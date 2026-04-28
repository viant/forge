import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardTimeline } from './DashboardBlocks.jsx';

const context = {
  dashboardKey: 'W_test:baseline',
  signals: {
    collection: { value: [], peek: () => [] },
    control: { value: {}, peek: () => ({}) },
    selection: { value: {}, peek: () => ({}) },
  },
};

const container = {
  kind: 'dashboard.timeline',
  title: 'Direct ineligibility funnel',
  dataSourceRef: 'baseline_ineligibility_empty',
  chartType: 'funnel_bar',
  series: ['reduction_pct'],
  chart: {
    type: 'funnel_bar',
    xAxis: { dataKey: 'date', label: 'date' },
    series: {
      nameKey: 'series',
      valueKey: 'value',
      values: [{ label: 'Reduction Pct', value: 'reduction_pct' }],
      palette: ['#137cbd'],
    },
  },
};

renderToStaticMarkup(
  React.createElement(DashboardTimeline, {
    container,
    context,
    isActive: true,
  })
);

console.log('dashboardTimelineEmptyFunnel ✓');
