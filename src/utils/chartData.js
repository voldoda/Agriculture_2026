import { getHeadSource } from './dataProvenance.js';

export function buildChartData(grid, metadata) {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const monthKey = String(i + 1).padStart(2, '0');
    const source = getHeadSource(monthKey, metadata);
    return { month: `${i + 1}월`, monthKey, source,
      fullMonthName: `${metadata?.year ? metadata.year + '년 ' : ''}${i + 1}월 말 (${source === 'model_sample' ? '제공 모델 자료' : '예시값'})`,
      head: Number.isFinite(grid.heads?.[monthKey]) ? grid.heads[monthKey] : null };
  });
  const valid = rows.map((row, x) => ({ x, y: row.head })).filter(p => p.y !== null);
  const n = valid.length;
  if (!n) return rows;
  const sumX = valid.reduce((s, p) => s + p.x, 0);
  const sumY = valid.reduce((s, p) => s + p.y, 0);
  const sumXY = valid.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = valid.reduce((s, p) => s + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = (sumY - slope * sumX) / n;
  return rows.map((row, i) => ({ ...row, avgLine: sumY / n,
    trendLine: n > 1 ? slope * i + intercept : null }));
}
