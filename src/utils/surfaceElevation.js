export const SURFACE_NOTICE = 'SRTM 약30m DEM 기반 참고 지표고(2000년 취득)입니다. 수위와 높이 기준·수면 해석이 확인되지 않아, 표고 차이는 확정 지하수심이 아닙니다.';

export function surfaceComparison(grid, month) {
  const surface = grid?.surfaceEl, head = grid?.heads?.[month];
  if (!Number.isFinite(surface)) return { rawDifferenceM: null, depthM: null, status: 'missing_surface', message: 'DEM 지표고 자료 없음' };
  if (!Number.isFinite(head)) return { rawDifferenceM: null, depthM: null, status: 'missing_head', message: '선택 월 수위 자료 없음' };
  const rawDifferenceM = surface - head;
  if (rawDifferenceM < 0) return { rawDifferenceM, depthM: null, status: 'head_above_surface', message: '수두가 DEM 지표고보다 높음 · 높이 기준·수면 해석 확인 필요' };
  const verified = grid.surfaceDatumConfirmed === true && grid.waterTableInterpretationConfirmed === true;
  return { rawDifferenceM, depthM: verified ? rawDifferenceM : null, status: verified ? 'verified_depth' : 'unconfirmed_vertical_reference', message: verified ? '높이 기준·수면 해석 확인됨' : '높이 기준·수면 해석 미확인 · 참고 차이' };
}
