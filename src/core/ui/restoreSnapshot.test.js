import assert from 'node:assert/strict';

import { activeWindows, selectedTabId, selectedWindowId, restoreWindowsFromSnapshot } from '../store/signals.js';

activeWindows.value = [{
  windowId: 'stale',
  windowKey: 'old',
  windowTitle: 'Old',
  inTab: true,
  parameters: {}
}];
selectedTabId.value = 'stale';
selectedWindowId.value = 'stale';

restoreWindowsFromSnapshot({
  selected: { windowId: 'orderPerformance_1', tabId: 'orderPerformance_1' },
  windows: [{
    windowId: 'orderPerformance_1',
    windowKey: 'orderPerformance',
    windowTitle: 'Order Summary',
    inTab: true,
    parameters: { order_performance_profile: { parameters: { AdOrderId: [2667545] } } },
    isModal: false,
    isMinimized: false,
    zIndex: 12,
    position: { x: 10, y: 20 },
    size: { width: 800, height: 500 }
  }]
});

assert.equal(activeWindows.value.length, 1);
assert.equal(activeWindows.value[0].windowId, 'orderPerformance_1');
assert.equal(activeWindows.value[0].windowKey, 'orderPerformance');
assert.deepEqual(activeWindows.value[0].parameters, { order_performance_profile: { parameters: { AdOrderId: [2667545] } } });
assert.equal(selectedTabId.value, 'orderPerformance_1');
assert.equal(selectedWindowId.value, 'orderPerformance_1');

console.log('restoreSnapshot ✓ rehydrates active windows and selected ids from UI snapshot');
