// Keep decimal source text separate from the float64 used for calculation.
export function exactHead(grid, month) {
  const value = grid.heads?.[month];
  if (!Number.isFinite(value)) return null;
  const exact = grid.headsExact?.[month];
  if (typeof exact === 'string' && /^-?\d+(\.\d+)?$/.test(exact) && Number(exact) === value) return exact;
  return String(value);
}
