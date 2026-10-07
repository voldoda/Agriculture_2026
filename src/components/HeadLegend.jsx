import React from 'react';
import { HEAD_STOPS, RANGE_STOPS, DEVIATION_STOPS, CHANGE_COLORS, CHANGE_BREAKS, NO_DATA_COLOR, METRIC_LABELS, metricCaption } from '../utils/headDisplay';

export default function HeadLegend({ mode = 'head', month, year, comparison = false }) {
  const stops = mode === 'deviation' ? DEVIATION_STOPS : mode === 'range' ? RANGE_STOPS : HEAD_STOPS;
  const ticks = mode === 'deviation' ? [-100, -50, 0, 50, 100] : stops.map(([value]) => value);
  const [min, max] = [stops[0][0], stops.at(-1)[0]];
  return <div className="space-y-2 text-[11px] text-slate-400">
    <div className="flex justify-between"><span>{METRIC_LABELS[mode]}</span><span>단위: {mode === 'head' ? 'm' : 'cm'}</span></div>
    {mode === 'change' ? <>
      <div className="flex h-4 rounded overflow-hidden border border-slate-700" aria-label="하강 주황색, 미소 변화 중립색, 상승 청색">
        {CHANGE_COLORS.map((color, i) => <span key={color} className="flex-1" style={{ backgroundColor: color }} title={i === 4 ? '−5~+5cm: 미소 변화' : i === 0 ? '−50cm 미만' : i === 8 ? '+50cm 초과' : `${CHANGE_BREAKS[i - 1]}~${CHANGE_BREAKS[i]}cm`} />)}
      </div>
      <div className="relative h-4 text-[9px] font-mono">{CHANGE_BREAKS.map((value, i) => <span key={value} className="absolute -translate-x-1/2" style={{ left: `${(i + 1) / 9 * 100}%` }}>{value > 0 ? '+' : ''}{value}</span>)}</div>
      <div className="flex justify-between text-[10px]"><span>← 하강 (−50 미만 포함)</span><span>상승 (+50 초과 포함) →</span></div>
      <p className="text-[10px] leading-relaxed">−5~+5cm는 미소 변화입니다. 변화 없음·모형 정확도를 뜻하지 않습니다. ±50cm를 벗어난 값도 실제 수치로 조회됩니다.</p>
    </> : <>
      <div className="h-4 rounded border border-slate-700" style={{ background: `linear-gradient(to right, ${stops.map(([value, color]) => `${color} ${(value - min) / (max - min) * 100}%`).join(', ')})` }} />
      <div className="relative h-4 font-mono text-[10px]">{ticks.map(value => <span key={value} className="absolute" style={{ left: `${(value - min) / (max - min) * 100}%`, transform: `translateX(${value === min ? 0 : value === max ? -100 : -50}%)` }}>{mode === 'deviation' && value > 0 ? '+' : ''}{value}</span>)}</div>
      <div className="flex justify-between text-[10px]"><span>{mode === 'deviation' ? '평균보다 낮음 (−)' : mode === 'head' ? '낮은 표고' : '작은 변동'}</span><span>{mode === 'deviation' ? '평균보다 높음 (+)' : mode === 'head' ? '높은 표고' : '큰 변동'}</span></div>
    </>}
    {mode === 'deviation' && <p className="text-[10px] leading-relaxed">−5~+5cm는 중립색입니다. ±100cm 밖은 끝 색상으로 표시하며 실제 값은 상세 정보에서 확인합니다. 12개월 월말 값의 산술평균 기준이며, 장기 평년값·가뭄 등급·모형 정확도를 뜻하지 않습니다.</p>}
    <p className="text-[10px] leading-relaxed">{comparison ? `${year}년 1~12월 · ${mode === 'deviation' ? '각 격자의 해당 연도 평균 대비' : mode === 'change' ? '전월 대비 (1월 비교 불가)' : '월말 지하수위 표고'}` : metricCaption(month, mode, year)}<br />월별 비교를 위해 색상 범위를 고정합니다.</p>
    <div className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: NO_DATA_COLOR }} />{mode === 'change' ? '비교 자료 없음' : '자료 없음'}</div>
  </div>;
}
