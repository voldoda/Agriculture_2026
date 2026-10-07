import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileCode2, 
  Layers, 
  CheckCircle2, 
  Settings,
  HardDrive,
  FileSpreadsheet,
  Globe,
  Info
} from 'lucide-react';
import { DATA_NOTICE } from '../utils/dataProvenance';


export default function ExportModal({ isOpen, onClose, dataset, selectedMonth, contourIntervalM = 10 }) {
  const [format, setFormat] = useState('SHP'); // 'SHP', 'GeoJSON', 'DXF'
  const [shpGeomType, setShpGeomType] = useState('point'); // 'point', 'polygon'
  const [includeGridMesh, setIncludeGridMesh] = useState(true);
  const [includeHeadText, setIncludeHeadText] = useState(true);
  const [includeContours, setIncludeContours] = useState(true);
  const [includeDrainagePolygons, setIncludeDrainagePolygons] = useState(true);
  const [includeWells, setIncludeWells] = useState(true);
  const [crs, setCrs] = useState('EPSG:5179');
  const [range, setRange] = useState('current'); // 'current', 'all'
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError('');
    try {
      const { buildExport } = await import('../utils/buildExport.js');
      const result = await buildExport(dataset, {
        format, selectedMonth, crs: format === 'GeoJSON' ? 'EPSG:4326' : crs,
        range: format === 'DXF' ? 'current' : range, geomType: shpGeomType,
        includeGridMesh, includeHeadText, contourIntervalM,
        includeContours: format === 'GeoJSON' || includeContours,
        includeDrainagePolygons: format === 'GeoJSON' || includeDrainagePolygons,
        includeWells: format === 'GeoJSON' || includeWells,
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (err) {
      setExportError('파일 생성 실패: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="데이터 내보내기" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">데이터 내보내기 (Export)</h3>
              <p className="text-xs text-slate-400">월말 모의수위, DEM 참고 지표고·표고 차이 및 예시 수위 저하 지수 추출</p>
            </div>
          </div>
          <button
            aria-label="내보내기 닫기"
            onClick={onClose} disabled={isExporting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-amber-200 leading-relaxed">{DATA_NOTICE}</p>
          <p className="text-xs text-slate-400">표시·내보내기는 모두 약 50m 원본 격자이며, 저류량은 산정 자료 없음입니다.</p>
          {format !== 'SHP' && <p className="text-xs text-slate-400">등수두선은 {dataset.metadata?.year}년 {Number(selectedMonth)}월 말 기준이며, 지도와 같은 {contourIntervalM}m 간격으로 내보냅니다.</p>}
          {exportError && <p role="alert" className="text-xs text-red-300">{exportError}</p>}
          {/* Format Options (Radio) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
              1. 포맷 선택 (Export Format)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'SHP', name: 'ESRI SHP', desc: 'Shapefile 패키지 (.zip)', icon: Layers },
                { id: 'GeoJSON', name: 'GeoJSON', desc: 'RFC 7946 웹 표준', icon: Globe },
                { id: 'DXF', name: 'AutoCAD DXF', desc: '2D/3D CAD 호환', icon: FileCode2 },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = format === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isExporting}
                    onClick={() => setFormat(item.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/40 text-white'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-blue-400 absolute top-2.5 right-2.5" />
                    )}
                    <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                    <div className="font-bold text-xs">{item.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ESRI SHP Specific Export Options */}
          {format === 'SHP' && (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
              <label className="text-xs font-semibold text-slate-300 block flex items-center justify-between">
                <span>2. Shapefile 형상 및 구성 옵션</span>
                <span className="text-[10px] text-blue-400 font-mono">ESRI Standard Archive</span>
              </label>

              {/* Geometry Type Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShpGeomType('point')}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all flex items-center justify-between ${
                    shpGeomType === 'point'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>표시 격자 중심점</span>
                  {shpGeomType === 'point' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShpGeomType('polygon')}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all flex items-center justify-between ${
                    shpGeomType === 'polygon'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>약 50m 원본 격자</span>
                  {shpGeomType === 'polygon' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              </div>

              {/* Information Note */}
              <div className="flex items-start gap-2 bg-blue-950/40 border border-blue-800/40 rounded-lg p-2.5 text-[11px] text-slate-300 leading-relaxed">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-blue-300">표준 ESRI Shapefile 패키지 (.zip)</span>로 다운로드됩니다.
                  압축 파일 내에 <span className="font-mono text-white">.shp</span>(형상), <span className="font-mono text-white">.shx</span>(인덱스), <span className="font-mono text-white">.dbf</span>(속성 테이블), <span className="font-mono text-white">.prj</span>(좌표계), <span className="font-mono text-white">.cpg</span>(인코딩)가 모두 포함되어 QGIS 및 ArcGIS에서 바로 열립니다.
                </div>
              </div>
            </div>
          )}

          {/* DXF / CAD Specific Export Options */}
          {format === 'DXF' && (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
              <label className="text-xs font-semibold text-slate-300 block flex items-center justify-between">
                <span>2. DXF 레이어 및 도면 구성 옵션 (CAD Layers)</span>
                <span className="text-[10px] text-blue-400 font-mono">AutoCAD R12 Standard</span>
              </label>

              <div className="space-y-2">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGridMesh}
                    onChange={() => setIncludeGridMesh(!includeGridMesh)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-200">
                    표시 격자 경계선 포함 (<span className="text-cyan-400 font-mono">GW_DISPLAY_GRID</span>)
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHeadText}
                    onChange={() => setIncludeHeadText(!includeHeadText)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-200">
                    지하수위 표고 텍스트 레이블 포함 (<span className="text-yellow-400 font-mono">GW_HEAD_TEXT</span>)
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeContours}
                    onChange={() => setIncludeContours(!includeContours)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-200">
                    지하수위 등수두선 레이어 포함 (<span className="text-emerald-400 font-mono">GW_CONTOUR</span>)
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDrainagePolygons}
                    onChange={() => setIncludeDrainagePolygons(!includeDrainagePolygons)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-200">
                    농업용수 가뭄 우려지구 폴리곤 포함 (<span className="text-amber-400 font-mono">GW_DROUGHT_ZONE</span>)
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWells}
                    onChange={() => setIncludeWells(!includeWells)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-200">
                    관측정 및 텔레메트리 지점 포함 (<span className="text-purple-400 font-mono">OBS_WELLS</span>)
                  </span>
                </label>
              </div>

              {/* Information Note */}
              <div className="flex items-start gap-2 bg-blue-950/40 border border-blue-800/40 rounded-lg p-2.5 text-[11px] text-slate-300 leading-relaxed">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-blue-300">AutoCAD R12(AC1009) 형식</span>으로 생성됩니다. 도면 한계($EXTMIN/$EXTMAX) 및 활성 뷰포트(VPORT)가 적용되어 AutoCAD 실행 시 화면 중앙에 유역 형상이 즉시 자동으로 확대(Zoom Extents)되어 나타납니다.
                </div>
              </div>
            </div>
          )}

          {format === 'GeoJSON' && <p className="text-xs text-blue-300">GeoJSON은 WGS84 경위도로 저장합니다. 선택 월의 등수두선과 예시 구역·관측정이 함께 포함됩니다.</p>}
          {format === 'DXF' && <p className="text-xs text-blue-300">DXF는 현재 선택 월만 지원합니다.</p>}
          {/* Coordinate System & Scope */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">좌표계 (CRS)</label>
              <select
                aria-label="내보내기 좌표계"
                value={format === 'GeoJSON' ? 'EPSG:4326' : crs}
                disabled={format === 'GeoJSON' || isExporting}
                onChange={(e) => setCrs(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="EPSG:5179">EPSG:5179 (Korea UTM-K)</option>
                <option value="EPSG:5186">EPSG:5186 (Korea Central)</option>
                <option value="EPSG:4326">EPSG:4326 (WGS84 Lon/Lat)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">대상 시점</label>
              <select
                aria-label="내보내기 대상 시점"
                value={format === 'DXF' ? 'current' : range}
                disabled={format === 'DXF' || isExporting}
                onChange={(e) => setRange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="current">현재 선택 월 ({selectedMonth}월)</option>
                <option value="all">1~12월 수위 속성 추가</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end space-x-3">
          <button
            onClick={onClose} disabled={isExporting}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-lg text-xs font-bold bg-primaryAccent hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? '파일 생성 중...' : '다운로드 (Download)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
