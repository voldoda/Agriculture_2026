import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWaterLevelAlerts, formatAlertChange } from '../src/utils/waterLevelAlerts.js';

const grid = (id, delta) => ({ id, row: 1, col: 1, heads: { '01': 100, '02': 100 + delta } });

test('monthly alert boundaries classify original signed changes before display rounding', () => {
  const deltas = [0, .24999, -.25, .49999, .5, -.99999, 1, -1.25];
  const grids = deltas.map((delta, i) => grid(String(i), delta));
  const original = JSON.stringify(grids);
  const result = buildWaterLevelAlerts(grids, '02');
  assert.equal(result.comparedCells, 8);
  assert.equal(result.withinThreshold, 2);
  assert.deepEqual(result.levels, { WATCH: 2, WARNING: 2, REVIEW: 2 });
  assert.equal(result.riseCount, 3);
  assert.equal(result.dropCount, 3);
  assert.deepEqual(result.alerts.map(a => a.id), ['7', '6', '5', '4', '3', '2']);
  assert.equal(result.alerts.find(a => a.id === '3').level, 'WATCH');
  assert.equal(formatAlertChange(.49999), '+50.0 cm');
  assert.equal(JSON.stringify(grids), original);
});

test('January and missing previous values cannot become zero-change or wraparound alerts', () => {
  const g = { ...grid('a', .5), heads: { '01': 100, '12': 90 } };
  const january = buildWaterLevelAlerts([g], '01');
  assert.equal(january.available, false);
  assert.equal(january.comparedCells, 0);
  assert.equal(january.alerts.length, 0);
  const missing = buildWaterLevelAlerts([g, { id: 'b', heads: { '02': 90 } }], '02');
  assert.equal(missing.comparedCells, 0);
  assert.equal(missing.missingCells, 2);
  const noAlerts = buildWaterLevelAlerts([grid('c', .1)], '02');
  assert.equal(noAlerts.comparedCells, 1);
  assert.equal(noAlerts.withinThreshold, 1);
  assert.equal(noAlerts.missingCells, 0);
});

test('2025 selected-month alerts match independent raw-head filtering and leading grid values', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../src/data/groundwater_data.json', import.meta.url), 'utf8'));
  const expectations = { '05': 5268, '07': 63300, '08': 1665, '11': 35964, '12': 37740 };
  for (const [month, expected] of Object.entries(expectations)) {
    const result = buildWaterLevelAlerts(data.grids, month);
    const previous = String(Number(month) - 1).padStart(2, '0');
    const independent = data.grids.filter(g => Math.abs(g.heads[month] - g.heads[previous]) >= .25);
    assert.equal(result.alerts.length, expected);
    assert.equal(result.alerts.length, independent.length);
    assert.equal(result.comparedCells, 113076);
    assert.equal(result.missingCells, 0);
    assert.equal(result.levels.WATCH + result.levels.WARNING + result.levels.REVIEW, expected);
    assert.equal(result.riseCount + result.dropCount, expected);
    const first = result.alerts[0], source = data.grids.find(g => g.id === first.id);
    assert.equal(first.deltaM, source.heads[month] - source.heads[previous]);
    assert.ok(result.alerts.every(a => Math.abs(a.deltaM) <= Math.abs(first.deltaM)));
    if (month === '11') assert.ok(result.levels.REVIEW > 0);
  }
});
