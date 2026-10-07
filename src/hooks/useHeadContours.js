import { useLayoutEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { contourIntervalM, contoursSuppressed, loadMonthlyContours, selectContourLines } from '../utils/headContours';

export function useHeadContours({ mapInstanceRef, dataset, layers }) {
  const active = useRef(null);
  const [error, setError] = useState('');
  const clear = () => {
    const map = mapInstanceRef.current;
    if (active.current && map) {
      map.removeLayer(active.current.group);
      map.removeLayer(active.current.renderer);
    }
    active.current = null;
  };
  useLayoutEffect(() => {
    if (!layers.contour || contoursSuppressed(layers)) { clear(); setError(''); }
  }, [layers.contour, layers.gridMetric]);
  useLayoutEffect(() => () => clear(), [dataset]);
  const prepareContours = async (settings, isCurrent) => {
    if (!settings.layers.contour || contoursSuppressed(settings.layers)) return { commit: clear };
    const month = settings.selectedMonth;
    const interval = contourIntervalM(settings.layers, settings.currentZoom);
    const key = `${month}:${interval}:${settings.currentZoom}`;
    if (active.current?.key === key) return { commit() {} };
    try {
      const data = await loadMonthlyContours(settings.dataset, month);
      if (!isCurrent()) return null;
      const renderer = L.svg({ pane: 'contourPane' });
      const group = L.layerGroup();
      const lines = selectContourLines(data, interval);
      const labelPositions = [];
      let labelCount = 0;
      for (const contour of lines) {
        const latlngs = contour.coordinates.map(([lon, lat]) => [lat, lon]);
        const index = contour.elevation % 50 === 0;
        const weight = index ? 2.1 : 1.1;
        L.polyline(latlngs, { renderer, pane: 'contourPane', color: '#172B42',
          weight: weight + 1.5, opacity: 0.7, interactive: false }).addTo(group);
        L.polyline(latlngs, { renderer, pane: 'contourPane', color: index ? '#FFC857' : '#FFF0B0',
          weight, opacity: 1 }).bindTooltip(
          `<strong>${data.metadata.year}년 ${Number(month)}월 말 · 등수두선</strong><br>` +
          `수위 표고 EL. ${contour.elevation}m · 표시 간격 ${interval}m<br>` +
          '원본 50m 모의수위를 선형 보간한 동일 수위 연결선',
          { sticky: true, className: 'head-contour-tooltip' }).addTo(group);
        // Short disconnected contours stay visible, but do not flood the map with labels.
        const lengthM = contour.coordinates5179.slice(1).reduce((sum, p, i) => {
          const previous = contour.coordinates5179[i];
          return sum + Math.hypot(p[0] - previous[0], p[1] - previous[1]);
        }, 0);
        if (lengthM < 750 || labelCount >= 35) continue;
        const point = latlngs[Math.floor(latlngs.length / 2)];
        const screenPoint = settings.mapInstanceRef.current.latLngToContainerPoint(point);
        const mapSize = settings.mapInstanceRef.current.getSize();
        if (screenPoint.x < 0 || screenPoint.y < 0 || screenPoint.x > mapSize.x || screenPoint.y > mapSize.y ||
            labelPositions.some(p => p.distanceTo(screenPoint) < 65)) continue;
        labelPositions.push(screenPoint);
        labelCount++;
        L.marker(point, { pane: 'contourLabelPane', interactive: false,
          icon: L.divIcon({ className: 'contour-label-wrapper', iconSize: [0, 0], iconAnchor: [0, 0],
            html: `<span class="head-contour-label">${contour.elevation}m</span>` }) }).addTo(group);
      }
      return { commit() {
        clear();
        group.addTo(settings.mapInstanceRef.current);
        const svg = group.getLayers().find(layer => layer.getElement?.())?.getElement().ownerSVGElement;
        svg?.setAttribute('data-contour-month', month);
        svg?.setAttribute('data-contour-interval', String(interval));
        active.current = { key, group, renderer };
        setError('');
      } };
    } catch (failure) {
      if (!isCurrent()) return null;
      // The new raster may still be shown, with an explicit missing-overlay notice.
      return { commit() { clear(); setError(failure.message); } };
    }
  };
  return { prepareContours, contourError: error };
}
