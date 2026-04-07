import assert from 'node:assert/strict';

import {useWindowHandlers} from './window.js';
import {setWindowContext, clearWindowContext} from '../core/context/registry.js';
import {getDashboardFilterSignal, getDashboardSelectionSignal} from '../core/store/signals.js';

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

clearWindowContext(windowId);
