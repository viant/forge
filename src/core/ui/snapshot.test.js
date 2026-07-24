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
    workspaceCollapsed: true,
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
      dashboard: {
        reportBuilderRef: 'performance',
        reportBuilders: {
          performance: {
            label: 'Performance Reports',
            reportBuilder: {
              dataSources: [
                {
                  id: 'delivery_last_7_days',
                  dataSourceRef: 'metrics_ad_cube_report',
                  label: 'Delivery · Last 7 Days',
                  description: 'Trailing seven-day delivery.',
                  kindLabel: 'relative window',
                  capabilities: { preview: true, export: true },
                  scope: {
                    mode: 'override',
                    relativeDateRange: {
                      preset: 'last7Days',
                      startParamPath: 'filters.From',
                      endParamPath: 'filters.To',
                    },
                  },
                  columnOptions: [
                    { key: 'eventDate', label: 'Date', kind: 'dimension' },
                    { key: 'totalSpend', label: 'Spend', kind: 'measure', format: 'currency' },
                  ],
                  valueFieldOptions: [
                    { value: 'totalSpend', label: 'Spend', format: 'currency' },
                  ],
                  scopeParamOptions: [
                    {
                      value: 'orderIds',
                      label: 'Ad Order',
                      kind: 'multiSelect',
                      multiple: true,
                      paramPath: 'filters.orderIds',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
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
getFormSignal('W1:windowForm').value = { granularity: 'day', reportBuilderRef: 'performance' };
getViewSignal('W1').value = { tabs: { c1: 'kpiTab' } };

const snap = buildUISnapshot({ includeCollection: false, includeInlineMetadata: true });

assert.equal(snap.conversationId, null);
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
assert.equal(snap.windows[0].workspaceCollapsed, true);
assert.equal(snap.windows[0].parentKey, 'root');
assert.equal(snap.windows[0].inlineMetadata.namespace, 'Demo');
assert.equal(snap.windows[0].inlineMetadata.actions.code, '(() => ({ ping: () => true }))()');
assert.equal('import' in snap.windows[0].inlineMetadata.actions, false);
assert.deepEqual(snap.windows[0].metadata.view.tabs, [
  { containerId: 'c1', tabId: 'deliveryTab', title: 'Delivery' },
  { containerId: 'c1', tabId: 'kpiTab', title: 'KPIs' },
]);
assert.deepEqual(snap.windows[0].metadata.view.controls, []);
assert.equal(snap.windows[0].metadata.reportBuilder.builderRef, 'performance');
assert.equal(
  snap.windows[0].metadata.reportBuilder.authoringContract,
  'Use dataSources[].id as report block datasetRef. dataSources[].dataSourceRef is the underlying execution source. Dataset scope mode inherit follows the active report filters; relativeDateRange overrides them with its declared window.',
);
assert.deepEqual(snap.windows[0].metadata.reportBuilder.dataSources, [
  {
    id: 'delivery_last_7_days',
    dataSourceRef: 'metrics_ad_cube_report',
    label: 'Delivery · Last 7 Days',
    description: 'Trailing seven-day delivery.',
    kindLabel: 'relative window',
    capabilities: { preview: true, export: true },
    scope: {
      mode: 'override',
      relativeDateRange: {
        preset: 'last7Days',
        startParamPath: 'filters.From',
        endParamPath: 'filters.To',
      },
    },
    fields: [
      {
        key: 'eventDate',
        label: 'Date',
        kind: 'dimension',
        format: null,
        required: undefined,
        multiple: undefined,
        paramPath: null,
        startParamPath: null,
        endParamPath: null,
      },
      {
        key: 'totalSpend',
        label: 'Spend',
        kind: 'measure',
        format: 'currency',
        required: undefined,
        multiple: undefined,
        paramPath: null,
        startParamPath: null,
        endParamPath: null,
      },
    ],
    scopeParams: [
      {
        key: 'orderIds',
        label: 'Ad Order',
        kind: 'multiSelect',
        format: null,
        required: undefined,
        multiple: true,
        paramPath: 'filters.orderIds',
        startParamPath: null,
        endParamPath: null,
      },
    ],
  },
]);

resetSignals();
