import L from 'leaflet';
import { gridsInBounds } from './gridViewport';
import { gridMetricValue, metricColor } from './headDisplay';
import { fillGridPixels, showGridBorder } from './gridRaster';
import { prepareTileFrame, surfaceSignature } from './tileFrame';
import { declineAppearance } from './declineDisplay';

export function createGridSurfaceLayer(map, index, type, getAnalysis) {
  const layer = L.gridLayer({
    pane: type === 'head' ? 'gridPane' : 'droughtPane',
    tileSize: 256, updateWhenIdle: true, keepBuffer: 1, noWrap: true,
    className: 'groundwater-surface',
  });
  const records = new Map();
  let committed;
  const setOpacity = settings => {
    const opacity = type === 'head' ? (settings.layers.gridOpacity ?? 0.85) : 1;
    if (layer.options.opacity !== opacity) layer.setOpacity(opacity);
  };
  // Newly exposed tiles must show the committed month during preparation.
  layer.initialize = settings => {
    committed = settings;
    setOpacity(settings);
  };
  layer.on('tileunload', event => records.delete(event.tile));

  const paint = (record, settings) => {
    const { canvas, ratio, cells, zoom } = record;
    const buffer = document.createElement('canvas');
    buffer.width = canvas.width;
    buffer.height = canvas.height;
    const context = buffer.getContext('2d');
    const square = settings.gridShape === 'square';
    const pixels = square ? context.createImageData(buffer.width, buffer.height) : null;
    const borders = [];
    const palette = new Map();
    if (!square) context.scale(ratio, ratio);
    for (const { grid, points, centre } of cells) {
      const info = type === 'drought' ? getAnalysis(grid, settings.selectedMonth) : null;
      const appearance = type === 'drought' ? declineAppearance(info, settings.layers) : null;
      const color = type === 'head'
        ? metricColor(gridMetricValue(grid, settings.selectedMonth, settings.layers.gridMetric), settings.layers.gridMetric)
        : appearance.color;
      if (!color) continue;
      if (square) {
        if (!points.length) continue;
        if (!palette.has(color)) palette.set(color, [
          parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16),
          parseInt(color.slice(5, 7), 16), type === 'head' ? 255 : Math.round(appearance.opacity * 255),
        ]);
        fillGridPixels(pixels.data, buffer.width, buffer.height,
          points.map(p => ({ x: p.x * ratio, y: p.y * ratio })), palette.get(color));
        if (showGridBorder(settings.layers.gridBorder, points)) borders.push(points);
      } else {
        context.beginPath();
        context.arc(centre.x, centre.y, zoom >= 13 ? 5 : 3.5, 0, Math.PI * 2);
        context.fillStyle = color;
        context.globalAlpha = type === 'head' ? 1 : appearance.opacity;
        context.fill();
        context.globalAlpha = 0.9;
        context.strokeStyle = zoom >= 13 ? '#0b0f19' : color;
        context.lineWidth = zoom >= 14 ? 0.8 : 0.4;
        context.stroke();
      }
    }
    if (square) {
      context.putImageData(pixels, 0, 0);
      if (borders.length) {
        context.scale(ratio, ratio);
        context.beginPath();
        for (const points of borders) {
          context.moveTo(points[0].x, points[0].y);
          for (const point of points.slice(1)) context.lineTo(point.x, point.y);
          context.closePath();
        }
        context.strokeStyle = 'rgba(23, 50, 77, 0.22)';
        context.lineWidth = 0.5;
        context.stroke();
      }
    }
    return buffer;
  };
  const publish = (record, buffer) => {
    const context = record.canvas.getContext('2d');
    // Copy also replaces transparent drought pixels without a visible clear.
    context.globalCompositeOperation = 'copy';
    context.drawImage(buffer, 0, 0);
    context.globalCompositeOperation = 'source-over';
  };
  layer.prepare = async (settings, isCurrent) => {
    const signature = surfaceSignature(settings, type);
    const frame = await prepareTileFrame(records, signature, record => paint(record, settings), isCurrent);
    if (!frame) return null;
    return {
      valid: frame.valid,
      commit() {
        if (!frame.commit(publish)) return false;
        committed = settings;
        setOpacity(settings);
        for (const record of records.values()) record.canvas.dataset.frame = signature;
        return true;
      },
    };
  };
  layer.createTile = coords => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.round(256 * Math.min(window.devicePixelRatio || 1, 2));
    const ratio = canvas.width / 256;
    const origin = L.point(coords.x * 256, coords.y * 256);
    const nw = map.unproject(origin.subtract([8, 8]), coords.z);
    const se = map.unproject(origin.add([264, 264]), coords.z);
    const cells = gridsInBounds(index, { north: nw.lat, south: se.lat, west: nw.lng, east: se.lng })
      .map(grid => ({ grid, points: (grid.polygon ?? []).map(p => map.project(p, coords.z).subtract(origin)),
        centre: map.project([grid.lat, grid.lon], coords.z).subtract(origin) }));
    const record = { canvas, ratio, cells, zoom: coords.z, signature: surfaceSignature(committed, type) };
    publish(record, paint(record, committed));
    canvas.dataset.frame = record.signature;
    records.set(canvas, record);
    return canvas;
  };
  return layer;
}
