// Compare cached public DEM samples with the source SHP's undocumented Z ordinate.
// This investigation does not assign Z to ground elevation or change app data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'reports', name), 'utf8'));
const inputs = [
  ['z-review-dem-samples.json', 'z-review-srtm-response.json', 'z-review-aster-response.json'],
  ['z-review-dem-spatial-samples.json', 'z-review-srtm90m-spatial-response.json', 'z-review-aster30m-spatial-response.json'],
];
const requests = [];
const samples = inputs.flatMap(([cellsFile, srtmFile, asterFile], group) => {
  const cells = read(cellsFile), srtm = read(srtmFile), aster = read(asterFile);
  for (const [response, dataset] of [[srtm, 'srtm90m'], [aster, 'aster30m']]) {
    assert.equal(response.status, 'OK');
    assert.equal(response.results.length, cells.length);
    response.results.forEach((point, i) => {
      assert.equal(point.dataset, dataset);
      assert.ok(Number.isFinite(point.elevation));
      assert.ok(Math.abs(point.location.lat - cells[i].lat) <= 0.0000051);
      assert.ok(Math.abs(point.location.lng - cells[i].lon) <= 0.0000051);
    });
    requests.push({ dataset, url: response.url, retrievedAt: response.retrievedAt });
  }
  return cells.map((cell, i) => ({ ...cell, sampleType: group ? 'spatial_5x5' : 'z_quantile',
    srtm: srtm.results[i].elevation, aster: aster.results[i].elevation }));
});
assert.equal(samples.length, 37);
assert.equal(new Set(samples.map(cell => cell.id)).size, samples.length);
const mean = values => values.reduce((sum, v) => sum + v, 0) / values.length;
const median = values => {
  const a = [...values].sort((x, y) => x - y), mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
const stats = a => ({ min: Math.min(...a), median: median(a), mean: mean(a), max: Math.max(...a) });
const summarize = (cells, key) => {
  const z = cells.map(c => c.z), dem = cells.map(c => c[key]), diffs = cells.map(c => c[key] - c.z);
  const mz = mean(z), md = mean(dem);
  const covariance = mean(z.map((v, i) => (v - mz) * (dem[i] - md)));
  const vz = mean(z.map(v => (v - mz) ** 2)), vd = mean(dem.map(v => (v - md) ** 2));
  return { count: cells.length, demMinusZ: stats(diffs), mae: mean(diffs.map(Math.abs)),
    rmse: Math.sqrt(mean(diffs.map(v => v ** 2))), demAboveZ: diffs.filter(v => v > 0).length,
    within10m: diffs.filter(v => Math.abs(v) <= 10).length, correlation: covariance / Math.sqrt(vz * vd),
    exploratoryLinearFit: { slope: covariance / vz, intercept: md - covariance / vz * mz,
      suitableForGroundElevationConversion: false } };
};
const comparison = {
  createdAt: new Date().toISOString(), sourceShpSha256: read('source-elevation-review.json').sourceShpSha256,
  determination: 'Evidence against interpreting the raw Z ordinate as ground elevation in metres. Exact Z meaning remains unconfirmed.',
  sampling: '12 Z-quantile samples plus 25 nearest active cells to a 5x5 spatial target grid; purposive samples, not a random population estimate.',
  limitations: 'Public DEM resolution, acquisition dates, surface representation and unverified source vertical datum limit exact comparison. Coordinates queried at 5 decimal places with bilinear interpolation. API integer raster results are rounded to integer elevations.',
  requests,
  combined: { srtm: summarize(samples, 'srtm'), aster: summarize(samples, 'aster'),
    demAbsoluteDifference: stats(samples.map(c => Math.abs(c.srtm - c.aster))) },
  spatialOnly: { srtm: summarize(samples.slice(12), 'srtm'), aster: summarize(samples.slice(12), 'aster') },
  samples,
};
fs.writeFileSync(path.join(root, 'reports/z-dem-comparison.json'), JSON.stringify(comparison, null, 2));
console.log(JSON.stringify({ combined: comparison.combined, spatialOnly: comparison.spatialOnly }, null, 2));
