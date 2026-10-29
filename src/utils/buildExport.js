export async function buildExport(dataset, options) {
  const { format, selectedMonth } = options;
  if (format === 'SHP') {
    const { generateShapefileZip } = await import('./shapefileExport.js');
    return generateShapefileZip(dataset, options);
  }
  if (options.includeContours !== false && dataset.metadata?.contours) {
    const { loadMonthlyContours, selectContourLines } = await import('./headContours.js');
    const interval = options.contourIntervalM === 5 ? 5 : 10;
    options = { ...options, contourIntervalM: interval,
      contourLines: selectContourLines(await loadMonthlyContours(dataset, selectedMonth), interval) };
  }
  const baseName = `HydroGIS_유구천_${selectedMonth}월_${format}`;
  if (format === 'GeoJSON') {
    const { generateGeoJSON } = await import('./geojsonExport.js');
    return { blob: new Blob([JSON.stringify(generateGeoJSON(dataset, options))], { type: 'application/geo+json' }),
      fileName: `${baseName}.geojson` };
  }
  if (format === 'DXF') {
    const { generateDxf } = await import('./dxfExport.js');
    return { blob: new Blob([generateDxf(dataset, options)], { type: 'application/dxf' }), fileName: `${baseName}.dxf` };
  }
  throw new Error('지원하지 않는 내보내기 형식입니다.');
}
