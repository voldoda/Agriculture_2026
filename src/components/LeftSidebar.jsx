import React, { useMemo } from 'react';
import { contoursSuppressed } from '../utils/headContours';
import HeadLegend from './HeadLegend';
import MapDisplayNotice from './MapDisplayNotice';
import { DeclineNotice, DeclineLegend } from './DeclinePresentation';
import { declineScope, summarizeDecline } from '../utils/declineDisplay';
import { droughtOverlaySuppressed, METRIC_LABELS } from '../utils/headDisplay';
import { getHeadSource } from '../utils/dataProvenance';
import { 
  Calendar, 
  Layers, 
  Play, 
  Pause, 
  Eye, 
  EyeOff, 
  Flame, 
  Droplet, 
  ShieldAlert, 
  MapPin, 
  Sliders, 
  Info,
  Waves,
  Sun,
  CloudRain,
  Compass,
  Grid,
  Circle,
  X
} from 'lucide-react';

export default function LeftSidebar({
  selectedMonth,
  setSelectedMonth,
  onGridMetricChange,
  isPlaying,
  setIsPlaying,
  layers,
  setLayers,
  gridShape,
  setGridShape,
  metadata,
  grids,
  onOpenComparison,
  isOpen = true,
  onClose,
  isDrawer = false
}) {
  const contourDisabled = contoursSuppressed(layers);
  const isAnnualRange = layers.grid && layers.gridMetric === 'range';
  const declineActive = layers.heatmap && !droughtOverlaySuppressed(layers);
  const declineSummary = useMemo(() => declineActive ? summarizeDecline(grids, selectedMonth) : null,
    [grids, selectedMonth, declineActive]);
  const quickFilters = [
    { label: '3월 (해빙기)', month: '03', icon: Droplet, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20' },
    { label: '5월 (갈수기)', month: '05', icon: Sun, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20' },
    { label: '7월 (장마기)', month: '07', icon: CloudRain, color: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20' },
    { label: '8월 (풍수기)', month: '08', icon: Waves, color: 'text-blue-400 border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20' },
    { label: '10월 (평수기)', month: '10', icon: Calendar, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20' },
  ];

  const handleToggleLayer = (key) => {
    setLayers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleOpacityChange = (key, value) => {
    setLayers(prev => ({
      ...prev,
      [`${key}Opacity`]: parseFloat(value)
    }));
  };

  const sidebarContent = (
    <aside className={`${
      isDrawer 
        ? 'w-80 max-w-full h-full overflow-y-auto bg-slate-900 border-r border-slate-700 shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200' 
        : 'w-80 bg-panel border-r border-panelBorder flex flex-col h-full overflow-y-auto select-none z-20 shadow-xl'
    }`}>
      {/* Drawer Header with Close Button */}
      {isDrawer && (
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2 text-slate-100 font-bold text-xs">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>레이어 및 시점 제어</span>
          </div>
          <button
            aria-label="레이어 패널 닫기"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Time Control Section */}
      <div className="p-4 border-b border-panelBorder space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-200">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-xs tracking-wider uppercase">시점 선택 (Time Control)</h2>
          </div>
          {/* Timeline auto-player */}
          <button
            disabled={isAnnualRange}
            onClick={() => setIsPlaying(!isPlaying)}
            className={`disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-all font-mono font-medium ${
              isPlaying 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
            }`}
            title="월별 지하수위 시계열 자동 시뮬레이션"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>정지</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span>재생</span>
              </>
            )}
          </button>
        </div>

        {/* Year & Month Dropdown */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">연도 (Year)</label>
            <div className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400">{metadata?.year ? `${metadata.year}년` : '연도 미지정'}</div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">월 (Month)</label>
            <select
              aria-label="선택 월"
              disabled={isAnnualRange}
              value={isAnnualRange ? 'annual' : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="disabled:opacity-60 disabled:cursor-not-allowed w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono font-semibold"
            >
              {isAnnualRange && <option value="annual">1~12월 전체</option>}
              {Array.from({ length: 12 }, (_, i) => {
                const mStr = String(i + 1).padStart(2, '0');
                const isCalibrated = getHeadSource(mStr, metadata) === 'model_sample';
                return (
                  <option key={mStr} value={mStr}>
                    {i + 1}월 {isCalibrated ? '(모델 자료)' : '(예시값)'}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {isAnnualRange && <p className="text-[11px] text-slate-400 leading-relaxed" role="status">연간 변동 폭은 해당 연도 1~12월 전체 자료로 계산하므로 월 선택·재생·계절별 퀵 필터를 사용하지 않습니다.</p>}

        <div className="space-y-2">
          <button onClick={onOpenComparison} className="w-full rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-400 py-2 text-xs font-semibold">12개월 비교</button>
        </div>

        {/* Season Quick Filters */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1.5 font-medium flex items-center justify-between">
            <span>계절별 퀵 필터</span>
            <span className="text-[10px] text-slate-500 font-mono">Quick Season Select</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {quickFilters.map((filter) => {
              const Icon = filter.icon;
              const isSelected = !isAnnualRange && selectedMonth === filter.month;
              return (
                <button
                  key={filter.month}
                  disabled={isAnnualRange}
                  onClick={() => {
                    setIsPlaying(false);
                    setSelectedMonth(filter.month);
                  }}
                  className={`disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition-all text-left ${
                    isSelected 
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400' 
                      : filter.color
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : ''}`} />
                  <span className="truncate">{filter.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {layers.grid && <MapDisplayNotice mode={layers.gridMetric} month={selectedMonth} metadata={metadata} />}
        {declineActive && <DeclineNotice month={selectedMonth} year={metadata?.year} layers={layers} summary={declineSummary} />}
        {!layers.grid && !declineActive && <p className="text-[11px] text-slate-400" role="status">수위·저하 격자가 꺼져 있습니다. 레이어 제어에서 표시할 격자를 선택해주세요.</p>}
      </div>

      {/* 2. Layer Toggle Section */}
      <div className="p-4 border-b border-panelBorder space-y-3">
        <div className="flex items-center justify-between text-slate-200">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold text-xs tracking-wider uppercase">레이어 제어 (Layer Control)</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">5 Layers</span>
        </div>

        <div className="space-y-2.5">
          {/* Layer 1: 50m Head Grid (with Square vs Point toggle) */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  checked={layers.grid}
                  onChange={() => handleToggleLayer('grid')}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 border border-blue-200"></span>
                  약 50m 원본 격자
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400">Graduated</span>
            </label>

            {/* Grid Shape Switcher: Square Grid vs Round Point */}
            {layers.grid && (
              <div className="space-y-2 pt-1 border-t border-slate-700/50">
                <div className="space-y-2 pb-2 border-b border-slate-700/50">
                <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  지도 표시
                  <select aria-label="수위 지도 표시" value={layers.gridMetric ?? 'head'}
                    onChange={e => onGridMetricChange(e.target.value)}
                    className="bg-slate-900 text-slate-200 border border-slate-700 rounded-md px-2 py-1 text-[11px]">
                    {Object.entries(METRIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <p className="text-[10px] text-slate-400">{layers.gridMetric === 'deviation' ? '주황: 같은 격자의 연평균보다 낮음 · 청색: 높음' : layers.gridMetric === 'range' ? '밝은색: 작은 변동 · 진한색: 큰 변동' : layers.gridMetric === 'head' ? '밝은색: 낮은 표고 · 진한색: 높은 표고' : '주황: 하강 · 청색: 상승 · 회색: 비교 자료 없음'}</p>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">격자 표출 형태:</span>
                  <div className="bg-slate-900 rounded-lg p-0.5 border border-slate-700 flex text-[10px] font-medium">
                    <button
                      onClick={() => setGridShape('square')}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                        gridShape === 'square' 
                          ? 'bg-blue-600 text-white font-bold shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Grid className="w-3 h-3" />
                      <span>네모 Grid</span>
                    </button>
                    <button
                      onClick={() => setGridShape('circle')}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                        gridShape === 'circle' 
                          ? 'bg-blue-600 text-white font-bold shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Circle className="w-3 h-3" />
                      <span>원형 Point</span>
                    </button>
                  </div>
                </div>

                {gridShape === 'square' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">격자선</span>
                      <div role="group" aria-label="격자선 표시" className="bg-slate-900 rounded-lg p-0.5 border border-slate-700 flex text-[10px] font-medium">
                        {[['auto', '자동'], ['visible', '표시'], ['hidden', '숨김']].map(([value, label]) => (
                          <button key={value} aria-pressed={(layers.gridBorder ?? 'auto') === value}
                            onClick={() => setLayers(prev => ({ ...prev, gridBorder: value }))}
                            className={`px-2.5 py-0.5 rounded transition-all ${(layers.gridBorder ?? 'auto') === value
                              ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">자동: 확대하면 경계선 표시 · 선택 격자는 항상 강조</p>
                  </div>
                )}

                {/* Opacity Slider */}
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400 font-mono">투명도</span>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={layers.gridOpacity ?? 0.85}
                    onChange={(e) => handleOpacityChange('grid', e.target.value)}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[10px] font-mono text-slate-300 w-7 text-right">
                    {Math.round((layers.gridOpacity || 0.85) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Monthly model head contours */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 space-y-2">
            <label className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <input type="checkbox" aria-label="지하수위 등수두선" checked={layers.contour && !contourDisabled}
                  disabled={contourDisabled} onChange={() => handleToggleLayer('contour')}
                  className="w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed" />
                <span className="w-2.5 h-1 rounded-sm bg-amber-400"></span>지하수위 등수두선
              </span>
              <span className="text-[10px] text-amber-400">월말 모의자료</span>
            </label>
            {contourDisabled ? <p className="text-[10px] text-slate-400">수위 표고에서 표시합니다. 편차·변화량·연간 변동 폭에서는 자동으로 숨깁니다.</p> : <>
              <p className="text-[10px] text-slate-400">{metadata?.year}년 {Number(selectedMonth)}월 말 · 원본 50m 수위에서 생성</p>
              {layers.contour && <label className="flex items-center justify-between text-[11px] text-slate-400">
                표시 간격
                <select aria-label="등수두선 표시 간격" value={layers.contourInterval ?? 'auto'}
                  onChange={e => setLayers(prev => ({ ...prev, contourInterval: e.target.value }))}
                  className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200">
                  <option value="auto">자동 (10m / 확대 5m)</option><option value="10">10m</option><option value="5">5m</option>
                </select>
              </label>}
            </>}
          </div>

          {/* Layer 3: Groundwater Drought & Water Level Depletion Grid */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  checked={layers.heatmap && !droughtOverlaySuppressed(layers)}
                  disabled={droughtOverlaySuppressed(layers)}
                  onChange={() => handleToggleLayer('heatmap')}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  예시 수위 저하 격자 (Head Decline)
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-400">{layers.declineMetric === 'amount' ? 'cm' : '4 Stages'}</span>
            </label>
            {declineActive && <div className="space-y-2 pt-2 border-t border-slate-700/50">
              <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400">지도 표시
                <select aria-label="수위 저하 지도 표시" value={layers.declineMetric ?? 'stage'}
                  onChange={e => setLayers(prev => ({ ...prev, declineMetric: e.target.value }))}
                  className="bg-slate-900 text-slate-200 border border-slate-700 rounded-md px-2 py-1 text-[11px]">
                  <option value="stage">4단계 (예시 지수)</option><option value="amount">실제 저하량 (cm)</option>
                </select>
              </label>
              <label className="block text-[11px] text-slate-400">표시 범위
                <select aria-label="수위 저하 표시 범위" value={layers.declineScope ?? 'auto'}
                  onChange={e => setLayers(prev => ({ ...prev, declineScope: e.target.value }))}
                  className="mt-1 w-full bg-slate-900 text-slate-200 border border-slate-700 rounded-md px-2 py-1 text-[11px]">
                  <option value="auto">자동 (단독 전체 / 겹침 강조)</option><option value="all">전체 격자 표시</option><option value="highlight">저하 구역만 강조 (지수 ≥35%)</option>
                </select>
              </label>
              <p className="text-[10px] text-slate-400">{declineScope(layers) === 'all' ? '전체 격자 표시 중' : '지수 35% 이상 구역만 강조 중'} · 숨겨진 격자도 클릭 조회 가능</p>
            </div>}
          </div>

          {/* Layer 4: Agricultural Drought & Depletion Risk Polygons */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  checked={layers.drainage}
                  onChange={() => handleToggleLayer('drainage')}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border border-dashed border-amber-400 rounded-sm"></span>
                  예시 관리구역 (Zone)
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-400">Hatched</span>
            </label>
          </div>

          {/* Layer 5: Observation Wells */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  checked={layers.wells}
                  onChange={() => handleToggleLayer('wells')}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  예시 관측정 (연동 없음)
                </span>
              </div>
              <span className="text-[10px] font-mono text-purple-400">5 Stations</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Symbology & Legend Section */}
      <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
        <div className="flex items-center space-x-2 text-slate-200">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h2 className="font-semibold text-xs tracking-wider uppercase">지도 범례 (Symbology Legend)</h2>
        </div>

        {layers.grid && <HeadLegend mode={layers.gridMetric ?? 'head'} month={selectedMonth} year={metadata?.year} />}
        {droughtOverlaySuppressed(layers) && <p className="text-[10px] text-slate-400 leading-relaxed">수위 변화 색상과 혼동하지 않도록 예시 수위 저하 레이어를 비활성화했습니다. 수위 표고 모드에서 켤 수 있습니다.</p>}

        {declineActive && <DeclineLegend layers={layers} summary={declineSummary} />}

        {/* Hatched Polygon Explanation */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="text-[11px] text-slate-400">농업용수 가뭄 우려지구</div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <div className="w-6 h-4 rounded border border-amber-500/80 bg-[repeating-linear-gradient(45deg,#f59e0b_0,#f59e0b_2px,transparent_0,transparent_6px)] bg-amber-500/20"></div>
            <span className="text-[11px]">갈수기 수위급저하 관리구역 (빗금)</span>
          </div>
        </div>

        {layers.contour && !contourDisabled && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-[11px] text-amber-300 font-medium">지하수위 등수두선 · 단위 m</div>
            <div className="text-[11px] text-slate-400 space-y-1">
              <p>같은 월말 수위 표고를 연결한 선입니다.</p>
              <p>표시 간격: {layers.contourInterval === '5' ? '5m' : layers.contourInterval === '10' ? '10m' : '기본 10m · 확대 단계 14부터 5m'}</p>
              <p><span className="inline-block w-5 h-1 bg-amber-400 mr-2"></span>굵은 선: 50m 간격 (50·100m)</p>
              <p>유동 방향 확인에는 별도의 유동 자료가 필요합니다.</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  if (isDrawer) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        />
        {sidebarContent}
      </div>
    );
  }

  return sidebarContent;
}
