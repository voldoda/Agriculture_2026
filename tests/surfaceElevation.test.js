import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceComparison } from '../src/utils/surfaceElevation.js';
import { calculateGridDrought } from '../src/utils/droughtUtils.js';
import { readHgt } from '../scripts/validation/hgt.js';

const grid = (drop = 0, surfaceEl = 100) => ({ surfaceEl,
  heads: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, '0'), i ? 100 : 100 - drop])) });

test('terrain height and missing DEM do not weight the head-decline stage', () => {
  const low = calculateGridDrought(grid(2, 101), '01');
  for (const terrain of [null, 50, 700]) {
    const result = calculateGridDrought(grid(2, terrain), '01');
    assert.equal(result.score, low.score);
    assert.equal(result.stageLabel, '저하 보통');
    assert.equal(result.drawdownM, 2);
    assert.equal(result.storageM3, null);
    assert.equal(result.storageRate, null);
  }
});

test('reference difference preserves negative and sub-0.5m values', () => {
  const negative = surfaceComparison(grid(0, 90), '01');
  assert.equal(negative.rawDifferenceM, -10);
  assert.equal(negative.depthM, null);
  assert.equal(negative.status, 'head_above_surface');
  const shallow = surfaceComparison(grid(0, 100.2), '01');
  assert.ok(Math.abs(shallow.rawDifferenceM - 0.2) < 1e-12);
  assert.equal(shallow.depthM, null);
  assert.equal(shallow.status, 'unconfirmed_vertical_reference');
});

test('validated water-table depth requires both vertical and water-table confirmation', () => {
  const g = { ...grid(0, 110), surfaceDatumConfirmed: true };
  assert.equal(surfaceComparison(g, '01').depthM, null);
  assert.equal(surfaceComparison({ ...g, waterTableInterpretationConfirmed: true }, '01').depthM, 10);
});

test('decline bins classify unrounded index and complete-year absence is not imputed', () => {
  for (const [drop, level] of [[0,0], [1.7499,0], [1.75,1], [2.7499,1], [2.75,2], [3.7499,2], [3.75,3]]) {
    assert.equal(calculateGridDrought(grid(drop),'01').level,level);
  }
  const missing = grid(2); delete missing.heads['12'];
  assert.equal(calculateGridDrought(missing, '01'), null);
  assert.equal(surfaceComparison({surfaceEl:100},'01').status, 'missing_head');
});

test('HGT bilinear interpolation handles north/south orientation, borders and NoData', () => {
  const bytes = Buffer.alloc(8);
  [10,20,30,40].forEach((v,i)=>bytes.writeInt16BE(v,i*2));
  const tile = readHgt(bytes,36,126);
  assert.equal(tile.elevation(37,126),10);
  assert.equal(tile.elevation(36,127),40);
  assert.equal(tile.elevation(36.5,126.5),25);
  assert.equal(tile.elevation(35,126),null);
  bytes.writeInt16BE(-32768,6);
  assert.equal(tile.elevation(36.5,126.5),null);
  assert.equal(tile.elevation(37,126),10, 'Zero-weight void does not invalidate an exact valid sample');
});
