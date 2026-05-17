import assert from 'node:assert/strict';

import {
  activeWindows,
  getCollectionSignal,
  getControlSignal,
  getDialogSignal,
  getFormSignal,
  getInputSignal,
  getMetricsSignal,
  getViewSignal,
  selectedTabId,
  selectedWindowId,
  restoreWindowsFromSnapshot,
} from '../store/signals.js';

activeWindows.value = [{
  windowId: 'stale',
  windowKey: 'old',
  windowTitle: 'Old',
  inTab: true,
  parameters: {}
}];
selectedTabId.value = 'stale';
selectedWindowId.value = 'stale';
getDialogSignal('orderPerformance_1DialogworkItemPicker').value = {
  open: true,
  selectionMode: 'multi',
  args: { page: 1 },
  props: { multiple: true, awaitResult: true },
};

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
    size: { width: 800, height: 500 },
    inlineMetadata: {
      namespace: 'order',
      actions: { code: '(() => ({}))()' },
      view: { content: { id: 'orderChart' } },
    },
    dialogs: [{
      id: 'workItemPicker',
      open: true,
      selectionMode: 'multi',
      args: { page: 2 },
    }],
    windowForm: { period: '7d' },
    viewState: { activeTabId: 'kpi' },
    dataSources: {
      profile: {
        dataSourceRef: 'profile',
        input: { fetch: false, parameters: { AdOrderId: [2667545] } },
        control: { loading: false, error: null },
        form: {},
        collection: [{ date: '2026-05-15', spend: 120 }],
        collectionInfo: { total: 1 },
        metrics: { spend: 120 },
      }
    }
  }]
});

assert.equal(activeWindows.value.length, 1);
assert.equal(activeWindows.value[0].windowId, 'orderPerformance_1');
assert.equal(activeWindows.value[0].windowKey, 'orderPerformance');
assert.deepEqual(activeWindows.value[0].parameters, { order_performance_profile: { parameters: { AdOrderId: [2667545] } } });
assert.equal(selectedTabId.value, 'orderPerformance_1');
assert.equal(selectedWindowId.value, 'orderPerformance_1');
assert.equal(activeWindows.value[0].inlineMetadata?.view?.content?.id, 'orderChart');
assert.deepEqual(getFormSignal('orderPerformance_1:windowForm').peek(), { period: '7d' });
assert.deepEqual(getViewSignal('orderPerformance_1').peek(), { activeTabId: 'kpi' });
assert.deepEqual(getDialogSignal('orderPerformance_1DialogworkItemPicker').peek(), {
  open: true,
  selectionMode: 'multi',
  args: { page: 2 },
  props: { multiple: true, awaitResult: true },
});
assert.deepEqual(getInputSignal('orderPerformance_1DSprofile').peek(), { fetch: false, parameters: { AdOrderId: [2667545] } });
assert.deepEqual(getControlSignal('orderPerformance_1DSprofile').peek(), { loading: false, error: null });
assert.deepEqual(getCollectionSignal('orderPerformance_1DSprofile').peek(), [{ date: '2026-05-15', spend: 120 }]);
assert.deepEqual(getMetricsSignal('orderPerformance_1DSprofile').peek(), { spend: 120 });

console.log('restoreSnapshot ✓ rehydrates windows and datasource state from UI snapshot');
