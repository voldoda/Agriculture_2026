const manifests = new Map(), months = new Map();
const fetchJson = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`등수두선 자료 요청 실패 (${response.status})`);
  return response.json();
};
const cached = (cache, key, get) => {
  if (!cache.has(key)) cache.set(key, get().catch(error => { cache.delete(key); throw error; }));
  return cache.get(key);
};
export function contourIntervalM(layers, zoom = 12) {
  return layers.contourInterval === '5' ? 5 : layers.contourInterval === '10' ? 10 : zoom >= 14 ? 5 : 10;
}
export function contoursSuppressed(layers) { return layers.gridMetric !== 'head'; }
export function selectContourLines(data, interval = 10) {
  return (data?.features ?? []).filter(f => Math.abs(f.properties.head_m / interval - Math.round(f.properties.head_m / interval)) < 1e-10)
    .map(f => ({ elevation: f.properties.head_m, coordinates: f.geometry.coordinates,
      coordinates5179: f.coordinates5179, month: f.properties.month, year: f.properties.year,
      source: f.properties.source }));
}
export async function loadMonthlyContours(dataset, month) {
  const reference = dataset.metadata?.contours;
  if (!reference?.manifestUrl) throw new Error('월별 등수두선 자료를 먼저 생성해주세요.');
  const manifest = await cached(manifests, reference.manifestUrl, () => fetchJson(reference.manifestUrl));
  if (manifest.sourceDigest !== reference.sourceDigest || manifest.year !== dataset.metadata.year ||
      manifest.sourceCells !== dataset.grids.length) throw new Error('등수두선과 수위 자료의 버전이 다릅니다.');
  const entry = manifest.months[month];
  if (!entry) throw new Error(`${month}월 등수두선 자료가 없습니다.`);
  const data = await cached(months, entry.url, () => fetchJson(entry.url));
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) ||
      data.metadata?.sourceDigest !== reference.sourceDigest || data.metadata?.month !== month ||
      data.metadata?.year !== dataset.metadata.year || data.features.some(f =>
        f.geometry?.type !== 'LineString' || !Number.isFinite(f.properties?.head_m) ||
        f.properties?.month !== month || f.properties?.source !== 'derived_model_head')) {
    months.delete(entry.url); // A retry must fetch a fresh file, rather than reuse invalid content.
    throw new Error('등수두선의 월·연도·출처를 확인해주세요.');
  }
  return data;
}
