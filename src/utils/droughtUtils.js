import { surfaceComparison } from './surfaceElevation.js';

// Within-year model-head decline demonstration, not an official drought diagnosis.
// Terrain depth is reported separately and never weights this index.
export function calculateGridDrought(grid, selectedMonth = '05') {
  if (!grid) return null;
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const vals = months.map(m => grid.heads?.[m]);
  const hm = grid.heads?.[selectedMonth];
  if (!Number.isFinite(hm) || !vals.every(Number.isFinite)) return null;
  const maxH = Math.max(...vals), minH = Math.min(...vals);
  const normalizationM = Math.max(5, maxH - minH);
  const drawdownM = Math.max(0, maxH - hm);
  const score = Math.max(0, Math.min(1, drawdownM / normalizationM));
  const level = score >= 0.75 ? 3 : score >= 0.55 ? 2 : score >= 0.35 ? 1 : 0;
  const colors = [null, '#FBBF24', '#F97316', '#DC2626'];
  const badges = [
    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    'bg-yellow-500/25 text-yellow-300 border border-yellow-500/40',
    'bg-orange-500/25 text-orange-400 border border-orange-500/50',
    'bg-red-500/25 text-red-400 border border-red-500/50',
  ];
  const surface = surfaceComparison(grid, selectedMonth);
  return {
    method: 'demo-head-decline-v2', score: Number(score.toFixed(2)), scorePercent: Math.round(score * 100), level,
    // Internal keys preserve old integrations; visible labels describe decline.
    stage: ['정상', '관심', '주의', '심각'][level],
    stageLabel: ['저하 작음', '저하 보통', '저하 큼', '저하 매우 큼'][level],
    stageEn: ['Low', 'Moderate', 'High', 'VeryHigh'][level],
    color: colors[level], opacity: [0, 0.72, 0.80, 0.88][level], textBadgeClass: badges[level],
    drawdownM, normalizationM, drawdownRate: Number((score * 100).toFixed(1)),
    depth: surface.depthM, rawDepthM: surface.rawDifferenceM, depthStatus: surface.status,
    // DEM/head do not supply aquifer thickness, specific yield or capacity.
    storageM3: null, storageRate: null, storageStatus: 'missing_aquifer_parameters', head: hm,
  };
}

export function getDroughtColor(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= 0.75) return '#DC2626';
  if (score >= 0.55) return '#F97316';
  if (score >= 0.35) return '#FBBF24';
  return null;
}
