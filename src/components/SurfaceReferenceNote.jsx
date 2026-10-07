import React from 'react';
import { surfaceComparison } from '../utils/surfaceElevation';

export default function SurfaceReferenceNote({ grid, month }) {
  const comparison = surfaceComparison(grid, month);
  return <div className="text-[10px] leading-relaxed text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded p-2">
    <p>지표고: <strong>{Number.isFinite(grid?.surfaceEl) ? `${grid.surfaceEl.toFixed(1)} m` : '자료 없음'}</strong> · SRTM 약30m 참고값</p>
    <p>2000년 취득 DEM + 2025년 월말 모의수위</p>
    <p className={comparison.status === 'head_above_surface' ? 'text-amber-300 font-medium' : ''}>{comparison.message}</p>
    <p>표고 차이는 확정 지하수심이 아닙니다. 수위 저하 지수는 지표고와 별도로 계산합니다.</p>
  </div>;
}
