import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateGridDrought } from '../src/utils/droughtUtils.js';
import { declineAppearance, summarizeDecline } from '../src/utils/declineDisplay.js';
import { surfaceSignature } from '../src/utils/tileFrame.js';

const grid = drop => ({ heads: Object.fromEntries(Array.from({ length: 12 }, (_, i) =>
  [String(i + 1).padStart(2, '0'), i ? 100 : 100 - drop])) });

test('2025 January valid low cells remain visible when decline is the sole layer', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../src/data/groundwater_data.json', import.meta.url), 'utf8'));
  const summary = summarizeDecline(data.grids, '01');
  assert.equal(summary.total, 113076);
  assert.equal(summary.valid, summary.total);
  assert.equal(summary.missing, 0);
  assert.deepEqual(summary.counts, [113076, 0, 0, 0]);
  assert.equal(summary.highlighted, 0);
  assert.ok(Math.abs(summary.maxM - 1.6197657428701575) < 1e-12);
  for (const g of data.grids) {
    const appearance = declineAppearance(calculateGridDrought(g, '01'), { grid: false });
    assert.ok(appearance.color && appearance.opacity > 0);
  }
});

test('valid zero decline, filtered low cells and missing comparisons are distinct', () => {
  const zero = calculateGridDrought(grid(0), '01');
  const small = calculateGridDrought(grid(1), '01');
  const partial = grid(2); delete partial.heads['12'];
  const summary = summarizeDecline([grid(0), grid(1), grid(2), partial], '01');
  assert.deepEqual(summary.counts, [2, 1, 0, 0]);
  assert.equal(summary.valid, 3);
  assert.equal(summary.missing, 1);
  assert.equal(summary.highlighted, 1);
  assert.equal(summary.minM, 0);
  const missing = declineAppearance(null, { grid: false });
  assert.ok(missing.opacity > 0);
  assert.notEqual(missing.color, declineAppearance(zero, { grid: false }).color);
  assert.equal(declineAppearance(small, { grid: true }).color, null);
  assert.ok(declineAppearance(small, { grid: true, declineScope: 'all' }).opacity > 0);
  assert.equal(declineAppearance(zero, { declineScope: 'highlight' }).opacity, 0);
});

test('actual decline uses a fixed scale without modifying the example classification', () => {
  const a = calculateGridDrought(grid(0.5), '01'), b = calculateGridDrought(grid(1.5), '01');
  const before = JSON.stringify([a, b]);
  assert.equal(a.level, b.level);
  assert.notEqual(declineAppearance(a, { declineMetric: 'amount' }).color,
    declineAppearance(b, { declineMetric: 'amount' }).color);
  assert.equal(declineAppearance({ ...b, drawdownM: 4 }, { declineMetric: 'amount' }).color,
    declineAppearance({ ...b, drawdownM: 3.5 }, { declineMetric: 'amount' }).color);
  assert.equal(JSON.stringify([a, b]), before);
});

test('changing decline display or automatic overlay scope invalidates the cached frame', () => {
  const settings = { selectedMonth: '01', gridShape: 'square', layers: { grid: false } };
  const key = surfaceSignature(settings, 'drought');
  for (const layers of [{ grid: true }, { declineScope: 'highlight' }, { declineMetric: 'amount' }]) {
    assert.notEqual(surfaceSignature({ ...settings, layers }, 'drought'), key);
  }
  assert.equal(surfaceSignature({ ...settings, layers: { grid: true, declineScope: 'all' } }, 'drought'), key);
});
