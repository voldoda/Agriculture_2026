import JSZip from 'jszip';
import { exactHead } from './headPrecision.js';
import { projectGridCenter, projectGridPolygon } from './projection.js';
import { calculateGridDrought } from './droughtUtils.js';
import { exportMetadata, getHeadSource, SOURCE_MONTHS } from './dataProvenance.js';
import { surfaceComparison } from './surfaceElevation.js';

// PRJ WKT definitions
const PRJ_DEFINITIONS = {
  'EPSG:5179': 'PROJCS["Korea 2000 / Unified CS",GEOGCS["Korea 2000",DATUM["Geocentric_Datum_of_Korea",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",38],PARAMETER["central_meridian",127.5],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",1000000],PARAMETER["false_northing",2000000],UNIT["metre",1]]',
  'EPSG:5186': 'PROJCS["Korea_2000_Korea_Central_Belt_2010",GEOGCS["Korea 2000",DATUM["D_Korean_2000",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",38],PARAMETER["central_meridian",127],PARAMETER["scale_factor",1],PARAMETER["false_easting",200000],PARAMETER["false_northing",600000],UNIT["Meter",1]]',
  'EPSG:4326': 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
};

/**
 * Builds Point Shapefile binary buffers (.shp, .shx, .dbf)
 */
function buildPointShapefile(records, fields) {
  const n = records.length;
  
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = records[i];
    if (r.x < xmin) xmin = r.x;
    if (r.x > xmax) xmax = r.x;
    if (r.y < ymin) ymin = r.y;
    if (r.y > ymax) ymax = r.y;
  }

  // 1. .shp
  const shpLen = 100 + n * 28;
  const shpBuf = new ArrayBuffer(shpLen);
  const shpView = new DataView(shpBuf);

  shpView.setInt32(0, 9994, false);
  shpView.setInt32(24, shpLen / 2, false);
  shpView.setInt32(28, 1000, true);
  shpView.setInt32(32, 1, true); // Point
  shpView.setFloat64(36, xmin, true);
  shpView.setFloat64(44, ymin, true);
  shpView.setFloat64(52, xmax, true);
  shpView.setFloat64(60, ymax, true);

  // 2. .shx
  const shxLen = 100 + n * 8;
  const shxBuf = new ArrayBuffer(shxLen);
  const shxView = new DataView(shxBuf);

  shxView.setInt32(0, 9994, false);
  shxView.setInt32(24, shxLen / 2, false);
  shxView.setInt32(28, 1000, true);
  shxView.setInt32(32, 1, true);
  shxView.setFloat64(36, xmin, true);
  shxView.setFloat64(44, ymin, true);
  shxView.setFloat64(52, xmax, true);
  shxView.setFloat64(60, ymax, true);

  let shpOffset = 100;
  let shxOffset = 100;
  for (let i = 0; i < n; i++) {
    const r = records[i];

    shxView.setInt32(shxOffset, shpOffset / 2, false);
    shxView.setInt32(shxOffset + 4, 10, false);
    shxOffset += 8;

    shpView.setInt32(shpOffset, i + 1, false);
    shpView.setInt32(shpOffset + 4, 10, false);
    shpOffset += 8;

    shpView.setInt32(shpOffset, 1, true);
    shpView.setFloat64(shpOffset + 4, r.x, true);
    shpView.setFloat64(shpOffset + 12, r.y, true);
    shpOffset += 20;
  }

  // 3. .dbf
  const dbfBuf = buildDbfBuffer(records, fields);

  return { shpBuf, shxBuf, dbfBuf };
}

/**
 * Builds Polygon Shapefile binary buffers (.shp, .shx, .dbf)
 */
