export const SOURCE_MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
export const DATA_NOTICE = '2025년 1~12월 월말 수위입니다(월평균 아님). 산정 방식: MODFLOW 6 계산 결과. 지표고는 SRTM 약30m DEM 참고값(2000년 취득)이며, 수위와 높이 기준·수면 해석이 미확인되어 표고 차이는 확정 지하수심이 아닙니다. 수위 저하 단계는 연내 최고수위 대비 예시 지수이며 공식 가뭄 판정이 아닙니다. 저류량은 산정 자료 없음입니다. 관측정·관리구역은 예시입니다.';

export function getHeadSource(month, metadata) {
  return (metadata?.sourceMonths ?? metadata?.calibratedMonths ?? SOURCE_MONTHS).includes(month) ? 'model_sample' : 'synthetic_example';
}

export function describeSampleAlert(alert) {
  return String(alert.description ?? '').replaceAll('실측치', '모델 샘플').replaceAll('실측', '모델');
}

export function exportMetadata(dataset, selectedMonth) {
  return {
    watershed: dataset.metadata?.watershedName,
    month: selectedMonth,
    year: dataset.metadata?.year ?? null,
    temporalBasis: dataset.metadata?.temporalBasis,
    sourceName: dataset.metadata?.sourceName,
    headPrecision: dataset.metadata?.headPrecision ?? 'numeric',
    headDecimalPlaces: dataset.metadata?.headDecimalPlaces,
    exactHeadEncoding: 'Source decimal text; GeoJSON uses head_m_exact / heads_exact alongside numeric fields.',
    calculationPrecision: 'float64',
    contours: dataset.metadata?.contours ?? null,
    headSource: getHeadSource(selectedMonth, dataset.metadata),
    analysisMethod: 'demo-head-decline-v2',
    analysisStatus: 'unvalidated_example',
    surfaceElevation: dataset.metadata?.surfaceElevation ?? null,
    depthBasis: 'surface - model head; signed reference difference; validated depth only after datum and water-table confirmation',
    declineBasis: '(within-year maximum head - selected head) / max(5m, within-year head amplitude); 35/55/75% example breaks',
    compatibilityFields: 'DROUGHT / drought_index are legacy names for the demonstration head-decline index, not drought probability.',
    sourceCellSizeM: dataset.metadata?.sourceCellSizeM ?? 49.97566566732752,
    sourceCellHeightM: dataset.metadata?.sourceCellHeightM ?? 49.97675151890144,
    displayCellSizeM: dataset.metadata?.displayCellSizeM ?? 49.97566566732752,
    displayCellHeightM: dataset.metadata?.displayCellHeightM ?? 49.97675151890144,
    storageBasis: 'Unavailable: aquifer thickness, specific yield and validated capacity are missing.',
    notice: DATA_NOTICE,
    generated: new Date().toISOString(),
  };
}
