import React from 'react';
import { Info } from 'lucide-react';
import { DECLINE_LABELS, DECLINE_COLORS, DECLINE_AMOUNT_STOPS, declineScope } from '../utils/declineDisplay';
import { NO_DATA_COLOR } from '../utils/headDisplay';

const countText = value => value.toLocaleString('ko-KR');

export function DeclineNotice({ month, year, layers, summary }) {
  const filtered = declineScope(layers) === 'highlight';
  return <div role="status" aria-label="수위 저하 지도 설명" aria-live="polite" aria-atomic="true"
    className="map-display-notice rounded-lg p-2 text-[11px] border border-blue-800/40 bg-blue-950/40 text-blue-300 flex items-start gap-1.5">
    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
    <div className="min-w-0 space-y-1.5 leading-relaxed">
      <strong className="block">{year}년 {Number(month)}월 · {layers.declineMetric === 'amount' ? '실제 저하량(cm)' : '예시 수위 저하'}</strong>
      <p>각 격자의 해당 연도 최고 월말 수위와 선택 월 수위의 차이입니다. 전월 대비 변화량이 아닙니다.</p>
      {summary.valid > 0 ? <p>계산 가능한 격자 {countText(summary.valid)}개 · 저하량 {summary.minM.toFixed(2)}~{summary.maxM.toFixed(2)}m.
        {summary.highlighted === 0 ? ' 지수 35% 이상 구역은 없습니다.' : ` 지수 35% 이상 ${countText(summary.highlighted)}개 (${(summary.highlighted / summary.valid * 100).toFixed(2)}%).`}</p>
        : <p>비교에 필요한 12개월 수위 자료가 없습니다.</p>}
      <p>{filtered ? '저하 작음은 투명하게 숨깁니다. 숨겨진 격자도 클릭하여 조회할 수 있습니다.'
        : layers.declineMetric === 'amount' ? '0~350cm 고정 색상 범위로 전체 격자를 표시합니다.' : '저하 작음도 옅은 청록색으로 표시합니다.'}</p>
      {summary.missing > 0 && <p>비교 자료 없음: {countText(summary.missing)}개 · 회색 표시.</p>}
      <p className="text-[10px] text-slate-400">월말 자료 기반의 예시 분석입니다. 공식 가뭄 판정이나 전년 대비 변화가 아닙니다.</p>
    </div>
  </div>;
}

export function DeclineLegend({ layers, summary }) {
  const amount = layers.declineMetric === 'amount';
  const filtered = declineScope(layers) === 'highlight';
  return <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400" aria-label="수위 저하 범례">
    <div className="flex justify-between"><span className="font-medium text-amber-300">{amount ? '연내 최고 대비 실제 저하량' : '예시 수위 저하 단계'}</span><span>{amount ? '단위: cm' : '수위 저하 지수'}</span></div>
    {amount ? <>
      <div className="h-4 rounded border border-slate-700" style={{ background: `linear-gradient(to right, ${DECLINE_AMOUNT_STOPS.map(([value, color]) => `${color} ${value / 350 * 100}%`).join(', ')})` }} />
      <div className="relative h-4 text-[10px] font-mono">{[0, 100, 175, 275, 350].map(value => <span key={value} className="absolute" style={{ left: `${value / 350 * 100}%`, transform: `translateX(${value === 0 ? 0 : value === 350 ? -100 : -50}%)` }}>{value}</span>)}</div>
      <p className="text-[10px] leading-relaxed">모든 월에 같은 0~350cm 범위를 사용합니다. 350cm 초과는 끝 색상이며 실제 수치는 조회할 수 있습니다. 색상은 저하량을 나타내며 단계 판정과 별개입니다.</p>
    </> : <>
      <div aria-hidden="true" className="drought-legend-columns h-4 rounded overflow-hidden border border-slate-700">
        {DECLINE_COLORS.map((color, i) => <span key={color} className={i === 0 && filtered ? 'drought-legend-transparent' : ''}
          style={i === 0 && filtered ? undefined : { backgroundColor: color, opacity: i === 0 ? 0.3 : 1 }} />)}
      </div>
      <div className="drought-legend-columns text-center text-[10px] leading-relaxed">
        {DECLINE_LABELS.map((label, i) => <div key={label}><span className="block font-semibold">{label}</span><span className="block font-mono">{['<35%', '35~<55%', '55~<75%', '≥75%'][i]}</span></div>)}
      </div>
    </>}
    <p className="text-[10px]">{filtered ? '표시 필터: 지수 35% 이상만 강조 · 저하 작음은 투명' : '전체 격자 표시 · 저하량 0도 유효한 값'}</p>
    <div aria-label="월별 수위 저하 집계" className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
      {DECLINE_LABELS.map((label, i) => <div key={label} className="flex justify-between gap-1"><span>{label}</span><span className="font-mono">{countText(summary.counts[i])}개</span></div>)}
    </div>
    <div className="flex items-center gap-1.5 text-[10px]"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: NO_DATA_COLOR }} />비교 자료 없음: {countText(summary.missing)}개</div>
    <p className="text-[10px] leading-relaxed bg-slate-800/40 p-1.5 rounded border border-slate-700/50">지수 = 연내 최고 대비 저하량 ÷ max(5m, 연간 변동 폭). 12개월 자료가 모두 있어야 계산합니다. 지표고·수심은 점수에 반영하지 않습니다. ‘저하 작음’은 저하 없음이나 공식 가뭄 정상 판정을 뜻하지 않습니다.</p>
  </div>;
}
