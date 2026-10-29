// Marching squares on original cell CENTRES in EPSG:5179. No resampling,
// extrapolation, smoothing or substitution of missing heads.
export function generateHeadContours(grids, month, interval = 5) {
  if (!(interval > 0) || !Number.isFinite(interval)) throw new Error('Invalid contour interval');
  // Leave an unused column so right-edge lookups cannot wrap into the next row.
  const stride = grids.reduce((v, g) => Math.max(v, g.col), 0) + 2;
  const index = new Map(grids.map(g => [g.row * stride + g.col, g]));
  const valid = grids.filter(g => Number.isFinite(g.heads?.[month]));
  const min = valid.reduce((v, g) => Math.min(v, g.heads[month]), Infinity);
  const max = valid.reduce((v, g) => Math.max(v, g.heads[month]), -Infinity);
  const quads = [];
  for (const g of valid) {
    const corners = [g, index.get(g.row * stride + g.col + 1),
      index.get((g.row + 1) * stride + g.col + 1), index.get((g.row + 1) * stride + g.col)];
    if (corners.every(c => c && Number.isFinite(c.heads?.[month]) && Number.isFinite(c.x) && Number.isFinite(c.y))) {
      quads.push(corners);
    }
  }
  const pairs = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
    6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 11: [[1, 2]],
    12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] };
  const edgeCorners = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const lines = [];
  let segmentCount = 0, maxInterpolationErrorM = 0;
  for (let level = Math.ceil(min / interval) * interval; level <= max; level += interval) {
    const nodes = new Map(), segments = [], adjacent = new Map();
    const crossing = (corners, edge) => {
      const [a, b] = edgeCorners[edge].map(i => corners[i]);
      const ha = a.heads[month], hb = b.heads[month], t = (level - ha) / (hb - ha);
      const ka = a.row * stride + a.col, kb = b.row * stride + b.col;
      const key = t === 0 ? `v${ka}` : t === 1 ? `v${kb}` : `${Math.min(ka, kb)}:${Math.max(ka, kb)}`;
      if (!nodes.has(key)) nodes.set(key, [a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)]);
      maxInterpolationErrorM = Math.max(maxInterpolationErrorM, Math.abs(ha + t * (hb - ha) - level));
      return key;
    };
    for (const corners of quads) {
      const f = corners.map(c => c.heads[month] - level);
      const mask = f.reduce((v, value, i) => v | (value >= 0 ? 1 << i : 0), 0);
      if (mask === 0 || mask === 15) continue;
      // Asymptotic decider resolves saddle cells using the bilinear surface.
      const connections = mask === 5 || mask === 10
        ? (f[0] * f[2] - f[1] * f[3] >= 0 ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]]) : pairs[mask];
      for (const [e1, e2] of connections) {
        const a = crossing(corners, e1), b = crossing(corners, e2);
        if (a === b) continue;
        const id = segments.length;
        segments.push([a, b]);
        for (const key of [a, b]) {
          if (!adjacent.has(key)) adjacent.set(key, []);
          adjacent.get(key).push(id);
        }
      }
    }
    segmentCount += segments.length;
    const used = new Set();
    const walk = (start, first) => {
      const coordinates5179 = [nodes.get(start)];
      let key = start, id = first;
      while (id !== undefined && !used.has(id)) {
        used.add(id);
        const [a, b] = segments[id];
        key = a === key ? b : a;
        coordinates5179.push(nodes.get(key));
        if (key === start || adjacent.get(key).length !== 2) break;
        id = adjacent.get(key).find(next => !used.has(next));
      }
      if (coordinates5179.length > 1) lines.push({ elevation: level, coordinates5179 });
    };
    // Open ends (including NoData boundaries) first, then closed loops.
    for (const [key, ids] of adjacent) if (ids.length !== 2) {
      for (const id of ids) if (!used.has(id)) walk(key, id);
    }
    segments.forEach(([a], id) => { if (!used.has(id)) walk(a, id); });
  }
  return { lines, statistics: { minHeadM: Number.isFinite(min) ? min : null,
    maxHeadM: Number.isFinite(max) ? max : null, validCells: valid.length,
    validQuads: quads.length, segmentCount, maxInterpolationErrorM } };
}
