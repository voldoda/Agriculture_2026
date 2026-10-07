import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatAlertChange } from '../utils/waterLevelAlerts';

const PAGE_SIZE = 10;
const count = n => n.toLocaleString('ko-KR');
const levelStyle = { WATCH: 'bg-blue-500/10 text-blue-400', WARNING: 'bg-amber-500/15 text-amber-400', REVIEW: 'bg-red-500/15 text-red-400' };

export default function WaterLevelAlerts({ report, onSelectGrid, wide = false, isAnnualRange = false }) {
  const [direction, setDirection] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [report, direction]);
  const filtered = useMemo(() => report?.alerts.filter(a => direction === 'all' || a.direction === direction) ?? [], [report, direction]);
  if (!report) return null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount), start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const criteriaText = report.criteria.map((c, i) => `${c.label} ${i === report.criteria.length - 1 ? '≥' : ''}${c.minimumM * 100}${report.criteria[i + 1] ? `~<${report.criteria[i + 1].minimumM * 100}` : ''}cm`).join(' · ');
  return <section className="water-level-alerts space-y-3" aria-label="수위 변동 경보" data-month={report.month}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2 text-slate-200">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div><h2 className="font-semibold text-xs">수위 변동 경보</h2>
          <p className="text-[10px] text-slate-400 mt-1">{report.year}년 {Number(report.month)}월{report.previousMonth ? `−${Number(report.previousMonth)}월` : ''} · 월말 모의수위 비교</p></div>
      </div>
      <span className="text-[10px] font-semibold rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 px-1.5 py-0.5 whitespace-nowrap">
        {report.available && report.comparedCells > 0 ? `${count(report.alerts.length)}개 격자` : '산정 불가'}
      </span>
    </div>
    <p className="text-[10px] text-slate-400 leading-relaxed">참고 기준 |변화량|: {criteriaText}</p>
    {isAnnualRange && <p className="text-[10px] text-slate-400">연간 지도와 별개로 마지막 선택 월인 {Number(report.month)}월의 경보를 표시합니다.</p>}
    <details className="text-[10px] text-slate-400 leading-relaxed">
      <summary className="cursor-pointer underline underline-offset-2">판정 기준 및 자료 안내</summary>
      <p className="mt-1">선택 월 수위−직전 월 수위로 계산하며, 양수는 상승·음수는 하강입니다. 반올림 전 원본 수위로 판정합니다. 현재 앱의 참고 기준이며 공식 경보·가뭄 판정·실시간 이상 탐지가 아닙니다. 연내 최고 대비 수위 저하 지수와 별개입니다.</p>
    </details>
    {!report.available ? <p role="status" className="text-xs text-slate-400 py-3">{report.year - 1}년 12월 자료가 없어 1월의 전월 대비 경보를 산정할 수 없습니다.</p>
      : report.comparedCells === 0 ? <p role="status" className="text-xs text-slate-400 py-3">두 달의 수위가 모두 있는 격자가 없어 경보를 산정할 수 없습니다.</p>
      : <>
        <div className="text-[10px] text-slate-400 leading-relaxed" aria-label="수위 변동 경보 집계">
          <p>비교 {count(report.comparedCells)}개 · 비교 자료 없음 {count(report.missingCells)}개</p>
          <p>상승 {count(report.riseCount)}개 · 하강 {count(report.dropCount)}개 · 기준 미만 {count(report.withinThreshold)}개</p>
          <p>관심 {count(report.levels.WATCH)}개 · 주의 {count(report.levels.WARNING)}개 · 중점 검토 {count(report.levels.REVIEW)}개</p>
        </div>
        {report.alerts.length === 0 ? <p role="status" className="text-xs text-slate-400 py-3">산정 완료: 절댓값 {report.criteria[0].minimumM * 100}cm 이상인 격자가 없습니다.</p> : <>
          <label className="flex items-center justify-between text-[11px] text-slate-400">경보 방향
            <select aria-label="경보 방향" value={direction} onChange={e => setDirection(e.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200">
              <option value="all">상승·하강 전체</option><option value="drop">하강만</option><option value="rise">상승만</option>
            </select>
          </label>
          <p className="text-[10px] text-slate-400" role="status">변화량 절댓값 큰 순 · {count(filtered.length)}개 중 {filtered.length ? `${count(start + 1)}~${count(Math.min(start + PAGE_SIZE, filtered.length))}개 표시` : '해당 방향의 경보 없음'}</p>
          <div className={wide ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
            {visible.map(alert => <button key={alert.id} type="button" onClick={() => onSelectGrid(alert)}
              aria-label={`${alert.id} ${alert.directionLabel} ${formatAlertChange(alert.deltaM)} ${alert.levelLabel} 지점 선택`}
              className="w-full text-left rounded-lg border border-slate-700 bg-slate-800/70 hover:border-blue-400 p-2.5 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] font-mono font-semibold text-slate-200">{alert.id}</span>
                <span className={`text-[10px] rounded px-1.5 py-0.5 ${levelStyle[alert.level]}`}>{alert.levelLabel}</span>
              </div>
              <div className={`flex items-center gap-1 text-xs font-mono font-bold ${alert.direction === 'rise' ? 'text-blue-400' : 'text-orange-400'}`}>
                {alert.direction === 'rise' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {alert.directionLabel} {formatAlertChange(alert.deltaM)}
              </div>
              <p className="text-[10px] text-slate-400">{Number(alert.previousMonth)}월 {alert.previousHead.toFixed(2)}m → {Number(alert.month)}월 {alert.currentHead.toFixed(2)}m</p>
              <p className="text-[10px] text-slate-400">Row {alert.row} / Col {alert.col} · 클릭하여 격자·시계열 확인</p>
            </button>)}
          </div>
          {filtered.length > PAGE_SIZE && <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <button type="button" aria-label="경보 이전 페이지" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">이전</button>
            <span>{count(currentPage)} / {count(pageCount)} 페이지</span>
            <button type="button" aria-label="경보 다음 페이지" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">다음</button>
          </div>}
        </>}
      </>}
  </section>;
}
