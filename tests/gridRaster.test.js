import test from 'node:test';
import assert from 'node:assert/strict';
import { fillGridPixels, showGridBorder } from '../src/utils/gridRaster.js';

const ring = (x, y, size) => [
  { x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size },
];

test('adjacent rotated cells have no seams, blending or interpolated colours', () => {
  const width = 40, height = 40;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const colors = [[20, 100, 200, 255], [40, 150, 220, 255], [230, 50, 25, 184], [0, 0, 0, 0]];
  const transform = ({ x, y }) => ({ x: 5.2 + x * 0.9 - y * 0.2, y: 2.7 + x * 0.2 + y * 0.9 });
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const color = colors[row * 2 + col];
    if (color[3]) fillGridPixels(pixels, width, height, ring(col * 15, row * 15, 15).map(transform), color);
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x + 0.5 - 5.2, dy = y + 0.5 - 2.7;
    const u = (0.9 * dx + 0.2 * dy) / 0.85, v = (-0.2 * dx + 0.9 * dy) / 0.85;
    const expected = u >= 0 && u < 30 && v >= 0 && v < 30
      ? colors[Math.floor(v / 15) * 2 + Math.floor(u / 15)] : [0, 0, 0, 0];
    assert.deepEqual(Array.from(pixels.slice((y * width + x) * 4, (y * width + x + 1) * 4)), expected, `pixel ${x},${y}`);
  }
});

test('tile boundaries match an untiled surface, including clipped cell corners', () => {
  const cells = [ring(-7.3, -4.7, 22.6), ring(15.3, -4.7, 22.6), ring(-7.3, 17.9, 22.6)];
  const rgba = [14, 165, 233, 255];
  const whole = new Uint8ClampedArray(32 * 32 * 4);
  cells.forEach(points => fillGridPixels(whole, 32, 32, points, rgba));
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const tile = new Uint8ClampedArray(16 * 16 * 4);
    cells.forEach(points => fillGridPixels(tile, 16, 16,
      points.map(p => ({ x: p.x - tx * 16, y: p.y - ty * 16 })), rgba));
    for (let y = 0; y < 16; y++) {
      const start = ((y + ty * 16) * 32 + tx * 16) * 4;
      assert.deepEqual(tile.slice(y * 16 * 4, (y + 1) * 16 * 4), whole.slice(start, start + 16 * 4));
    }
  }
});

test('automatic borders depend on screen cell size; explicit modes override', () => {
  assert.equal(showGridBorder('auto', ring(0, 0, 11.9)), false);
  assert.equal(showGridBorder('auto', ring(0, 0, 12)), true);
  assert.equal(showGridBorder('visible', ring(0, 0, 2)), true);
  assert.equal(showGridBorder('hidden', ring(0, 0, 100)), false);
});
