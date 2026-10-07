// SRTM HGT: north-to-south rows of big-endian int16 samples, including tile edges.
export function readHgt(bytes, south, west) {
  const size = Math.sqrt(bytes.length / 2);
  if (!Number.isInteger(size) || size < 2) throw new Error('Invalid HGT size');
  const sample = (row, col) => bytes.readInt16BE((row * size + col) * 2);
  return { size, south, west, elevation(lat, lon) {
    if (lat < south || lat > south + 1 || lon < west || lon > west + 1) return null;
    const x = (lon - west) * (size - 1), y = (south + 1 - lat) * (size - 1);
    const c = Math.min(size - 2, Math.floor(x)), r = Math.min(size - 2, Math.floor(y));
    const fx = x - c, fy = y - r;
    const entries = [[r,c,(1-fx)*(1-fy)], [r,c+1,fx*(1-fy)], [r+1,c,(1-fx)*fy], [r+1,c+1,fx*fy]];
    let value = 0;
    for (const [row, col, weight] of entries) {
      if (weight <= 1e-12) continue;
      const z = sample(row, col);
      if (z === -32768) return null; // Never fill voids or average across missing samples.
      value += z * weight;
    }
    return value;
  } };
}
