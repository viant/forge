import assert from 'node:assert/strict';

import {
  applyDashboardFiltersToCollection,
  buildDashboardDefaultFilters,
  createDashboardConditionSnapshot,
  evaluateDashboardCondition,
  evaluateDashboardConditionSnapshot,
  formatDashboardDelta,
  formatDashboardValue,
  getDashboardToneName,
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

assert.equal(formatDashboardValue(1234.5, 'number', 'de-DE'), '1.234,5');
assert.equal(formatDashboardValue(1234, 'currency', 'de-DE').includes('1.234'), true);
assert.equal(formatDashboardDelta(5000, 'currencyDelta', 'de-DE'), '+5.000 $');
assert.equal(formatDashboardDelta(-12.5, 'percentDelta', 'en-US'), '-12.5%');
assert.equal(getDashboardToneName(50, { warningAbove: 40, dangerAbove: 25 }), 'danger');
assert.equal(getDashboardToneName(30, { warningAbove: 40, dangerAbove: 25 }), 'warning');
assert.equal(getDashboardToneName(90, { warningBelow: 80, dangerBelow: 95 }), 'warning');
assert.equal(getDashboardToneName(70, { warningBelow: 80, dangerBelow: 95 }), 'danger');

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
