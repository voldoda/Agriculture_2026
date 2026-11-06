// Inert background branches, not the branch containing the dialog.
export function containModalFocus(dialog, { initialFocus, onEscape } = {}) {
  const doc = dialog.ownerDocument;
  const previous = doc.activeElement;
  const backgrounds = [];
  for (let branch = dialog; branch && branch !== doc.body; branch = branch.parentElement) {
    for (const sibling of branch.parentElement?.children ?? []) {
      if (sibling === branch) continue;
      backgrounds.push([sibling, sibling.inert]);
      sibling.inert = true;
    }
  }
  const controls = () => [...dialog.querySelectorAll(
    'button, select, input, textarea, a[href], [tabindex]',
  )].filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
  const focusFirst = () => (initialFocus && !initialFocus.disabled ? initialFocus : controls()[0] ?? dialog).focus();
  const handleFocus = event => { if (!dialog.contains(event.target)) focusFirst(); };
  const handleKey = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape?.();
    }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const items = controls();
    const index = items.indexOf(doc.activeElement);
    const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length;
    (items[next] ?? dialog).focus();
  };
  doc.addEventListener('focusin', handleFocus, true);
  doc.addEventListener('keydown', handleKey, true);
  focusFirst();
  return () => {
    doc.removeEventListener('focusin', handleFocus, true);
    doc.removeEventListener('keydown', handleKey, true);
    for (const [element, inert] of backgrounds) element.inert = inert;
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  };
}
