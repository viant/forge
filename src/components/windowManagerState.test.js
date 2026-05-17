import assert from 'node:assert/strict';

import { isHostedRegionWindow, resolveTabWindows, resolveVisibleTabId } from './windowManagerState.js';

assert.equal(isHostedRegionWindow({ presentation: 'hosted', region: 'chat.top' }), true);
assert.equal(isHostedRegionWindow({ presentation: 'hosted', region: 'chat.bottom' }), true);
assert.equal(isHostedRegionWindow({ presentation: 'hosted', region: 'other' }), false);
assert.equal(isHostedRegionWindow({ presentation: 'inline', region: 'chat.top' }), false);

const windows = [
  { windowId: 'chat/new', inTab: true, windowKey: 'chat/new' },
  { windowId: 'order_1', inTab: true, presentation: 'hosted', region: 'chat.top', windowKey: 'order' },
  { windowId: 'schedule', inTab: true, windowKey: 'schedule' },
  { windowId: 'runs_bottom', inTab: true, presentation: 'hosted', region: 'chat.bottom', windowKey: 'schedule/history' },
];

const tabs = resolveTabWindows(windows);
assert.deepEqual(tabs.map((entry) => entry.windowId), ['chat/new', 'schedule']);
assert.equal(resolveVisibleTabId(tabs, 'schedule'), 'schedule');
assert.equal(resolveVisibleTabId(tabs, 'order_1'), 'chat/new');
assert.equal(resolveVisibleTabId([], 'order_1'), null);

console.log('windowManagerState ✓ hosted region windows stay out of root tabs');
