import assert from 'node:assert/strict';

import {
  applyDashboardFiltersToCollection,
  applyDashboardSelectionToCollection,
  buildDashboardDefaultFilters,
  createDashboardContext,
  createDashboardConditionSnapshot,
  evaluateDashboardCondition,
  evaluateDashboardConditionSnapshot,
  formatDashboardDelta,
  formatDashboardValue,
  getDashboardToneName,
  getDashboardVisibleWhen,
  publishDashboardSelection,
  seedDashboardDefaultFilters,
  shouldShowDashboardKPIContext,
  withDashboardContext,
} from './dashboardUtils.js';
import {
  getBusSignal,
  getDashboardFilterSignal,
  getDashboardSelectionSignal,
} from '../../core/store/signals.js';
import {
  aggregateGeoRows,
  buildGeoConfig,
  normalizeGeoKey,
  resolveGeoColor,
} from './geoMapUtils.js';

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

const initializedDashboardContext = createDashboardContext(baseContext, {
  kind: 'dashboard',
  id: 'orderDashboard',
  containers: [
    {
      kind: 'dashboard.filters',
      items: [
        {
          id: 'periodView',
          field: 'periodView',
          options: [
            { label: 'Today', value: 'today', default: true },
            { label: '7D', value: '7d' },
          ],
        },
      ],
    },
  ],
});
assert.equal(initializedDashboardContext.dashboardKey, 'W1:orderDashboard');
seedDashboardDefaultFilters('W1:orderDashboard', {
  kind: 'dashboard',
  id: 'orderDashboard',
  containers: [
    {
      kind: 'dashboard.filters',
      items: [
        {
          id: 'periodView',
          field: 'periodView',
          options: [
            { label: 'Today', value: 'today', default: true },
            { label: '7D', value: '7d' },
          ],
        },
      ],
    },
  ],
});
assert.deepEqual(getDashboardFilterSignal('W1:orderDashboard').peek(), { periodView: 'today' });

getDashboardFilterSignal('W1:preexistingDashboard').value = {};
const reseededDashboardContext = createDashboardContext(baseContext, {
  kind: 'dashboard',
  id: 'preexistingDashboard',
  containers: [
    {
      kind: 'dashboard.filters',
      items: [
        {
          id: 'periodView',
          field: 'periodView',
          options: [
            { label: 'Today', value: 'today', default: true },
            { label: '7D', value: '7d' },
          ],
        },
      ],
    },
  ],
});
assert.equal(reseededDashboardContext.dashboardKey, 'W1:preexistingDashboard');
seedDashboardDefaultFilters('W1:preexistingDashboard', {
  kind: 'dashboard',
  id: 'preexistingDashboard',
  containers: [
    {
      kind: 'dashboard.filters',
      items: [
        {
          id: 'periodView',
          field: 'periodView',
          options: [
            { label: 'Today', value: 'today', default: true },
            { label: '7D', value: '7d' },
          ],
        },
      ],
    },
  ],
});
assert.deepEqual(getDashboardFilterSignal('W1:preexistingDashboard').peek(), { periodView: 'today' });

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

assert.deepEqual(
  applyDashboardSelectionToCollection(
    [
      {stateCode: 'CA', dma: 'Los Angeles'},
      {stateCode: 'CA', dma: 'San Francisco'},
      {stateCode: 'TX', dma: 'Dallas-Fort Worth'},
    ],
    {entityKey: 'stateCode'},
    {dimension: 'stateCode', entityKey: 'CA'},
  ).map((row) => row.dma),
  ['Los Angeles', 'San Francisco'],
);

assert.deepEqual(
  applyDashboardSelectionToCollection(
    [
      {stateCode: 'CA', dma: 'Los Angeles'},
      {stateCode: 'TX', dma: 'Dallas-Fort Worth'},
    ],
    {entityKey: 'stateCode'},
    {},
  ).map((row) => row.stateCode),
  ['CA', 'TX'],
);

