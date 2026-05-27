import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardSummary } from './DashboardBlocks.jsx';

const baseSignals = {
  metrics: { value: {}, peek: () => ({}) },
  collection: { value: [], peek: () => [] },
  control: { value: {}, peek: () => ({}) },
  selection: { value: {}, peek: () => ({}) },
};

const summaryRows = [
  {
    primary_blocker_family: 'supply',
    primary_blocker_class: 'PRIMARY_PATH_CONCENTRATION',
    setup_ready: true,
    delivery_state: 'live_with_material_delivery',
    ad_order_pacing_rate: 0.9871,
    ad_order_spend: 4331.9931,
    ad_order_budget: 4388.7563,
  },
];

const context = {
  signals: baseSignals,
  Context(dataSourceRef) {
    return {
      identity: { dataSourceRef },
      signals: {
        collection: { value: summaryRows, peek: () => summaryRows },
        control: { value: {}, peek: () => ({}) },
        selection: { value: {}, peek: () => ({}) },
      },
    };
  },
};

const container = {
  kind: 'dashboard.summary',
  title: 'Posture',
  dataSourceRef: 'troubleshoot_order_2662396_summary',
  items: [
    { label: 'Primary blocker family', valueField: 'primary_blocker_family' },
    { label: 'Blocker class', valueField: 'primary_blocker_class' },
    { label: 'Setup', valueField: 'setup_ready' },
    { label: 'Delivery state', valueField: 'delivery_state' },
    { label: 'Ad order pacing', valueField: 'ad_order_pacing_rate', format: 'percentFraction' },
    { label: 'Spend vs budget', valueField: 'ad_order_spend', secondaryValueField: 'ad_order_budget', format: 'currency' },
  ],
};

const html = renderToStaticMarkup(
  React.createElement(DashboardSummary, {
    container,
    context,
  })
);

if (!html.includes('supply')) {
  throw new Error('expected Primary blocker family value to render from valueField');
}
if (!html.includes('PRIMARY_PATH_CONCENTRATION')) {
  throw new Error('expected Blocker class value to render from valueField');
}
if (!html.includes('98.7%')) {
  throw new Error('expected percentFraction value to render');
}
if (!html.includes('$4,332')) {
  throw new Error('expected primary currency value to render');
}
if (!html.includes('$4,389')) {
  throw new Error('expected secondaryValueField currency value to render');
}

console.log('dashboardSummaryLegacyFields ✓');
