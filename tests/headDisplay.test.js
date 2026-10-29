import test from 'node:test';
import assert from 'node:assert/strict';
import { gridMetricValue, metricColor, metricText, previousMonth, metricCaption,
  HEAD_STOPS, RANGE_STOPS, CHANGE_COLORS, NO_DATA_COLOR, droughtOverlaySuppressed } from '../src/utils/headDisplay.js';

test('month change uses source heads before rounding and never wraps January to December', () => {
  const grid = { heads: { '01': 94.1234567890123, '02': 94.1234571234567, '12': 200 } };
  assert.equal(gridMetricValue(grid, '02', 'change'), (grid.heads['02'] - grid.heads['01']) * 100);
  assert.equal(gridMetricValue(grid, '01', 'change'), null);
  assert.equal(previousMonth('01'), null);
  assert.equal(previousMonth('13'), null);
  assert.equal(gridMetricValue(grid, '03', 'change'), null);
  assert.equal(gridMetricValue({ heads: { '02': 50 } }, '02', 'change'), null);
  assert.match(metricCaption('01', 'change', 2025), /2024년 12월 자료 없음/);
  assert.equal(metricColor(null, 'change'), NO_DATA_COLOR);
});

test('annual amplitude uses all twelve months and is independent of selected month', () => {
  const grid = { heads: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, '0'), 100 + i / 10])) };
  const amplitude = (101.1 - 100) * 100;
  assert.equal(gridMetricValue(grid, '05', 'range'), amplitude);
  assert.equal(gridMetricValue(grid, '12', 'range'), amplitude);
  grid.heads['01'] = null;
  assert.equal(gridMetricValue(grid, '12', 'range'), null);
});

test('fixed change bins distinguish signs, neutral band and out-of-range values', () => {
  const values = [-51, -50, -25, -10, -5, 5.01, 10.01, 25.01, 50.01];
  values.forEach((v, i) => assert.equal(metricColor(v, 'change'), CHANGE_COLORS[i]));
  for (const v of [-5, 0, 5]) assert.equal(metricColor(v, 'change'), CHANGE_COLORS[4]);
  assert.equal(metricText(-104.7854, 'change'), '-104.8 cm');
  assert.equal(metricText(119.5149, 'change'), '+119.5 cm');
  assert.equal(metricText(-0.0001, 'change'), '0.0 cm');
  assert.equal(metricText(null, 'change'), '비교 자료 없음');
});

test('map ramps and legend stops share exact colours and do not mutate the data', () => {
  for (const [value, color] of HEAD_STOPS) assert.equal(metricColor(value), color);
  for (const [value, color] of RANGE_STOPS) assert.equal(metricColor(value, 'range'), color);
  assert.notEqual(metricColor(50), metricColor(55));
  const grid = { heads: { '01': 90.1, '02': 89.9 }, headsExact: { '01': '90.100000000000001' } };
  const before = JSON.stringify(grid);
  for (const mode of ['head', 'change', 'range']) metricText(gridMetricValue(grid, '02', mode), mode);
  assert.equal(JSON.stringify(grid), before);
  assert.equal(droughtOverlaySuppressed({ grid: true, gridMetric: 'change' }), true);
  assert.equal(droughtOverlaySuppressed({ grid: true, gridMetric: 'head' }), false);
  assert.equal(droughtOverlaySuppressed({ grid: false, gridMetric: 'change' }), false);
});
