import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import HeadLegend from './HeadLegend';
import { MONTHS, METRIC_LABELS, metricText } from '../utils/headDisplay';
import { comparisonLayout, comparisonFrame } from '../utils/monthComparison';

function MonthMap({ frame, layout, cellAspect }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.getContext('2d').putImageData(new ImageData(frame.pixels, layout.width, layout.height), 0, 0);
  }, [frame, layout]);
  return <canvas ref={ref} width={layout.width} height={layout.height}
    role="img" aria-label={`${Number(frame.month)}월 ${METRIC_LABELS[frame.mode]} 지도`}
    className="block mx-auto max-w-full" style={{ height: 'clamp(130px, 22vh, 230px)', width: 'auto', aspectRatio: `${layout.width / (layout.height * cellAspect)}`, imageRendering: 'pixelated' }} />;
}

export default function MonthComparison({ dataset, selectedMonth, initialMode, onClose, onSelectMonth }) {
  const [mode, setMode] = useState(['head', 'change', 'deviation'].includes(initialMode) ? initialMode : 'deviation');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const callbacks = useRef({ onClose });
  callbacks.current = { onClose };
  const ready = result?.mode === mode;

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); callbacks.current.onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), select')];
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && (index < 0 || index === controls.length - 1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => { document.removeEventListener('keydown', handleKey, true); previousFocus?.focus(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');
    async function prepare() {
      try {
        const layout = comparisonLayout(dataset.grids);
        const frames = [];
        for (const month of MONTHS) {
          // Yield between months so closing or changing modes cancels the work.
          await new Promise(resolve => setTimeout(resolve, 0));
          if (cancelled) return;
          frames.push(comparisonFrame(dataset.grids, layout, month, mode));
        }
        if (!cancelled) setResult({ mode, layout, frames });
      } catch (failure) { if (!cancelled) setError(failure.message); }
    }
    prepare();
    return () => { cancelled = true; };
  }, [dataset, mode]);

  return <div role="dialog" aria-modal="true" aria-labelledby="comparison-title" ref={dialogRef}
    className="fixed inset-0 z-[1000] bg-slate-900 text-slate-200 flex flex-col">
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
      <div><h2 id="comparison-title" className="font-bold">{dataset.metadata.year}년 12개월 수위 비교</h2>
        <p className="text-xs text-slate-400 mt-1">동일한 유역 범위 · 동일한 색상 기준 · 북쪽이 위 · 원본 약 50m 격자</p></div>
      <button ref={closeRef} onClick={onClose} aria-label="12개월 비교 닫기" className="p-2 rounded border border-slate-700"><X size={20} /></button>
    </header>
    <div className="overflow-y-auto flex-1 p-4">
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-3">비교 항목
            <select aria-label="12개월 비교 항목" value={mode} onChange={e => setMode(e.target.value)} className="p-2 rounded border border-slate-700 bg-slate-800">
              {['deviation', 'change', 'head'].map(value => <option key={value} value={value}>{METRIC_LABELS[value]}</option>)}
            </select>
          </label>
          <p>월 카드를 선택하면 해당 월과 표시 항목을 본 지도에서 확인합니다.</p>
          <p className="text-slate-400">배경지도와 보조 레이어를 제외하여 수위의 색상 차이에 집중합니다. 카드 수치는 비교 가능한 격자의 단순 평균입니다.</p>
          {mode === 'deviation' && <p className="text-slate-400">편차 = 해당 월 수위 − 같은 격자의 12개월 월말 모의수위 평균. 장기 평년값에 대한 편차나 가뭄 등급이 아닙니다.</p>}
        </div>
        <HeadLegend mode={mode} month={selectedMonth} year={dataset.metadata.year} comparison />
      </div>
      {!ready && !error && <p role="status" className="p-8 text-center">12개월 비교 지도를 계산하는 중입니다…</p>}
      {error && <p role="alert">비교 지도를 만들지 못했습니다: {error}</p>}
      {ready && !error && <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3" aria-label="월별 비교 지도">
        {result.frames.map(frame => <button key={frame.month} onClick={() => onSelectMonth(frame.month, mode)}
          aria-label={`${Number(frame.month)}월 지도에서 보기`} aria-current={frame.month === selectedMonth ? 'true' : undefined}
          className={`rounded-lg border bg-slate-800/40 p-2 text-left hover:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 ${frame.month === selectedMonth ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700'}`}>
          <div className="flex flex-wrap gap-1 justify-between mb-2 text-xs"><strong>{Number(frame.month)}월</strong><span className="font-mono">격자 평균 {metricText(frame.mean, mode)}</span></div>
          <MonthMap frame={frame} layout={result.layout} cellAspect={(dataset.metadata.sourceCellHeightM || 50) / (dataset.metadata.sourceCellSizeM || 50)} />
          <p className="text-[10px] text-slate-400 mt-2">{frame.count ? `비교 가능 ${frame.count.toLocaleString()}개 격자` : '전년도 12월 자료 없음 · 비교 불가'}{mode === 'deviation' && ` · ±100cm 밖 ${frame.clipped.toLocaleString()}개`}</p>
        </button>)}
      </div>}
    </div>
  </div>;
}
