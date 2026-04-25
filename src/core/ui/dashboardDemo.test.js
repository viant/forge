import assert from 'node:assert/strict';

import {
  DEFAULT_DASHBOARD_DEMO_VARIANT,
  createDashboardDemoBundle,
  createDashboardDemoMetadata,
  createDashboardDemoSeed,
  createOperationsDashboardDemoMetadata,
  createOperationsDashboardDemoSeed,
  createQualityDashboardDemoMetadata,
  createQualityDashboardDemoSeed,
  getDashboardDemoDefinition,
  listDashboardDemoVariants,
} from './dashboardDemo.js';

const metadata = createDashboardDemoMetadata();
const seed = createDashboardDemoSeed();
const opsMetadata = createOperationsDashboardDemoMetadata();
const opsSeed = createOperationsDashboardDemoSeed();
const qualityMetadata = createQualityDashboardDemoMetadata();
const qualitySeed = createQualityDashboardDemoSeed();
const opsBundle = createDashboardDemoBundle('operations');
const qualityBundle = createDashboardDemoBundle('quality');
const variants = listDashboardDemoVariants();
const fallbackBundle = createDashboardDemoBundle('unknown');
const qualityDefinition = getDashboardDemoDefinition('quality');

assert.equal(metadata.view.content.kind, 'dashboard');
assert.equal(DEFAULT_DASHBOARD_DEMO_VARIANT, 'performance');
assert.equal(metadata.view.content.toolbar.items.some((item) => item.label === 'Reset Dashboard'), true);
assert.equal(metadata.view.content.toolbar.items.some((item) => item.on?.[0]?.handler === 'window.resetDashboardState'), true);
assert.equal(metadata.view.content.toolbar.items.some((item) => item.on?.[0]?.handler === 'window.exportDashboard'), true);
assert.equal(metadata.view.content.toolbar.modes.includes('report'), true);
assert.equal(metadata.view.content.report.enabled, true);
assert.equal(metadata.view.content.containers.some((c) => c.kind === 'dashboard.compare'), true);
assert.equal(metadata.view.content.containers.some((c) => c.kind === 'dashboard.composition'), true);
assert.equal(metadata.view.content.containers.some((c) => c.kind === 'dashboard.kpiTable'), true);
assert.equal(metadata.view.content.containers.some((c) => c.kind === 'dashboard.filters'), true);
assert.equal(metadata.view.content.containers.some((c) => c.kind === 'dashboard.dimensions'), true);
assert.equal(metadata.view.content.containers.some((c) => c.kind === 'dashboard.report'), true);
assert.equal(metadata.view.content.containers.find((c) => c.id === 'byCountry').on[0].handler, 'dashboardDemo.updateDetailTrend');

const actions = metadata.actions.import({
  identity: { windowId: 'W1' },
  metadata,
});

assert.equal(typeof actions.dashboardDemo.updateDetailTrend, 'function');
assert.equal(seed.perf.metrics.summary.total_spend, 123000);
assert.equal(seed.perf.metrics.summary.previous_total_spend, 118000);
assert.equal(seed.detailTrend.collection[0].series, 'US');
assert.equal(opsMetadata.view.content.title, 'Operations Dashboard Demo');
assert.equal(opsMetadata.view.content.containers.some((c) => c.kind === 'dashboard.status'), true);
assert.equal(opsSeed.ops.metrics.summary.open_incidents, 7);
assert.equal(opsBundle.metadata.view.content.id, 'opsDashboard');
assert.equal(qualityMetadata.view.content.title, 'Data Quality Dashboard Demo');
assert.equal(qualityMetadata.view.content.containers.some((c) => c.kind === 'dashboard.status'), true);
assert.equal(qualitySeed.quality.metrics.summary.failed_rows, 126000);
assert.equal(qualityBundle.metadata.view.content.id, 'qualityDashboard');
assert.equal(fallbackBundle.metadata.view.content.id, 'demoDashboard');
assert.equal(qualityDefinition.filename, 'quality-dashboard-demo.html');
assert.equal(variants.some((item) => item.id === 'performance'), true);
assert.equal(variants.some((item) => item.id === 'operations'), true);
assert.equal(variants.some((item) => item.id === 'quality'), true);
assert.equal(variants.find((item) => item.id === 'quality').filename, 'quality-dashboard-demo.html');
