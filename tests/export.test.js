import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { projectWgs84, projectGridPolygon } from '../src/utils/projection.js';
import { calculateGridDrought } from '../src/utils/droughtUtils.js';
import { generateShapefileZip } from '../src/utils/shapefileExport.js';
import { generateGeoJSON } from '../src/utils/geojsonExport.js';
import { generateDxf } from '../src/utils/dxfExport.js';
import { buildChartData } from '../src/utils/chartData.js';
import { indexGridBounds, gridsInBounds, gridAtPoint } from '../src/utils/gridViewport.js';

const data = JSON.parse(fs.readFileSync(new URL('../src/data/groundwater_data.json', import.meta.url)));
const grid = data.grids.find(g => Number.isFinite(g.surfaceEl));
const sample = { ...data, grids: [grid] };
const close = (a, b, tolerance = 0.15) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

async function unzip(options) {
  const result = await generateShapefileZip(sample, options);
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const read = async extension => {
    const bytes = await zip.file(Object.keys(zip.files).find(n => n.endsWith(extension))).async('uint8array');
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  };
  return { zip, shp: await read('.shp'), shx: await read('.shx'), dbf: await read('.dbf') };
}

function readDbf(view) {
  const decoder = new TextDecoder();
  const text = (offset, count) => decoder.decode(new Uint8Array(view.buffer, view.byteOffset + offset, count)).replace(/\0/g, '').trim();
  let recordOffset = view.getUint16(8, true) + 1;
  const record = {};
  for (let fieldOffset = 32; view.getUint8(fieldOffset) !== 13; fieldOffset += 32) {
    const name = text(fieldOffset, 11);
    const length = view.getUint8(fieldOffset + 16);
    const value = text(recordOffset, length);
    record[name] = text(fieldOffset + 11, 1) === 'N' ? (value === '' ? null : +value) : value;
    recordOffset += length;
  }
  return record;
}

test('projection origins and source control points', () => {
  assert.deepEqual(projectWgs84(127, 38, 'EPSG:5186'), [200000, 600000]);
  assert.deepEqual(projectWgs84(127.5, 38, 'EPSG:5179'), [1000000, 2000000]);
  for (const g of data.grids.filter((_, i) => i % 500 === 0)) {
    const [x, y] = projectWgs84(g.lon, g.lat, 'EPSG:5179');
    close(x, g.x); close(y, g.y);
  }
  assert.throws(() => projectWgs84(127, 37, 'EPSG:9999'));
});

test('SHP 5186 transforms coordinates and matches its PRJ', async () => {
  const { zip, shp } = await unzip({ crs: 'EPSG:5186' });
  const [x, y] = projectWgs84(grid.lon, grid.lat, 'EPSG:5186');
  close(shp.getFloat64(112, true), x, 1e-6);
  close(shp.getFloat64(120, true), y, 1e-6);
  assert.ok(Math.abs(x - grid.x) > 700000);
  assert.match(await zip.file(Object.keys(zip.files).find(n => n.endsWith('.prj'))).async('text'), /Central_Belt_2010/);
});

test('polygon SHP preserves displayed footprint in every CRS, closed rings and binary sizes', async () => {
  for (const crs of ['EPSG:4326', 'EPSG:5179', 'EPSG:5186']) {
    const { shp, shx } = await unzip({ crs, geomType: 'polygon' });
    assert.equal(shp.byteLength, shp.getInt32(24, false) * 2);
    assert.equal(shx.getInt32(100, false) * 2, 100);
    assert.equal(shp.getInt32(148, true), 5);
    const ring = projectGridPolygon(grid, crs);
    ring.forEach(([x, y], i) => {
      close(shp.getFloat64(156 + i * 16, true), x, 1e-8);
      close(shp.getFloat64(164 + i * 16, true), y, 1e-8);
    });
    if (crs === 'EPSG:5179') close(Math.hypot(ring[1][0] - ring[0][0], ring[1][1] - ring[0][1]), data.metadata.displayCellSizeM, 0.001);
  }
});

