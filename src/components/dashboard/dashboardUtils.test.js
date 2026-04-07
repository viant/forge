import assert from 'node:assert/strict';

import {
  applyDashboardFiltersToCollection,
  buildDashboardDefaultFilters,
  createDashboardConditionSnapshot,
  evaluateDashboardCondition,
  evaluateDashboardConditionSnapshot,
  publishDashboardSelection,
  withDashboardContext,
} from './dashboardUtils.js';
import {
  getBusSignal,
  getDashboardFilterSignal,
  getDashboardSelectionSignal,
} from '../../core/store/signals.js';

const baseContext = {
  identity: { windowId: 'W1', dataSourceRef: 'perf' },
  signals: {
    metrics: {
      value: {
        summary: { total_spend: 123000 },
        quality: { zero_spend_rate: 47.2 },
      },
    },
  },
  Context(dataSourceRef) {
    return { ...this, identity: { ...this.identity, dataSourceRef } };
  },
};

const dashboardContext = withDashboardContext(baseContext, 'W1:perfDashboard');
getDashboardFilterSignal('W1:perfDashboard').value = { dateRange: '90d' };
getDashboardSelectionSignal('W1:perfDashboard').value = { dimension: 'country', entityKey: 'US' };

assert.equal(
  evaluateDashboardCondition(
    { selector: 'quality.zero_spend_rate', gt: 40 },
    { context: dashboardContext, dashboardKey: dashboardContext.dashboardKey },
  ),
  true,
);

assert.equal(
  evaluateDashboardCondition(
    { source: 'selection', field: 'entityKey', equals: 'US' },
    { context: dashboardContext, dashboardKey: dashboardContext.dashboardKey },
  ),
  true,
);

assert.equal(
  evaluateDashboardCondition(
    { source: 'filters', field: 'dateRange', equals: '30d' },
    { context: dashboardContext, dashboardKey: dashboardContext.dashboardKey },
  ),
  false,
);

const snapshot = createDashboardConditionSnapshot({
  context: dashboardContext,
  dashboardKey: dashboardContext.dashboardKey,
  metrics: { quality: { zero_spend_rate: 47.2 } },
  dashboardFilters: { dateRange: '90d' },
  dashboardSelection: { entityKey: 'US' },
});

assert.equal(
  evaluateDashboardConditionSnapshot(
    { selector: 'quality.zero_spend_rate', gt: 40 },
    snapshot,
  ),
  true,
);

assert.equal(
  evaluateDashboardConditionSnapshot(
    { source: 'filters', field: 'dateRange', equals: '90d' },
    snapshot,
  ),
  true,
);

assert.equal(dashboardContext.Context('detail').dashboardKey, 'W1:perfDashboard');

assert.deepEqual(
  buildDashboardDefaultFilters({
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
    ],
  }),
  {dateRange: '90d', region: ['NA']},
);

assert.deepEqual(
  buildDashboardDefaultFilters({
    kind: 'dashboard',
    containers: [
      {
        kind: 'dashboard.detail',
        containers: [
          {
            kind: 'dashboard.filters',
            items: [
              {
                id: 'domain',
                field: 'domain',
                multiple: true,
                options: [
                  {label: 'Customer', value: 'customer', default: true},
                  {label: 'Billing', value: 'billing'},
                ],
              },
            ],
          },
        ],
      },
    ],
  }),
  {domain: ['customer']},
);

assert.deepEqual(
  applyDashboardFiltersToCollection(
    [
      {country: 'US', region: 'NA'},
      {country: 'CA', region: 'NA'},
      {country: 'GB', region: 'EMEA'},
    ],
    {region: 'region'},
    {region: ['NA']},
  ).map((row) => row.country),
  ['US', 'CA'],
);

assert.deepEqual(
  applyDashboardFiltersToCollection(
    [
      {country: 'US', region: 'na'},
      {country: 'GB', region: 'EMEA'},
    ],
    {region: 'region'},
    {region: 'NA'},
  ).map((row) => row.country),
  ['US'],
);

publishDashboardSelection({
  context: dashboardContext,
  dimension: 'country',
  entityKey: 'CA',
  selected: {country: 'CA'},
  sourceBlockId: 'byCountry',
});

assert.equal(getDashboardSelectionSignal('W1:perfDashboard').value.entityKey, 'CA');
const busMessages = getBusSignal('W1').value;
assert.equal(busMessages[busMessages.length - 1].type, 'dashboard.selection.changed');
assert.equal(busMessages[busMessages.length - 1].sourceBlockId, 'byCountry');
