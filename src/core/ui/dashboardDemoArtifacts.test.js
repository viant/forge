import assert from 'node:assert/strict';

import {
  buildDashboardDemoContext,
  buildDashboardDemoExportModel,
  buildDashboardDemoStandaloneHtml,
  getDashboardDemoExportFilename,
  listDashboardDemoArtifacts,
} from './dashboardDemoArtifacts.js';

const performanceContext = buildDashboardDemoContext('performance');
assert.equal(performanceContext.dashboardFilters.dateRange, '90d');
assert.deepEqual(performanceContext.dashboardFilters.region, ['NA']);
assert.equal(performanceContext.Context('perf').signals.metrics.peek().summary.total_spend, 123000);
assert.equal(Array.isArray(performanceContext.Context('byCountry').signals.collection.peek()), true);
assert.equal(performanceContext.Context('byState').signals.collection.peek().some((row) => row.stateCode === 'CA'), true);

const opsModel = buildDashboardDemoExportModel('operations', { generatedAt: '2026-04-07T12:00:00.000Z' });
assert.equal(opsModel.title, 'Operations Dashboard Demo');
assert.equal(opsModel.generatedAt, '2026-04-07T12:00:00.000Z');
assert.equal(opsModel.dashboardFilters.severity.includes('critical'), true);
assert.equal(opsModel.blocks.some((block) => block.kind === 'dashboard.summary'), true);

const qualityHtml = buildDashboardDemoStandaloneHtml('quality', { generatedAt: '2026-04-07T12:00:00.000Z' });
assert.match(qualityHtml.html, /<!doctype html>/i);
assert.match(qualityHtml.html, /Data Quality Dashboard Demo/);
assert.match(qualityHtml.html, /Customer/);

assert.equal(getDashboardDemoExportFilename('performance'), 'performance-dashboard-demo.html');
assert.equal(listDashboardDemoArtifacts().some((artifact) => artifact.id === 'quality' && artifact.filename === 'quality-dashboard-demo.html'), true);
