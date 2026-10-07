// Close foreground UI first; Escape in an editor must not clear a map selection.
export function selectionEscapeAction(event, state) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.repeat) return null;
  if (state.comparison) return 'comparison';
  if (state.export) return 'export';
  if (state.leftDrawer || state.rightDrawer) return 'drawers';
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input, select, textarea, [contenteditable="true"], [role="combobox"]')) return null;
  return state.selected ? 'selection' : null;
}
