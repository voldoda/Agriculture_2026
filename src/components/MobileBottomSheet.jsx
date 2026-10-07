import React, { useState, useMemo } from 'react';
import HeadChangeSummary from './HeadChangeSummary';
import SurfaceReferenceNote from './SurfaceReferenceNote';
import WaterLevelAlerts from './WaterLevelAlerts';
import UnselectedPoint from './UnselectedPoint';
import { surfaceComparison } from '../utils/surfaceElevation';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  ChevronUp,
  ChevronDown,
  MapPin,
  BarChart3,
  Sliders,
  X
} from 'lucide-react';
import { calculateGridDrought } from '../utils/droughtUtils';
import { buildChartData } from '../utils/chartData';

export default function MobileBottomSheet({
  selectedGrid,
  onSelectGrid,
  onClearSelection,
  alertReport,
  selectedMonth,
  isAnnualRange = false,
  dataset
}) {
  // Sheet state: 'peek' (minimized), 'half' (50% screen), 'full' (85% screen)
  const [sheetState, setSheetState] = useState('peek');
  const [showAvgLine, setShowAvgLine] = useState(true);
  const [showTrendLine, setShowTrendLine] = useState(true);

  const grid = selectedGrid;

  const currentHead = grid?.heads?.[selectedMonth];
  const depthToWater = surfaceComparison(grid, selectedMonth).rawDifferenceM;
  const dInfo = useMemo(() => calculateGridDrought(grid, selectedMonth), [grid, selectedMonth]);

  // Time-series Chart Data
  const chartData = useMemo(() => grid ? buildChartData(grid, dataset?.metadata) : [], [grid, dataset?.metadata]);

  const toggleExpand = () => {
    if (sheetState === 'peek') setSheetState('half');
    else if (sheetState === 'half') setSheetState('full');
    else setSheetState('peek');
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-700 rounded-t-2xl shadow-2xl backdrop-blur-md transition-all duration-300 ease-in-out select-none flex flex-col ${
        sheetState === 'peek' ? 'h-20' : sheetState === 'half' ? 'h-[52vh]' : 'h-[85vh]'
      }`}
    >
      {/* Handle & Header Bar */}
      <div
        className="pt-2.5 pb-2 px-4 flex flex-col items-center border-b border-slate-800/80"
      >
        {/* Grab Pill */}
        <div className="w-12 h-1.5 rounded-full bg-slate-600 mb-2"></div>

        {/* Peek Summary Row */}
        <div className="w-full flex items-center justify-between">
          <button type="button" aria-label="지점 분석 패널 크기 변경" aria-expanded={sheetState !== 'peek'}
            onClick={toggleExpand} className="flex flex-1 min-w-0 items-center justify-between text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs text-cyan-300">{grid?.id || '지점 선택'}</span>
                {grid && <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  dInfo?.textBadgeClass || 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {dInfo?.stageLabel || '자료 없음'}
                </span>}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{grid ? `Row ${grid.row} / Col ${grid.col}` : '지도 또는 경보에서 지점 선택'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {grid && <div className="text-right font-mono">
              <div className="text-sm font-bold text-cyan-400">
                {currentHead?.toFixed(2) ?? '—'} <span className="text-[10px] font-normal">EL.m</span>
              </div>
              <span className="text-[10px] text-slate-400">참고 차이 {depthToWater?.toFixed(1) ?? '—'}m</span>
            </div>}
            {sheetState === 'peek' ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
          </button>
          {grid && <button type="button" onClick={onClearSelection} aria-label="모바일 패널에서 지점 선택 해제"
            title="지점 선택 해제" className="shrink-0 ml-2 rounded-lg p-2.5 text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
            <X className="w-4 h-4" />
          </button>}
        </div>
      </div>

      {/* Expanded Content (Scrollable) */}
      {sheetState !== 'peek' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!grid ? <UnselectedPoint /> : <>
          <HeadChangeSummary grid={grid} month={selectedMonth} isAnnualRange={isAnnualRange} />
        <SurfaceReferenceNote grid={grid} month={selectedMonth} />
          {/* Core Specs 2x2 Grid */}
          <div className="point-metrics grid grid-cols-2 gap-2">
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
              <span className="metric-label text-[10px] text-slate-400 font-medium">현재 지하수위</span>
              <div className="metric-value-row"><span className="metric-value font-mono text-cyan-400">{currentHead?.toFixed(2) ?? '—'}</span><span className="metric-unit text-slate-400 font-mono">EL. m</span></div>
              <span className="metric-note text-slate-500 font-mono">{Number(selectedMonth)}월 기준 표고</span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
              <span className="metric-label text-[10px] text-slate-400 font-medium">지표고−수두 (참고 차이)</span>
              <div className="metric-value-row"><span className="metric-value font-mono text-blue-400">{depthToWater?.toFixed(1) ?? '자료 없음'}</span>{Number.isFinite(depthToWater) && <span className="metric-unit text-slate-400 font-mono">m</span>}</div>
              <span className="metric-note text-slate-500 font-mono">높이 기준·수면 해석 미확인</span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
              <span className="metric-label text-[10px] text-slate-400 font-medium">저류량</span>
              <div className="metric-value-row"><span className="metric-value font-mono text-cyan-300">{dInfo?.storageM3?.toLocaleString() ?? '산정 자료 없음'}</span>{Number.isFinite(dInfo?.storageM3) && <span className="metric-unit text-slate-400 font-mono">m³</span>}</div>
              <span className="metric-note text-slate-500 font-mono">대수층 매개변수 필요</span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
              <span className="metric-label text-[10px] text-slate-400 font-medium">예시 수위 저하 단계 ({selectedMonth}월)</span>
              <div className="metric-value-row"><span className={`metric-value font-mono ${
                dInfo?.stage === '심각' ? 'text-red-400' :
                dInfo?.stage === '주의' ? 'text-orange-400' :
                dInfo?.stage === '관심' ? 'text-yellow-400' : 'text-emerald-400'
              }`}>
                {dInfo?.stageLabel || '자료 없음'}
              </span></div>
              <span className="metric-note text-slate-400 font-mono">연내 최고 대비 {dInfo?.drawdownM.toFixed(2) ?? '—'}m 저하 · 지수 {dInfo?.scorePercent ?? '—'}%</span>
            </div>
          </div>

          <p className="text-[11px] text-amber-200/90">{dataset?.metadata?.year}년 1~12월 월말 모의자료. 평균·추세는 월말 값 기준이며, 지표고는 공개 DEM 참고값이며 수위 저하 지수는 공식 가뭄 판정이 아닙니다.</p>
          {/* Time-series Chart */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-200">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-xs">시계열 수위 분석 (12개월)</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-1 text-[10px] text-purple-300">
                  <input
                    type="checkbox"
                    checked={showAvgLine}
                    onChange={() => setShowAvgLine(!showAvgLine)}
                    className="w-3 h-3 rounded bg-slate-900 border-purple-500 text-purple-600"
                  />
                  <span>평균</span>
                </label>
                <label className="flex items-center space-x-1 text-[10px] text-orange-400">
                  <input
                    type="checkbox"
                    checked={showTrendLine}
                    onChange={() => setShowTrendLine(!showTrendLine)}
                    className="w-3 h-3 rounded bg-slate-900 border-orange-500 text-orange-500"
                  />
                  <span>추세</span>
                </label>
              </div>
            </div>

            <div className="h-44 w-full -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart key={grid.id} data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={9} domain={['auto', 'auto']} tickLine={false} unit="m" />
                  <Tooltip
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullMonthName || label}
                    contentStyle={{
                      backgroundColor: 'var(--ui-surface)',
                      borderColor: 'var(--ui-border)',
                      borderRadius: '8px',
                      fontSize: '10px',
                      color: 'var(--ui-text)'
                    }}
                  />
                  <Line type="monotone" dataKey="head" name="수위" stroke="var(--ui-primary)" strokeWidth={2} dot={{ r: 2 }} />
                  {showAvgLine && <Line type="monotone" dataKey="avgLine" name="평균" stroke="#A855F7" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
                  {showTrendLine && <Line type="linear" dataKey="trendLine" name="추세" stroke="#F97316" strokeWidth={1.5} dot={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          </>}
          {(sheetState === 'full' || !grid) && <WaterLevelAlerts report={alertReport} isAnnualRange={isAnnualRange}
            onSelectGrid={alert => { onSelectGrid(alert); setSheetState('half'); }} />}
        </div>
      )}
    </div>
  );
}
