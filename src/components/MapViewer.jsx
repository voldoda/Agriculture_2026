import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useHeadContours } from '../hooks/useHeadContours';
import { contourIntervalM, contoursSuppressed } from '../utils/headContours';
import { useGridLayers } from '../hooks/useGridLayers';
import { projectWgs84 } from '../utils/projection';
import HeadChangeSummary from './HeadChangeSummary';
import SurfaceReferenceNote from './SurfaceReferenceNote';
import { surfaceComparison } from '../utils/surfaceElevation';
import { calculateGridDrought } from '../utils/droughtUtils';
import { declineCaption } from '../utils/declineDisplay';
import { gridMetricValue, metricText, metricCaption, METRIC_LABELS } from '../utils/headDisplay';
import { watershedBounds, unobscuredWatershedPadding, createWatershedViewport } from '../utils/watershedViewport';
import { 
  Maximize2, 
  RotateCcw, 
  Map as MapIcon, 
  Compass, 
  Crosshair, 
  Ruler, 
  Layers,
  Sparkles,
  Grid,
  Circle
} from 'lucide-react';

export default function MapViewer({
  dataset,
  selectedMonth,
  requestedMonth,
  onMonthReady,
  onContourIntervalReady,
  selectedGrid,
  setSelectedGrid,
  onClearSelection,
  layers,
  gridShape = 'square' // 'square' (default) or 'circle'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const viewportRef = useRef(null);
  const headCaptionRef = useRef(null);
  const declineCaptionRef = useRef(null);
  const coordinateBarRef = useRef(null);
  const navigationRef = useRef(null);
  const bounds = useMemo(() => watershedBounds(dataset), [dataset]);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const drainageLayerGroupRef = useRef(null);

  const wellsLayerGroupRef = useRef(null);
  const selectionMarkerRef = useRef(null);
  const selectionBadgeRef = useRef(null);

  const [mouseCoord, setMouseCoord] = useState(() => {
    const [lat, lon] = dataset.metadata.bounds.center;
    const [x, y] = projectWgs84(lon, lat, 'EPSG:5179').map(Math.round);
    return { lat, lon, x, y };
  });
  const [hoveredGrid, setHoveredGrid] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [basemapType, setBasemapType] = useState('streets');
  const [basemapMuted, setBasemapMuted] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12);
  useEffect(() => { onContourIntervalReady?.(contourIntervalM(layers, currentZoom)); },
    [layers.contourInterval, currentZoom, onContourIntervalReady]);

  const metadata = dataset?.metadata || {};
  const centerLat = metadata.bounds?.center?.[0] || 36.5644;
  const centerLon = metadata.bounds?.center?.[1] || 126.9899;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 12,
      zoomSnap: 0.05,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true // Canvas rendering for high performance interlocking polygons
    });

    const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors'
    });

    streetTile.addTo(map);
    mapInstanceRef.current = map;


    // Create Custom Panes with strict Z-Index Hierarchy (Prevents layers from burying each other on zoom)
    map.createPane('gridPane');
    map.getPane('gridPane').style.zIndex = '410';
    map.getPane('gridPane').style.pointerEvents = 'none';

    map.createPane('droughtPane');
    map.getPane('droughtPane').style.zIndex = '420';
    map.getPane('droughtPane').style.pointerEvents = 'none';

    map.createPane('drainagePane');
    map.getPane('drainagePane').style.zIndex = '430';

    map.createPane('contourPane');
    map.getPane('contourPane').style.zIndex = '450';
    map.getPane('contourPane').style.pointerEvents = 'auto';

    map.createPane('contourLabelPane');
    map.getPane('contourLabelPane').style.zIndex = '460';
    map.getPane('contourLabelPane').style.pointerEvents = 'auto';

    map.createPane('selectionPane');
    map.getPane('selectionPane').style.zIndex = '500';

    // Layer Groups

    drainageLayerGroupRef.current = L.layerGroup().addTo(map);

    wellsLayerGroupRef.current = L.layerGroup().addTo(map);

    // Zoom & Mouse events
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    let coordinateFrame = 0;
    map.on('mousemove', (e) => {
      const { lat, lng } = e.latlng;
      cancelAnimationFrame(coordinateFrame);
      coordinateFrame = requestAnimationFrame(() => {
        const [x, y] = projectWgs84(lng, lat, 'EPSG:5179').map(Math.round);
        setMouseCoord({ lat: +lat.toFixed(5), lon: +lng.toFixed(5), x, y });
      });
    });

    const viewport = createWatershedViewport(map, {
      getBounds: () => boundsRef.current,
      getPadding: size => {
        const mapRect = mapContainerRef.current.getBoundingClientRect();
        const overlays = [headCaptionRef.current, declineCaptionRef.current, coordinateBarRef.current,
          document.querySelector('[data-map-overlay="bottom"]')];
        let bottomInset = 0;
        for (const overlay of overlays) {
          if (!overlay) continue;
          const rect = overlay.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.bottom > mapRect.top && rect.top < mapRect.bottom) {
            bottomInset = Math.max(bottomInset, mapRect.bottom - Math.max(mapRect.top, rect.top));
          }
        }
        const navigation = navigationRef.current?.getBoundingClientRect();
        const rightInset = navigation?.width > 0 ? Math.max(0, mapRect.right - navigation.left) : 0;
        return unobscuredWatershedPadding(map, boundsRef.current, size, {
          bottomInset, rightInset,
          navigationBottom: navigation?.height > 0 ? Math.max(0, navigation.bottom - mapRect.top) : 0,
        });
      },
    });
    viewportRef.current = viewport;
    // Throttle resize events, including responsive side panels and bottom sheets.
    let bottomSheet = null;
    const observeBottomSheet = () => {
      const next = document.querySelector('[data-map-overlay="bottom"]');
      if (next === bottomSheet) return;
      if (bottomSheet) resizeObserver.unobserve(bottomSheet);
      bottomSheet = next;
      if (bottomSheet) resizeObserver.observe(bottomSheet);
    };
    const resizeObserver = new ResizeObserver(() => {
      observeBottomSheet();
      viewport.resize();
    });
    resizeObserver.observe(mapContainerRef.current);
    observeBottomSheet();
    viewport.reset();

    return () => {
      resizeObserver.disconnect();
      viewport.dispose();
      viewportRef.current = null;
      cancelAnimationFrame(coordinateFrame);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => { viewportRef.current?.resize(); },
    [bounds, layers.grid, layers.heatmap, layers.gridMetric, layers.contour]);

  // Handle Basemap Switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const vworldKey = (import.meta.env.VITE_VWORLD_KEY || '').trim();
    if (!vworldKey) {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      return;
    }

    if (basemapType === 'satellite') {
      // Vworld Satellite + Hybrid (국토교통부 고해상도 영상 + 행정/도로/지명 하이브리드)
      const satLayer = L.tileLayer(
        `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Satellite/{z}/{y}/{x}.jpeg`,
        {
          minZoom: 6,
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.vworld.kr/" target="_blank" class="text-blue-400 hover:underline">Vworld</a>'
        }
      );
      const hybridLayer = L.tileLayer(
        `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Hybrid/{z}/{y}/{x}.png`,
        {
          minZoom: 6,
          maxZoom: 19,
          pane: 'tilePane'
        }
      );
      satLayer.addTo(map);
      hybridLayer.addTo(map);
    } else if (basemapType === 'streets') {
      // Vworld Base (국토교통부 국가공간정보 표준 2D 전자지도)
      const baseLayer = L.tileLayer(
        `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Base/{z}/{y}/{x}.png`,
        {
          minZoom: 6,
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.vworld.kr/" target="_blank" class="text-blue-400 hover:underline">Vworld</a>'
        }
      );
      baseLayer.addTo(map);
    } else {
      // Vworld midnight (국토교통부 야간/다크 모드 전자지도)
      const darkLayer = L.tileLayer(
        `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/midnight/{z}/{y}/{x}.png`,
        {
          minZoom: 6,
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.vworld.kr/" target="_blank" class="text-blue-400 hover:underline">Vworld</a>'
        }
      );
      darkLayer.addTo(map);
    }
  }, [basemapType]);

  const { prepareContours, contourError } = useHeadContours({ mapInstanceRef, dataset, layers });

  useGridLayers({ prepareContours, mapInstanceRef, dataset, selectedMonth, requestedMonth, onMonthReady, layers, gridShape, currentZoom,
    setHoveredGrid, setTooltipPos, setSelectedGrid, selectedGrid });

  // Render Agricultural Drought & Depletion Risk Polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = drainageLayerGroupRef.current;
    if (!map || !group || !dataset?.drainagePolygons) return;

    group.clearLayers();
    if (!layers.drainage) return;

    dataset.drainagePolygons.forEach((poly) => {
      const latlngs = poly.coordinates.map(pt => [pt[1], pt[0]]);
      
      const polygon = L.polygon(latlngs, {
        pane: 'drainagePane',
        color: '#F59E0B',
        weight: 2.2,
        dashArray: '6, 3',
        fillColor: '#D97706',
        fillOpacity: 0.25,
        lineCap: 'round'
      });

      polygon.bindTooltip(`
        <div class="p-1">
          <div class="font-bold text-amber-300">${poly.name}</div>
          <div class="text-[11px] text-slate-300">면적: ${poly.area_ha} ha | 관리등급: ${poly.riskLevel}</div>
          <div class="text-[10px] text-amber-200/80">${poly.description || '갈수기 농업용수 수위급저하 집중 관리구역'}</div>
        </div>
      `, {
        sticky: true,
        className: 'bg-slate-900/95 text-slate-100 text-xs rounded-lg border border-amber-500/50 shadow-xl'
      });

      polygon.addTo(group);
    });
  }, [dataset, layers.drainage]);

  // Render Observation Wells
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = wellsLayerGroupRef.current;
    if (!map || !group || !dataset?.observationWells) return;

    group.clearLayers();
    if (!layers.wells) return;

    dataset.observationWells.forEach((well) => {
      const icon = L.divIcon({
        className: 'custom-well-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-lg animate-bounce"></div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-slate-900/90 text-purple-300 border border-purple-500/40 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
              ${well.id}
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([well.lat, well.lon], { icon });
      marker.bindPopup(`
        <div class="p-2 space-y-1">
          <div class="font-bold text-sm text-purple-300">${well.name}</div>
          <div class="text-xs text-slate-300">굴착심도: <strong class="font-mono text-slate-100">${well.depth}m</strong></div>
          <div class="text-xs text-slate-300">대수층: <strong class="text-slate-100">${well.aquifer}</strong></div>
          <div class="text-xs text-emerald-400 font-mono flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            예시 관측정 · 원격 연동 없음
          </div>
        </div>
      `);
      marker.addTo(group);
    });
  }, [dataset, layers.wells]);

  // Move only when the selected cell changes, not on every timeline tick.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && selectedGrid) {
      viewportRef.current?.preserve();
      map.flyTo([selectedGrid.lat, selectedGrid.lon], Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
    else if (map) map.stop(); // Cancel an unfinished selection flight without resetting the view.
  }, [selectedGrid]);

  // Update Selected Grid Glowing Target Highlight Box
  useLayoutEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectionMarkerRef.current) {
      map.removeLayer(selectionMarkerRef.current);
      selectionMarkerRef.current = null;
      selectionBadgeRef.current = null;
    }

    if (selectedGrid) {
      const highlightLayers = [];

      if (gridShape === 'square' && selectedGrid.polygon) {
        // 1-A. Outer Black Contrast Shadow Stroke (Protects against bright/cyan/white backgrounds)
        const shadowPoly = L.polygon(selectedGrid.polygon, {
          pane: 'selectionPane',
          color: '#000000',
          weight: 6.5,
          opacity: 0.95,
          fill: false,
          interactive: false
        });
        highlightLayers.push(shadowPoly);

        // 1-B. Inner High-Contrast Neon Yellow Stroke & Glowing Fill
        const neonPoly = L.polygon(selectedGrid.polygon, {
          pane: 'selectionPane',
          color: '#FACC15',
          weight: 3.5,
          fillColor: '#FACC15',
          fillOpacity: 0.35,
          className: 'selection-neon-box',
          interactive: false
        });
        highlightLayers.push(neonPoly);
      } else {
        // Point / Circle Mode High-Contrast Double Ring
        const shadowCircle = L.circleMarker([selectedGrid.lat, selectedGrid.lon], {
          pane: 'selectionPane',
          radius: 10,
          color: '#000000',
          weight: 6,
          fill: false,
          interactive: false
        });
        const neonCircle = L.circleMarker([selectedGrid.lat, selectedGrid.lon], {
          pane: 'selectionPane',
          radius: 10,
          color: '#FACC15',
          weight: 3.5,
          fillColor: '#FACC15',
          fillOpacity: 0.4,
          className: 'selection-neon-box',
          interactive: false
        });
        highlightLayers.push(shadowCircle, neonCircle);
      }



      // 3. Floating Smart Pin Badge Marker (Elevated above the grid with pointer arrow)
      const topLat = selectedGrid.polygon 
        ? Math.max(...selectedGrid.polygon.map(p => p[0])) 
        : selectedGrid.lat;

      const badgeIcon = L.divIcon({
        className: 'custom-floating-badge-marker',
        html: `
          <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-full mb-2 pointer-events-none select-none z-[1000] selection-floating-badge">
            <!-- Capsule Badge Body -->
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/95 border-2 border-amber-400 shadow-[0_4px_20px_rgba(0,0,0,0.8)] backdrop-blur text-[11px] font-mono whitespace-nowrap">
              <span class="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block"></span>
              <span class="font-extrabold text-white tracking-wide">${selectedGrid.id}</span>
              <span class="text-slate-400">|</span>
              <span class="selection-value text-amber-300 font-extrabold"></span>
              <button type="button" aria-label="지도에서 지점 선택 해제" title="지점 선택 해제 (Esc)"
                class="selection-clear-button pointer-events-auto ml-1 rounded-full w-8 h-8 flex items-center justify-center text-lg text-amber-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">&times;</button>
            </div>
            <!-- Downward Pointer Arrow -->
            <div class="w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-amber-400 -mt-[1px] drop-shadow-md"></div>
          </div>
        `,
        iconSize: [0, 0]
      });
      const badgeMarker = L.marker([topLat, selectedGrid.lon], { icon: badgeIcon, interactive: false, keyboard: false });
      highlightLayers.push(badgeMarker);

      selectionMarkerRef.current = L.layerGroup(highlightLayers).addTo(map);
      selectionBadgeRef.current = badgeMarker;
      const element = badgeMarker.getElement();
      const button = element.querySelector('.selection-clear-button');
      // A badge click must never reach the indexed map hit test and reselect a cell.
      L.DomEvent.disableClickPropagation(element);
      L.DomEvent.disableScrollPropagation(element);
      const hideHover = event => {
        L.DomEvent.stopPropagation(event);
        setHoveredGrid(null);
      };
      const clearSelection = event => {
        L.DomEvent.stop(event);
        onClearSelection();
        mapContainerRef.current?.focus({ preventScroll: true });
      };
      element.addEventListener('mousemove', hideHover);
      button.addEventListener('click', clearSelection);
      return () => {
        element.removeEventListener('mousemove', hideHover);
        button.removeEventListener('click', clearSelection);
        map.removeLayer(selectionMarkerRef.current);
        selectionMarkerRef.current = null;
        selectionBadgeRef.current = null;
      };
    }
  }, [selectedGrid, gridShape, onClearSelection]);

  // Keep the marker and its animation alive; only its value changes per month.
  useLayoutEffect(() => {
    const value = selectionBadgeRef.current?.getElement()?.querySelector('.selection-value');
    if (value && selectedGrid) {
      if (layers.heatmap) {
        const info = calculateGridDrought(selectedGrid, selectedMonth);
        value.textContent = !info ? '저하 비교 자료 없음' : layers.declineMetric === 'amount'
          ? `연내 최고 대비 ${(info.drawdownM * 100).toFixed(1)} cm 저하`
          : `${info.stageLabel} · ${info.scorePercent}%`;
      } else {
        const metric = layers.gridMetric ?? 'head';
        value.textContent = `${METRIC_LABELS[metric]} ${metricText(gridMetricValue(selectedGrid, selectedMonth, metric), metric)}`;
      }
    }
  }, [selectedGrid, gridShape, selectedMonth, layers.gridMetric, layers.heatmap, layers.declineMetric]);

  const handleResetBounds = () => {
    setHoveredGrid(null);
    viewportRef.current?.reset();
  };

  return (
    <div className="map-shell relative flex-1 h-full overflow-hidden"
      data-basemap={basemapType} data-basemap-muted={basemapType === 'streets' && basemapMuted}>
      {/* Keep className constant: Leaflet adds its own required container classes.
          React must not replace those classes when display settings change. */}
      {contourError && <div role="alert" className="absolute left-3 top-3 z-[600] rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">등수두선을 표시하지 못했습니다: {contourError}<br />레이어를 껐다 켜면 다시 요청합니다.</div>}
      <div ref={mapContainerRef} className="w-full h-full z-10" />
      {layers.grid && <div ref={headCaptionRef} role="status" className="absolute bottom-14 left-3 z-20 max-w-[calc(100%-2rem)] bg-panel/90 border border-panelBorder rounded-lg px-3 py-2 shadow text-[11px] text-slate-200">
        <strong>{METRIC_LABELS[layers.gridMetric ?? 'head']}</strong>
        <span className="ml-2">{metricCaption(selectedMonth, layers.gridMetric, metadata.year)}</span>
      </div>}
      {layers.heatmap && !layers.grid && <div ref={declineCaptionRef} role="status" aria-label="표시 중인 수위 저하 지도" className="absolute bottom-14 left-3 z-20 max-w-[calc(100%-2rem)] bg-panel/90 border border-panelBorder rounded-lg px-3 py-2 shadow text-[11px] text-slate-200">
        {declineCaption(selectedMonth, layers, metadata.year)}
      </div>}

      {layers.contour && !contoursSuppressed(layers) && !contourError && (
        <div role="status" aria-label="등수두선 설명" className="absolute top-3 md:top-4 left-3 md:left-4 max-w-[calc(100%-8rem)] z-20 bg-panel/95 border border-amber-400 rounded-lg px-3 py-2 shadow text-[11px] text-slate-200">
          <strong>{metadata.year}년 {Number(selectedMonth)}월 등수두선 · {contourIntervalM(layers, currentZoom)}m 간격</strong>
          <p className="mt-1 text-slate-400">월말 수위 · 동일 수위 표고를 연결한 선</p>
        </div>
      )}

      {/* Floating Map Navigation & Basemap Switcher Controls */}
      <div ref={navigationRef} className="absolute top-3 md:top-4 right-3 md:right-4 z-20 flex flex-col space-y-2">
        {/* Reset View Button */}
        <button
          onClick={handleResetBounds}
          title="유역 전체 영역 맞춤 (Fit Watershed Bounds)"
          className="p-2 md:p-2.5 rounded-lg bg-panel/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-panelBorder shadow-xl backdrop-blur transition-all active:scale-95 flex items-center justify-center"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* GPS Geolocation Button */}
        <button
          onClick={() => {
            if (navigator.geolocation && mapInstanceRef.current) {
              viewportRef.current?.preserve();
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { latitude, longitude } = pos.coords;
                  mapInstanceRef.current.flyTo([latitude, longitude], 14, { duration: 1.2 });
                },
                (err) => {
                  // Fallback center of Yugu-cheon
                  mapInstanceRef.current.flyTo([centerLat, centerLon], 13, { duration: 1.0 });
                }
              );
            }
          }}
          title="내 GPS 현재 위치로 이동"
          className="p-2 md:p-2.5 rounded-lg bg-panel/90 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-panelBorder shadow-xl backdrop-blur transition-all active:scale-95 flex items-center justify-center"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <div className="bg-panel/90 border border-panelBorder rounded-lg p-1 shadow-xl backdrop-blur flex flex-col space-y-1">
          {(import.meta.env.VITE_VWORLD_KEY || '').trim() ? <>
          <button
            onClick={() => setBasemapType('streets')}
            aria-pressed={basemapType === 'streets'}
            className={`px-2 md:px-2.5 py-1 rounded text-[10px] md:text-[11px] font-medium transition-all text-left ${
              basemapType === 'streets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Vworld 일반
          </button>
          <button
            onClick={() => setBasemapType('satellite')}
            aria-pressed={basemapType === 'satellite'}
            className={`px-2 md:px-2.5 py-1 rounded text-[10px] md:text-[11px] font-medium transition-all text-left ${
              basemapType === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Vworld 위성
          </button>
          <button
            onClick={() => setBasemapType('dark')}
            aria-pressed={basemapType === 'dark'}
            className={`px-2 md:px-2.5 py-1 rounded text-[10px] md:text-[11px] font-medium transition-all text-left ${
              basemapType === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Vworld 다크
          </button>
          </> : <p className="px-2 py-1 text-[10px] md:text-[11px] text-slate-300">OpenStreetMap 일반</p>}
          <div className="border-t border-panelBorder pt-2 px-1 pb-1">
            <label className={`flex items-center gap-1.5 text-[10px] md:text-[11px] ${basemapType === 'streets' ? 'text-slate-300 cursor-pointer' : 'text-slate-400'}`}>
              <input type="checkbox" aria-label="배경지도 옅게" aria-describedby="basemap-muted-help"
                checked={basemapType === 'streets' && basemapMuted} disabled={basemapType !== 'streets'}
                onChange={event => setBasemapMuted(event.target.checked)} className="accent-blue-600" />
              배경지도 옅게
            </label>
            <p id="basemap-muted-help" className="mt-1 text-[9px] text-slate-400">일반 지도 전용</p>
          </div>
        </div>
      </div>

      {/* Real-time Bottom Coordinate & Scale Indicator Bar */}
      <div ref={coordinateBarRef} className="hidden md:flex absolute bottom-3 left-3 z-20 bg-panel/90 border border-panelBorder px-3 py-1.5 rounded-lg shadow-lg backdrop-blur text-[11px] text-slate-300 items-center space-x-4 font-mono select-none">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-blue-400" />
          <span>WGS84: {mouseCoord.lat}°N, {mouseCoord.lon}°E</span>
        </div>
        <div className="w-px h-3 bg-slate-700"></div>
        <div className="flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span>TM(5179): X={mouseCoord.x.toLocaleString()}m, Y={mouseCoord.y.toLocaleString()}m</span>
        </div>
        <div className="w-px h-3 bg-slate-700"></div>
        <div className="text-slate-400 flex items-center gap-1 font-sans">
          <span>격자 형태:</span>
          <strong className="text-cyan-300 font-mono flex items-center gap-1">
            {gridShape === 'square' ? <Grid className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {gridShape === 'square' ? '약 50m 원본 격자' : '원형 Point'}
          </strong>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredGrid && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-900/95 border border-cyan-500/50 rounded-xl p-3 shadow-2xl backdrop-blur text-xs w-64 space-y-2 transition-all transform duration-75"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-mono font-bold text-cyan-300 text-[13px]">{hoveredGrid.id}</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">
              Row {hoveredGrid.row} / Col {hoveredGrid.col}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block">지하수위 (HEAD)</span>
              <strong className="text-base font-mono text-cyan-400">
                {Number.isFinite(hoveredGrid.currentHead) ? hoveredGrid.currentHead.toFixed(2) : '자료 없음'} <span className="text-xs font-normal">m</span>
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">지표고 (DEM 참고)</span>
              <strong className="text-sm font-mono text-slate-200">
                {hoveredGrid.surfaceEl?.toFixed(1) ?? '자료 없음'} <span className="text-xs font-normal">m</span>
              </strong>
            </div>
          </div>

          <HeadChangeSummary grid={hoveredGrid} month={selectedMonth} isAnnualRange={layers.grid && layers.gridMetric === 'range'} />
          <p className="text-[11px] text-slate-400">연내 최고 대비 저하량: {hoveredGrid.droughtInfo ? `${(hoveredGrid.droughtInfo.drawdownM * 100).toFixed(1)} cm` : '비교 자료 없음'}</p>
          <p className="text-[11px] text-slate-400">지표고−수두: {surfaceComparison(hoveredGrid, selectedMonth).rawDifferenceM?.toFixed(1) ?? '자료 없음'} m (참고)</p>
          <SurfaceReferenceNote grid={hoveredGrid} month={selectedMonth} />
          <div className="border-t border-slate-800 pt-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">예시 수위 저하 단계 ({hoveredGrid.currentMonth || selectedMonth}월):</span>
              <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                hoveredGrid.droughtInfo?.textBadgeClass || 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {hoveredGrid.droughtInfo?.stage === '심각' ? '저하 매우 큼' : (
                  hoveredGrid.droughtInfo?.stage === '주의' ? '저하 큼' : (
                    hoveredGrid.droughtInfo?.stage === '관심' ? '저하 보통' : (hoveredGrid.droughtInfo ? '저하 작음' : '자료 없음')
                  )
                )}
                ({hoveredGrid.droughtInfo?.scorePercent ?? '—'}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">저류량 (산정 자료 없음):</span>
              <span className="font-mono text-cyan-300 font-semibold">
                산정 자료 없음
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-center bg-slate-800/60 py-0.5 rounded">
            클릭하여 시계열 및 상세 분석 조회
          </div>
        </div>
      )}
    </div>
  );
}
