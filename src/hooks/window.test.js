import assert from 'node:assert/strict';

import {useDialogHandlers, useWindowHandlers} from './window.js';
import {setWindowContext, clearWindowContext} from '../core/context/registry.js';
import {activeWindows, getDashboardFilterSignal, getDashboardSelectionSignal, getDialogSignal} from '../core/store/signals.js';

const windowId = 'W_test_dashboard';
const dashboardId = 'demoDashboard';
const dashboardKey = `${windowId}:${dashboardId}`;

setWindowContext(windowId, {
  identity: {
    windowId,
    dataSourceRef: 'perf',
  },
  metadata: {
    view: {
      content: {
        id: dashboardId,
        title: 'Demo Dashboard',
        kind: 'dashboard',
        containers: [
          {
            kind: 'dashboard.filters',
            items: [
              {
                id: 'dateRange',
                field: 'dateRange',
                options: [
                  {label: '30D', value: '30d'},
                  {label: '90D', value: '90d', default: true},
                ],
              },
              {
                id: 'region',
                field: 'region',
                multiple: true,
                options: [
                  {label: 'NA', value: 'NA', default: true},
                  {label: 'EMEA', value: 'EMEA'},
                ],
              },
            ],
          },
          {id: 'summary', kind: 'dashboard.summary'},
          {id: 'trend', kind: 'dashboard.timeline'},
        ],
      },
    },
  },
  Context() {
    return this;
  },
});

const handlers = useWindowHandlers(windowId);

handlers.setDashboardFilter({parameters: {dashboardId, patch: {dateRange: '30d', region: ['EMEA']}}});
handlers.setDashboardSelection({parameters: {dashboardId, dimension: 'country', entityKey: 'GB'}});

const state = handlers.getDashboardState({parameters: {dashboardId}});
assert.equal(state.ok, true);
assert.equal(state.dashboardKey, dashboardKey);
assert.equal(state.filters.dateRange, '30d');
assert.deepEqual(state.filters.region, ['EMEA']);
assert.equal(state.selection.entityKey, 'GB');
assert.equal(state.blockIds.includes('summary'), true);

handlers.resetDashboardState({parameters: {dashboardId}});
assert.equal(getDashboardFilterSignal(dashboardKey).peek().dateRange, '90d');
assert.deepEqual(getDashboardFilterSignal(dashboardKey).peek().region, ['NA']);
assert.equal(getDashboardSelectionSignal(dashboardKey).peek().entityKey, null);

const dialogPromise = handlers.openDialog({
  execution: {
    args: ['adOrderPicker', { awaitResult: true, multiple: true }],
  },
  parameters: {
    'filters.adOrderId': '1232',
  },
  context: {
    identity: {
      dataSourceRef: 'perf',
    },
  },
});
assert.equal(typeof dialogPromise?.then, 'function');
const dialogSignal = getDialogSignal(`${windowId}DialogadOrderPicker`).peek();
const dialogHandlers = useDialogHandlers(windowId, 'adOrderPicker');
assert.equal(dialogSignal.open, true);
assert.deepEqual(dialogSignal.args, {
  'filters.adOrderId': '1232',
});
assert.deepEqual(dialogSignal.props.parameters, {
  'filters.adOrderId': '1232',
});
assert.deepEqual(dialogHandlers.callerProps().parameters, {
  'filters.adOrderId': '1232',
});
assert.equal(dialogHandlers.callerProps().multiple, true);
console.log('openDialog ✓ preserves explicit caller parameters in dialog props');

handlers.openWindow({
  execution: {
    args: ['metrics/report', 'Performance Metrics', '', true],
  },
  parameters: {
    prefill: {
      advertiserId: 123,
      dealId: 778899,
    },
  },
  context: {
    identity: {
      dataSourceRef: 'perf',
    },
  },
});
const openedWindow = activeWindows.peek().find((entry) => entry.windowKey === 'metrics/report');
assert.equal(openedWindow.windowTitle, 'Performance Metrics');
assert.deepEqual(openedWindow.parameters, {
  prefill: {
    advertiserId: 123,
    dealId: 778899,
  },
});
console.log('openWindow ✓ preserves explicit prefill parameters for windowForm seeding');

activeWindows.value = [{
  windowId,
  windowKey: 'order',
  windowTitle: 'Order Summary',
  parentKey: 'chat/new',
  presentation: 'hosted',
  region: 'chat.top',
  conversationId: 'conv-123',
  workspaceSharePct: 72,
  workspaceMinHeight: 500,
  inTab: true,
  parameters: {
    AdOrderId: [123],
  },
}];

handlers.openTarget({
  target: {
    kind: 'window',
    windowKey: 'campaign',
    windowTitle: 'Campaign',
    inTab: true,
    parameters: {
      CampaignId: [456],
    },
  },
  context: {
    identity: {
      dataSourceRef: 'perf',
    },
  },
});
const targetWindow = activeWindows.peek().find((entry) => entry.windowKey === 'campaign');
assert.equal(targetWindow.windowTitle, 'Campaign');
assert.deepEqual(targetWindow.parameters, {
  CampaignId: [456],
});
assert.equal(targetWindow.presentation, 'hosted');
assert.equal(targetWindow.region, 'chat.top');
assert.equal(targetWindow.conversationId, 'conv-123');
assert.equal(targetWindow.parentKey, 'chat/new');
console.log('openTarget ✓ opens a window from a resolved target contract');

activeWindows.value = [{
  windowId: 'line_7289845__conv-123',
  windowKey: 'line',
  windowTitle: 'OLV_BAU_AUS_Lotame F1 Fans_OM',
  parentKey: 'chat/new',
  presentation: 'hosted',
  region: 'chat.top',
  conversationId: 'conv-123',
  workspaceSharePct: 72,
  workspaceMinHeight: 500,
  inTab: true,
  parameters: {
    AudienceId: [7289845],
    AdOrderId: [2660900],
    CampaignId: [551549],
  },
}];

const hostedHandlers = useWindowHandlers('line_7289845__conv-123');

hostedHandlers.openTarget({
  target: {
    kind: 'window',
    windowKey: 'order',
    windowTitle: '2660900',
    inTab: true,
    parameters: {
      AdOrderId: [2660900],
      CampaignId: [551549],
    },
  },
  context: {
    identity: {
      dataSourceRef: 'line_header_lookup',
    },
  },
});
assert.equal(activeWindows.peek().length, 1);
assert.equal(activeWindows.peek()[0].windowKey, 'order');
assert.deepEqual(activeWindows.peek()[0].parameters, {
  AdOrderId: [2660900],
  CampaignId: [551549],
});
assert.equal(activeWindows.peek()[0].conversationId, 'conv-123');
assert.equal(activeWindows.peek()[0].parentKey, 'chat/new');
assert.equal(activeWindows.peek()[0].workspaceSharePct, 72);
assert.equal(activeWindows.peek()[0].workspaceMinHeight, undefined);
console.log('openTarget ✓ replaces the current hosted workspace region for drillback navigation');

clearWindowContext(windowId);
