import assert from 'node:assert/strict';

import {
  activeWindows,
  selectedTabId,
  selectedWindowId,
  getMetadataSignal,
  getInputSignal,
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
    parentKey: 'root',
    inTab: true,
  },
];
selectedTabId.value = 'W1';
selectedWindowId.value = 'W1';

getMetadataSignal('W1').value = {
  ns: ['demo'],
  dataSource: { fs: { selectionMode: 'single' } },
  view: { dataSourceRef: 'fs', content: { id: 'c1', type: 'container' } },
  dialogs: [{ id: 'pick', title: 'Pick' }],
};

getInputSignal('W1DSfs').value = { filter: { uri: '/tmp' } };

const snap = buildUISnapshot({ includeCollection: false });

assert.equal(snap.selected.windowId, 'W1');
assert.equal(snap.windows.length, 1);
assert.equal(snap.windows[0].metadata.loaded, true);
assert.deepEqual(snap.windows[0].dataSources.fs.filter, { uri: '/tmp' });
assert.equal(snap.windows[0].dialogs[0].id, 'pick');

resetSignals();

