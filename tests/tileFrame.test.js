import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTileFrame, surfaceSignature } from '../src/utils/tileFrame.js';

function tiles() {
  const records = [0, 1, 2].map(id => ({ canvas: { id, pixels: 'May' }, signature: '05' }));
  return new Map(records.map(record => [record.canvas, record]));
}
const publish = (record, buffer) => { record.canvas.pixels = buffer; };

test('a complete month is staged without clearing or replacing visible canvases', async () => {
  const records = tiles();
  const original = [...records.keys()];
  const frame = await prepareTileFrame(records, '06', () => 'June', () => true);
  assert.deepEqual(original.map(canvas => canvas.pixels), ['May', 'May', 'May']);
  assert.equal(frame.commit(publish), true);
  assert.deepEqual([...records.keys()], original);
  assert.deepEqual(original.map(canvas => canvas.pixels), ['June', 'June', 'June']);
});

test('cancelled or superseded preparation cannot publish an obsolete month', async () => {
  const records = tiles();
  let current = true;
  const frame = await prepareTileFrame(records, '06', () => 'June', () => current);
  current = false;
  assert.equal(frame.commit(publish), false);
  assert.ok([...records.keys()].every(canvas => canvas.pixels === 'May'));
  assert.equal(await prepareTileFrame(records, '07', () => assert.fail('cancelled paint'), () => false), null);
});

test('pan or zoom changing the tile set invalidates the whole prepared frame', async () => {
  const records = tiles();
  const frame = await prepareTileFrame(records, '06', () => 'June', () => true);
  const first = [...records.keys()][0];
  records.delete(first);
  const replacement = { canvas: { pixels: 'May' }, signature: '05' };
  records.set(replacement.canvas, replacement);
  assert.equal(frame.valid(), false);
  assert.equal(frame.commit(publish), false);
  assert.ok([...records.keys()].every(canvas => canvas.pixels === 'May'));
});

test('annual range ignores timeline ticks; opacity does not rerasterize tiles', async () => {
  const settings = { selectedMonth: '05', gridShape: 'square', layers: { gridMetric: 'range', gridBorder: 'auto', gridOpacity: 0.85 } };
  const key = surfaceSignature(settings, 'head');
  const next = { ...settings, selectedMonth: '06', layers: { ...settings.layers, gridOpacity: 0.5 } };
  assert.equal(surfaceSignature(next, 'head'), key);
  assert.notEqual(surfaceSignature(next, 'drought'), surfaceSignature(settings, 'drought'));
  const records = tiles();
  records.forEach(record => { record.signature = key; });
  const frame = await prepareTileFrame(records, key, () => assert.fail('unnecessary redraw'), () => true);
  assert.equal(frame.commit(() => assert.fail('unnecessary canvas update')), true);
  assert.notEqual(surfaceSignature({ ...next, gridShape: 'circle' }, 'head'), key);
});
