import assert from 'node:assert/strict';

import {
  activeWindows,
  getCollectionSignal,
  getCollectionInfoSignal,
  getControlSignal,
  getDialogSignal,
  getFormSignal,
  getInputSignal,
  getMetricsSignal,
  getSelectionSignal,
  getFormStatusSignal,
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
      },
      campaigns: {
        dataSourceRef: 'advertiser_campaigns',
        input: { fetch: false, parameters: { AdvertiserId: [85141] } },
        control: { loading: false, loaded: true, error: null },
        collection: [],
        metrics: {},
      }
    }
  }]
});

assert.equal(activeWindows.value.length, 1);
assert.equal(activeWindows.value[0].windowId, 'orderPerformance_1');
assert.equal(activeWindows.value[0].windowKey, 'orderPerformance');
assert.equal(
  activeWindows.value[0].hostOpenState,
  'historical_replay',
  'a window restored from a durable UI snapshot must retain explicit historical replay provenance',
);
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
assert.deepEqual(getInputSignal('orderPerformance_1DSprofile').peek(), { fetch: true, refresh: false, parameters: { AdOrderId: [2667545] } });
assert.equal(
  getInputSignal('orderPerformance_1DSprofile').peek().__forgeRestoredPendingFetch,
  true,
  'restore-promoted reads must carry runtime provenance for already-mounted responsive consumers',
);
assert.equal(
  Object.keys(getInputSignal('orderPerformance_1DSprofile').peek()).includes('__forgeRestoredPendingFetch'),
  false,
  'restore provenance must not leak into request input or subsequent snapshots',
);
assert.equal(
  ({...getInputSignal('orderPerformance_1DSprofile').peek(), parameters: {Id: 2667545}}).__forgeRestoredPendingFetch,
  undefined,
  'a fresh metadata parameter binding must consume restore provenance before fetching',
);
assert.deepEqual(getControlSignal('orderPerformance_1DSprofile').peek(), { loading: false, error: null, stale: false });
assert.deepEqual(getCollectionSignal('orderPerformance_1DSprofile').peek(), [{ date: '2026-05-15', spend: 120 }]);
assert.deepEqual(getMetricsSignal('orderPerformance_1DSprofile').peek(), { spend: 120 });
assert.deepEqual(getInputSignal('orderPerformance_1DSadvertiser_campaigns').peek(), {
  fetch: true,
  refresh: false,
  parameters: { AdvertiserId: [85141] },
});
assert.deepEqual(getControlSignal('orderPerformance_1DSadvertiser_campaigns').peek(), {
  loading: false,
  loaded: false,
  error: null,
  stale: false,
});

restoreWindowsFromSnapshot({
  selected: { windowId: 'line_1', tabId: 'line_1' },
  windows: [{
    windowId: 'line_1',
    windowKey: 'line',
    windowTitle: 'Line',
    inTab: true,
    parameters: { AudienceId: [7289845] },
    dataSources: {
      period30d: {
        dataSourceRef: 'line_performance_period_30d',
        input: { fetch: false, parameters: { AudienceId: [7289845], granularity: 'day' } },
        control: { loading: true, error: null, stale: true },
        collection: [],
        metrics: {},
      },
      profile: {
        dataSourceRef: 'line_performance_profile',
        input: { fetch: false, parameters: { AudienceId: [7289845] } },
        control: { loading: false, error: { message: 'authorization required' }, stale: true },
        collection: [],
        metrics: {},
      },
    },
  }]
});

assert.deepEqual(getInputSignal('line_1DSline_performance_period_30d').peek(), {
  fetch: true,
  refresh: false,
  parameters: { AudienceId: [7289845], granularity: 'day' },
});
assert.deepEqual(getControlSignal('line_1DSline_performance_period_30d').peek(), {
  loading: false,
  error: null,
  stale: false,
});
assert.deepEqual(getInputSignal('line_1DSline_performance_profile').peek(), {
  fetch: true,
  refresh: false,
  parameters: { AudienceId: [7289845] },
});
assert.deepEqual(getControlSignal('line_1DSline_performance_profile').peek(), {
  loading: false,
  error: null,
  stale: false,
});

restoreWindowsFromSnapshot({
  selected: { windowId: 'line_marker', tabId: 'line_marker' },
  windows: [{
    windowId: 'line_marker',
    windowKey: 'line',
    windowTitle: 'Line',
    inTab: true,
    parameters: { AudienceId: [7289845], targeting: { nested: '[MaxDepth]' } },
    windowForm: { draft: { targeting: '[Circular]' } },
    viewState: { filters: ['active', '[MaxDepth]'] },
    dataSources: {
      targeting: {
        dataSourceRef: 'line_targeting',
        input: { fetch: false, parameters: { AudienceId: [7289845], targeting: { children: ['[MaxDepth]'] } } },
        control: { loading: true, loaded: true, error: { message: 'stale snapshot' }, stale: true },
        form: { targeting: { children: ['[Circular]'] } },
        selection: { selection: [{ id: '[MaxDepth]' }] },
        collection: [{ id: 1, children: ['[Circular]'] }],
        collectionInfo: { total: 1, cursor: '[MaxDepth]' },
        metrics: { selected: '[Circular]' },
        formStatus: { dirty: true, version: '[MaxDepth]' },
      },
      profile: {
        dataSourceRef: 'line_profile',
        input: { fetch: false, parameters: { AudienceId: [7289845] } },
        control: { loading: false, loaded: true, error: null, stale: false },
        form: { name: 'Safe form' },
        selection: { selected: { id: 7289845 }, rowIndex: 0 },
        collection: [{ id: 7289845, name: 'Safe row' }],
        collectionInfo: { total: 1 },
        metrics: { count: 1 },
      },
    },
  }],
});

