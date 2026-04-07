import assert from 'node:assert/strict';

import { buildDashboardExportModel, buildStandaloneDashboardHtml, captureChartSvg, captureDashboardChartSvgs, buildStandaloneDashboardDocument } from './dashboardExport.js';

const html = buildStandaloneDashboardHtml({
  title: 'Performance Overview',
  subtitle: 'Standalone export',
  generatedAt: '2026-04-07T10:00:00Z',
  dashboardFilters: {
    dateRange: '90d',
    region: ['NA', 'EMEA'],
  },
  dashboardSelection: {
    dimension: 'country',
    entityKey: 'US',
  },
  blocks: [
    {
      kind: 'dashboard.summary',
      title: 'KPIs',
      columnSpan: 12,
      metrics: [
        { label: 'Spend', value: '$123,000' },
        { label: 'CTR', value: '2.3%' },
      ],
    },
    {
      kind: 'dashboard.compare',
      title: 'Compare',
      columnSpan: 6,
      items: [
        { label: 'Spend', currentValue: '$123,000', previousValue: '$118,000', deltaLabel: 'vs prior', deltaValue: '+$5,000', severity: 'success' },
      ],
    },
    {
      kind: 'dashboard.kpiTable',
      title: 'Metric Table',
      columnSpan: 6,
      rows: [
        { label: 'Impressions', value: '5.4M', context: 'Reach', contextTone: 'success' },
      ],
    },
    {
      kind: 'dashboard.filters',
      title: 'Filters',
      columnSpan: 12,
      items: [
        { label: 'Date Range', activeOptions: ['90D'] },
      ],
    },
    {
      kind: 'dashboard.timeline',
      title: 'Trend',
      columnSpan: 8,
      svg: '<svg viewBox="0 0 10 10"><path d="M0 10 L10 0"></path></svg>',
    },
    {
      kind: 'dashboard.dimensions',
      title: 'By Country',
      columnSpan: 4,
      rows: [
        { label: 'US', value: '$100,000', rawValue: 100000 },
        { label: 'CA', value: '$23,000', rawValue: 23000 },
      ],
    },
    {
      kind: 'dashboard.messages',
      title: 'Messages',
      columnSpan: 6,
      items: [
        { severity: 'warning', title: 'High zero-spend rate', body: 'Nearly half of rows have zero spend.' },
      ],
    },
    {
      kind: 'dashboard.report',
      title: 'Report',
      columnSpan: 6,
      sections: [
        { title: 'Summary', tone: 'info', body: ['US dominates spend.', 'Zero-spend rate is elevated.'] },
      ],
    },
  ],
});

assert.match(html, /<!doctype html>/i);
assert.match(html, /Performance Overview/);
assert.match(html, /<style>[\s\S]*dashboard-export__grid/);
assert.match(html, /<svg viewBox="0 0 10 10">/);
assert.match(html, /vs prior/);
assert.match(html, /Metric Table/);
assert.match(html, /Date Range/);
assert.match(html, /Filter/);
assert.match(html, /dateRange=90d/);
assert.match(html, /Selection/);
assert.match(html, /country=US/);
assert.match(html, /High zero-spend rate/);
assert.match(html, /US dominates spend/);
assert.match(html, /grid-column: span 8/);

const fakeRoot = {
  querySelector(selector) {
    if (selector !== 'svg') return null;
    return { outerHTML: '<svg><circle cx="5" cy="5" r="5"></circle></svg>' };
  },
};

assert.equal(captureChartSvg(fakeRoot), '<svg><circle cx="5" cy="5" r="5"></circle></svg>');
assert.equal(captureChartSvg(null), '');

const fakeDashboardRoot = {
  querySelectorAll(selector) {
    assert.equal(selector, '[data-dashboard-chart-id]');
    return [
      {
        getAttribute(name) {
          return name === 'data-dashboard-chart-id' ? 'trend' : null;
        },
        querySelector(inner) {
          return inner === 'svg' ? { outerHTML: '<svg id="trend"></svg>' } : null;
        },
      },
      {
        getAttribute(name) {
          return name === 'data-dashboard-chart-id' ? 'detailTrend' : null;
        },
        querySelector(inner) {
          return inner === 'svg' ? { outerHTML: '<svg id="detail"></svg>' } : null;
        },
      },
    ];
  },
};

assert.deepEqual(captureDashboardChartSvgs(fakeDashboardRoot), {
  trend: '<svg id="trend"></svg>',
  detailTrend: '<svg id="detail"></svg>',
});

const context = {
  dashboardKey: 'W1:perf',
  signals: {
    metrics: {
      peek: () => ({
        summary: { total_spend: 123000, previous_total_spend: 118000, total_impressions: 5400000, overall_ctr_pct: 2.3 },
        quality: { zero_spend_rate: 47.2 },
      }),
    },
    collection: {
      peek: () => ([
        { country: 'US', region: 'NA', spend: 100000 },
        { country: 'CA', region: 'NA', spend: 23000 },
        { country: 'GB', region: 'EMEA', spend: 6000 },
      ]),
    },
  },
  Context() {
    return this;
  },
};