function buildPolygonShapefile(records, fields) {
  const n = records.length;
  
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = records[i];
    for (const pt of r.polygon) {
      if (pt[0] < xmin) xmin = pt[0];
      if (pt[0] > xmax) xmax = pt[0];
      if (pt[1] < ymin) ymin = pt[1];
      if (pt[1] > ymax) ymax = pt[1];
    }
  }

  const shpLen = 100 + n * 136;
  const shpBuf = new ArrayBuffer(shpLen);
  const shpView = new DataView(shpBuf);

  shpView.setInt32(0, 9994, false);
  shpView.setInt32(24, shpLen / 2, false);
  shpView.setInt32(28, 1000, true);
  shpView.setInt32(32, 5, true); // Shape Type: 5 (Polygon)
  shpView.setFloat64(36, xmin, true);
  shpView.setFloat64(44, ymin, true);
  shpView.setFloat64(52, xmax, true);
  shpView.setFloat64(60, ymax, true);

  const shxLen = 100 + n * 8;
  const shxBuf = new ArrayBuffer(shxLen);
  const shxView = new DataView(shxBuf);

  shxView.setInt32(0, 9994, false);
  shxView.setInt32(24, shxLen / 2, false);
  shxView.setInt32(28, 1000, true);
  shxView.setInt32(32, 5, true);
  shxView.setFloat64(36, xmin, true);
  shxView.setFloat64(44, ymin, true);
  shxView.setFloat64(52, xmax, true);
  shxView.setFloat64(60, ymax, true);

  let shpOffset = 100;
  let shxOffset = 100;
  for (let i = 0; i < n; i++) {
    const r = records[i];
    const poly = r.polygon;

    let cXmin = Infinity, cYmin = Infinity, cXmax = -Infinity, cYmax = -Infinity;
    for (const pt of poly) {
      if (pt[0] < cXmin) cXmin = pt[0];
      if (pt[0] > cXmax) cXmax = pt[0];
      if (pt[1] < cYmin) cYmin = pt[1];
      if (pt[1] > cYmax) cYmax = pt[1];
    }

    shxView.setInt32(shxOffset, shpOffset / 2, false);
    shxView.setInt32(shxOffset + 4, 64, false);
    shxOffset += 8;

    shpView.setInt32(shpOffset, i + 1, false);
    shpView.setInt32(shpOffset + 4, 64, false);
    shpOffset += 8;

    shpView.setInt32(shpOffset, 5, true);
    shpView.setFloat64(shpOffset + 4, cXmin, true);
    shpView.setFloat64(shpOffset + 12, cYmin, true);
    shpView.setFloat64(shpOffset + 20, cXmax, true);
    shpView.setFloat64(shpOffset + 28, cYmax, true);
    shpView.setInt32(shpOffset + 36, 1, true); // NumParts = 1
    shpView.setInt32(shpOffset + 40, 5, true); // NumPoints = 5
    shpView.setInt32(shpOffset + 44, 0, true); // Parts[0] = 0

    let ptOffset = shpOffset + 48;
    for (let j = 0; j < 5; j++) {
      shpView.setFloat64(ptOffset, poly[j][0], true);
      shpView.setFloat64(ptOffset + 8, poly[j][1], true);
      ptOffset += 16;
    }

    shpOffset += 128;
  }

  const dbfBuf = buildDbfBuffer(records, fields);

  return { shpBuf, shxBuf, dbfBuf };
}

/**
 * Builds dBASE III (.dbf) binary buffer
 */
function buildDbfBuffer(records, fields) {
  const n = records.length;
  const headerLen = 32 + fields.length * 32 + 1;
  const recordLen = 1 + fields.reduce((sum, f) => sum + f.len, 0);
  const dbfLen = headerLen + n * recordLen + 1;
  const dbfBuf = new ArrayBuffer(dbfLen);
  const dbfView = new DataView(dbfBuf);
  const dbfBytes = new Uint8Array(dbfBuf);

  const now = new Date();
  dbfView.setUint8(0, 0x03);
  dbfView.setUint8(1, now.getFullYear() - 1900);
  dbfView.setUint8(2, now.getMonth() + 1);
  dbfView.setUint8(3, now.getDate());
  dbfView.setInt32(4, n, true);
  dbfView.setInt16(8, headerLen, true);
  dbfView.setInt16(10, recordLen, true);

  const encoder = new TextEncoder();
  let fOffset = 32;
  fields.forEach(f => {
    const nameBytes = encoder.encode(f.name);
    for (let j = 0; j < 11; j++) {
      dbfBytes[fOffset + j] = j < nameBytes.length ? nameBytes[j] : 0;
    }
    dbfBytes[fOffset + 11] = f.type.charCodeAt(0);
    dbfView.setUint8(fOffset + 16, f.len);
    dbfView.setUint8(fOffset + 17, f.dec || 0);
    fOffset += 32;
  });
  dbfBytes[fOffset] = 0x0D;

  let rOffset = headerLen;
  for (let i = 0; i < n; i++) {
    const r = records[i];
    dbfBytes[rOffset] = 0x20; // Active record
    let colOffset = rOffset + 1;

    fields.forEach(f => {
      let val = r[f.key];
      let str = '';
      if (f.type === 'N') {
        if (f.exact && val != null) {
          if (typeof val !== 'string' || !/^-?\d+(\.\d+)?$/.test(val) || val.length > f.len) throw new Error('원본 수위 DBF 필드 범위 초과: ' + f.name);
          str = val.padStart(f.len, ' ');
        } else str = Number.isFinite(val)
          ? (f.dec > 0 ? val.toFixed(f.dec) : Math.round(val).toString()).padStart(f.len, ' ')
          : ''.padStart(f.len, ' ');
      } else {
        str = String(val || '').padEnd(f.len, ' ');
      }

      const b = encoder.encode(str.slice(0, f.len));
      for (let j = 0; j < f.len; j++) {
        dbfBytes[colOffset + j] = j < b.length ? b[j] : 32;
      }
      colOffset += f.len;
    });

    rOffset += recordLen;
  }
  dbfBytes[rOffset] = 0x1A; // EOF

  return dbfBuf;
}

/**
 * Generates a complete, standard ESRI Shapefile Package (.zip)
 * containing .shp, .shx, .dbf, .prj, .cpg
 */
