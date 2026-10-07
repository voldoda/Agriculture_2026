import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readDbf, readShpPoints, recognizePrj } from './validation/sourceFiles.js';
import { unproject5179, projectWgs84 } from '../src/utils/projection.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceDir = process.env.GROUNDWATER_SOURCE_DIR || path.join(root, 'source-data/heads2025');
const base = path.join(sourceDir, 'Heads_2025_Monthly_5179');
const target = path.join(root, 'src/data/groundwater_data.json');
const before = fs.readFileSync(target);
const data = JSON.parse(before);
const checkOnly = process.argv.includes('--check');
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHashes = Object.fromEntries(['shp', 'shx', 'dbf', 'prj', 'cpg'].map(ext => [ext, hash(fs.readFileSync(`${base}.${ext}`))]));
assert.equal(recognizePrj(fs.readFileSync(`${base}.prj`, 'utf8')), 'EPSG:5179');
const dbf = readDbf(`${base}.dbf`, { includeRaw: true });
const points = readShpPoints(`${base}.shp`);
for (const m of months) {
  const field = dbf.fields.find(f => f.name === `H_25${m}`);
  assert.ok(field && field.length === 24 && field.decimals === 15, 'Unexpected source precision');
}
const firstRows = dbf.records();
const first = firstRows.next().value, second = firstRows.next().value;
const cellSize = second.X - first.X;
assert.ok(cellSize > 49 && cellSize < 51, 'Unexpected model cell size');
let nextRow; for (const r of dbf.records()) { if (r.ROW !== first.ROW) { nextRow = r; break; } }
const cellHeight = (first.Y - nextRow.Y) / (nextRow.ROW - first.ROW);
assert.ok(cellHeight > 49 && cellHeight < 51);
const generated = [];
assert.equal(points.length, dbf.count);
for (const field of ['LAYER', 'ROW', 'COLUMN', 'X', 'Y', ...months.map(m => `H_25${m}`)]) {
  assert.ok(dbf.fields.some(f => f.name === field), `Missing field: ${field}`);
}
const lookup = new Map(data.grids.map(g => [`${g.row}:${g.col}`, g]));
assert.equal(lookup.size, data.grids.length, 'Duplicate app locations');
const seen = new Set();
const matched = new Set();
const stats = months.map(month => ({ month, active: 0, missing: 0, min: Infinity, max: -Infinity, compared: 0, mismatches: 0, maxDifference: 0 }));
let active = 0;
for (const r of dbf.records()) {
  assert.equal(r.deleted, false, 'Deleted source row');
  assert.equal(r.LAYER, 1, 'Unexpected layer');
  const key = `${r.ROW}:${r.COLUMN}`;
  assert.ok(!seen.has(key), `Duplicate source cell: ${key}`);
  seen.add(key);
  const p = points[r.index];
  assert.ok(p && Math.hypot(p[0] - r.X, p[1] - r.Y) < 0.001, 'SHP/DBF coordinate mismatch');
  const hasData = months.some(m => Number.isFinite(r[`H_25${m}`]) && Math.abs(r[`H_25${m}`]) < 1e29);
  assert.ok(Math.abs(r.X - (first.X + (r.COLUMN - first.COLUMN) * cellSize)) < 0.001, 'Nonuniform column spacing');
  assert.ok(Math.abs(r.Y - (first.Y - (r.ROW - first.ROW) * cellHeight)) < 0.001, 'Nonuniform row spacing');
  let g = lookup.get(key);
  if (hasData && !checkOnly) {
    const [lat, lon] = unproject5179(r.X, r.Y);
    const h = cellSize / 2, v = cellHeight / 2;
    g = { id: `YG-R${r.ROW}_C${r.COLUMN}`, row: r.ROW, col: r.COLUMN,
      x: r.X, y: r.Y, lat, lon,
      polygon: [[-h, v], [h, v], [h, -v], [-h, -v]].map(([dx, dy]) => unproject5179(r.X + dx, r.Y + dy)),
      surfaceEl: Number.isFinite(g?.surfaceEl) ? g.surfaceEl : null,
      legacySurfaceEl: g?.legacySurfaceEl ?? null,
      surfaceSource: g?.surfaceSource ?? null,
      surfaceDatumConfirmed: g?.surfaceDatumConfirmed === true,
      waterTableInterpretationConfirmed: g?.waterTableInterpretationConfirmed === true,
      soilType: g?.soilType ?? null, heads: {}, headsExact: {},
    };
    generated.push(g);
  }
  if (checkOnly) assert.equal(!!g, hasData, `Coverage mismatch: ${key}`);
  if (g) {
    matched.add(key);
    assert.ok(Math.hypot(g.x - r.X, g.y - r.Y) < 0.1, `App coordinate mismatch: ${key}`);
    if (checkOnly) {
      const center = projectWgs84(g.lon, g.lat);
      assert.ok(Math.hypot(center[0] - r.X, center[1] - r.Y) < 0.001, `Center mismatch: ${key}`);
      const h = cellSize / 2, v = cellHeight / 2;
      [[-h, v], [h, v], [h, -v], [-h, -v]].forEach(([dx, dy], i) => {
        const corner = projectWgs84(g.polygon[i][1], g.polygon[i][0]);
        assert.ok(Math.hypot(corner[0] - r.X - dx, corner[1] - r.Y - dy) < 0.001, `Corner mismatch: ${key}`);
      });
    }
  }
  let validCount = 0;
  months.forEach((m, i) => {
    const value = r[`H_25${m}`];
    const valid = Number.isFinite(value) && Math.abs(value) < 1e29;
    const s = stats[i];
    if (valid) { validCount++; s.active++; s.min = Math.min(s.min, value); s.max = Math.max(s.max, value); }
    else s.missing++;
    if (!g) return;
    // Numeric values drive calculations; source decimal text preserves every DBF digit.
    const expected = valid ? value : null;
    const exact = valid ? r.raw[`H_25${m}`] : null;
    if (checkOnly) {
      s.compared++;
      if (g.heads[m] !== expected || g.headsExact?.[m] !== exact) s.mismatches++;
      if (valid && Number.isFinite(g.heads[m])) s.maxDifference = Math.max(s.maxDifference, Math.abs(g.heads[m] - value));
    } else { g.heads[m] = expected; g.headsExact[m] = exact; }
  });
  if (validCount) active++;
}
if (checkOnly) assert.equal(matched.size, data.grids.length, 'Missing displayed cells');
assert.ok(stats.every(s => s.active === 113076), 'Unexpected source coverage');
if (!checkOnly) {
  const backupDir = path.join(root, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, 'groundwater-2025-before-full-precision.json');
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, before, { flag: 'wx' });
  data.grids = generated;
  delete data.contourLines;
  delete data.metadata.contours; // Regenerate derived contours after every source import.
  const bounds = generated.reduce((b, g) => ({ minLat: Math.min(b.minLat, ...g.polygon.map(p => p[0])), maxLat: Math.max(b.maxLat, ...g.polygon.map(p => p[0])), minLon: Math.min(b.minLon, ...g.polygon.map(p => p[1])), maxLon: Math.max(b.maxLon, ...g.polygon.map(p => p[1])) }), { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity });
  bounds.center = [(bounds.minLat + bounds.maxLat) / 2, (bounds.minLon + bounds.maxLon) / 2];
  Object.assign(data.metadata, {
    year: 2025, modelEngine: 'USGS MODFLOW 6', sourceMonths: months,
    temporalBasis: 'month_end', sourceName: 'Heads_2025_Monthly_5179',
    sourceHashes, headPrecision: 'source_decimal_preserved',
    headFieldWidth: 24, headDecimalPlaces: 15, calculationPrecision: 'float64', crs: 'EPSG:5179',
    totalCells: dbf.count, activeCells: active,
    sampledNodes: generated.length, samplingStep: 1, bounds,
    sourceCellHeightM: cellHeight, displayCellHeightM: cellHeight, sourceCellSizeM: cellSize, displayCellSizeM: cellSize, gridSize: '약 50m × 50m',
    auxiliaryDataStatus: data.metadata.surfaceElevation ? 'reference_dem_with_example_context' : 'synthetic_example', analysisStatus: 'unvalidated_example',
  });
  delete data.metadata.calibratedMonths;
  delete data.metadata.sourcePrecisionM;
  // Old fixed alerts describe the replaced dataset, so they must not masquerade as 2025 results.
  data.anomalies = [];
  for (const g of data.grids) {
    for (const key of ['vulnScore', 'deltaSeason', 'droughtIndex', 'droughtStage', 'storageM3', 'storageRate']) delete g[key];
  }
  fs.writeFileSync(target, JSON.stringify(data));
  console.log(`Imported ${data.grids.length} displayed cells × 12 months. Backup: ${backup}. Run npm run generate:contours next.`);
} else {
  assert.equal(data.metadata.year, 2025);
  assert.equal(data.grids.length, active);
  assert.equal(data.metadata.samplingStep, 1);
  assert.equal(data.metadata.headPrecision, 'source_decimal_preserved');
  assert.deepEqual(data.metadata.sourceMonths, months);
  assert.deepEqual(data.metadata.sourceHashes, sourceHashes, 'Source files changed since import');
  const report = {
    generatedAt: new Date().toISOString(), year: 2025, sourceName: data.metadata.sourceName,
    datasetSha256: hash(before), sourceHashes, crs: 'EPSG:5179',
    records: dbf.count, displayedCells: data.grids.length, months: stats,
    cellSizeM: cellSize, cellHeightM: cellHeight, geometryChecked: true,
    headPrecision: data.metadata.headPrecision, sourceDecimalTextChecked: true,
    sourceDataMatches: stats.every(s => s.mismatches === 0),
    operationalReady: false, status: 'source_checked_model_unvalidated',
    blockers: [
      { code: 'NO_OBSERVATIONS', message: '동일 지점·기간의 실측 자료와 대조하지 않았습니다.' },
      { code: 'NO_SOLVER_EVIDENCE', message: '모델 수렴·물수지 및 입력 조건 검증이 필요합니다.' },
      { code: 'UNVALIDATED_DROUGHT_STORAGE', message: '지표고는 공개 DEM 참고값이며 수위와 높이 기준·수면 해석이 미확인입니다. 수위 저하 지수는 공식 가뭄 판정이 아니며 저류량은 산정 자료 없음입니다. 관측정·관리구역은 예시입니다.' },
    ],
  };
  for (const folder of ['reports', 'public/validation']) fs.mkdirSync(path.join(root, folder), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports/source-validation.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'public/validation/status.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'reports/source-validation.md'), `# 2025년 월말 지하수위 원본 대조\n\n${report.generatedAt}\n\n표시 격자 ${data.grids.length}개 × 12개월 대조. 좌표계 EPSG:5179. 수위는 반올림 없이 계산에 사용하며 원본 십진 문자열까지 전수 대조. 현장·물리모형 검증은 미완료입니다.\n\n| 월 | 유효 원본 | 결측 원본 | 앱 대조 | 불일치 |\n|---|---:|---:|---:|---:|\n${stats.map(s => `| ${s.month} | ${s.active} | ${s.missing} | ${s.compared} | ${s.mismatches} |`).join('\n')}\n\n${report.blockers.map(b => `- ${b.message}`).join('\n')}\n`);
  console.log(JSON.stringify({ sourceDataMatches: report.sourceDataMatches, comparedValues: stats.reduce((n, s) => n + s.compared, 0), maxDifferenceM: Math.max(...stats.map(s => s.maxDifference)), operationalReady: false }));
  assert.ok(report.sourceDataMatches, 'Imported values do not match source');
}
