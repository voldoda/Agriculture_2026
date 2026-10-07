import { declineScope } from './declineDisplay.js';

// Prepare a complete frame without touching any currently visible pixels.
export async function prepareTileFrame(records, signature, paint, isCurrent,
  yieldTask = () => new Promise(resolve => setTimeout(resolve, 0))) {
  const snapshot = [...records.values()];
  const updates = [];
  let start = performance.now();
  for (const record of snapshot) {
    if (!isCurrent()) return null;
    if (record.signature !== signature) updates.push([record, paint(record)]);
    if (performance.now() - start > 10) {
      await yieldTask();
      start = performance.now();
    }
  }
  const valid = () => isCurrent() && snapshot.length === records.size &&
    snapshot.every(record => records.get(record.canvas) === record);
  return {
    valid,
    commit(publish) {
      if (!valid()) return false;
      for (const [record, buffer] of updates) {
        publish(record, buffer);
        record.signature = signature;
      }
      return true;
    },
  };
}

export function surfaceSignature(settings, type) {
  const metric = type === 'head' ? (settings.layers.gridMetric ?? 'head')
    : `drought:${settings.layers.declineMetric ?? 'stage'}:${declineScope(settings.layers)}`;
  const time = metric === 'range' ? 'annual' : settings.selectedMonth;
  return `${time}:${metric}:${settings.gridShape}:${settings.layers.gridBorder ?? 'auto'}`;
}
