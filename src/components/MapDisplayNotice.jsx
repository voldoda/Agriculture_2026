import React from 'react';
import { Info } from 'lucide-react';
import { MONTHS, previousMonth } from '../utils/headDisplay';
import { getHeadSource } from '../utils/dataProvenance';

// month is the published map month, not the frame currently being prepared.
export default function MapDisplayNotice({ mode = 'head', month, metadata }) {
  const year = metadata?.year;
  const yearLabel = year ? `${year}년` : '해당 연도';
  const monthLabel = `${Number(month)}월`;
  const previous = previousMonth(month);
  const unavailable = mode === 'change' && !previous;
  const descriptions = {
    deviation: {
      title: `${yearLabel} ${monthLabel} · 연평균 대비 편차`,
      text: `같은 격자의 ${yearLabel} 1~12월 월말 수위 평균과 비교한 차이(cm)입니다. 주황색은 평균보다 낮음, 청색은 높음을 나타냅니다.`,
    },
    change: {
      title: `${yearLabel} ${monthLabel} · ${unavailable ? '전월 비교 불가' : '전월 대비 변화량'}`,
      text: unavailable
        ? `${year ? `${year - 1}년` : '전년도'} 12월 자료가 없어 전월 대비 변화량을 계산할 수 없습니다. 회색은 비교 자료 없음을 뜻하며, 변화량 0을 의미하지 않습니다.`
        : `같은 격자의 ${Number(previous)}월 말 대비 ${monthLabel} 말 수위 변화(cm)입니다. 음수는 하강, 양수는 상승을 나타냅니다.`,
    },
    head: {
      title: `${yearLabel} ${monthLabel} 말 · 수위 표고`,
      text: '해당 월말의 지하수위 표고(m)를 나타냅니다. 색상으로 지점별 수위의 높고 낮음을 비교할 수 있습니다.',
    },
    range: {
      title: `${yearLabel} 전체 · 연간 변동 폭`,
      text: '같은 격자의 1~12월 월말 수위 중 최고값과 최저값의 차이(cm)입니다. 값이 클수록 연중 변동이 크며, 선택 월에 따라 달라지지 않습니다.',
    },
  };
  const description = descriptions[mode] ?? descriptions.head;
  const usedMonths = ['range', 'deviation'].includes(mode) ? MONTHS : mode === 'change' && previous ? [previous, month] : [month];
  const hasExample = usedMonths.some(value => getHeadSource(value, metadata) !== 'model_sample');
  return <div role="status" aria-label="지도 설명" aria-live="polite" aria-atomic="true" data-tone={unavailable ? 'warning' : 'info'}
    className={`map-display-notice rounded-lg p-2 text-[11px] border flex items-start gap-1.5 ${unavailable
      ? 'bg-amber-950/30 border-amber-800/40 text-amber-300'
      : 'bg-blue-950/40 border-blue-800/40 text-blue-300'}`}>
    <Info className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${unavailable ? 'text-amber-400' : 'text-blue-400'}`} />
    <div className="min-w-0 space-y-1.5 leading-relaxed">
      <strong className="block">{description.title}</strong>
      <p>{description.text}</p>
      {mode === 'deviation' && <details>
        <summary className="cursor-pointer underline underline-offset-2">평균 기준 안내</summary>
        <p className="pt-1">해당 연도의 12개 월말 값 평균이며, 장기 평년값이 아닙니다.</p>
      </details>}
      <p className="text-[10px] text-slate-400">{hasExample
        ? '예시 수위가 포함된 자료입니다.'
        : '제공된 월말 수위 기반입니다.'}</p>
    </div>
  </div>;
}