export async function generateShapefileZip(dataset, options = {}) {
  const {
    selectedMonth = '05',
    crs = 'EPSG:5179',
    range = 'current',
    geomType = 'point' // 'point' or 'polygon'
  } = options;

  if (!PRJ_DEFINITIONS[crs]) throw new Error('지원하지 않는 좌표계: ' + crs);
  if (!dataset?.grids?.length) throw new Error('내보낼 격자가 없습니다.');

  const isPolygon = geomType === 'polygon';
  const isAllMonths = range === 'all';
  const monthName = `${selectedMonth}월`;
  const baseName = `HydroGIS_유구천_${monthName}_SHP`;

  // Define DBF fields
  const fields = [
    { name: 'ID', key: 'id', type: 'C', len: 16 },
    { name: 'ROW', key: 'row', type: 'N', len: 6, dec: 0 },
    { name: 'COL', key: 'col', type: 'N', len: 6, dec: 0 },
    { name: 'HEAD', key: 'head', type: 'N', len: 24, dec: 15, exact: true },
    { name: 'SURF_EL', key: 'surfaceEl', type: 'N', len: 10, dec: 2 },
    { name: 'DEPTH', key: 'depth', type: 'N', len: 8, dec: 2 },
    { name: 'DEPTH_REF', key: 'depthRef', type: 'N', len: 10, dec: 2 },
    { name: 'DEPTH_Q', key: 'depthQuality', type: 'C', len: 32 },
    { name: 'SURF_SRC', key: 'surfaceSource', type: 'C', len: 16 },
    { name: 'DECLINE_M', key: 'declineM', type: 'N', len: 12, dec: 4 },
    { name: 'DECL_IDX', key: 'drought', type: 'N', len: 8, dec: 2 },
    { name: 'DROUGHT', key: 'drought', type: 'N', len: 8, dec: 2 },
    { name: 'STORAGE', key: 'storage', type: 'N', len: 10, dec: 0 },
    { name: 'STORE_PCT', key: 'storePct', type: 'N', len: 6, dec: 1 },
    { name: 'STAGE', key: 'stage', type: 'C', len: 12 },
    { name: 'YEAR', key: 'year', type: 'N', len: 4, dec: 0 },
    { name: 'MONTH', key: 'month', type: 'C', len: 2 },
    { name: 'HEAD_SRC', key: 'source', type: 'C', len: 20 },
    { name: 'ANALYSIS', key: 'analysis', type: 'C', len: 20 }
  ];

  if (isAllMonths) {
    fields.push(...(dataset.metadata?.sourceMonths ?? SOURCE_MONTHS).map(m => ({ name: 'H_' + m, key: 'h' + m, type: 'N', len: 24, dec: 15, exact: true })));
  }

  // Prepare records with coordinates based on CRS
  const records = dataset.grids.map(g => {
    const info = calculateGridDrought(g, selectedMonth);
    const surface = surfaceComparison(g, selectedMonth);
    const [x, y] = projectGridCenter(g, crs);
    const rec = {
      id: g.id, row: g.row, col: g.col,
      head: exactHead(g, selectedMonth), surfaceEl: g.surfaceEl, depth: surface.depthM,
      depthRef: surface.rawDifferenceM, depthQuality: surface.status,
      surfaceSource: g.surfaceSource ?? '', declineM: info?.drawdownM,
      drought: info?.score, storage: info?.storageM3, storePct: info?.storageRate,
      year: dataset.metadata?.year ?? null, stage: info?.stageEn ?? 'No data', month: selectedMonth,
      source: getHeadSource(selectedMonth, dataset.metadata), analysis: 'unvalidated_example',
      x, y, polygon: isPolygon ? projectGridPolygon(g, crs) : undefined,
    };
    if (isAllMonths) {
      for (const m of (dataset.metadata?.sourceMonths ?? SOURCE_MONTHS)) rec['h' + m] = exactHead(g, m);
    }

    return rec;
  });

  // Build shapefile binary buffers
  const { shpBuf, shxBuf, dbfBuf } = isPolygon
    ? buildPolygonShapefile(records, fields)
    : buildPointShapefile(records, fields);

  const prjContent = PRJ_DEFINITIONS[crs] || PRJ_DEFINITIONS['EPSG:5179'];
  const cpgContent = 'UTF-8';

  // Create ZIP archive
  const zip = new JSZip();
  zip.file(`${baseName}.shp`, shpBuf);
  zip.file(`${baseName}.shx`, shxBuf);
  zip.file(`${baseName}.dbf`, dbfBuf);
  zip.file(`${baseName}.prj`, prjContent);
  zip.file(`${baseName}.cpg`, cpgContent);
  zip.file('metadata.json', JSON.stringify(exportMetadata(dataset, selectedMonth), null, 2));

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    blob: zipBlob,
    fileName: `${baseName}.zip`,
    totalRecords: records.length,
    geomType: isPolygon ? 'Polygon' : 'Point'
  };
}
