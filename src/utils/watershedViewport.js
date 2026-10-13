// Grid polygons include the original cell edges, not just their centers.
export function watershedBounds(dataset) {
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  const extend = point => {
    const [lat, lon] = point ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
    south = Math.min(south, lat); north = Math.max(north, lat);
    west = Math.min(west, lon); east = Math.max(east, lon);
    return true;
  };
  for (const grid of dataset?.grids ?? []) {
    let hasPolygon = false;
    for (const point of grid.polygon ?? []) hasPolygon = extend(point) || hasPolygon;
    if (!hasPolygon) extend([grid.lat, grid.lon]);
  }
  if (Number.isFinite(south)) return [[south, west], [north, east]];
  const bounds = dataset?.metadata?.bounds;
  if (bounds && bounds.minLat <= bounds.maxLat && bounds.minLon <= bounds.maxLon &&
      extend([bounds.minLat, bounds.minLon]) && extend([bounds.maxLat, bounds.maxLon])) {
    return [[south, west], [north, east]];
  }
  return null;
}

export function watershedPadding(size, bottomInset = 0, rightInset = 0) {
  // Leave room for navigation, captions, coordinates and the mobile bottom sheet.
  // Clamp the padding on short/narrow windows so the usable area stays positive.
  const edge = Math.min(size.x >= 768 ? 24 : 16, size.x / 4, size.y / 4);
  const bottom = Math.min(Math.max(edge, bottomInset + edge), Math.max(edge, size.y - edge - 32));
  const right = Math.min(Math.max(edge, rightInset + edge), Math.max(edge, size.x - edge - 32));
  return { paddingTopLeft: [edge, edge], paddingBottomRight: [right, bottom] };
}

export function unobscuredWatershedPadding(map, bounds, size, { bottomInset = 0, rightInset = 0, navigationBottom = 0 }) {
  const beside = watershedPadding(size, bottomInset, rightInset);
  const edge = beside.paddingTopLeft[1];
  const below = watershedPadding(size, bottomInset);
  below.paddingTopLeft[1] = navigationBottom + edge;
  if (!rightInset || size.y - below.paddingTopLeft[1] - below.paddingBottomRight[1] < 32) return beside;
  const zoom = padding => map.getBoundsZoom(bounds, false, [
    padding.paddingTopLeft[0] + padding.paddingBottomRight[0],
    padding.paddingTopLeft[1] + padding.paddingBottomRight[1],
  ]);
  // On tall phones, fitting below the controls can show substantially larger data
  // than permanently reserving the whole right column. Both keep controls clear.
  return zoom(below) > zoom(beside) ? below : beside;
}

// Keep automatic fitting separate from the user's manually chosen map view.
export function createWatershedViewport(map, {
  getBounds,
  getPadding,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
}) {
  let automatic = true;
  let applying = false;
  let disposed = false;
  let frame = null;
  const cancel = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
  };
  const preserve = () => {
    if (applying || disposed) return;
    automatic = false;
    cancel();
  };
  const fit = () => {
    if (disposed) return false;
    const bounds = getBounds();
    if (!bounds) return false;
    applying = true;
    try {
      map.stop();
      map.invalidateSize({ animate: false });
      const size = map.getSize();
      if (size.x <= 0 || size.y <= 0) return false;
      map.fitBounds(bounds, { ...getPadding(size), maxZoom: 19, animate: false });
      return true;
    } finally {
      applying = false;
    }
  };
  const resize = () => {
    if (disposed) return;
    cancel();
    frame = requestFrame(() => {
      frame = null;
      if (disposed) return;
      if (automatic) fit();
      else {
        // Leaflet keeps the geographic center while updating its pixel size.
        applying = true;
        try { map.invalidateSize({ animate: false, debounceMoveend: true }); }
        finally { applying = false; }
      }
    });
  };
  const reset = () => {
    if (disposed) return false;
    cancel();
    automatic = true;
    return fit();
  };
  map.on('movestart zoomstart dragstart', preserve);
  return {
    reset, resize, preserve,
    dispose() {
      disposed = true;
      cancel();
      map.off('movestart zoomstart dragstart', preserve);
    },
  };
}
