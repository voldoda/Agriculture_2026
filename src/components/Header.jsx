import React from 'react';
import ekrLogo from '../assets/ekr_logo.png';
import { 
  Download, 
  BarChart2,
  Sliders
} from 'lucide-react';

export default function Header({ 
  onOpenExport, 
  onToggleLeftDrawer,
  onToggleRightDrawer,
  isLeftDrawerOpen,
  isRightDrawerOpen,
  deviceType
}) {
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';


  return (
    <header className="shrink-0 h-14 md:h-16 bg-panel border-b border-panelBorder px-3 md:px-5 flex items-center justify-between gap-3 z-30 shadow-lg select-none">
      {/* Left: Brand & Mobile Drawer Toggle */}
      <div className="flex flex-1 min-w-0 items-center space-x-2.5 md:space-x-4">
        {/* Mobile/Tablet Left Drawer Toggle Button */}
        {(isMobile || isTablet) && (
          <button
            onClick={onToggleLeftDrawer}
            title="레이어 및 시점 제어 서랍 열기"
            className={`shrink-0 p-2 rounded-lg border transition-all ${
              isLeftDrawerOpen
                ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        {/* Logo and Title */}
        <div className="flex flex-1 min-w-0 items-center space-x-2.5 md:space-x-3">
          <div className="flex items-center flex-shrink-0 bg-white px-2.5 py-1 md:px-3 md:py-1 rounded-lg border border-white/20 shadow-sm">
            <img 
              src={ekrLogo} 
              alt="한국농어촌공사" 
              className="h-5 sm:h-6 md:h-7 w-auto max-w-[124px] sm:max-w-[160px] xl:max-w-none object-contain" 
            />
          </div>
          <div className="sr-only sm:not-sr-only min-w-0 sm:flex-1">
            <div className="flex min-w-0 items-center space-x-1.5 md:space-x-2">
              <h1 className="min-w-0 font-bold text-xs md:text-base text-slate-100 tracking-tight truncate"
                title={isMobile ? '유역 모니터링 공간가시화 시작품' : '테스트베드 유역 모니터링 공간 가시화를 위한 시작품'}>
                {isMobile ? '유역 모니터링 공간가시화 시작품' : '테스트베드 유역 모니터링 공간 가시화를 위한 시작품'}
              </h1>
              <span className="hidden xl:inline-block shrink-0 px-2 py-0.5 text-[10px] md:text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                지하수위·수위 저하 모니터링
              </span>
            </div>
            <p className="hidden md:block truncate text-xs text-slate-400">
              <span>충남 공주시 유구천 표준유역</span>
              <span className="text-slate-600 mx-2">|</span>
              <span>유역코드: <strong className="text-slate-300 font-mono">301206</strong></span>
            </p>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center whitespace-nowrap space-x-1.5 md:space-x-3">
        {/* Tablet Right Analytics Drawer Toggle */}
        {isTablet && (
          <button
            onClick={onToggleRightDrawer}
            title="분석 차트 & 경보 서랍 열기"
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              isRightDrawerOpen
                ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <span>분석 차트</span>
          </button>
        )}

        {/* Data Export Button */}
        <button
          aria-label="데이터 내보내기"
          onClick={onOpenExport}
          className="px-2.5 md:px-3.5 py-1.5 md:py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 flex items-center space-x-1 transition-all shadow-sm active:scale-95"
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span className="hidden sm:inline">내보내기 (Export)</span>
        </button>
      </div>
    </header>
  );
}
