import assert from 'node:assert/strict';

import { activeWindows, selectedTabId, selectedWindowId } from '../store/signals.js';
import { runUICommand } from './commands.js';
import { registerControlTarget, unregisterControlTarget } from './registry.js';

activeWindows.value = [];
selectedTabId.value = null;
selectedWindowId.value = null;

const res = await runUICommand({
  method: 'ui.window.open',
  params: { windowKey: 'demo', windowTitle: 'Demo', inTab: true },
});

assert.ok(res.windowId);
assert.equal(activeWindows.peek().length, 1);
assert.equal(selectedTabId.peek(), res.windowId);
assert.equal(selectedWindowId.peek(), res.windowId);

await runUICommand({ method: 'ui.window.activate', params: { windowId: res.windowId } });
assert.equal(selectedWindowId.peek(), res.windowId);

await runUICommand({ method: 'ui.window.close', params: { windowId: res.windowId } });
assert.equal(activeWindows.peek().length, 0);

const regKey = registerControlTarget(
  { windowId: 'W1', dataSourceRef: 'ds', controlId: 'name', label: 'Name', type: 'text', scope: 'form' },
  { element: { isConnected: true, focus: () => {} } }
);
assert.ok(regKey);

const list = await runUICommand({ method: 'ui.controls.list', params: { windowId: 'W1' } });
assert.equal(Array.isArray(list.controls), true);
assert.equal(list.controls.length, 1);

const search = await runUICommand({ method: 'ui.controls.search', params: { query: 'nam', windowId: 'W1' } });
assert.equal(search.controls.length, 1);

const focusInfo = await runUICommand({ method: 'ui.focus.get', params: {} });
assert.ok('focused' in focusInfo);

unregisterControlTarget(regKey);
