import { calculateGridDrought } from './droughtUtils.js';
import { NO_DATA_COLOR, ramp } from './headDisplay.js';

// Display policy is separate from the unrounded scientific/example calculation.
export const DECLINE_LABELS = ['저하 작음', '저하 보통', '저하 큼', '저하 매우 큼'];
export const DECLINE_COLORS = ['#5eead4', '#FBBF24', '#F97316', '#DC2626'];
export const DECLINE_AMOUNT_STOPS = [[0, '#ccfbf1'], [50, '#5eead4'], [100, '#14b8a6'],
  [175, '#FBBF24'], [275, '#F97316'], [350, '#b91c1c']];

export function declineScope(layers) {
  return ['all', 'highlight'].includes(layers.declineScope)
    ? layers.declineScope : layers.grid ? 'highlight' : 'all';
}

export function declineAppearance(info, layers) {
  if (!info) return { color: NO_DATA_COLOR, opacity: 0.55 };
  if (declineScope(layers) === 'highlight' && info.level === 0) return { color: null, opacity: 0 };
  if (layers.declineMetric === 'amount') {
    return { color: ramp(info.drawdownM * 100, DECLINE_AMOUNT_STOPS), opacity: 0.8 };
  }
  return { color: DECLINE_COLORS[info.level], opacity: [0.3, 0.72, 0.8, 0.88][info.level] };
}

export function declineCaption(month, layers, year = 2025) {
  return `${year}년 ${Number(month)}월 · 연내 최고 대비 ${layers.declineMetric === 'amount' ? '저하량(cm)' : '예시 저하 단계'} · ${declineScope(layers) === 'highlight' ? '지수 35% 이상 강조' : '전체 격자 표시'}`;
}

// Cache only scalar summaries, keyed by the immutable loaded grid collection.
const summaries = new WeakMap();
export function summarizeDecline(grids, month) {
  let cached = summaries.get(grids);
  if (!cached) { cached = new Map(); summaries.set(grids, cached); }
  if (cached.has(month)) return cached.get(month);
  const result = { total: grids.length, valid: 0, missing: 0, counts: [0, 0, 0, 0], minM: null, maxM: null };
  for (const grid of grids) {
    const info = calculateGridDrought(grid, month);
    if (!info) { result.missing++; continue; }
    result.valid++;
    result.counts[info.level]++;
    result.minM = result.minM === null ? info.drawdownM : Math.min(result.minM, info.drawdownM);
    result.maxM = result.maxM === null ? info.drawdownM : Math.max(result.maxM, info.drawdownM);
  }
  result.highlighted = result.counts.slice(1).reduce((sum, count) => sum + count, 0);
  cached.set(month, result);
  return result;
}
