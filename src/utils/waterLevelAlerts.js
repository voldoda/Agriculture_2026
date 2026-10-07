import { previousMonth } from './headDisplay.js';

// Application reference thresholds, not a validated operational warning standard.
// Monthly differences always use source float64 heads before display rounding.
export const WATER_LEVEL_ALERT_CRITERIA = [
  { level: 'WATCH', label: '관심', minimumM: 0.25 },
  { level: 'WARNING', label: '주의', minimumM: 0.5 },
  { level: 'REVIEW', label: '중점 검토', minimumM: 1 },
];

export function buildWaterLevelAlerts(grids, month, year = 2025) {
  const previous = previousMonth(month);
  const result = { method: 'month-end-change-reference-v1', year, month, previousMonth: previous,
    available: !!previous, totalCells: grids.length, comparedCells: 0, missingCells: 0,
    withinThreshold: 0, riseCount: 0, dropCount: 0,
    levels: { WATCH: 0, WARNING: 0, REVIEW: 0 }, alerts: [],
    criteria: WATER_LEVEL_ALERT_CRITERIA };
  if (!previous) { result.missingCells = grids.length; return result; }
  for (const grid of grids) {
    const currentHead = grid.heads?.[month], previousHead = grid.heads?.[previous];
    if (!Number.isFinite(currentHead) || !Number.isFinite(previousHead)) { result.missingCells++; continue; }
    result.comparedCells++;
    const deltaM = currentHead - previousHead, magnitude = Math.abs(deltaM);
    const criterion = WATER_LEVEL_ALERT_CRITERIA.findLast(c => magnitude >= c.minimumM);
    if (!criterion) { result.withinThreshold++; continue; }
    const direction = deltaM > 0 ? 'rise' : 'drop';
    result[direction === 'rise' ? 'riseCount' : 'dropCount']++;
    result.levels[criterion.level]++;
    result.alerts.push({ id: grid.id, row: grid.row, col: grid.col, month, previousMonth: previous,
      currentHead, previousHead, deltaM, direction, directionLabel: direction === 'rise' ? '상승' : '하강',
      level: criterion.level, levelLabel: criterion.label });
  }
  result.alerts.sort((a, b) => Math.abs(b.deltaM) - Math.abs(a.deltaM) || String(a.id).localeCompare(String(b.id)));
  return result;
}

export function formatAlertChange(deltaM) {
  return `${deltaM > 0 ? '+' : ''}${(deltaM * 100).toFixed(1)} cm`;
}
