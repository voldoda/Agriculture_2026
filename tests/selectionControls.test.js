import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionEscapeAction } from '../src/utils/selectionControls.js';

test('Escape closes foreground UI before clearing the selected map cell', () => {
  const event = { key: 'Escape' };
  assert.equal(selectionEscapeAction(event, { selected: true }), 'selection');
  assert.equal(selectionEscapeAction(event, { selected: false }), null);
  assert.equal(selectionEscapeAction(event, { selected: true, leftDrawer: true }), 'drawers');
  assert.equal(selectionEscapeAction(event, { selected: true, rightDrawer: true }), 'drawers');
  assert.equal(selectionEscapeAction(event, { selected: true, rightDrawer: true, export: true }), 'export');
  assert.equal(selectionEscapeAction(event, { selected: true, export: true, comparison: true }), 'comparison');
});

test('Consumed, composing or repeated keys and active form controls preserve selection', () => {
  const state = { selected: true };
  for (const event of [
    { key: 'Enter' }, { key: 'Escape', defaultPrevented: true },
    { key: 'Escape', isComposing: true }, { key: 'Escape', repeat: true },
    { key: 'Escape', target: { isContentEditable: true } },
    { key: 'Escape', target: { closest: () => ({ tagName: 'SELECT' }) } },
  ]) assert.equal(selectionEscapeAction(event, state), null);
  assert.equal(selectionEscapeAction({ key: 'Escape', target: { closest: () => null } }, state), 'selection');
  assert.equal(selectionEscapeAction({ key: 'Escape', target: { isContentEditable: true } }, { ...state, export: true }), 'export');
});
