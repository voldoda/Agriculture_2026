import { calculateGridDrought } from './droughtUtils.js';
import { exactHead } from './headPrecision.js';
import { exportMetadata, getHeadSource, SOURCE_MONTHS } from './dataProvenance.js';
import { surfaceComparison } from './surfaceElevation.js';

// RFC 7946 coordinates are always longitude/latitude; no legacy CRS member.
export function generateGeoJSON(dataset, options = {}) {
  const { selectedMonth = '05', range = 'current', includeContours = true,
    includeDrainagePolygons = true, includeWells = true } = options;
  const features = dataset.grids.map(g => {
    const info = calculateGridDrought(g, selectedMonth);
    const surface = surfaceComparison(g, selectedMonth);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
      properties: {
        id: g.id, row: g.row, col: g.col, year: dataset.metadata?.year ?? null, month: selectedMonth,
        tm_x: g.x, tm_y: g.y, tm_crs: 'EPSG:5179',
        head_m: g.heads?.[selectedMonth] ?? null, surface_el: g.surfaceEl,
        head_m_exact: exactHead(g, selectedMonth),
        depth_m: surface.depthM, depth_reference_m: surface.rawDifferenceM,
        depth_status: surface.status, surface_source: g.surfaceSource ?? null,
        surface_vertical_datum: dataset.metadata?.surfaceElevation?.verticalDatum ?? null,
        head_decline_m: info?.drawdownM ?? null, head_decline_index: info?.score ?? null,
        head_decline_stage: info?.stageLabel ?? '자료 없음',
        drought_index: info?.score ?? null, drought_stage: info?.stageLabel ?? '자료 없음',
        storage_m3: info?.storageM3 ?? null, storage_pct: info?.storageRate ?? null,
        head_source: getHeadSource(selectedMonth, dataset.metadata),
        analysis: 'demo-head-decline-v2', storage_basis: 'unavailable_missing_aquifer_parameters',
        soil: g.soilType,
        ...(range === 'all' ? { heads: Object.fromEntries(
          (dataset.metadata?.sourceMonths ?? dataset.metadata?.calibratedMonths ?? SOURCE_MONTHS).map(m => [m, g.heads?.[m] ?? null])
        ), heads_exact: Object.fromEntries(
          (dataset.metadata?.sourceMonths ?? dataset.metadata?.calibratedMonths ?? SOURCE_MONTHS).map(m => [m, exactHead(g, m)])
        ) } : {}),
      },
    };
  });
  if (includeContours) for (const c of options.contourLines ?? []) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c.coordinates },
      properties: { layer: 'GW_HEAD_CONTOUR', head_m: c.elevation, elevation_m: c.elevation,
        year: c.year, month: c.month, interval_m: options.contourIntervalM ?? 10,
        source: 'derived_model_head', method: 'linear_interpolation_original_50m' } });
  }
  if (includeDrainagePolygons) for (const p of dataset.drainagePolygons ?? []) {
    // GeoJSON exterior rings use counterclockwise winding.
    const ring = [...p.coordinates];
    if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push([...ring[0]]);
    const area = ring.slice(0, -1).reduce((a, pt, i) => a + pt[0] * ring[i + 1][1] - ring[i + 1][0] * pt[1], 0);
    if (area < 0) ring.reverse();
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { layer: 'RISK_ZONE_EXAMPLE', name: p.name, risk: p.riskLevel, area_ha: p.area_ha, source: 'synthetic_example' } });
  }
  if (includeWells) for (const w of dataset.observationWells ?? []) {
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
      properties: { layer: 'WELL_EXAMPLE', id: w.id, name: w.name, depth_m: w.depth, source: 'synthetic_example' } });
  }
  return { type: 'FeatureCollection', metadata: exportMetadata(dataset, selectedMonth), features };
}
