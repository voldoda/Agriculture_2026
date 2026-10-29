// Hypothetical sensitivity review using cached DEM samples; never writes app data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { calculateGridDrought } from '../src/utils/droughtUtils.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const bytes = fs.readFileSync(path.join(root, 'src/data/groundwater_data.json'));
const dataHash = createHash('sha256').update(bytes).digest('hex');
assert.equal(dataHash, read('reports/source-validation.json').datasetSha256);
const data = JSON.parse(bytes.toString('utf8'));
const comparison = read('reports/z-dem-comparison.json');
const srtm30 = read('reports/dem-review-srtm30m-response.json');
assert.equal(srtm30.status, 'OK');
assert.equal(srtm30.results.length, comparison.samples.length);
const grids = new Map(data.grids.map(grid => [grid.id, grid]));
const samples = comparison.samples.map((sample, i) => {
  const point = srtm30.results[i];
  assert.equal(point.dataset, 'srtm30m');
  assert.ok(Number.isFinite(point.elevation));
  assert.ok(Math.abs(point.location.lat - sample.lat) < 0.0000051);
  assert.ok(Math.abs(point.location.lng - sample.lon) < 0.0000051);
  const grid = grids.get(sample.id);
  assert.ok(grid);
  return { ...sample, srtm30: point.elevation, grid };
});
const mean = values => values.reduce((sum, v) => sum + v, 0) / values.length;
const summary = values => ({ min: Math.min(...values), max: Math.max(...values),
  meanAbsolute: mean(values.map(Math.abs)) });
const sources = ['srtm', 'aster', 'srtm30'];
const allMonths = Object.fromEntries(sources.map(source => [source, data.metadata.sourceMonths.map(month => {
  const stages = {}, rawDepths = [];
  let negativeDepthCount = 0, depthAtLeast14 = 0, differentStagesFromAster = 0;
  for (const sample of samples) {
    const rawDepth = sample[source] - sample.grid.heads[month];
    rawDepths.push(rawDepth);
    if (rawDepth < 0) negativeDepthCount++;
    if (rawDepth >= 14) depthAtLeast14++;
    const info = calculateGridDrought({ ...sample.grid, surfaceEl: sample[source] }, month);
    const asterInfo = calculateGridDrought({ ...sample.grid, surfaceEl: sample.aster }, month);
    stages[info.stage] = (stages[info.stage] || 0) + 1;
    if (info.stage !== asterInfo.stage) differentStagesFromAster++;
  }
  return { month, stages, rawDepthMin: Math.min(...rawDepths), rawDepthMax: Math.max(...rawDepths),
    negativeDepthCount, depthAtLeast14, differentStagesFromAster };
})]));
const report = {
  createdAt: new Date().toISOString(), hypothetical: true, notApplied: true,
  assumptions: 'DEM and model HEAD assumed to share metre units and a vertical reference solely for sensitivity review; actual datum agreement and water-table interpretation are unconfirmed.',
  sampleCount: samples.length, sampling: comparison.sampling,
  limitations: 'Purposive sample statistics do not estimate region-wide counts. Agreement between two DEMs is not independent ground-truth accuracy. Drought stages are the existing unvalidated demonstration formula, including its 0.5m depth clamp.',
  datasetSha256: dataHash, datasetUnchangedSinceSourceValidation: true,
  additionalDemRequest: { url: srtm30.url, retrievedAt: srtm30.retrievedAt },
  comparisons: {
    srtm30Minus90: summary(samples.map(s => s.srtm30 - s.srtm)),
    srtm30MinusAster: summary(samples.map(s => s.srtm30 - s.aster)),
  },
  allMonths,
  samples: samples.map(s => ({ id: s.id, row: s.row, col: s.col, lat: s.lat, lon: s.lon,
    srtm90: s.srtm, srtm30: s.srtm30, aster: s.aster, currentSurface: s.grid.surfaceEl,
    headMay: s.grid.heads['05'], rawDepthSrtm30May: s.srtm30 - s.grid.heads['05'],
    rawDepthSrtm90May: s.srtm - s.grid.heads['05'], rawDepthAsterMay: s.aster - s.grid.heads['05'] })),
};
fs.writeFileSync(path.join(root, 'reports/dem-surface-impact-review.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ sampleCount: report.sampleCount, comparisons: report.comparisons,
  may: Object.fromEntries(sources.map(s => [s, allMonths[s].find(m => m.month === '05')])) }, null, 2));
