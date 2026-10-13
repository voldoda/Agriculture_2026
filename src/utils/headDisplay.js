export const NO_DATA_COLOR = '#94a3b8';
export const HEAD_STOPS = [[10, '#e0f2fe'], [35, '#7dd3fc'], [60, '#0ea5e9'], [85, '#2563eb'], [115, '#312e81']];
export const RANGE_STOPS = [[0, '#e0f2fe'], [80, '#7dd3fc'], [160, '#0ea5e9'], [240, '#2563eb'], [320, '#312e81']];
export const DEVIATION_STOPS = [[-100, '#a65308'], [-50, '#e79c42'], [-5, '#f5f5f3'], [5, '#f5f5f3'], [50, '#73afd0'], [100, '#12618e']];
export const CHANGE_COLORS = ['#8c510a', '#b35806', '#e08214', '#fdb863', '#f1f5f9', '#bdd9ed', '#74add1', '#2b8cbe', '#08589e'];
export const CHANGE_BREAKS = [-50, -25, -10, -5, 5, 10, 25, 50];
export const METRIC_LABELS = { deviation: '연평균 대비 편차', change: '전월 대비 변화량', head: '수위 표고', range: '연간 변동 폭' };
export const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

// Equal weights for the twelve month-end model heads, at the same cell.
// Do not round, impute missing months, or modify the source values.
export function annualMeanHead(grid) {
  const values = MONTHS.map(month => grid?.heads?.[month]);
  if (!values.every(Number.isFinite)) return null;
  return values.reduce((sum, value) => sum + value, 0) / 12;
}

export function previousMonth(month) {
  const n = Number(month);
  return Number.isInteger(n) && n >= 2 && n <= 12 ? String(n - 1).padStart(2, '0') : null;
}

export function gridMetricValue(grid, month, mode = 'head') {
  const heads = grid?.heads ?? {};
  if (mode === 'range') {
    const values = Array.from({ length: 12 }, (_, i) => heads[String(i + 1).padStart(2, '0')]);
    return values.every(Number.isFinite) ? (Math.max(...values) - Math.min(...values)) * 100 : null;
  }
  if (!Number.isFinite(heads[month])) return null;
  if (mode === 'deviation') {
    const mean = annualMeanHead(grid);
    return mean === null ? null : (heads[month] - mean) * 100;
  }
  if (mode === 'change') {
    const previous = previousMonth(month);
    return previous && Number.isFinite(heads[previous]) ? (heads[month] - heads[previous]) * 100 : null;
  }
  return heads[month];
}

export function ramp(value, stops) {
  if (value <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [right, b] = stops[i], [left, a] = stops[i - 1];
    if (value <= right) {
      const t = (value - left) / (right - left);
      return '#' + [1, 3, 5].map(offset => Math.round(
        parseInt(a.slice(offset, offset + 2), 16) * (1 - t) + parseInt(b.slice(offset, offset + 2), 16) * t
      ).toString(16).padStart(2, '0')).join('');
    }
  }
  return stops.at(-1)[1];
}

export function metricColor(value, mode = 'head') {
  if (!Number.isFinite(value)) return NO_DATA_COLOR;
  if (mode === 'change') {
    const index = CHANGE_BREAKS.findIndex((limit, i) => i < 4 ? value < limit : value <= limit);
    return CHANGE_COLORS[index < 0 ? 8 : index];
  }
  return ramp(value, mode === 'deviation' ? DEVIATION_STOPS : mode === 'range' ? RANGE_STOPS : HEAD_STOPS);
}

export function metricText(value, mode = 'head') {
  if (!Number.isFinite(value)) return ['change', 'deviation'].includes(mode) ? '비교 자료 없음' : '자료 없음';
  // Formatting never feeds back into calculations or exports.
  const rounded = Number(value.toFixed(mode === 'head' ? 2 : 1));
  return `${['change', 'deviation'].includes(mode) && rounded > 0 ? '+' : ''}${rounded.toFixed(mode === 'head' ? 2 : 1)} ${mode === 'head' ? 'm' : 'cm'}`;
}

export function metricCaption(month, mode = 'head', year = 2025) {
  if (mode === 'deviation') return `${year}년 ${Number(month)}월 − 같은 격자의 ${year}년 12개월 평균`;
  if (mode === 'range') return `${year}년 1~12월 최고−최저 · 월 선택과 무관`;
  if (mode === 'change') return previousMonth(month)
    ? `${year}년 ${Number(month)}월 − ${Number(previousMonth(month))}월 · 월말 수위 차이`
    : `${year - 1}년 12월 자료 없음 · 전월 대비 비교 불가`;
  return `${year}년 ${Number(month)}월 말 · 지하수위 표고`;
}

export function droughtOverlaySuppressed(layers) {
  return layers.grid && (layers.gridMetric ?? 'head') !== 'head';
}
