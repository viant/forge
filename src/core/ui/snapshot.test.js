import assert from 'node:assert/strict';

import {
  activeWindows,
  getControlSignal,
  selectedTabId,
  selectedWindowId,
  getFormSignal,
  getMetadataSignal,
  getInputSignal,
  getViewSignal,
} from '../store/signals.js';

import { buildUISnapshot } from './snapshot.js';

function resetSignals() {
  activeWindows.value = [];
  selectedTabId.value = null;
  selectedWindowId.value = null;
}

resetSignals();

activeWindows.value = [
  {
    windowId: 'W1',
    windowKey: 'files',
    windowTitle: 'Files',
    presentation: 'hosted',
    region: 'chat.top',
    workspaceSharePct: 72,
    workspaceMinHeight: 500,
    parentKey: 'root',
    inTab: true,
  },
];
selectedTabId.value = 'W1';
selectedWindowId.value = 'W1';

getMetadataSignal('W1').value = {
  namespace: 'Demo',
  ns: ['demo'],
  actions: {
    code: '(() => ({ ping: () => true }))()',
    import: () => ({ demo: { ping: () => true } }),
  },
  dataSource: { fs: { selectionMode: 'single' } },
  view: {
    dataSourceRef: 'fs',
    content: {
      id: 'c1',
      type: 'container',
      tabs: { defaultSelectedTabId: 'deliveryTab' },
      containers: [
        { id: 'deliveryTab', title: 'Delivery' },
        { id: 'kpiTab', title: 'KPIs' },
      ],
    },
  },
  dialogs: [{ id: 'pick', title: 'Pick' }],
};

getInputSignal('W1DSfs').value = { filter: { uri: '/tmp' }, fetch: true, refresh: true };
getControlSignal('W1DSfs').value = { loading: true, error: null };
getFormSignal('W1:windowForm').value = { granularity: 'day' };
getViewSignal('W1').value = { tabs: { c1: 'kpiTab' } };

const snap = buildUISnapshot({ includeCollection: false, includeInlineMetadata: true });

assert.equal(snap.selected.windowId, 'W1');
assert.equal(snap.windows.length, 1);
assert.equal(snap.windows[0].metadata.loaded, true);
assert.deepEqual(snap.windows[0].dataSources.fs.filter, { uri: '/tmp' });
assert.equal(snap.windows[0].dataSources.fs.input.fetch, false);
assert.equal(snap.windows[0].dataSources.fs.input.refresh, false);
assert.equal(snap.windows[0].dataSources.fs.control.loading, false);
assert.equal(snap.windows[0].dialogs[0].id, 'pick');
assert.equal(snap.windows[0].windowForm.granularity, 'day');
assert.equal(snap.windows[0].viewState.tabs.c1, 'kpiTab');
assert.equal(snap.windows[0].presentation, 'hosted');
assert.equal(snap.windows[0].region, 'chat.top');
assert.equal(snap.windows[0].workspaceSharePct, 72);
assert.equal(snap.windows[0].workspaceMinHeight, 500);
assert.equal(snap.windows[0].parentKey, 'root');
assert.equal(snap.windows[0].inlineMetadata.namespace, 'Demo');
assert.equal(snap.windows[0].inlineMetadata.actions.code, '(() => ({ ping: () => true }))()');
assert.equal('import' in snap.windows[0].inlineMetadata.actions, false);
assert.deepEqual(snap.windows[0].metadata.view.tabs, [
  { containerId: 'c1', tabId: 'deliveryTab', title: 'Delivery' },
  { containerId: 'c1', tabId: 'kpiTab', title: 'KPIs' },
]);
assert.deepEqual(snap.windows[0].metadata.view.controls, []);

resetSignals();
