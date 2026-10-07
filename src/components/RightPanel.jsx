import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  ComposedChart,
  Bar
} from 'recharts';
import {
  TrendingUp,
  MapPin,
  BarChart3,
  Calendar,
  Layers,
  ChevronRight,
  Droplets,
  Activity,
  Sliders,
  X,
  GripVertical
} from 'lucide-react';
import { calculateGridDrought } from '../utils/droughtUtils';
import { buildChartData } from '../utils/chartData';
import HeadChangeSummary from './HeadChangeSummary';
import SurfaceReferenceNote from './SurfaceReferenceNote';
import WaterLevelAlerts from './WaterLevelAlerts';
import UnselectedPoint from './UnselectedPoint';
import { surfaceComparison } from '../utils/surfaceElevation';

export default function RightPanel({
  selectedGrid,
  onSelectGrid,
  onClearSelection,
  alertReport,
  selectedMonth,
  isAnnualRange = false,
  dataset,
  isOpen = true,
  onClose,
  isDrawer = false,
  width = 384,
  onWidthChange
}) {
  const [showAvgLine, setShowAvgLine] = useState(true);
  const [showTrendLine, setShowTrendLine] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  const grid = selectedGrid;

  const currentHead = grid?.heads?.[selectedMonth];
  const depthToWater = surfaceComparison(grid, selectedMonth).rawDifferenceM;
  const dInfo = useMemo(() => calculateGridDrought(grid, selectedMonth), [grid, selectedMonth]);

  // Drag to resize handler
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX;
      const maxWidth = Math.min(window.innerWidth * 0.65, 840);
      const newWidth = Math.max(360, Math.min(maxWidth, startWidth + delta));
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Trigger map resize
      window.dispatchEvent(new Event('resize'));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Prepare Chart Time-series Data with Adaptive Labels
  const chartData = useMemo(() => grid ? buildChartData(grid, dataset?.metadata) : [], [grid, dataset?.metadata]);

  // Key Statistics
  const headsList = chartData.map(d => d.head).filter(Number.isFinite);
  const maxHead = headsList.length ? Math.max(...headsList) : '—';
  const minHead = headsList.length ? Math.min(...headsList) : '—';
  const avgHead = headsList.length ? (headsList.reduce((a, b) => a + b, 0) / headsList.length).toFixed(1) : '—';
  const variance = headsList.length ? (maxHead - minHead).toFixed(1) : '—';

  // Dynamic Chart Height based on panel width
  const chartHeightClass = width >= 620 ? 'h-72' : (width >= 500 ? 'h-64' : 'h-56');

  const panelContent = (
    <aside 
      style={{ width: isDrawer ? undefined : `${width}px` }}
      className={`relative bg-panel border-l border-panelBorder flex flex-col h-full overflow-y-auto select-none z-20 shadow-xl transition-[width] ${
        isResizing ? 'duration-0' : 'duration-75'
      } ${
        isDrawer
          ? 'w-96 h-full bg-slate-900 border-l border-slate-700 shadow-2xl z-50 animate-in slide-in-from-right duration-200'
          : ''
      }`}
    >
      {/* Drag-to-Resize Handle on Left Border (Desktop Mode) */}
      {!isDrawer && (
        <div
          onMouseDown={handleMouseDown}
          title="좌우로 드래그하여 패널 및 차트 너비 조절 (Drag to resize)"
          className={`absolute left-0 top-0 bottom-0 w-2.5 -translate-x-1/2 cursor-col-resize z-40 group flex items-center justify-center transition-colors ${
            isResizing ? 'bg-blue-500/80 shadow-lg shadow-blue-500/50' : 'hover:bg-blue-500/40'
          }`}
        >
          {/* Grip line indicator */}
          <div className="w-1 h-8 rounded-full bg-slate-500/60 group-hover:bg-blue-400 transition-colors"></div>
        </div>
      )}

      {/* Drawer Header with Close Button (Tablet Mode) */}
      {isDrawer && (
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2 text-slate-100 font-bold text-xs">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span>지점 분석 및 경보 내역</span>
          </div>
          <button
            aria-label="분석 패널 닫기"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Selected Point Info Card */}
      <div className="p-4 border-b border-panelBorder space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-2 text-slate-200">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold text-xs tracking-wider uppercase">선택 지점 상세 정보 (Point Info)</h2>
          </div>
          {grid && <button type="button" onClick={onClearSelection} aria-label="상세 패널에서 지점 선택 해제"
            title="지점 선택 해제 (Esc)" className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-panelBorder px-2 py-2 text-[11px] text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
            <X className="w-3.5 h-3.5" />선택 해제
          </button>}
        </div>

        {!grid ? <UnselectedPoint /> : <>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30">
              {grid.id}
            </span>
          </div>
        <HeadChangeSummary grid={grid} month={selectedMonth} isAnnualRange={isAnnualRange} />
        <SurfaceReferenceNote grid={grid} month={selectedMonth} />
        {/* Core Specs Grid: Adapts from 2-column to 4-column when widened */}
        <div className={`point-metrics grid gap-2 ${width >= 720 ? 'grid-cols-4' : 'grid-cols-2'}`}>
          {/* Current Head */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
            <span className="metric-label text-[10px] text-slate-400 font-medium">현재 지하수위 (HEAD)</span>
            <div className="metric-value-row">
              <span className="metric-value font-mono text-cyan-400">
                {currentHead?.toFixed(2) ?? '—'}
              </span>
              <span className="metric-unit text-slate-400 font-mono">EL. m</span>
            </div>
            <span className="metric-note text-slate-500 font-mono">{parseInt(selectedMonth)}월 기준 표고</span>
          </div>

          {/* Depth to Groundwater */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
            <span className="metric-label text-[10px] text-slate-400 font-medium">지표고−수두 (참고 차이)</span>
            <div className="metric-value-row">
              <span className="metric-value font-mono text-blue-400">
                {depthToWater?.toFixed(1) ?? '자료 없음'}
              </span>
              {Number.isFinite(depthToWater) && <span className="metric-unit text-slate-400 font-mono">m</span>}
            </div>
            <span className="metric-note text-slate-500 font-mono">높이 기준·수면 해석 미확인</span>
          </div>

          {/* Aquifer Groundwater Storage */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
            <span className="metric-label text-[10px] text-slate-400 font-medium">저류량</span>
            <div className="metric-value-row">
              <span className="metric-value font-mono text-cyan-400">
                {dInfo?.storageM3?.toLocaleString() ?? '산정 자료 없음'}
              </span>
              {Number.isFinite(dInfo?.storageM3) && <span className="metric-unit text-slate-400 font-mono">m³</span>}
            </div>
            <span className="metric-note text-cyan-300/80 font-mono">대수층 매개변수 필요</span>
          </div>

          {/* Drought Stage */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
            <span className="metric-label text-[10px] text-slate-400 font-medium">예시 수위 저하 단계 ({selectedMonth}월)</span>
            <div className="metric-value-row">
              <span className={`metric-value font-mono ${
                dInfo?.stage === '심각' ? 'text-red-400' :
                dInfo?.stage === '주의' ? 'text-orange-400' :
                dInfo?.stage === '관심' ? 'text-yellow-400' : 'text-emerald-400'
              }`}>
                {dInfo?.stageLabel || '자료 없음'}
              </span>
            </div>
            <span className="metric-note text-slate-400 font-mono">
              연내 최고 대비 {dInfo?.drawdownM.toFixed(2) ?? '—'}m 저하 · 지수 {dInfo?.scorePercent ?? '—'}%
            </span>
          </div>
        </div>

        {/* Sub-attributes */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">예시 수위 저하 단계:</span>
            <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
              dInfo?.textBadgeClass || 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {dInfo?.stage === '심각' ? '🚨' : (dInfo?.stage === '주의' ? '⚠️' : (dInfo?.stage === '관심' ? '🟡' : (dInfo ? '✅' : '—')))} {dInfo?.stageLabel ?? '자료 없음'} ({dInfo?.stageEn ?? 'No data'}) ({dInfo?.scorePercent ?? '—'}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">저류율 (산정 자료 없음):</span>
            <span className="text-cyan-300 font-mono font-medium">
              {dInfo?.storageRate ?? '—'}% <span className="text-slate-500">(대수층 매개변수 필요)</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">예시 지질·대수층:</span>
            <span className="text-slate-200 font-medium">{grid.soilType || '자료 없음'}</span>
          </div>
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-slate-400">좌표 (EPSG:5179):</span>
            <span className="text-cyan-300">X {Math.round(grid.x || 948230)}, Y {Math.round(grid.y || 1842100)}</span>
          </div>
        </div>
        </>}
      </div>

      {/* 2. Time-series Analysis Chart (Recharts) */}
      {grid && <div className="p-4 border-b border-panelBorder space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-200">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-xs tracking-wider uppercase">시계열 수위 분석 (Time-series)</h2>
          </div>
          <span className="text-[10px] text-slate-400">{dataset?.metadata?.year}년 · 월말 모의자료</span>
        </div>

        <p className="text-[11px] text-amber-200/90">1~12월: 월말 모의 지하수위(월평균 아님). 평균·추세는 월말 값 기준입니다. 지표고는 공개 DEM 참고값이며 수위 저하 지수는 공식 가뭄 판정이 아닙니다.</p>
        {/* Toggles for Average Line & Trend Line */}
        <div className="flex items-center justify-between bg-slate-800/70 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs">
          {/* Toggle 1: Average Line (Purple Dashed) */}
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showAvgLine}
              onChange={() => setShowAvgLine(!showAvgLine)}
              className="w-3.5 h-3.5 rounded bg-slate-900 border-purple-500 text-purple-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-[11px] font-medium text-purple-300 flex items-center gap-1">
              <span className="w-3 h-0.5 bg-purple-400 border-b border-dashed"></span>
              평균선 (Average)
            </span>
          </label>

          {/* Toggle 2: Trend Line (Orange Linear) */}
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showTrendLine}
              onChange={() => setShowTrendLine(!showTrendLine)}
              className="w-3.5 h-3.5 rounded bg-slate-900 border-orange-500 text-orange-500 focus:ring-0 cursor-pointer"
            />
            <span className="text-[11px] font-medium text-orange-400 flex items-center gap-1">
              <span className="w-3 h-0.5 bg-orange-400"></span>
              추세선 (Trend)
            </span>
          </label>
        </div>

        {/* Recharts Chart Container: Expands smoothly with panel width */}
        <div className={`${chartHeightClass} w-full -ml-3 transition-all duration-150`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart key={grid.id} data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis
                dataKey="month"
                stroke="#64748B"
                fontSize={width < 450 ? 9 : 10}
                tickLine={false}
                interval={width < 450 ? 1 : 0}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                domain={['auto', 'auto']}
                tickLine={false}
                unit="m"
              />
              <Tooltip
                formatter={(value, name) => [`${value} m`, name]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item?.fullMonthName || label;
                }}
                contentStyle={{
                  backgroundColor: 'var(--ui-surface)',
                  borderColor: 'var(--ui-border)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'var(--ui-text)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)'
                }}
              />
              
              {/* Groundwater Level (Head) Line */}
              <Line
                type="monotone"
                dataKey="head"
                name="지하수위(HEAD)"
                stroke="var(--ui-primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--ui-primary)', strokeWidth: 1, stroke: 'var(--ui-surface)' }}
                activeDot={{ r: 5, fill: 'var(--ui-primary)', stroke: '#fff' }}
              />

              {/* Purple Dashed Average Line */}
              {showAvgLine && (
                <Line
                  type="monotone"
                  dataKey="avgLine"
                  name="평균선 (Avg)"
                  stroke="#A855F7"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}

              {/* Orange Trend Line */}
              {showTrendLine && (
                <Line
                  type="linear"
                  dataKey="trendLine"
                  name="추세선 (Trend)"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics Summary Mini Bar */}
        <div className="grid grid-cols-4 gap-1.5 pt-1 text-center font-mono">
          <div className="bg-slate-800/60 rounded p-1.5 border border-slate-700/50">
            <span className="text-[9px] text-slate-400 block font-sans">최고</span>
            <span className="text-xs md:text-sm font-bold text-red-400">{Number.isFinite(maxHead) ? maxHead.toFixed(2) : maxHead}m</span>
          </div>
          <div className="bg-slate-800/60 rounded p-1.5 border border-slate-700/50">
            <span className="text-[9px] text-slate-400 block font-sans">최저</span>
            <span className="text-xs md:text-sm font-bold text-cyan-400">{Number.isFinite(minHead) ? minHead.toFixed(2) : minHead}m</span>
          </div>
          <div className="bg-slate-800/60 rounded p-1.5 border border-slate-700/50">
            <span className="text-[9px] text-slate-400 block font-sans">평균</span>
            <span className="text-xs md:text-sm font-bold text-purple-400">{avgHead}m</span>
          </div>
          <div className="bg-slate-800/60 rounded p-1.5 border border-slate-700/50">
            <span className="text-[9px] text-slate-400 block font-sans">변동폭</span>
            <span className="text-xs md:text-sm font-bold text-amber-400">{variance}m</span>
          </div>
        </div>
      </div>}

      <div className="p-4 space-y-3 shrink-0">
        <WaterLevelAlerts report={alertReport} onSelectGrid={onSelectGrid} wide={width >= 620} isAnnualRange={isAnnualRange} />
      </div>
    </aside>
  );

  if (isDrawer) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        />
        {panelContent}
      </div>
    );
  }

  return panelContent;
}
