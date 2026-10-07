// Rasterize pixel centres, with a half-open edge rule shared by adjacent cells.
// Unlike individual antialiased Canvas paths, this leaves no translucent seams.
// Coordinates are projected cell corners, never an enlarged or averaged cell.
export function fillGridPixels(data, width, height, points, rgba) {
  const first = Math.max(0, Math.ceil(Math.min(...points.map(p => p.y)) - 0.5));
  const last = Math.min(height, Math.ceil(Math.max(...points.map(p => p.y)) - 0.5));
  for (let y = first; y < last; y++) {
    const scan = y + 0.5;
    const crossings = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i];
      if ((a.y <= scan && b.y > scan) || (b.y <= scan && a.y > scan)) {
        crossings.push(a.x + (scan - a.y) * (b.x - a.x) / (b.y - a.y));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const left = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const right = Math.min(width, Math.ceil(crossings[i + 1] - 0.5));
      for (let x = left; x < right; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = rgba[0];
        data[offset + 1] = rgba[1];
        data[offset + 2] = rgba[2];
        data[offset + 3] = rgba[3];
      }
    }
  }
}

export function showGridBorder(mode = 'auto', points) {
  if (mode === 'hidden') return false;
  if (mode === 'visible') return true;
  // CSS pixels, independent of fullscreen mode and device pixel ratio.
  return points.every((p, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(next.x - p.x, next.y - p.y) >= 12;
  });
}