assert.deepEqual(activeWindows.value[0].parameters, {}, 'marker-containing window parameters must not be restored');
assert.deepEqual(getFormSignal('line_marker:windowForm').peek(), {}, 'marker-containing window form must not be restored');
assert.deepEqual(getViewSignal('line_marker').peek(), {}, 'marker-containing view state must not be restored');
assert.deepEqual(getInputSignal('line_markerDSline_targeting').peek(), { fetch: true, refresh: false });
assert.deepEqual(getControlSignal('line_markerDSline_targeting').peek(), {
  loading: false,
  loaded: false,
  error: null,
  stale: false,
});
assert.deepEqual(getFormSignal('line_markerDSline_targeting').peek(), {});
assert.equal(getSelectionSignal('line_markerDSline_targeting', null).peek(), null);
assert.deepEqual(getCollectionSignal('line_markerDSline_targeting').peek(), []);
assert.deepEqual(getCollectionInfoSignal('line_markerDSline_targeting').peek(), {});
assert.deepEqual(getMetricsSignal('line_markerDSline_targeting').peek(), {});
assert.deepEqual(getFormStatusSignal('line_markerDSline_targeting').peek(), { dirty: false, version: 0 });
assert.deepEqual(getInputSignal('line_markerDSline_profile').peek(), {
  fetch: true,
  refresh: false,
  parameters: { AudienceId: [7289845] },
});
assert.deepEqual(getCollectionSignal('line_markerDSline_profile').peek(), [{ id: 7289845, name: 'Safe row' }]);

restoreWindowsFromSnapshot({
  selected: { windowId: 'control_marker', tabId: 'control_marker' },
  windows: [{
    windowId: 'control_marker',
    windowKey: 'line',
    dataSources: {
      profile: {
        dataSourceRef: 'line_profile',
        input: { fetch: false, parameters: { AudienceId: [7289845] } },
        control: { loading: false, loaded: false, error: { detail: '[MaxDepth]' }, stale: true },
        form: { name: 'must clear' },
        selection: { selected: { id: 1 } },
        collection: [{ id: 1 }],
        collectionInfo: { total: 1 },
        metrics: { count: 1 },
      },
    },
  }],
});

assert.deepEqual(getInputSignal('control_markerDSline_profile').peek(), {
  fetch: true,
  refresh: false,
  parameters: { AudienceId: [7289845] },
});
assert.deepEqual(getControlSignal('control_markerDSline_profile').peek(), {
  loading: false,
  loaded: false,
  error: null,
  stale: false,
});
assert.deepEqual(getFormSignal('control_markerDSline_profile').peek(), {});
assert.deepEqual(getCollectionSignal('control_markerDSline_profile').peek(), []);

restoreWindowsFromSnapshot({
  selected: { windowId: 'window_marker', tabId: 'window_marker' },
  windows: [{
    windowId: 'window_marker',
    windowKey: 'line',
    windowForm: { name: 'Safe prior form' },
    viewState: { activeTabId: 'targeting' },
    dialogs: [{ id: 'editor', open: true, args: { id: 1 } }],
  }],
});
assert.deepEqual(getFormSignal('window_marker:windowForm').peek(), { name: 'Safe prior form' });
assert.deepEqual(getViewSignal('window_marker').peek(), { activeTabId: 'targeting' });
assert.deepEqual(getDialogSignal('window_markerDialogeditor').peek(), {
  open: true,
  selectionMode: undefined,
  args: { id: 1 },
});

restoreWindowsFromSnapshot({
  selected: { windowId: 'window_marker', tabId: 'window_marker' },
  windows: [{
    windowId: 'window_marker',
    windowKey: 'line',
    windowForm: { targeting: '[MaxDepth]' },
    viewState: { activeTabId: '[Circular]' },
    dialogs: [{ id: 'editor', open: true, args: { id: '[MaxDepth]' } }],
  }],
});
assert.deepEqual(getFormSignal('window_marker:windowForm').peek(), {});
assert.deepEqual(getViewSignal('window_marker').peek(), {});
assert.deepEqual(getDialogSignal('window_markerDialogeditor').peek(), []);

console.log('restoreSnapshot ✓ rehydrates windows and datasource state from UI snapshot');
