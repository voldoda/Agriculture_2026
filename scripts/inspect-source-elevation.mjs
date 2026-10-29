// Inspect PointZ without assigning its undocumented Z ordinate to surfaceEl.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readDbf } from './validation/sourceFiles.js';
import { calculateGridDrought } from '../src/utils/droughtUtils.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceDir = process.env.GROUNDWATER_SOURCE_DIR || path.join(root, 'source-data/heads2025');
const base = path.join(sourceDir, 'Heads_2025_Monthly_5179');
const bytes = fs.readFileSync(base + '.shp');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/groundwater_data.json'), 'utf8'));
assert.equal(createHash('sha256').update(bytes).digest('hex'), data.metadata.sourceHashes.shp);
assert.equal(bytes.readInt32LE(32), 11, 'Expected PointZ');
const points = [];
for (let offset = 100; offset < bytes.length;) {
  const length = bytes.readInt32BE(offset + 4) * 2, start = offset + 8;
  assert.ok(length >= 28 && start + length <= bytes.length, 'Invalid PointZ record');
  assert.equal(bytes.readInt32LE(start), 11);
  points.push({ x: bytes.readDoubleLE(start + 4), y: bytes.readDoubleLE(start + 12), z: bytes.readDoubleLE(start + 20) });
  offset = start + length;
}
const dbf = readDbf(base + '.dbf');
assert.equal(points.length, dbf.count);
const grids = new Map(data.grids.map(g => [`${g.row}:${g.col}`, g]));
const candidates = [];
for (const row of dbf.records()) {
  const point = points[row.index];
  assert.ok(Math.hypot(point.x - row.X, point.y - row.Y) < 0.001);
  const grid = grids.get(`${row.ROW}:${row.COLUMN}`);
  if (grid) {
    assert.ok(Math.hypot(point.x - grid.x, point.y - grid.y) < 0.001);
    assert.ok(Number.isFinite(point.z) && Math.abs(point.z) < 1e29);
    candidates.push({ ...grid, surfaceEl: point.z });
  }
}
assert.equal(candidates.length, data.grids.length);
const sourceZ = candidates.map(g => g.surfaceEl).sort((a, b) => a - b);
const hypothetical = data.metadata.sourceMonths.map(month => {
  const stages = { '정상': 0, '관심': 0, '주의': 0, '심각': 0, missing: 0 };
  let minRawDepthM = Infinity, maxRawDepthM = -Infinity, headAboveZCells = 0;
  for (const grid of candidates) {
    const rawDepth = grid.surfaceEl - grid.heads[month];
    minRawDepthM = Math.min(minRawDepthM, rawDepth);
    maxRawDepthM = Math.max(maxRawDepthM, rawDepth);
    if (rawDepth < 0) headAboveZCells++;
    const analysis = calculateGridDrought(grid, month);
    if (analysis) stages[analysis.stage]++; else stages.missing++;
  }
  return { month, minRawDepthM, maxRawDepthM, headAboveZCells, stages };
});
const report = {
  year: data.metadata.year, sourceName: data.metadata.sourceName,
  sourceShpSha256: data.metadata.sourceHashes.shp, shapeType: 'PointZ',
  totalSourcePoints: points.length, matchedAppCells: candidates.length,
  zMin: sourceZ[0], zMedian: sourceZ[Math.floor(sourceZ.length / 2)], zMax: sourceZ.at(-1),
  zUnit: 'unconfirmed', verticalDatum: 'unconfirmed',
  groundElevationMeaningConfirmed: false,
  status: 'z_semantics_require_provider_confirmation',
  note: 'Z is an undocumented vertical ordinate. It is not assigned to surfaceEl. The following drought results are a hypothetical diagnostic only, assuming Z is ground elevation in m with the same vertical datum as head.',
  hypotheticalIfZIsGroundElevation: hypothetical,
};
fs.writeFileSync(path.join(root, 'reports/source-elevation-review.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, hypotheticalIfZIsGroundElevation: hypothetical.filter(s => ['01', '05', '12'].includes(s.month)) }, null, 2));
