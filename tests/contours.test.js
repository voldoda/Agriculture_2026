import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { generateHeadContours } from '../src/utils/contourGeneration.js';
import { selectContourLines, contourIntervalM, contoursSuppressed, loadMonthlyContours } from '../src/utils/headContours.js';
import { projectWgs84 } from '../src/utils/projection.js';
import { generateGeoJSON } from '../src/utils/geojsonExport.js';
import { generateDxf } from '../src/utils/dxfExport.js';

const quad = heads => heads.map((head, i) => ({ row: i >= 2 ? 1 : 0, col: i === 1 || i === 2 ? 1 : 0,
  x: i === 1 || i === 2 ? 50 : 0, y: i >= 2 ? 0 : 50, heads: { '01': head } }));
test('plane contours use exact cell centres and linear interpolation', () => {
  const result = generateHeadContours(quad([1, 11, 11, 1]), '01', 5);
  assert.deepEqual(result.lines.map(l => l.elevation), [5, 10]);
  for (const line of result.lines) for (const [x] of line.coordinates5179) {
    assert.ok(Math.abs(1 + x / 5 - line.elevation) < 1e-12);
  }
  assert.equal(result.statistics.maxInterpolationErrorM, 0);
});
test('NoData corner excludes a quad rather than connecting across missing heads', () => {
  assert.equal(generateHeadContours(quad([1, 11, 11, null]), '01').lines.length, 0);
  assert.equal(generateHeadContours(quad([1, 11, NaN, 1]), '01').lines.length, 0);
  assert.equal(generateHeadContours([], '01').lines.length, 0);
});
test('saddle topology follows bilinear asymptotic decider', () => {
  const segments = generateHeadContours(quad([9, 1, 6, 1]), '01', 5).lines;
  assert.equal(segments.length, 2);
  // Positive diagonal is disconnected: each isolated high corner has its own segment.
  assert.ok(segments.some(l => l.coordinates5179.some(p => p[0] === 0) && l.coordinates5179.some(p => p[1] === 50)));
  const connected = generateHeadContours(quad([9, 4, 9, 4]), '01', 5).lines;
  assert.ok(connected.some(l => l.coordinates5179.some(p => p[0] === 50) && l.coordinates5179.some(p => p[1] === 50)));
});
test('closed contours stitch once, with no exterior extension', () => {
  const grids = Array.from({ length: 9 }, (_, i) => ({ row: Math.floor(i / 3), col: i % 3,
    x: i % 3 * 50, y: (2 - Math.floor(i / 3)) * 50, heads: { '01': i === 4 ? 11 : 1 } }));
  const result = generateHeadContours(grids, '01', 5);
  assert.equal(result.statistics.validQuads, 4);
  assert.equal(result.lines.length, 2);
  for (const line of result.lines) {
    assert.deepEqual(line.coordinates5179[0], line.coordinates5179.at(-1));
    assert.equal(line.coordinates5179.length, 5);
  }
});
test('flat/equal-level samples do not produce zero-length or nonfinite contours', () => {
  assert.equal(generateHeadContours(quad([5, 5, 5, 5]), '01').lines.length, 0);
  for (const line of generateHeadContours(quad([5, 10, 10, 5]), '01').lines) {
    assert.ok(line.coordinates5179.every(p => p.every(Number.isFinite)));
    for (let i = 1; i < line.coordinates5179.length; i++) assert.notDeepEqual(line.coordinates5179[i], line.coordinates5179[i - 1]);
  }
});
test('automatic intervals and metric suppression preserve consistent meanings', () => {
  assert.equal(contourIntervalM({ contourInterval: 'auto' }, 13), 10);
  assert.equal(contourIntervalM({ contourInterval: 'auto' }, 14), 5);
  assert.equal(contourIntervalM({ contourInterval: '10' }, 17), 10);
  assert.equal(contourIntervalM({ contourInterval: '5' }, 10), 5);
  for (const gridMetric of ['deviation', 'change', 'range']) assert.equal(contoursSuppressed({ gridMetric }), true);
  assert.equal(contoursSuppressed({ gridMetric: 'head' }), false);
});
const manifest = JSON.parse(fs.readFileSync(new URL('../reports/contour-validation.json', import.meta.url)));
const files = Object.fromEntries(Object.entries(manifest.months).map(([month, entry]) => {
  const bytes = fs.readFileSync(new URL('../public' + entry.url, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  return [month, JSON.parse(bytes)];
}));
test('all twelve assets have matching provenance, valid levels and reversible coordinates', () => {
  assert.equal(Object.keys(files).length, 12);
  assert.equal(new Set(Object.values(manifest.months).map(m => m.sha256)).size, 12);
  for (const [month, geo] of Object.entries(files)) {
    assert.equal(geo.metadata.month, month);
    assert.equal(geo.metadata.year, 2025);
    assert.equal(geo.metadata.sourceDigest, manifest.sourceDigest);
    assert.equal(geo.metadata.statistics.validCells, 113076);
    assert.ok(geo.metadata.statistics.maxInterpolationErrorM < 1e-10);
    for (const feature of geo.features) {
      assert.equal(feature.properties.month, month);
      assert.equal(feature.properties.head_m % 5, 0);
      assert.ok(feature.properties.head_m >= geo.metadata.statistics.minHeadM && feature.properties.head_m <= geo.metadata.statistics.maxHeadM);
      assert.equal(feature.geometry.coordinates.length, feature.coordinates5179.length);
      for (const i of [0, Math.floor(feature.geometry.coordinates.length / 2), feature.geometry.coordinates.length - 1]) {
        const projected = projectWgs84(...feature.geometry.coordinates[i]);
        assert.ok(Math.hypot(projected[0] - feature.coordinates5179[i][0], projected[1] - feature.coordinates5179[i][1]) < 0.001);
      }
    }
  }
});
test('exports contain selected monthly model contours with exact 5179 coordinates', () => {
  for (const month of ['01', '12']) {
    const contourLines = selectContourLines(files[month], 10);
    assert.ok(contourLines.length > 0);
    assert.ok(contourLines.every(l => l.elevation % 10 === 0 && l.month === month));
    const dataset = { metadata: { bounds: { minLat: 36, maxLat: 37, minLon: 126, maxLon: 128 } }, grids: [] };
    const geo = generateGeoJSON(dataset, { selectedMonth: month, contourLines, contourIntervalM: 10 });
    assert.equal(geo.features.length, contourLines.length);
    assert.ok(geo.features.every(f => f.properties.source === 'derived_model_head' && f.properties.month === month));
    const dxf = generateDxf({ ...dataset, grids: [{ id: 'point', x: 950000, y: 1840000, lat: 36.56, lon: 126.99, heads: { [month]: 55 } }] }, { selectedMonth: month, contourLines, crs: 'EPSG:5179', includeGridMesh: false, includeHeadText: false });
    assert.ok(dxf.includes(contourLines[0].coordinates5179[0][0].toFixed(4)));
    assert.ok(dxf.includes('GW_CONTOUR'));
  }
});
test('loader rejects stale source versions and mismatched months', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => url.endsWith('manifest.json') ? manifest : files['01'] });
  try {
    const dataset = { grids: { length: 113076 }, metadata: { year: 2025,
      contours: { manifestUrl: '/test-manifest.json', sourceDigest: manifest.sourceDigest } } };
    assert.equal((await loadMonthlyContours(dataset, '01')).metadata.month, '01');
    await assert.rejects(loadMonthlyContours(dataset, '02'), /월·연도·출처/);
    globalThis.fetch = async () => ({ ok: true, json: async () => files['02'] });
    assert.equal((await loadMonthlyContours(dataset, '02')).metadata.month, '02');
    await assert.rejects(loadMonthlyContours({ ...dataset, metadata: { ...dataset.metadata,
      contours: { ...dataset.metadata.contours, sourceDigest: 'stale' } } }, '01'), /버전/);
  } finally { globalThis.fetch = originalFetch; }
});