test('SHP and GeoJSON match displayed monthly analysis, not stale saved values', async () => {
  for (const month of ['01', '05', '08', '12']) {
    const info = calculateGridDrought(grid, month);
    const { dbf, zip } = await unzip({ selectedMonth: month, range: 'all' });
    const record = readDbf(dbf);
    const geo = generateGeoJSON(sample, { selectedMonth: month, range: 'all', crs: 'EPSG:5179' });
    assert.equal(record.HEAD, info.head);
    assert.equal(record.DROUGHT, info.score);
    assert.equal(record.STORAGE, info.storageM3);
    assert.equal(record.STORE_PCT, info.storageRate);
    assert.equal(record.STAGE, info.stageEn);
    assert.equal(geo.features[0].properties.storage_m3, info.storageM3);
    assert.equal(geo.features[0].properties.drought_stage, info.stageLabel);
    assert.equal(geo.features[0].properties.head_decline_index, info.score);
    assert.equal(record.DECL_IDX, info.score);
    assert.equal(record.DEPTH, null);
    close(record.DEPTH_REF, grid.surfaceEl - grid.heads[month], 0.006);
    assert.equal(record.SURF_SRC, 'srtm_gl1');
    assert.equal(geo.features[0].properties.depth_reference_m, grid.surfaceEl - grid.heads[month]);
    assert.equal(geo.features[0].properties.drought_index, info.score);
    assert.equal(geo.crs, undefined);
    assert.deepEqual(geo.features[0].geometry.coordinates, [grid.lon, grid.lat]);
    assert.equal(record.H_09, grid.heads['09']);
    assert.equal(record.YEAR, 2025);
    assert.equal(geo.metadata.year, 2025);
    assert.equal(geo.metadata.temporalBasis, 'month_end');
    assert.equal(geo.features[0].properties.year, 2025);
    for (let n = 1; n <= 12; n++) {
      const m = String(n).padStart(2, '0');
      assert.equal(record['H_' + m], grid.heads[m]);
      assert.equal(geo.features[0].properties.heads[m], grid.heads[m]);
    }
    const chart = buildChartData(grid, data.metadata);
    assert.ok(chart.every(row => row.source === 'model_sample' && row.fullMonthName.startsWith('2025년')));
    assert.equal(geo.features[0].properties.heads['09'], grid.heads['09']);
    assert.equal(JSON.parse(await zip.file('metadata.json').async('text')).analysisStatus, 'unvalidated_example');
  }
});

test('DXF uses the same projected ring and selected head', () => {
  const text = generateDxf(sample, { crs: 'EPSG:5186', selectedMonth: '08', includeContours: false, includeDrainagePolygons: false, includeWells: false });
  const lines = text.split('\n');
  assert.match(text, /year: 2025; temporal basis: month_end/);
  const entities = [];
  for (let i = 0; i < lines.length; i += 2) if (lines[i].trim() === '0' && lines[i + 1] === 'LINE') {
    const entity = {};
    for (let j = i + 2; j < lines.length && lines[j].trim() !== '0'; j += 2) entity[lines[j].trim()] = lines[j + 1];
    entities.push(entity);
  }
  assert.equal(entities.length, 4);
  const [x, y] = projectGridPolygon(grid, 'EPSG:5186')[0];
  close(+entities[0]['10'], x); close(+entities[0]['20'], y);
  assert.equal(+entities[0]['30'], grid.heads['08']);
});

test('missing months are not fabricated in analysis, charts or exports', async () => {
  const missing = { ...grid, heads: { '05': 10 } };
  assert.equal(calculateGridDrought(missing, '06'), null);
  assert.equal(buildChartData(missing)[5].head, null);
  assert.equal(generateGeoJSON({ grids: [missing] }, { selectedMonth: '06' }).features[0].properties.storage_m3, null);
  const result = await generateShapefileZip({ grids: [missing] }, { selectedMonth: '06' });
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const bytes = await zip.file(Object.keys(zip.files).find(n => n.endsWith('.dbf'))).async('uint8array');
  assert.equal(readDbf(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)).HEAD, null);
});

test('viewport includes edge intersections and excludes distant cells', () => {
  const index = indexGridBounds([grid, { id: 'far', lat: 0, lon: 0 }]);
  const [lat, lon] = grid.polygon[0];
  assert.deepEqual(gridsInBounds(index, { north: lat + 0.00001, south: lat - 0.00001, west: lon - 0.00001, east: lon + 0.00001 }).map(g => g.id), [grid.id]);
});

