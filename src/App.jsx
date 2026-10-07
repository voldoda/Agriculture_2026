import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import Header from './components/Header';
import LeftSidebar from './components/LeftSidebar';
import MapViewer from './components/MapViewer';
import RightPanel from './components/RightPanel';
import { droughtOverlaySuppressed } from './utils/headDisplay';
import { buildWaterLevelAlerts } from './utils/waterLevelAlerts';
import { selectionEscapeAction } from './utils/selectionControls';
import MobileBottomSheet from './components/MobileBottomSheet';
import { useResponsive } from './hooks/useResponsive';

import dataUrl from './data/groundwater_data.json?url';
const MonthComparison = lazy(() => import('./components/MonthComparison'));
const ExportModal = lazy(() => import('./components/ExportModal'));

export default function App() {
  const [dataset, setDataset] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError('');
    fetch(dataUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`자료 요청 실패 (${response.status})`);
        return response.json();
      })
      .then(data => {
        if (!data.grids?.length || !data.metadata?.bounds) throw new Error('자료 형식을 확인해주세요.');
        if (!controller.signal.aborted) setDataset(data);
      })
      .catch(error => { if (error.name !== 'AbortError') setLoadError(error.message); });
    return () => controller.abort();
  }, [loadAttempt]);
  const [selectedMonth, setDisplayedMonth] = useState('05');
  const [requestedMonth, setSelectedMonth] = useState('05');
  const [isPlaying, updatePlaying] = useState(false);
  const onMonthReady = useCallback(month => setDisplayedMonth(month), []);
  const setIsPlaying = playing => {
    updatePlaying(playing && !(layers.grid && layers.gridMetric === 'range'));
    if (!playing) setSelectedMonth(selectedMonth); // Cancel an unpublished frame.
  };
  const [selectedGrid, setSelectedGrid] = useState(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [gridShape, setGridShape] = useState('square'); // 'square' (default) or 'circle'
  const [visibleContourInterval, setVisibleContourInterval] = useState(10);
  const alertReport = useMemo(() => dataset ? buildWaterLevelAlerts(dataset.grids, selectedMonth, dataset.metadata?.year) : null,
    [dataset, selectedMonth]);

  // Resizable Right Panel Width (Desktop)
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('hydrogis_right_panel_width'));
      return Number.isFinite(saved) && saved >= 360 ? Math.min(saved, 840) : 384;
    } catch { return 384; }
  });

  const handleRightPanelWidthChange = (newWidth) => {
    setRightPanelWidth(newWidth);
    try { localStorage.setItem('hydrogis_right_panel_width', String(newWidth)); } catch { /* Optional preference. */ }
  };

  // Adaptive Drawer States
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const { isMobile, isTablet, isDesktop, deviceType } = useResponsive();
  const handleClearSelection = useCallback(() => setSelectedGrid(null), []);

  useEffect(() => {
    const handleKeyDown = event => {
      const action = selectionEscapeAction(event, {
        comparison: isComparisonOpen, export: isExportOpen,
        leftDrawer: !isDesktop && isLeftDrawerOpen, rightDrawer: isTablet && isRightDrawerOpen,
        selected: Boolean(selectedGrid),
      });
      // The comparison dialog owns its keyboard and focus handling.
      if (!action || action === 'comparison') return;
      event.preventDefault();
      if (action === 'export') setIsExportOpen(false);
      else if (action === 'drawers') {
        setIsLeftDrawerOpen(false);
        setIsRightDrawerOpen(false);
      } else handleClearSelection();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isComparisonOpen, isExportOpen, isLeftDrawerOpen, isRightDrawerOpen, isDesktop, isTablet, selectedGrid, handleClearSelection]);

  // Layer Visibility & Settings
  const [layers, setLayers] = useState({
    grid: true,
    gridOpacity: 0.95,
    gridMetric: 'deviation',
    gridBorder: 'auto',
    contour: false,
    contourInterval: 'auto',
    heatmap: false,
    declineMetric: 'stage',
    declineScope: 'auto',
    drainage: false,
    wells: false,
  });

  const isAnnualRange = layers.grid && layers.gridMetric === 'range';
  const handleGridMetricChange = metric => {
    if (layers.grid && metric === 'range') setIsPlaying(false); // Keep the last published month; cancel pending playback.
    setLayers(prev => ({ ...prev, gridMetric: metric }));
  };
  const handleMonthChange = month => {
    if (!isAnnualRange) setSelectedMonth(month);
  };

  useEffect(() => {
    if (isAnnualRange && isPlaying) {
      updatePlaying(false);
      setSelectedMonth(selectedMonth);
    }
  }, [isAnnualRange, isPlaying, selectedMonth]);

  // Wait for a committed frame before scheduling the next month.
  useEffect(() => {
    if (isAnnualRange || !isPlaying || requestedMonth !== selectedMonth) return;
    const timer = setTimeout(() => {
      setSelectedMonth(String(Number(selectedMonth) % 12 + 1).padStart(2, '0'));
    }, 1800);
    return () => clearTimeout(timer);
  }, [isAnnualRange, isPlaying, requestedMonth, selectedMonth]);

  // Handle selecting an anomaly alert card
  const handleSelectAnomaly = (anomaly) => {
    const foundGrid = dataset.grids.find(g => g.id === anomaly.id);
    if (foundGrid) setSelectedGrid(foundGrid);
  };

  if (!dataset) return (
    <main className="h-screen bg-slate-950 text-slate-200 flex flex-col gap-4 items-center justify-center p-6">
      <h1 className="text-lg font-bold">유역 모니터링 시작품</h1>
      <p role={loadError ? 'alert' : 'status'}>{loadError || '유역 자료를 불러오는 중입니다…'}</p>
      {loadError && <button className="rounded bg-blue-600 px-4 py-2" onClick={() => setLoadAttempt(n => n + 1)}>다시 시도</button>}
    </main>
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-slate-100 overflow-hidden font-sans">
      {/* 1. Top Header */}
      <Header
        onOpenExport={() => { setIsPlaying(false); setIsExportOpen(true); }}
        onToggleLeftDrawer={() => setIsLeftDrawerOpen(!isLeftDrawerOpen)}
        onToggleRightDrawer={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
        isLeftDrawerOpen={isLeftDrawerOpen}
        isRightDrawerOpen={isRightDrawerOpen}
        deviceType={deviceType}
      />

      {/* 2. Main Content Area (Adaptive 3-Tier Layout) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Static Left Sidebar */}
        {isDesktop && (
          <LeftSidebar
            selectedMonth={selectedMonth}
            setSelectedMonth={handleMonthChange}
            onGridMetricChange={handleGridMetricChange}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            layers={layers}
            setLayers={setLayers}
            gridShape={gridShape}
            setGridShape={setGridShape}
            onOpenComparison={() => { setIsPlaying(false); setIsComparisonOpen(true); }}
            metadata={dataset.metadata}
            grids={dataset.grids}
            isDrawer={false}
          />
        )}

        {/* Mobile & Tablet Slide-Over Drawer for Left Controls */}
        {!isDesktop && (
          <LeftSidebar
            selectedMonth={selectedMonth}
            setSelectedMonth={handleMonthChange}
            onGridMetricChange={handleGridMetricChange}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            layers={layers}
            setLayers={setLayers}
            gridShape={gridShape}
            setGridShape={setGridShape}
            onOpenComparison={() => { setIsPlaying(false); setIsComparisonOpen(true); }}
            metadata={dataset.metadata}
            grids={dataset.grids}
            isOpen={isLeftDrawerOpen}
            onClose={() => setIsLeftDrawerOpen(false)}
            isDrawer={true}
          />
        )}

        {/* Center Main Map Viewer */}
        <MapViewer
          dataset={dataset}
          selectedMonth={selectedMonth}
          requestedMonth={requestedMonth}
          onMonthReady={onMonthReady}
          onContourIntervalReady={setVisibleContourInterval}
          selectedGrid={selectedGrid}
          setSelectedGrid={setSelectedGrid}
          onClearSelection={handleClearSelection}
          layers={{ ...layers, heatmap: layers.heatmap && !droughtOverlaySuppressed(layers) }}
          gridShape={gridShape}
        />

        {/* Desktop Static Right Panel (Resizable) */}
        {isDesktop && (
          <RightPanel
            selectedGrid={selectedGrid}
            onSelectGrid={handleSelectAnomaly}
            onClearSelection={handleClearSelection}
            alertReport={alertReport}
            selectedMonth={selectedMonth}
            isAnnualRange={isAnnualRange}
            dataset={dataset}
            width={rightPanelWidth}
            onWidthChange={handleRightPanelWidthChange}
            isDrawer={false}
          />
        )}

        {/* Tablet Slide-Over Drawer for Right Panel */}
        {isTablet && (
          <RightPanel
            selectedGrid={selectedGrid}
            onSelectGrid={handleSelectAnomaly}
            onClearSelection={handleClearSelection}
            alertReport={alertReport}
            selectedMonth={selectedMonth}
            isAnnualRange={isAnnualRange}
            dataset={dataset}
            isOpen={isRightDrawerOpen}
            onClose={() => setIsRightDrawerOpen(false)}
            isDrawer={true}
          />
        )}

        {/* Mobile Interactive Bottom Sheet */}
        {isMobile && (
          <MobileBottomSheet
            selectedGrid={selectedGrid}
            onSelectGrid={handleSelectAnomaly}
            onClearSelection={handleClearSelection}
            alertReport={alertReport}
            selectedMonth={selectedMonth}
            isAnnualRange={isAnnualRange}
            dataset={dataset}
          />
        )}
      </div>

      {isComparisonOpen && <Suspense fallback={<div role="status" className="fixed inset-0 z-[1000] bg-slate-900 p-8">비교 화면 준비 중…</div>}>
        <MonthComparison dataset={dataset} selectedMonth={selectedMonth} initialMode={layers.gridMetric}
          onClose={() => setIsComparisonOpen(false)}
          onSelectMonth={(month, mode) => {
            setIsPlaying(false);
            setLayers(prev => ({ ...prev, grid: true, gridMetric: mode }));
            setSelectedMonth(month);
            setIsComparisonOpen(false);
            setIsLeftDrawerOpen(false);
          }} />
      </Suspense>}

      {/* 3. Export Modal */}
      {isExportOpen && <Suspense fallback={<div role="status" className="fixed bottom-4 right-4 z-50 bg-slate-900 p-4">내보내기 창 준비 중…</div>}><ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        dataset={dataset}
        selectedMonth={selectedMonth}
        contourIntervalM={visibleContourInterval}
      /></Suspense>}

    </div>
  );
}
