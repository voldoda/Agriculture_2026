import test from 'node:test';
import assert from 'node:assert/strict';
import { containModalFocus } from '../src/utils/modalFocus.js';

function fixture() {
  const listeners = new Map();
  const doc = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const element = (name, properties = {}) => ({
    name, ownerDocument: doc, inert: false, disabled: false, isConnected: true, tabIndex: 0,
    getClientRects: () => [{}],
    focus() { doc.activeElement = this; listeners.get('focusin')?.({ target: this }); },
    ...properties,
  });
  const trigger = element('export trigger'), preexisting = element('already inert', { inert: true });
  const close = element('close'), select = element('format'), download = element('download');
  const hidden = element('hidden', { getClientRects: () => [] });
  const disabled = element('disabled', { disabled: true });
  const root = element('app'), dialog = element('dialog');
  doc.body = { children: [root] };
  root.parentElement = doc.body;
  root.children = [trigger, preexisting, dialog];
  dialog.parentElement = root;
  const items = [close, hidden, disabled, select, download];
  dialog.querySelectorAll = () => items;
  dialog.contains = target => target === dialog || items.includes(target);
  doc.activeElement = trigger;
  const key = (value, shiftKey = false) => {
    const event = { key: value, shiftKey, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    listeners.get('keydown')(event);
    return event;
  };
  return { doc, dialog, close, select, download, trigger, preexisting, listeners, key };
}

test('export focus stays within enabled visible controls in both directions and restores background state', () => {
  const f = fixture();
  const dispose = containModalFocus(f.dialog, { initialFocus: f.close });
  assert.equal(f.doc.activeElement, f.close);
  assert.equal(f.trigger.inert, true);
  f.key('Tab'); assert.equal(f.doc.activeElement, f.select);
  f.key('Tab'); assert.equal(f.doc.activeElement, f.download);
  assert.equal(f.key('Tab').prevented, true); assert.equal(f.doc.activeElement, f.close);
  f.key('Tab', true); assert.equal(f.doc.activeElement, f.download);
  dispose();
  assert.equal(f.trigger.inert, false);
  assert.equal(f.preexisting.inert, true);
  assert.equal(f.doc.activeElement, f.trigger);
  assert.equal(f.listeners.size, 0);
});

test('outside focus is redirected and Escape cannot also reach the application handler', () => {
  const f = fixture();
  let closed = 0;
  const dispose = containModalFocus(f.dialog, { initialFocus: f.close, onEscape: () => closed++ });
  f.trigger.focus();
  assert.equal(f.doc.activeElement, f.close);
  const event = f.key('Escape');
  assert.equal(closed, 1);
  assert.equal(event.prevented && event.stopped, true);
  f.close.disabled = f.select.disabled = f.download.disabled = true;
  f.key('Tab'); assert.equal(f.doc.activeElement, f.dialog);
  dispose();
});