assert.equal(formatDashboardValue(1234.5, 'number', 'de-DE'), '1.234,5');
assert.equal(formatDashboardValue(1234, 'currency', 'de-DE').includes('1.234'), true);
assert.equal(formatDashboardValue(19.37, 'percent', 'en-US'), '19.4%');
assert.equal(formatDashboardValue(0.1937, 'percentFraction', 'en-US'), '19.4%');
assert.equal(formatDashboardValue('2026-05-01T04:00:00Z', 'date', 'en-US').includes('2026'), true);
assert.equal(formatDashboardValue('2026-05-01T04:00:00Z', 'dateTime', 'en-US').includes('2026'), true);
assert.equal(formatDashboardValue('2026-05-01T04:00:00Z', 'date', 'en-US', { timeZone: 'America/New_York' }), 'May 1, 2026');
assert.equal(formatDashboardValue('2026-05-13T00:00:00Z', 'wallClockHour', 'en-US'), '12 AM');
assert.equal(formatDashboardDelta(5000, 'currencyDelta', 'de-DE'), '+5.000 $');
assert.equal(formatDashboardDelta(-12.5, 'percentDelta', 'en-US'), '-12.5%');
assert.equal(formatDashboardDelta(-0.125, 'percentFractionDelta', 'en-US'), '-12.5%');
assert.equal(getDashboardToneName(50, { warningAbove: 40, dangerAbove: 25 }), 'danger');
assert.equal(shouldShowDashboardKPIContext([{label: 'Budget', context: ''}, {label: 'CTR'}]), false);
assert.equal(shouldShowDashboardKPIContext([{label: 'Status', context: 'Healthy'}]), true);
assert.equal(getDashboardToneName(30, { warningAbove: 40, dangerAbove: 25 }), 'warning');
assert.equal(getDashboardToneName(90, { warningBelow: 80, dangerBelow: 95 }), 'warning');
assert.equal(getDashboardToneName(70, { warningBelow: 80, dangerBelow: 95 }), 'danger');
assert.deepEqual(
  getDashboardVisibleWhen({
    visibleWhen: {selector: 'legacy'},
    dashboard: {visibleWhen: {source: 'selection', field: 'entityKey'}},
  }),
  {source: 'selection', field: 'entityKey'},
);
assert.deepEqual(getDashboardVisibleWhen({visibleWhen: {selector: 'legacy'}}), {selector: 'legacy'});

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

const geoConfig = buildGeoConfig({
  geo: {key: 'stateCode', metric: {key: 'spend', label: 'Spend', format: 'currency'}},
});
assert.equal(geoConfig.key, 'stateCode');
assert.equal(geoConfig.metricKey, 'spend');

const groupedGeoConfig = buildGeoConfig({
  dashboard: {
    geo: {
      key: 'stateCode',
      metric: {key: 'spend', label: 'Spend', format: 'currency'},
      color: {field: 'status', rules: [{value: 'healthy', color: '#1f8f63'}]},
    },
  },
});
assert.equal(groupedGeoConfig.key, 'stateCode');
assert.equal(groupedGeoConfig.metricKey, 'spend');
assert.equal(groupedGeoConfig.color.rules[0].value, 'healthy');

assert.equal(normalizeGeoKey(' ca '), 'CA');
assert.equal(
  aggregateGeoRows(
    [
      {stateCode: 'CA', spend: 10},
      {stateCode: 'CA', spend: 5},
      {stateCode: 'TX', spend: 7},
    ],
    geoConfig,
  ).get('CA').value,
  15,
);
assert.equal(
  resolveGeoColor({
    row: {status: 'critical'},
    value: 10,
    minValue: 0,
    maxValue: 20,
    colorConfig: {field: 'status', rules: [{value: 'critical', color: '#c23030'}]},
  }),
  '#c23030',
);
