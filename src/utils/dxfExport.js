import { exactHead } from './headPrecision.js';
import { projectWgs84, projectGridCenter, projectGridPolygon } from './projection.js';
export { projectWgs84 } from './projection.js';

/**
 * DXF export engine for the supported Korean coordinate systems
 * Generates AutoCAD Release 12 (AC1009) ASCII DXF
 * with Accurate Geodetic Projections (EPSG:5179, EPSG:5186, EPSG:4326),
 * Extents, Active VPORT Camera, Layers, Colors, Lines, Circles, Points, and Text.
 */

// Universal AutoCAD Unicode Escape for TEXT and MTEXT entities
// Converts characters > 127 to AutoCAD standard \U+XXXX escape sequences
export function toCadUnicode(str) {
  if (!str) return '';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 127) {
      out += '\\U+' + code.toString(16).toUpperCase().padStart(4, '0');
    } else {
      out += str[i];
    }
  }
  return out;
}

export function generateDxf(dataset, options = {}) {
  const {
    selectedMonth = '05',
    crs = 'EPSG:5179',
    includeGridMesh = true,
    includeHeadText = true,
    includeContours = true,
    includeDrainagePolygons = true,
    includeWells = true
  } = options;

  const grids = dataset?.grids || [];
  if (grids.length === 0) return '';

  const isWgs84 = crs === 'EPSG:4326';

  // 1. Calculate Spatial Extents & Center across active entities
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  let zmin = Infinity, zmax = -Infinity;

  // Grid coordinates cache
  const projectedGrids = new Array(grids.length);

  for (let i = 0; i < grids.length; i++) {
    const g = grids[i];
    const [gx, gy] = projectGridCenter(g, crs);
    const h = g.heads?.[selectedMonth];
    if (!Number.isFinite(h)) throw new Error(g.id + ': 선택 월 수위가 없습니다.');
    projectedGrids[i] = { x: gx, y: gy, h, hExact: exactHead(g, selectedMonth), polygon: includeGridMesh ? projectGridPolygon(g, crs) : null };

    if (gx < xmin) xmin = gx;
    if (gx > xmax) xmax = gx;
    if (gy < ymin) ymin = gy;
    if (gy > ymax) ymax = gy;
    if (h < zmin) zmin = h;
    if (h > zmax) zmax = h;
  }

  const xmid = (xmin + xmax) / 2;
  const ymid = (ymin + ymax) / 2;
  const height = Math.max(isWgs84 ? 0.05 : 100.0, (ymax - ymin) * 1.15);
  const width = Math.max(isWgs84 ? 0.05 : 100.0, (xmax - xmin) * 1.15);

  const out = [];
  const p = (code, val) => {
    out.push(String(code).padStart(3, ' '));
    out.push(String(val));
  };

  // 2. HEADER SECTION
  p(999, 'PROTOTYPE: synthetic context layers; unvalidated analysis; grid footprint ~50m.');
  if (includeContours && options.contourLines) p(999, 'GW_CONTOUR: derived monthly model head; linear interpolation; interval ' + (options.contourIntervalM ?? 10) + 'm; no flow vectors.');
  p(999, 'CRS: ' + crs + '; selected month: ' + selectedMonth + '; year: ' + (dataset.metadata?.year ?? 'unspecified') + '; temporal basis: month_end');
  p(0, 'SECTION');
  p(2, 'HEADER');
  p(9, '$ACADVER');
  p(1, 'AC1009'); // AutoCAD Release 12: maximum compatibility across all CAD packages
  p(9, '$DWGCODEPAGE');
  p(3, 'ANSI_949'); // Korean standard codepage
  p(9, '$TEXTSTYLE');
  p(7, 'STANDARD');
  p(9, '$INSBASE');
  p(10, xmid.toFixed(4));
  p(20, ymid.toFixed(4));
  p(30, 0.0);
  p(9, '$EXTMIN');
  p(10, xmin.toFixed(4));
  p(20, ymin.toFixed(4));
  p(30, String(zmin));
  p(9, '$EXTMAX');
  p(10, xmax.toFixed(4));
  p(20, ymax.toFixed(4));
  p(30, String(zmax));
  p(9, '$LIMMIN');
  p(10, (xmin - (isWgs84 ? 0.01 : 100)).toFixed(4));
  p(20, (ymin - (isWgs84 ? 0.01 : 100)).toFixed(4));
  p(9, '$LIMMAX');
  p(10, (xmax + (isWgs84 ? 0.01 : 100)).toFixed(4));
  p(20, (ymax + (isWgs84 ? 0.01 : 100)).toFixed(4));
  p(9, '$PDMODE');
  p(70, 35); // Circle with X mark
  p(9, '$PDSIZE');
  p(40, isWgs84 ? 0.0001 : 6.0);
  p(0, 'ENDSEC');

  // 3. TABLES SECTION
  p(0, 'SECTION');
  p(2, 'TABLES');

  // VPORT Table: Automatically targets and fits the watershed in CAD viewport
  p(0, 'TABLE');
  p(2, 'VPORT');
  p(70, 1);
  p(0, 'VPORT');
  p(2, '*ACTIVE');
  p(70, 0);
  p(10, 0.0);
  p(20, 0.0);
  p(11, 1.0);
  p(21, 1.0);
  p(12, xmid.toFixed(4));
  p(22, ymid.toFixed(4));
  p(13, 0.0);
  p(23, 0.0);
  p(14, 1.0);
  p(24, 1.0);
  p(15, 0.0);
  p(25, 0.0);
  p(16, 0.0);
  p(26, 0.0);
  p(36, 1.0);
  p(17, 0.0);
  p(27, 0.0);
  p(37, 0.0);
  p(40, height.toFixed(4));
  p(41, (width / height).toFixed(2));
  p(42, 50.0);
  p(43, 0.0);
  p(44, 0.0);
  p(50, 0.0);
  p(51, 0.0);
  p(71, 0);
  p(72, 1000);
  p(73, 1);
  p(74, 3);
  p(75, 0);
  p(76, 0);
  p(77, 0);
  p(78, 0);
  p(0, 'ENDTAB');

  // LTYPE Table
  p(0, 'TABLE');
  p(2, 'LTYPE');
  p(70, 1);
  p(0, 'LTYPE');
  p(2, 'CONTINUOUS');
  p(70, 0);
  p(3, 'Solid line');
  p(72, 65);
  p(73, 0);
  p(40, 0.0);
  p(0, 'ENDTAB');

  // LAYER Table: Define dedicated CAD layers with standard ACI colors
  p(0, 'TABLE');
  p(2, 'LAYER');
  p(70, 5);

  const addLayerDef = (name, color) => {
    p(0, 'LAYER');
    p(2, name);
    p(70, 0);
    p(62, color); // 1=Red, 2=Yellow, 3=Green, 4=Cyan, 5=Blue, 6=Magenta, 7=White
    p(6, 'CONTINUOUS');
  };

  addLayerDef('GW_DISPLAY_GRID', 4);     // Cyan (Displayed Grid Mesh)
  addLayerDef('GW_HEAD_TEXT', 2);    // Yellow (Water Level Head Labels)
  addLayerDef('GW_CONTOUR', 3);      // Green (Contour Vectors)
  addLayerDef('GW_DROUGHT_ZONE', 1); // Red (Groundwater Drought & Depletion Risk Areas)
  addLayerDef('OBS_WELLS', 6);       // Magenta (Telemetry Wells)
  p(0, 'ENDTAB');

  // STYLE Table: Define text style with standard Windows Korean font (Gulim / Malgun)
  p(0, 'TABLE');
  p(2, 'STYLE');
  p(70, 1);
  p(0, 'STYLE');
  p(2, 'STANDARD');
  p(70, 0);
  p(40, 0.0);
  p(41, 1.0);
  p(50, 0.0);
  p(71, 0);
  p(42, 2.5);
  p(3, 'gulim.ttc');
  p(4, '');
  p(0, 'ENDTAB');

  p(0, 'ENDSEC');

  // 4. ENTITIES SECTION
  p(0, 'SECTION');
  p(2, 'ENTITIES');

  const addLine = (layer, x1, y1, z1, x2, y2, z2) => {
    p(0, 'LINE');
    p(8, layer);
    p(10, x1.toFixed(4));
    p(20, y1.toFixed(4));
    p(30, String(z1));
    p(11, x2.toFixed(4));
    p(21, y2.toFixed(4));
    p(31, String(z2));
  };

  const addText = (layer, text, x, y, z, size = 5.0) => {
    p(0, 'TEXT');
    p(8, layer);
    p(10, x.toFixed(4));
    p(20, y.toFixed(4));
    p(30, String(z));
    p(40, size.toFixed(4));
    p(1, toCadUnicode(text));
    p(50, 0.0);
    p(7, 'STANDARD');
  };

  const addCircle = (layer, x, y, z, radius) => {
    p(0, 'CIRCLE');
    p(8, layer);
    p(10, x.toFixed(4));
    p(20, y.toFixed(4));
    p(30, String(z));
    p(40, radius.toFixed(4));
  };

  const addPoint = (layer, x, y, z) => {
    p(0, 'POINT');
    p(8, layer);
    p(10, x.toFixed(4));
    p(20, y.toFixed(4));
    p(30, String(z));
  };

  // A. Display Grid Mesh & Points & Water Level Texts

  for (let i = 0; i < projectedGrids.length; i++) {
    const pg = projectedGrids[i];
    const x = pg.x;
    const y = pg.y;
    const h = pg.h;
    const hExact = pg.hExact;

    if (includeGridMesh) {
      const [[x1, y1], [x2, y2], [x3, y3], [x4, y4]] = pg.polygon;

      addLine('GW_DISPLAY_GRID', x1, y1, hExact, x2, y2, hExact);
      addLine('GW_DISPLAY_GRID', x2, y2, hExact, x3, y3, hExact);
      addLine('GW_DISPLAY_GRID', x3, y3, hExact, x4, y4, hExact);
      addLine('GW_DISPLAY_GRID', x4, y4, hExact, x1, y1, hExact);
    }

    addPoint('GW_DISPLAY_GRID', x, y, hExact);

    if (includeHeadText && i % 2 === 0) {
      const textSize = isWgs84 ? 0.00004 : 4.5;
      const offsetX = isWgs84 ? 0.0001 : 12.0;
      const offsetY = isWgs84 ? 0.00002 : 2.5;
      addText('GW_HEAD_TEXT', `${h.toFixed(1)}m`, x - offsetX, y - offsetY, hExact, textSize);
    }
  }

  // B. Contours (Accurately projected into target CRS)
  if (includeContours && options.contourLines) {
    options.contourLines.forEach(c => {
      const coords = c.coordinates || [];
      for (let i = 0; i < coords.length - 1; i++) {
        const pt1 = coords[i]; // [lon, lat]
        const pt2 = coords[i + 1];

        let p1x, p1y, p2x, p2y;
        if (isWgs84) {
          p1x = pt1[0]; p1y = pt1[1];
          p2x = pt2[0]; p2y = pt2[1];
        } else if (crs === 'EPSG:5179' && c.coordinates5179) {
          [p1x, p1y] = c.coordinates5179[i];
          [p2x, p2y] = c.coordinates5179[i + 1];
        } else {
          const [x1, y1] = projectWgs84(pt1[0], pt1[1], crs);
          const [x2, y2] = projectWgs84(pt2[0], pt2[1], crs);
          p1x = x1; p1y = y1;
          p2x = x2; p2y = y2;
        }

        addLine('GW_CONTOUR', p1x, p1y, c.elevation, p2x, p2y, c.elevation);
      }
    });
  }

  // C. Agricultural Drought Risk Polygons (Accurately projected into target CRS)
  if (includeDrainagePolygons && dataset.drainagePolygons) {
    dataset.drainagePolygons.forEach(poly => {
      const coords = poly.coordinates || [];
      let sumX = 0, sumY = 0;
      const count = Math.max(1, coords.length - 1);

      for (let i = 0; i < coords.length - 1; i++) {
        const pt1 = coords[i]; // [lon, lat]
        const pt2 = coords[i + 1];

        let p1x, p1y, p2x, p2y;
        if (isWgs84) {
          p1x = pt1[0]; p1y = pt1[1];
          p2x = pt2[0]; p2y = pt2[1];
        } else {
          const [x1, y1] = projectWgs84(pt1[0], pt1[1], crs);
          const [x2, y2] = projectWgs84(pt2[0], pt2[1], crs);
          p1x = x1; p1y = y1;
          p2x = x2; p2y = y2;
        }

        sumX += p1x;
        sumY += p1y;
        addLine('GW_DROUGHT_ZONE', p1x, p1y, 35.0, p2x, p2y, 35.0);
      }

      if (coords.length > 2) {
        const cX = sumX / count;
        const cY = sumY / count;
        const polyTextSize = isWgs84 ? 0.0002 : 18.0;
        addText('GW_DROUGHT_ZONE', `${poly.id}: ${poly.name}`, cX, cY, 35.0, polyTextSize);
      }
    });
  }

  // D. Observation Wells (From dataset.observationWells, accurately projected into target CRS)
  if (includeWells && dataset.observationWells) {
    dataset.observationWells.forEach(w => {
      let wx, wy;
      if (isWgs84) {
        wx = w.lon;
        wy = w.lat;
      } else {
        const [x, y] = projectWgs84(w.lon, w.lat, crs);
        wx = x;
        wy = y;
      }

      const radius = isWgs84 ? 0.0003 : 25.0;
      const textSize = isWgs84 ? 0.00015 : 14.0;
      const offsetX = isWgs84 ? 0.0004 : 35.0;
      const offsetY = isWgs84 ? 0.0001 : 8.0;

      addCircle('OBS_WELLS', wx, wy, 0.0, radius);
      addText('OBS_WELLS', `${w.id}: ${w.name}`, wx + offsetX, wy + offsetY, 0.0, textSize);
    });
  }

  p(0, 'ENDSEC');
  p(0, 'EOF');

  return out.join('\n');
}