const model = buildDashboardExportModel({
  container: {
    kind: 'dashboard',
    title: 'Live Dashboard',
    containers: [
      {
        id: 'summary',
        kind: 'dashboard.summary',
        title: 'Summary',
        metrics: [
          { id: 'spend', label: 'Spend', selector: 'summary.total_spend', format: 'currency' },
        ],
      },
      {
        id: 'compare',
        kind: 'dashboard.compare',
        title: 'Compare',
        items: [
          {
            id: 'spendChange',
            label: 'Spend',
            current: 'summary.total_spend',
            previous: 'summary.previous_total_spend',
            format: 'currency',
            deltaFormat: 'currencyDelta',
            deltaLabel: 'vs prior period',
          },
        ],
      },
      {
        id: 'kpiTable',
        kind: 'dashboard.kpiTable',
        title: 'Metric Table',
        rows: [
          {
            id: 'impressions',
            label: 'Impressions',
            value: 'summary.total_impressions',
            format: 'compactNumber',
            context: 'Reach',
            contextTone: 'success',
          },
        ],
      },
      {
        id: 'filters',
        kind: 'dashboard.filters',
        title: 'Filters',
        items: [
          {
            id: 'dateRange',
            label: 'Date Range',
            field: 'dateRange',
            options: [
              { label: '30D', value: '30d' },
              { label: '90D', value: '90d' },
            ],
          },
        ],
      },
      {
        id: 'messages',
        kind: 'dashboard.messages',
        title: 'Messages',
        items: [
          {
            severity: 'warning',
            title: 'Zero-spend ${quality.zero_spend_rate}',
            body: 'Selected ${selection.entityKey} for ${filters.dateRange}',
            visibleWhen: { selector: 'quality.zero_spend_rate', gt: 40 },
          },
        ],
      },
      {
        id: 'dimensions',
        kind: 'dashboard.dimensions',
        title: 'By Country',
        filterBindings: {
          region: 'region',
        },
        dimension: { key: 'country' },
        metric: { key: 'spend', label: 'Spend', format: 'currency' },
      },
      {
        id: 'report',
        kind: 'dashboard.report',
        title: 'Report',
        sections: [
          {
            title: 'Spend ${summary.total_spend}',
            body: ['Selected ${selection.entityKey}'],
            tone: 'info',
            visibleWhen: { source: 'selection', field: 'entityKey', equals: 'US' },
          },
        ],
      },
    ],
  },
  context: {
    ...context,
    dashboardFilters: {dateRange: '90d', region: ['NA']},
    dashboardSelection: { entityKey: 'US' },
  },
  chartSvgs: {},
});

assert.equal(model.blocks.length, 7);
assert.equal(model.dashboardFilters.dateRange, '90d');
assert.deepEqual(model.dashboardFilters.region, ['NA']);
assert.equal(model.dashboardSelection.entityKey, 'US');
assert.equal(model.blocks[0].metrics[0].value, '$123,000');
assert.equal(model.blocks[1].items[0].deltaValue, '+$5,000');
assert.equal(model.blocks[2].rows[0].value, '5.4M');
assert.equal(model.blocks[3].items[0].activeOptions[0], '90D');
assert.equal(model.blocks[4].items.length, 1);
assert.equal(model.blocks[4].items[0].title, 'Zero-spend 47.2');
assert.equal(model.blocks[4].items[0].body, 'Selected US for 90d');
assert.equal(model.blocks[5].rows[0].label, 'US');
assert.equal(model.blocks[5].rows.length, 2);
assert.equal(model.blocks[6].sections[0].title, 'Spend 123000');
assert.equal(model.blocks[6].sections[0].body[0], 'Selected US');

const nestedModel = buildDashboardExportModel({
  container: {
    kind: 'dashboard',
    title: 'Nested Dashboard',
    containers: [
      {
        id: 'detail',
        kind: 'dashboard.detail',
        title: 'Detail',
        containers: [
          {
            id: 'detailTrend',
            kind: 'dashboard.timeline',
            title: 'Detail Trend',
            dataSourceRef: 'detail',
            chart: {
              xAxis: { dataKey: 'week', label: 'Week' },
              series: { valueKey: 'spend' },
            },
          },
        ],
      },
    ],
  },
  context: {
    dashboardKey: 'W1:perf',
    signals: {
      metrics: { peek: () => ({}) },
      collection: { peek: () => [] },
    },
    Context(dataSourceRef) {
      if (dataSourceRef === 'detail') {
        return {
          ...this,
          signals: {
            ...this.signals,
            collection: {
              peek: () => [{ week: '2026-04-01', spend: 42 }],
            },
          },
          Context: this.Context,
        };
      }
      return this;
    },
  },
  chartSvgs: {
    detailTrend: '<svg id="nested"></svg>',
  },
});

assert.equal(nestedModel.blocks[0].children.length, 1);
assert.equal(nestedModel.blocks[0].children[0].svg, '<svg id="nested"></svg>');

const autoDocument = buildStandaloneDashboardDocument({
  container: {
    kind: 'dashboard',
    title: 'Auto SVG',
    containers: [
      {
        id: 'trend',
        kind: 'dashboard.timeline',
        title: 'Trend',
        chart: { xAxis: { dataKey: 'week', label: 'Week' }, series: { valueKey: 'spend' } },
      },
    ],
  },
  context: {
    dashboardKey: 'W1:auto',
    signals: {
      metrics: { peek: () => ({}) },
      collection: { peek: () => [{ week: '2026-04-01', spend: 10 }] },
    },
    Context() {
      return this;
    },
  },
  rootElement: fakeDashboardRoot,
});

assert.match(autoDocument.html, /<svg id="trend"><\/svg>/);
