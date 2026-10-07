import React from 'react';
import { annualMeanHead, gridMetricValue, metricText, previousMonth } from '../utils/headDisplay';

export default function HeadChangeSummary({ grid, month, isAnnualRange = false }) {
  const change = gridMetricValue(grid, month, 'change');
  const range = gridMetricValue(grid, month, 'range');
  return <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-2 space-y-1 text-[11px]">
    {isAnnualRange && <p className="text-[11px] text-blue-400 font-medium">연간 지도 표시 중 · 월별 상세 수치는 이전 선택 월({Number(month)}월) 기준입니다.</p>}
    <div className="flex justify-between gap-2"><span className="text-slate-400">같은 격자 12개월 평균</span><strong className="font-mono text-slate-200">{metricText(annualMeanHead(grid))}</strong></div>
    <div className="flex justify-between gap-2"><span className="text-slate-400">연평균 대비 편차</span><strong className="font-mono text-slate-200">{metricText(gridMetricValue(grid, month, 'deviation'), 'deviation')}</strong></div>
    <div className="flex justify-between gap-2"><span className="text-slate-400">전월 대비 {previousMonth(month) ? `(${Number(month)}월−${Number(previousMonth(month))}월)` : '(1월)'}</span><strong className="font-mono text-slate-200">{metricText(change, 'change')}</strong></div>
    <div className="flex justify-between gap-2"><span className="text-slate-400">연간 변동 폭 (최고−최저)</span><strong className="font-mono text-slate-200">{metricText(range, 'range')}</strong></div>
    <p className="text-[10px] text-slate-400">원본 월말 모의수위로 계산{previousMonth(month) ? ' · 상승 + / 하강 −' : ' · 전년도 12월 자료 없음'}</p>
    <p className="text-[10px] text-slate-400">평균은 해당 연도 12개 월말 값의 산술평균이며, 장기 평년값·가뭄 등급이 아닙니다.</p>
  </div>;
}
