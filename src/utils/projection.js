// Shared Transverse Mercator projection for the supported Korean coordinate systems.
export function projectWgs84(lon, lat, targetCrs = 'EPSG:5179') {
  if (!['EPSG:5179', 'EPSG:5186', 'EPSG:4326'].includes(targetCrs)) throw new Error('지원하지 않는 좌표계: ' + targetCrs);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error('유효하지 않은 경위도');
  if (targetCrs === 'EPSG:4326') {
    return [lon, lat];
  }

  const a = 6378137.0; // GRS80 / WGS84 semi-major axis
  const f = 1.0 / 298.257222101; // GRS80 flattening

  let k0, lon0, lat0, falseEasting, falseNorthing;

  if (targetCrs === 'EPSG:5186') {
    // Korea 2000 / Central Belt 2010
    k0 = 1.0;
    lon0 = 127.0 * (Math.PI / 180.0);
    lat0 = 38.0 * (Math.PI / 180.0);
    falseEasting = 200000.0;
    falseNorthing = 600000.0;
  } else {
    // EPSG:5179 (Korea 2000 / Unified CS - Korea UTM-K) default
    k0 = 0.9996;
    lon0 = 127.5 * (Math.PI / 180.0);
    lat0 = 38.0 * (Math.PI / 180.0);
    falseEasting = 1000000.0;
    falseNorthing = 2000000.0;
  }

  const e2 = 2 * f - f * f;
  const ePrime2 = e2 / (1.0 - e2);

  const phi = lat * (Math.PI / 180.0);
  const lambda = lon * (Math.PI / 180.0);

  const N = a / Math.sqrt(1.0 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = ePrime2 * Math.cos(phi) * Math.cos(phi);
  const A = (lambda - lon0) * Math.cos(phi);

  const M = a * (
    (1.0 - e2 / 4.0 - 3.0 * e2 * e2 / 64.0 - 5.0 * e2 * e2 * e2 / 256.0) * phi
    - (3.0 * e2 / 8.0 + 3.0 * e2 * e2 / 32.0 + 45.0 * e2 * e2 * e2 / 1024.0) * Math.sin(2.0 * phi)
    + (15.0 * e2 * e2 / 256.0 + 45.0 * e2 * e2 * e2 / 1024.0) * Math.sin(4.0 * phi)
    - (35.0 * e2 * e2 * e2 / 3072.0) * Math.sin(6.0 * phi)
  );

  const M0 = a * (
    (1.0 - e2 / 4.0 - 3.0 * e2 * e2 / 64.0 - 5.0 * e2 * e2 * e2 / 256.0) * lat0
    - (3.0 * e2 / 8.0 + 3.0 * e2 * e2 / 32.0 + 45.0 * e2 * e2 * e2 / 1024.0) * Math.sin(2.0 * lat0)
    + (15.0 * e2 * e2 / 256.0 + 45.0 * e2 * e2 * e2 / 1024.0) * Math.sin(4.0 * lat0)
    - (35.0 * e2 * e2 * e2 / 3072.0) * Math.sin(6.0 * lat0)
  );

  const x = falseEasting + k0 * N * (
    A + (1.0 - T + C) * Math.pow(A, 3) / 6.0
    + (5.0 - 18.0 * T + T * T + 72.0 * C - 58.0 * ePrime2) * Math.pow(A, 5) / 120.0
  );

  const y = falseNorthing + k0 * (
    M - M0 + N * Math.tan(phi) * (
      Math.pow(A, 2) / 2.0
      + (5.0 - T + 9.0 * C + 4.0 * C * C) * Math.pow(A, 4) / 24.0
      + (61.0 - 58.0 * T + T * T + 600.0 * C - 330.0 * ePrime2) * Math.pow(A, 6) / 720.0
    )
  );

  return [x, y];
}

// Invert the shared projection with Newton iteration; suitable for the Korean model domain.
export function unproject5179(x, y) {
  let lon = 127.5, lat = 38;
  for (let i = 0; i < 8; i++) {
    const [px, py] = projectWgs84(lon, lat);
    const dx = x - px, dy = y - py;
    if (Math.hypot(dx, dy) < 0.00001) return [lat, lon];
    const h = 0.00001;
    const a = projectWgs84(lon + h, lat), b = projectWgs84(lon, lat + h);
    const ax = (a[0] - px) / h, ay = (a[1] - py) / h;
    const bx = (b[0] - px) / h, by = (b[1] - py) / h;
    const det = ax * by - ay * bx;
    lon += (dx * by - dy * bx) / det;
    lat += (dy * ax - dx * ay) / det;
  }
  throw new Error('EPSG:5179 inverse projection did not converge');
}

export function projectGridCenter(grid, crs) {
  if (crs === 'EPSG:5179' && Number.isFinite(grid.x) && Number.isFinite(grid.y)) {
    return [grid.x, grid.y];
  }
  return projectWgs84(grid.lon, grid.lat, crs);
}

// Transform the displayed footprint, rather than recreating a different-sized cell.
// Dataset rings are [lat, lon], clockwise, with four vertices.
export function projectGridPolygon(grid, crs) {
  if (!Array.isArray(grid.polygon) || grid.polygon.length < 4) {
    throw new Error(`${grid.id}: 표시 격자 경계가 없습니다.`);
  }
  const ring = grid.polygon.slice(0, 4).map(([lat, lon]) => projectWgs84(lon, lat, crs));
  return [...ring, [...ring[0]]];
}
