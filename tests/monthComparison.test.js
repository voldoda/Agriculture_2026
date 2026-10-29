import test from 'node:test';
import assert from 'node:assert/strict';
import { annualMeanHead, gridMetricValue, metricColor, metricText, MONTHS, DEVIATION_STOPS, NO_DATA_COLOR } from '../src/utils/headDisplay.js';
import { comparisonLayout, comparisonFrame } from '../src/utils/monthComparison.js';

const cell = (row, col, offset = 0) => ({ row, col,
  heads: Object.fromEntries(MONTHS.map((month, i) => [month, 70.12345678901234 + offset + i / 10])) });
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

test('deviation subtracts the same-cell twelve month mean without rounding or modifying heads', () => {
  const grid = cell(1, 1);
  const source = JSON.stringify(grid);
  const mean = Object.values(grid.heads).reduce((sum, value) => sum + value, 0) / 12;
  assert.equal(annualMeanHead(grid), mean);
  for (const month of MONTHS) assert.equal(gridMetricValue(grid, month, 'deviation'), (grid.heads[month] - mean) * 100);
  assert.ok(Math.abs(MONTHS.reduce((sum, m) => sum + gridMetricValue(grid, m, 'deviation'), 0)) < 1e-9);
  assert.ok(Math.abs(gridMetricValue(grid, '05', 'deviation') - gridMetricValue(cell(1, 1, 200), '05', 'deviation')) < 1e-9);
  assert.equal(JSON.stringify(grid), source);
  for (const missing of [null, undefined, NaN]) {
    grid.heads['12'] = missing;
    assert.equal(annualMeanHead(grid), null);
    assert.equal(gridMetricValue(grid, '05', 'deviation'), null);
  }
});

test('deviation shares legend stops, neutral band and saturation without clipping numbers', () => {
  for (const [value, color] of DEVIATION_STOPS) assert.equal(metricColor(value, 'deviation'), color);
  for (const value of [-5, 0, 5]) assert.equal(metricColor(value, 'deviation'), '#f5f5f3');
  assert.equal(metricColor(-165, 'deviation'), DEVIATION_STOPS[0][1]);
  assert.equal(metricColor(165, 'deviation'), DEVIATION_STOPS.at(-1)[1]);
  assert.equal(metricText(165.367, 'deviation'), '+165.4 cm');
  assert.equal(metricText(-0.0001, 'deviation'), '0.0 cm');
  assert.equal(metricText(null, 'deviation'), '비교 자료 없음');
});

test('comparison preserves a shared spatial extent, source row direction and map colours for all months', () => {
  const grids = [cell(10, 20), cell(11, 21, 5)];
  const layout = comparisonLayout(grids);
  assert.deepEqual(layout, { minRow: 10, minCol: 20, width: 2, height: 2 });
  for (const mode of ['head', 'deviation', 'change']) for (const month of MONTHS) {
    const frame = comparisonFrame(grids, layout, month, mode);
    assert.equal(frame.pixels.length, 16);
    for (const [i, offset] of [[0, 0], [1, 12]]) {
      assert.deepEqual([...frame.pixels.slice(offset, offset + 4)], [...rgb(metricColor(gridMetricValue(grids[i], month, mode), mode)), 255]);
    }
    assert.equal(frame.pixels[7], 0); // Outside source coverage, not a zero head.
    assert.equal(frame.pixels[11], 0);
    assert.equal(frame.count, mode === 'change' && month === '01' ? 0 : 2);
  }
  assert.throws(() => comparisonLayout([]));
  assert.throws(() => comparisonLayout([{ row: 1 }]));
});

test('comparison counts saturated cells and excludes unavailable comparisons from averages', () => {
  const a = cell(1, 1), b = cell(1, 2);
  a.heads['01'] += 10;
  b.heads['12'] = null;
  const frame = comparisonFrame([a, b], comparisonLayout([a, b]), '01', 'deviation');
  assert.equal(frame.count, 1);
  assert.equal(frame.clipped, 1);
  assert.equal(frame.mean, gridMetricValue(a, '01', 'deviation'));
  assert.deepEqual([...frame.pixels.slice(4, 7)], rgb(NO_DATA_COLOR));
});
