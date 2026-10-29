// Precompute bounds once, including cells whose edge intersects the viewport.
export function indexGridBounds(grids) {
  const entries = grids.map(grid => {
    const points = grid.polygon?.length ? grid.polygon : [[grid.lat, grid.lon]];
    return { grid, south: Math.min(...points.map(p => p[0])), north: Math.max(...points.map(p => p[0])),
      west: Math.min(...points.map(p => p[1])), east: Math.max(...points.map(p => p[1])) };
  });
  const buckets = new Map();
  const step = 0.01;
  for (const item of entries) {
    for (let y = Math.floor(item.south / step); y <= Math.floor(item.north / step); y++) {
      for (let x = Math.floor(item.west / step); x <= Math.floor(item.east / step); x++) {
        const key = `${y}:${x}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      }
    }
  }
  return { entries, buckets, step };
}

export function gridsInBounds(index, bounds) {
  const { step, buckets, entries } = index;
  const south = Math.floor(bounds.south / step), north = Math.floor(bounds.north / step);
  const west = Math.floor(bounds.west / step), east = Math.floor(bounds.east / step);
  let candidates;
  if ((north - south + 1) * (east - west + 1) > buckets.size * 2) candidates = entries;
  else {
    const found = new Set();
    for (let y = south; y <= north; y++) for (let x = west; x <= east; x++) {
      for (const item of buckets.get(`${y}:${x}`) ?? []) found.add(item);
    }
    candidates = [...found];
  }
  return candidates.filter(item => item.north >= bounds.south && item.south <= bounds.north &&
    item.east >= bounds.west && item.west <= bounds.east).map(item => item.grid);
}

export function gridAtPoint(index, lat, lon) {
  return gridsInBounds(index, { north: lat, south: lat, west: lon, east: lon }).find(grid => {
    let inside = false;
    const ring = grid.polygon ?? [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i], [yj, xj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}
