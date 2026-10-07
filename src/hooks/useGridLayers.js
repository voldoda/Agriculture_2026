import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { calculateGridDrought } from '../utils/droughtUtils';
import { indexGridBounds, gridAtPoint } from '../utils/gridViewport';
import { createGridSurfaceLayer } from '../utils/gridSurfaceLayer';

// Prepare the next month offscreen and commit all layers together.
export function useGridLayers(options) {
  const latest = useRef(options);
  latest.current = options;
  const refresh = useRef(null);
  const clearHover = useRef(null);
  const index = useMemo(() => indexGridBounds(options.dataset?.grids ?? []), [options.dataset]);

  useEffect(() => {
    const map = options.mapInstanceRef.current;
    if (!map) return;
    let commitFrame = 0;
    const analysisCache = new WeakMap();
    const getAnalysis = (grid, month) => {
      let analysis = analysisCache.get(grid);
      if (analysis?.month !== month) {
        analysis = { month, info: calculateGridDrought(grid, month) };
        analysisCache.set(grid, analysis);
      }
      return analysis.info;
    };
    const surfaces = ['head', 'drought'].map(type => ({
      type, layer: createGridSurfaceLayer(map, index, type, getAnalysis),
    }));
    let generation = 0;
    let frame = 0;
    let tooltipFrame = 0;
    let hitFrame = 0;
    clearHover.current = () => {
      cancelAnimationFrame(hitFrame);
      cancelAnimationFrame(tooltipFrame);
      latest.current.setHoveredGrid(null);
    };
    const hitTest = event => {
      const settings = latest.current;
      if (!settings.layers.grid && !settings.layers.heatmap) return null;
      const grid = gridAtPoint(index, event.latlng.lat, event.latlng.lng);
      if (!grid) return null;
      // Visibility filtering never removes valid grid locations from inspection.
      // Missing comparisons can also be inspected to explain their gray fill.
      return grid;
    };
    // One indexed hit test works through the stacked Canvas panes and avoids
    // three mouse listeners for each of the 113,076 cells.
    const select = event => {
      const grid = hitTest(event);
      if (grid) latest.current.setSelectedGrid(grid);
    };
    const hover = event => {
      cancelAnimationFrame(hitFrame);
      hitFrame = requestAnimationFrame(() => {
        const grid = hitTest(event), settings = latest.current;
        settings.setHoveredGrid(grid ? { ...grid, currentHead: grid.heads[settings.selectedMonth],
          currentMonth: settings.selectedMonth, droughtInfo: calculateGridDrought(grid, settings.selectedMonth) } : null);
        if (grid) positionTooltip(event);
      });
    };
    const positionTooltip = event => {
      const { clientX, clientY } = event.originalEvent;
      cancelAnimationFrame(tooltipFrame);
      tooltipFrame = requestAnimationFrame(() => latest.current.setTooltipPos({
        x: Math.max(8, Math.min(clientX + 15, window.innerWidth - 272)),
        y: Math.max(8, Math.min(clientY - 30, window.innerHeight - 450)),
      }));
    };

    const renderKey = settings => [settings.requestedMonth, settings.gridShape,
      settings.layers.grid, settings.layers.heatmap, settings.layers.gridMetric,
      settings.layers.gridBorder, settings.layers.gridOpacity, settings.layers.contour,
      settings.layers.declineMetric, settings.layers.declineScope,
      settings.layers.contourInterval, settings.currentZoom].join(':');
    const render = async version => {
      const current = latest.current;
      const key = renderKey(current);
      const settings = { ...current, selectedMonth: current.requestedMonth };
      const isCurrent = () => version === generation && renderKey(latest.current) === key;
      const active = [];
      for (const { type, layer } of surfaces) {
        const enabled = type === 'head' ? settings.layers.grid : settings.layers.heatmap;
        if (enabled) {
          if (!map.hasLayer(layer)) {
            layer.initialize(current);
            layer.addTo(map);
          }
          active.push(layer);
        } else if (map.hasLayer(layer)) map.removeLayer(layer);
      }
      const [frames, contourFrame] = await Promise.all([
        Promise.all(active.map(layer => layer.prepare(settings, isCurrent))),
        settings.prepareContours?.(settings, isCurrent),
      ]);
      if (!isCurrent()) return;
      if (frames.some(frame => !frame?.valid())) { schedule(); return; }
      cancelAnimationFrame(commitFrame);
      commitFrame = requestAnimationFrame(() => {
        if (!isCurrent()) return;
        if (frames.some(frame => !frame.valid())) { schedule(); return; }
        // One browser frame publishes all visible layers and their React labels.
        contourFrame?.commit();
        frames.forEach(frame => frame.commit());
        flushSync(() => {
          latest.current.setHoveredGrid(null);
          if (latest.current.selectedMonth !== settings.selectedMonth) {
            latest.current.onMonthReady(settings.selectedMonth);
          }
        });
      });
    };
    const invalidate = () => {
      generation++;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(commitFrame);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      const version = ++generation;
      frame = requestAnimationFrame(() => render(version));
    };
    refresh.current = schedule;
    map.on('click', select);
    map.on('mousemove', hover);
    map.on('movestart zoomstart', invalidate);
    map.on('moveend resize zoomend', schedule);
    schedule();
    return () => {
      generation++;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(tooltipFrame);
      cancelAnimationFrame(hitFrame);
      map.off('click', select);
      map.off('mousemove', hover);
      map.off('movestart zoomstart', invalidate);
      map.off('moveend resize zoomend', schedule);
      cancelAnimationFrame(commitFrame);
      for (const { layer } of surfaces) if (map.hasLayer(layer)) map.removeLayer(layer);
      refresh.current = null;
      clearHover.current = null;
    };
  }, [index, options.mapInstanceRef]);

  useLayoutEffect(() => {
    if (!options.selectedGrid) clearHover.current?.();
  }, [options.selectedGrid]);

  useEffect(() => { refresh.current?.(); }, [options.requestedMonth, options.gridShape,
    options.layers.grid, options.layers.heatmap, options.layers.gridOpacity, options.layers.gridBorder,
    options.layers.gridMetric, options.layers.declineMetric, options.layers.declineScope,
    options.layers.contour, options.layers.contourInterval, options.currentZoom]);
}
