import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { generateHeadContours } from '../src/utils/contourGeneration.js';
import { unproject5179 } from '../src/utils/projection.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'src/data/groundwater_data.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
const folder = path.join(root, 'public/contours');
fs.mkdirSync(folder, { recursive: true });
const sourceDigest = createHash('sha256').update(JSON.stringify(data.grids.map(g =>
  [g.row, g.col, g.x, g.y, g.heads]))).digest('hex');
const manifest = { year: data.metadata.year, sourceName: data.metadata.sourceName,
  sourceHashes: data.metadata.sourceHashes, sourceDigest, sourceCells: data.grids.length,
  temporalBasis: 'month_end', source: 'derived_model_head', generationCrs: 'EPSG:5179',
  intervalM: 5, method: 'marching_squares_linear_edges_asymptotic_decider',
  nodataPolicy: 'skip_quad_if_any_corner_missing', smoothing: false, months: {} };
for (const month of data.metadata.sourceMonths) {
  const { lines, statistics } = generateHeadContours(data.grids, month);
  const features = lines.map((line, i) => ({ type: 'Feature', id: `${month}-${i}`,
    geometry: { type: 'LineString', coordinates: line.coordinates5179.map(([x, y]) => {
      const [lat, lon] = unproject5179(x, y);
      return [lon, lat];
    }) }, properties: { layer: 'GW_HEAD_CONTOUR', head_m: line.elevation,
      year: data.metadata.year, month, source: 'derived_model_head', interval_m: 5 },
    coordinates5179: line.coordinates5179 }));
  const geo = { type: 'FeatureCollection', metadata: { ...manifest, months: undefined, month, statistics }, features };
  const content = JSON.stringify(geo);
  const digest = createHash('sha256').update(content).digest('hex');
  const file = `${data.metadata.year}-${month}-${digest.slice(0, 16)}.geojson`;
  fs.writeFileSync(path.join(folder, file), content);
  manifest.months[month] = { url: `/contours/${file}`, sha256: digest, lineCount: lines.length, ...statistics };
  console.log(`${month}: ${lines.length} lines, ${statistics.segmentCount} segments, residual ${statistics.maxInterpolationErrorM}m`);
}
const manifestContent = JSON.stringify(manifest, null, 2);
const manifestId = createHash('sha256').update(manifestContent).digest('hex').slice(0, 16);
const manifestUrl = `/contours/${data.metadata.year}-${manifestId}-manifest.json`;
fs.writeFileSync(path.join(root, 'public', manifestUrl), manifestContent);
data.metadata.contours = { manifestUrl, sourceDigest, source: 'derived_model_head', intervalM: 5 };
// Remove the stale synthetic lines so no map/export path can reuse them.
delete data.contourLines;
fs.writeFileSync(target, JSON.stringify(data));
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/contour-validation.json'), manifestContent);
console.log(`Saved ${manifestUrl}`);
