import React from 'react';

export default function UnselectedPoint() {
  return <div role="status" className="rounded-lg border border-panelBorder bg-slate-800/50 p-4 text-xs space-y-2">
    <p className="font-semibold text-slate-200">선택한 지점이 없습니다.</p>
    <p className="text-slate-400 leading-relaxed">지도에서 격자를 클릭하거나 수위 변동 경보에서 지점을 선택해주세요.</p>
  </div>;
}
