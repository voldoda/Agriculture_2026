import { gridMetricValue, metricColor } from './headDisplay.js';

// One raster pixel per source cell, north at the top. Every month uses this
// single extent; missing cells remain transparent, missing heads are grey.
export function comparisonLayout(grids) {
  if (!grids.length) throw new Error('비교할 격자가 없습니다.');
  let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
  for (const { row, col } of grids) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) throw new Error('원본 격자의 행·열 정보를 확인해주세요.');
    minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
  }
  return { minRow, minCol, width: maxCol - minCol + 1, height: maxRow - minRow + 1 };
}

export function comparisonFrame(grids, layout, month, mode) {
  const pixels = new Uint8ClampedArray(layout.width * layout.height * 4);
  let sum = 0, count = 0, clipped = 0;
  for (const grid of grids) {
    const value = gridMetricValue(grid, month, mode);
    const color = metricColor(value, mode);
    const offset = ((grid.row - layout.minRow) * layout.width + grid.col - layout.minCol) * 4;
    for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16);
    pixels[offset + 3] = 255;
    if (Number.isFinite(value)) {
      sum += value; count++;
      if (mode === 'deviation' && Math.abs(value) > 100) clipped++;
    }
  }
  return { pixels, month, mode, mean: count ? sum / count : null, count, clipped };
}