test('50m full coverage preserves NoData analysis and real monthly heads in exports', async () => {
  assert.equal(data.grids.length, 113076);
  assert.equal(new Set(data.grids.map(g => g.id)).size, 113076);
  assert.equal(data.grids.filter(g => Number.isFinite(g.surfaceEl)).length, 113076);
  assert.equal(data.grids.filter(g => Number.isFinite(g.legacySurfaceEl)).length, 28269);
  const missing = { ...data.grids[0], surfaceEl: null };
  assert.ok(calculateGridDrought(missing, '01'), 'Head decline remains available without a DEM');
  const minimal = { metadata: data.metadata, grids: [missing] };
  const geo = generateGeoJSON(minimal, { selectedMonth: '01' });
  assert.equal(geo.features[0].properties.head_m, missing.heads['01']);
  assert.equal(geo.features[0].properties.surface_el, null);
  assert.equal(geo.features[0].properties.depth_m, null);
  assert.equal(geo.features[0].properties.storage_m3, null);
  const result = await generateShapefileZip(minimal, { selectedMonth: '01', geomType: 'polygon' });
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const bytes = await zip.file(Object.keys(zip.files).find(n => n.endsWith('.dbf'))).async('uint8array');
  const row = readDbf(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  assert.equal(row.HEAD, missing.heads['01']);
  for (const field of ['SURF_EL', 'DEPTH', 'DEPTH_REF', 'STORAGE']) assert.equal(row[field], null);
  assert.equal(row.DEPTH_Q, 'missing_surface');
  assert.equal(row.DECL_IDX, calculateGridDrought(missing, '01').score);
});

test('spatial buckets return exactly intersecting cells without duplicates', () => {
  const index = indexGridBounds(data.grids);
  for (const g of data.grids.filter((_, i) => i % 10000 === 0)) {
    assert.equal(gridAtPoint(index, g.lat, g.lon)?.id, g.id);
    const b = { north: g.lat + 0.004, south: g.lat - 0.004, west: g.lon - 0.004, east: g.lon + 0.004 };
    const found = gridsInBounds(index, b).map(x => x.id).sort();
    const expected = index.entries.filter(x => x.north >= b.south && x.south <= b.north && x.east >= b.west && x.west <= b.east).map(x => x.grid.id).sort();
    assert.deepEqual(found, expected);
    assert.equal(new Set(found).size, found.length);
  }
  assert.equal(gridAtPoint(index, 0, 0), undefined);
});

test('source decimal digits survive SHP, GeoJSON and DXF without float64 reformatting', async () => {
  const exact = '108.123456789012345';
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const precise = { ...grid, heads: Object.fromEntries(months.map(m => [m, Number(exact)])),
    headsExact: Object.fromEntries(months.map(m => [m, exact])) };
  const dataset = { ...sample, grids: [precise] };
  const result = await generateShapefileZip(dataset, { selectedMonth: '01', range: 'all' });
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const buf = await zip.file(Object.keys(zip.files).find(n => n.endsWith('.dbf'))).async('nodebuffer');
  let offset = buf.readUInt16LE(8) + 1, checked = 0;
  for (let f = 32; buf[f] !== 13; f += 32) {
    const name = buf.toString('ascii', f, f + 11).replace(/\0/g, '');
    const width = buf[f + 16];
    if (name === 'HEAD' || /^H_\d\d$/.test(name)) {
      assert.equal(width, 24);
      assert.equal(buf[f + 17], 15);
      assert.equal(buf.toString('ascii', offset, offset + width).trim(), exact);
      checked++;
    }
    offset += width;
  }
  assert.equal(checked, 13);
  const geo = JSON.parse(JSON.stringify(generateGeoJSON(dataset, { selectedMonth: '01', range: 'all' })));
  assert.equal(geo.features[0].properties.head_m_exact, exact);
  for (const m of months) assert.equal(geo.features[0].properties.heads_exact[m], exact);
  const dxf = generateDxf(dataset, { selectedMonth: '01', includeContours: false, includeDrainagePolygons: false, includeWells: false });
  const lines = dxf.split('\n').map(line => line.trim());
  assert.ok(lines.some((line, i) => i % 2 === 0 && line === '30' && lines[i + 1] === exact));
  assert.ok(lines.some((line, i) => i % 2 === 0 && line === '31' && lines[i + 1] === exact));
  assert.equal(buildChartData(precise, dataset.metadata)[0].head, Number(exact));
  const missing = { ...precise, heads: {} };
  assert.equal(generateGeoJSON({ grids: [missing] }, { selectedMonth: '01' }).features[0].properties.head_m_exact, null);
});
