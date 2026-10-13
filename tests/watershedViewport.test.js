import test from 'node:test';
import assert from 'node:assert/strict';
import { watershedBounds, watershedPadding, unobscuredWatershedPadding, createWatershedViewport } from '../src/utils/watershedViewport.js';

test('fit extent includes all original cell edges and ignores unrelated example objects', () => {
  const data = { grids: [
    { lat: 36.5, lon: 127, polygon: [[36.4, 126.9], [36.6, 126.9], [36.6, 127.1], [36.4, 127.1]] },
    { lat: 36.7, lon: 127.2, polygon: [[36.65, 127.15], [36.75, 127.15], [36.75, 127.25], [36.65, 127.25]] },
  ], observationWells: [{ lat: 40, lon: 130 }], metadata: { bounds: { minLat: 30, maxLat: 40, minLon: 120, maxLon: 130 } } };
  assert.deepEqual(watershedBounds(data), [[36.4, 126.9], [36.75, 127.25]]);
});

test('bounds support center-only grids and a valid metadata fallback without inventing an empty extent', () => {
  assert.deepEqual(watershedBounds({ grids: [{ lat: 36.5, lon: 127 }, { lat: 36.6, lon: 127.1 }] }),
    [[36.5, 127], [36.6, 127.1]]);
  assert.deepEqual(watershedBounds({ metadata: { bounds: { minLat: 36, maxLat: 37, minLon: 126, maxLon: 127 } } }),
    [[36, 126], [37, 127]]);
  assert.equal(watershedBounds({ grids: [{ lat: NaN, lon: 127 }] }), null);
  assert.equal(watershedBounds({ metadata: { bounds: { minLat: 37, maxLat: 36, minLon: 126, maxLon: 127 } } }), null);
});

test('padding protects bottom overlays and leaves positive space in short windows', () => {
  const desktop = watershedPadding({ x: 1600, y: 1000 }, 90);
  assert.deepEqual(desktop, { paddingTopLeft: [24, 24], paddingBottomRight: [24, 114] });
  const mobile = watershedPadding({ x: 375, y: 780 }, 80);
  assert.deepEqual(mobile.paddingBottomRight, [16, 96]);
  const controls = watershedPadding({ x: 375, y: 780 }, 80, 102);
  assert.deepEqual(controls.paddingBottomRight, [118, 96]);
  const tiny = watershedPadding({ x: 50, y: 70 }, 500, 500);
  assert.ok(tiny.paddingTopLeft[0] + tiny.paddingBottomRight[0] < 50);
  assert.ok(tiny.paddingTopLeft[1] + tiny.paddingBottomRight[1] < 70);
});

test('phones use the larger unobscured area below controls, while wide screens and open sheets use the left area', () => {
  const bounds = [[36, 126], [37, 127]];
  const choose = (size, bottomInset) => unobscuredWatershedPadding({
    getBoundsZoom: (_bounds, _inside, padding) => Math.log2(Math.min((size.x - padding[0]) / 740, (size.y - padding[1]) / 1000)),
  }, bounds, size, { bottomInset, rightInset: 102, navigationBottom: 260 });
  const phone = choose({ x: 375, y: 844 }, 80);
  assert.deepEqual(phone, { paddingTopLeft: [16, 276], paddingBottomRight: [16, 96] });
  const halfSheet = choose({ x: 375, y: 844 }, 468);
  assert.deepEqual(halfSheet, { paddingTopLeft: [16, 16], paddingBottomRight: [118, 484] });
  const wide = choose({ x: 1856, y: 1376 }, 90);
  assert.deepEqual(wide, { paddingTopLeft: [24, 24], paddingBottomRight: [126, 114] });
});

function setup() {
  const listeners = new Map(), frames = new Map();
  let serial = 0;
  const map = {
    size: { x: 1200, y: 800 }, fits: [], invalidations: [],
    on(events, callback) { for (const event of events.split(' ')) listeners.set(event, callback); },
    off(events) { for (const event of events.split(' ')) listeners.delete(event); },
    fire(event) { listeners.get(event)?.(); },
    stop() {},
    invalidateSize(options) { this.invalidations.push(options); },
    getSize() { return this.size; },
    fitBounds(bounds, options) {
      this.fire('movestart'); this.fire('zoomstart');
      this.fits.push({ bounds, options, size: { ...this.size } });
    },
  };
  let bounds = [[36, 126], [37, 127]];
  const viewport = createWatershedViewport(map, {
    getBounds: () => bounds,
    getPadding: size => watershedPadding(size, 80),
    requestFrame: callback => { const id = ++serial; frames.set(id, callback); return id; },
    cancelFrame: id => frames.delete(id),
  });
  return { map, viewport, frames, listeners,
    setBounds(value) { bounds = value; },
    flush() { const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback()); },
  };
}

test('automatic fitting uses the current map size and coalesces repeated resize events', () => {
  const { map, viewport, frames, flush } = setup();
  viewport.reset();
  map.size = { x: 700, y: 1100 };
  viewport.resize(); viewport.resize(); viewport.resize();
  assert.equal(frames.size, 1);
  flush();
  assert.equal(map.fits.length, 2); // Self-generated map events must not turn off automatic fitting.
  assert.deepEqual(map.fits[1].size, { x: 700, y: 1100 });
  assert.equal(map.fits[1].options.animate, false);
});

for (const action of ['dragstart', 'zoomstart', 'movestart', 'selection']) {
  test(`resizing preserves a manually chosen view after ${action}; reset restores automatic fitting`, () => {
    const { map, viewport, flush } = setup();
    viewport.reset();
    viewport.resize(); // A queued automatic fit must also be cancelled.
    if (action === 'selection') viewport.preserve();
    else map.fire(action);
    flush();
    map.size = { x: 700, y: 900 };
    viewport.resize(); flush();
    assert.equal(map.fits.length, 1);
    assert.ok(map.invalidations.some(options => options.debounceMoveend));
    viewport.reset();
    viewport.resize(); flush();
    assert.equal(map.fits.length, 3);
  });
}

test('zero-size maps defer fitting until visible and disposal cancels late callbacks', () => {
  const { map, viewport, flush, frames, listeners, setBounds } = setup();
  map.size = { x: 0, y: 0 };
  assert.equal(viewport.reset(), false);
  assert.equal(map.fits.length, 0);
  map.size = { x: 375, y: 720 };
  viewport.resize(); flush();
  assert.equal(map.fits.length, 1);
  setBounds(null);
  assert.equal(viewport.reset(), false);
  viewport.resize();
  viewport.dispose();
  assert.equal(frames.size, 0);
  assert.equal(listeners.size, 0);
  flush();
  assert.equal(map.fits.length, 1);
});
