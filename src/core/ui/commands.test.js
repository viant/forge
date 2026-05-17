import assert from 'node:assert/strict';

import { activeWindows, selectedTabId, selectedWindowId, getBusSignal, getCollectionSignal, getDashboardFilterSignal, getDashboardSelectionSignal, getFormSignal, getMetricsSignal, getViewSignal } from '../store/signals.js';
import { runUICommand } from './commands.js';
import { registerControlTarget, unregisterControlTarget } from './registry.js';

activeWindows.value = [{
  windowId: 'chat/new',
  windowKey: 'chat/new',
  inTab: true,
  parameters: {
    conversations: {
      form: {
        id: 'conv-1',
      },
    },
  },
}];
selectedTabId.value = 'chat/new';
selectedWindowId.value = 'chat/new';

const res = await runUICommand({
  method: 'ui.window.open',
  params: { windowKey: 'demo', windowTitle: 'Demo', inTab: true },
});

assert.ok(res.windowId);
assert.equal(activeWindows.peek().length, 2);
assert.equal(selectedTabId.peek(), res.windowId);
assert.equal(selectedWindowId.peek(), res.windowId);

const updated = await runUICommand({
  method: 'ui.window.open',
  params: {
    windowKey: 'demo',
    windowTitle: 'Demo Hosted',
    inTab: true,
    options: {
      conversationId: 'conv-1',
      presentation: 'hosted',
      region: 'chat.top',
      parentKey: 'chat/new',
    },
  },
});
assert.equal(updated.windowId, 'demo__conv-1');
assert.equal(activeWindows.peek().length, 3);
assert.equal(activeWindows.peek()[2].windowTitle, 'Demo Hosted');
assert.equal(activeWindows.peek()[2].conversationId, 'conv-1');
assert.equal(activeWindows.peek()[2].presentation, 'hosted');
assert.equal(activeWindows.peek()[2].region, 'chat.top');
assert.deepEqual(activeWindows.peek()[2].parameters, {});
const replacedHosted = await runUICommand({
  method: 'ui.window.open',
  params: {
    windowKey: 'order',
    windowTitle: 'Order 2609393',
    inTab: true,
    parameters: { AdOrderId: [2609393] },
    options: {
      conversationId: 'conv-1',
      presentation: 'hosted',
      region: 'chat.top',
      parentKey: 'chat/new',
      replaceHostedRegion: true,
    },
  },
});
assert.equal(replacedHosted.windowId.endsWith('__conv-1'), true);
assert.equal(activeWindows.peek().length, 3);
assert.equal(activeWindows.peek()[2].windowKey, 'order');
assert.deepEqual(activeWindows.peek()[2].parameters, { AdOrderId: [2609393] });
assert.equal(activeWindows.peek()[2].parentKey, 'chat/new');

const appendedHosted = await runUICommand({
  method: 'ui.window.open',
  params: {
    windowKey: 'order',
    windowTitle: 'Order 2656980',
    inTab: true,
    parameters: { AdOrderId: [2656980] },
    options: {
      conversationId: 'conv-1',
      presentation: 'hosted',
      region: 'chat.top',
      parentKey: 'chat/new',
      replaceHostedRegion: false,
    },
  },
});
assert.equal(activeWindows.peek().length, 4);
assert.deepEqual(
  activeWindows.peek().filter((win) => win.windowKey === 'order').map((win) => win.parameters.AdOrderId[0]),
  [2609393, 2656980]
);
assert.equal(appendedHosted.windowId, activeWindows.peek()[3].windowId);

const crossConversationHosted = await runUICommand({
  method: 'ui.window.open',
  params: {
    windowKey: 'order',
    windowTitle: 'Order 2656980 Conversation 2',
    inTab: true,
    parameters: { AdOrderId: [2656980] },
    options: {
      conversationId: 'conv-2',
      presentation: 'hosted',
      region: 'chat.top',
      parentKey: 'chat/new',
      replaceHostedRegion: false,
    },
  },
});
assert.equal(activeWindows.peek().filter((win) => win.windowKey === 'order').length, 3);
assert.notEqual(crossConversationHosted.windowId, appendedHosted.windowId);
assert.equal(
  activeWindows.peek().filter((win) => win.windowKey === 'order' && win.conversationId === 'conv-2').length,
  1
);
assert.equal(selectedWindowId.peek(), appendedHosted.windowId);
assert.equal(selectedTabId.peek(), appendedHosted.windowId);

const replacedBuilder = await runUICommand({
  method: 'ui.window.open',
  params: {
    windowKey: 'metricReportBuilder',
    windowTitle: 'Metric Report Builder',
    inTab: true,
    options: {
      conversationId: 'conv-1',
      presentation: 'hosted',
      region: 'chat.top',
      parentKey: 'chat/new',
      replaceHostedRegion: true,
    },
  },
});
assert.notEqual(replacedBuilder.windowId, replacedHosted.windowId);
assert.equal(activeWindows.peek().length, 5);
assert.equal(activeWindows.peek().filter((win) => win.windowKey === 'metricReportBuilder').length, 1);
assert.equal(activeWindows.peek().find((win) => win.windowKey === 'metricReportBuilder').windowId, replacedBuilder.windowId);
assert.equal(activeWindows.peek().find((win) => win.windowKey === 'metricReportBuilder').parentKey, 'chat/new');

getDashboardFilterSignal(`${res.windowId}:demoDashboard`).value = { periodView: 'today' };

await runUICommand({ method: 'ui.window.activate', params: { windowId: res.windowId } });
assert.equal(selectedWindowId.peek(), res.windowId);

await runUICommand({ method: 'ui.window.selectTab', params: { windowId: res.windowId, containerId: 'analysisPane', tabId: 'kpiTab' } });
const busMessages = getBusSignal(res.windowId).peek();
assert.equal(busMessages[busMessages.length - 1].type, 'selectTab');
assert.equal(busMessages[busMessages.length - 1].tabId, 'kpiTab');
assert.equal(busMessages[busMessages.length - 1].containerId, 'analysisPane');
assert.equal(getViewSignal(res.windowId).peek().tabs.analysisPane, 'kpiTab');

await runUICommand({ method: 'ui.window.close', params: { windowId: res.windowId } });
await runUICommand({ method: 'ui.window.close', params: { windowId: replacedHosted.windowId } });
await runUICommand({ method: 'ui.window.close', params: { windowId: appendedHosted.windowId } });
await runUICommand({ method: 'ui.window.close', params: { windowId: crossConversationHosted.windowId } });
await runUICommand({ method: 'ui.window.close', params: { windowId: replacedBuilder.windowId } });
assert.equal(activeWindows.peek().length, 1);
assert.equal(activeWindows.peek()[0].windowId, 'chat/new');
assert.equal(selectedWindowId.peek(), 'chat/new');
assert.equal(selectedTabId.peek(), 'chat/new');
assert.deepEqual(getDashboardFilterSignal(`${res.windowId}:demoDashboard`).peek(), {});

const regKey = registerControlTarget(
  { windowId: 'W1', dataSourceRef: 'ds', controlId: 'name', label: 'Name', type: 'text', scope: 'form' },
  { element: { isConnected: true, focus: () => {} } }
);
assert.ok(regKey);

const list = await runUICommand({ method: 'ui.controls.list', params: { windowId: 'W1' } });
assert.equal(Array.isArray(list.controls), true);
assert.equal(list.controls.length, 1);

const search = await runUICommand({ method: 'ui.controls.search', params: { query: 'nam', windowId: 'W1' } });
assert.equal(search.controls.length, 1);

await runUICommand({
  method: 'ui.control.setValue',
  params: { windowId: 'W1', controlId: 'granularity', scope: 'windowForm', value: 'hour' },
});
assert.equal(getFormSignal('W1:windowForm').peek().granularity, 'hour');

await runUICommand({
  method: 'ui.window.setFormData',
  params: {
    windowId: 'W1',
    values: {
      prefill: {
        advertiserId: 123,
        dealId: 'deal-xyz',
      },
    },
  },
});
assert.deepEqual(getFormSignal('W1:windowForm').peek(), {
  granularity: 'hour',
  prefill: {
    advertiserId: 123,
    dealId: 'deal-xyz',
  },
});

await runUICommand({
  method: 'ui.window.setFormData',
  params: {
    windowId: 'W1',
    values: {
      prefill: {
        targetingIncl: 'iris:1466062,123',
      },
    },
  },
});
assert.deepEqual(getFormSignal('W1:windowForm').peek(), {
  granularity: 'hour',
  prefill: {
    advertiserId: 123,
    dealId: 'deal-xyz',
    targetingIncl: 'iris:1466062,123',
  },
});

await runUICommand({
  method: 'ui.window.setFormData',
  params: {
    windowId: 'W1',
    replace: true,
    values: {
      prefill: {
        advertiserId: 999,
      },
    },
  },
});
assert.deepEqual(getFormSignal('W1:windowForm').peek(), {
  prefill: {
    advertiserId: 999,
  },
});

const focusInfo = await runUICommand({ method: 'ui.focus.get', params: {} });
assert.ok('focused' in focusInfo);

const exported = await runUICommand({
  method: 'ui.dashboard.exportHtml',
  params: {
    download: false,
    filename: 'perf.html',
    model: {
      title: 'Perf',
      blocks: [
        {
          kind: 'dashboard.summary',
          title: 'KPIs',
          metrics: [{ label: 'Spend', value: '$10' }],
        },
      ],
    },
  },
});
assert.equal(exported.ok, true);
assert.equal(exported.filename, 'perf.html');
assert.match(exported.html, /<!doctype html>/i);
assert.match(exported.html, /Perf/);

const freshDashboardKey = `${res.windowId}:demoDashboard`;
getDashboardFilterSignal(freshDashboardKey).value = {};

const exportedFromContainer = await runUICommand({
  method: 'ui.dashboard.exportFromContainer',
  params: {
    download: false,
    filename: 'perf-live.html',
    container: {
      kind: 'dashboard',
      title: 'Perf Live',
      containers: [
        {
          id: 'summary',
          kind: 'dashboard.summary',
          title: 'KPIs',
          metrics: [{ label: 'Spend', selector: 'summary.total_spend', format: 'currency' }],
        },
      ],
    },
    context: {
      dashboardKey: 'W1:perf',
      locale: 'de-DE',
      signals: {
        metrics: {
          peek: () => ({ summary: { total_spend: 10 } }),
        },
      },
      Context() {
        return this;
      },
    },
  },
});
assert.equal(exportedFromContainer.ok, true);
assert.match(exportedFromContainer.html, /<html lang="de-DE">/);
assert.match(exportedFromContainer.html, /10\s?\$/);
assert.equal(exportedFromContainer.model.blocks.length, 1);
assert.equal(exportedFromContainer.model.locale, 'de-DE');

const exportedWithDomSvg = await runUICommand({
  method: 'ui.dashboard.exportFromContainer',
  params: {
    download: false,
    container: {
      kind: 'dashboard',
      title: 'Perf Charts',
      containers: [
        {
          id: 'trend',
          kind: 'dashboard.timeline',
          title: 'Trend',
          chart: { xAxis: { dataKey: 'day', label: 'Day' }, series: { valueKey: 'spend' } },
        },
      ],
    },
    context: {
      dashboardKey: 'W1:perf',
      signals: {
        metrics: { peek: () => ({}) },
        collection: {
          peek: () => [{ day: '2026-04-07', spend: 10 }],
        },
      },
      Context() {
        return this;
      },
    },
    rootElement: {
      querySelectorAll() {
        return [{
          getAttribute(name) {
            return name === 'data-dashboard-chart-id' ? 'trend' : null;
          },
          querySelector(name) {
            return name === 'svg' ? { outerHTML: '<svg id="captured"></svg>' } : null;
          },
        }];
      },
    },
  },
});
assert.match(exportedWithDomSvg.html, /<svg id="captured"><\/svg>/);

const demoList = await runUICommand({
  method: 'ui.dashboard.listDemos',
  params: {},
});
assert.equal(demoList.ok, true);
assert.equal(Array.isArray(demoList.demos), true);
assert.equal(demoList.demos.some((item) => item.id === 'performance'), true);
assert.equal(demoList.demos.some((item) => item.id === 'operations'), true);
assert.equal(demoList.demos.some((item) => item.id === 'quality'), true);

const opsDemoBundle = await runUICommand({
  method: 'ui.dashboard.getDemo',
  params: {
    variant: 'operations',
  },
});
assert.equal(opsDemoBundle.ok, true);
assert.equal(opsDemoBundle.variant, 'operations');
assert.equal(opsDemoBundle.metadata.view.content.id, 'opsDashboard');
assert.equal(opsDemoBundle.seed.ops.metrics.summary.open_incidents, 7);

const qualityDemoBundle = await runUICommand({
  method: 'ui.dashboard.getDemo',
  params: {
    variant: 'quality',
  },
});
assert.equal(qualityDemoBundle.ok, true);
assert.equal(qualityDemoBundle.variant, 'quality');
assert.equal(qualityDemoBundle.metadata.view.content.id, 'qualityDashboard');
assert.equal(qualityDemoBundle.seed.quality.metrics.summary.failed_rows, 126000);

const dashboardCapabilities = await runUICommand({
  method: 'ui.dashboard.capabilities',
  params: {},
});
assert.equal(dashboardCapabilities.ok, true);
assert.equal(dashboardCapabilities.blockKinds.includes('dashboard.filters'), true);
assert.equal(dashboardCapabilities.blockKinds.includes('dashboard.badges'), true);
assert.equal(dashboardCapabilities.blockKinds.includes('dashboard.geoMap'), true);
assert.equal(dashboardCapabilities.chartTypes.includes('area'), true);
assert.equal(dashboardCapabilities.chartTypes.includes('geoMap'), true);
assert.equal(dashboardCapabilities.commands.includes('ui.dashboard.capabilities'), true);
assert.equal(dashboardCapabilities.commands.includes('ui.dashboard.state.reset'), true);
assert.equal(dashboardCapabilities.commands.includes('ui.dashboard.generateDemoArtifacts'), true);
assert.equal(dashboardCapabilities.demos.some((item) => item.id === 'operations'), true);
assert.equal(dashboardCapabilities.schema.additionalProperties, true);
assert.equal(dashboardCapabilities.schema.$defs.block.additionalProperties, true);
assert.equal(dashboardCapabilities.schema.$defs.block.properties.kind.enum.includes('dashboard.geoMap'), true);
assert.equal(dashboardCapabilities.schema.$defs.block.properties.dashboard.$ref, '#/$defs/dashboardConfig');
assert.equal(dashboardCapabilities.schema.$defs.block.properties.visibleWhen.$ref, '#/$defs/condition');
assert.equal(dashboardCapabilities.schema.$defs.dashboardConfig.properties.visibleWhen.$ref, '#/$defs/condition');
assert.equal(dashboardCapabilities.schema.$defs.dashboardConfig.properties.reportOptions.$ref, '#/$defs/reportConfig');
assert.equal(dashboardCapabilities.schema.$defs.dashboardConfig.properties.geo.$ref, '#/$defs/geoConfig');
assert.equal(dashboardCapabilities.schema.$defs.geoConfig.properties.color.properties.rules.type, 'array');
assert.equal(dashboardCapabilities.schema.$defs.geoConfig.properties.limit.minimum, 1);
assert.equal(dashboardCapabilities.schema.$defs.block.properties.selectionBindings.$ref, '#/$defs/bindings');
assert.equal(dashboardCapabilities.schema.$defs.reportConfig.properties.enabled.type, 'boolean');

const defaultDemoBundle = await runUICommand({
  method: 'ui.dashboard.getDemo',
  params: {},
});
assert.equal(defaultDemoBundle.ok, true);
assert.equal(defaultDemoBundle.variant, 'performance');
assert.equal(defaultDemoBundle.metadata.view.content.id, 'demoDashboard');

const demoArtifacts = await runUICommand({
  method: 'ui.dashboard.listDemoArtifacts',
  params: {},
});
assert.equal(demoArtifacts.ok, true);
assert.equal(demoArtifacts.artifacts.some((item) => item.id === 'performance' && item.filename === 'performance-dashboard-demo.html'), true);

const generatedArtifacts = await runUICommand({
  method: 'ui.dashboard.generateDemoArtifacts',
  params: {
    variants: ['quality'],
    generatedAt: '2026-04-07T12:00:00.000Z',
  },
});
assert.equal(generatedArtifacts.ok, true);
assert.equal(generatedArtifacts.artifacts.length, 1);
assert.equal(generatedArtifacts.artifacts[0].id, 'quality');
assert.match(generatedArtifacts.artifacts[0].html, /Data Quality Dashboard Demo/);
assert.equal(generatedArtifacts.artifacts[0].model.generatedAt, '2026-04-07T12:00:00.000Z');

const localizedArtifacts = await runUICommand({
  method: 'ui.dashboard.generateDemoArtifacts',
  params: {
    variants: ['performance'],
    generatedAt: '2026-04-07T12:00:00.000Z',
    locale: 'de-DE',
  },
});
assert.equal(localizedArtifacts.ok, true);
assert.equal(localizedArtifacts.artifacts[0].model.locale, 'de-DE');
assert.match(localizedArtifacts.artifacts[0].html, /<html lang="de-DE">/);

const openedDemo = await runUICommand({
  method: 'ui.dashboard.openDemo',
  params: {
    windowTitle: 'Demo Dashboard',
  },
});
assert.equal(openedDemo.ok, true);
assert.ok(openedDemo.windowId);
assert.equal(activeWindows.peek().some((w) => w.windowId === openedDemo.windowId), true);
assert.equal(getMetricsSignal(`${openedDemo.windowId}DSperf`).peek().summary.total_spend, 123000);
assert.equal(Array.isArray(getCollectionSignal(`${openedDemo.windowId}DSbyCountry`).peek()), true);
assert.equal(getCollectionSignal(`${openedDemo.windowId}DSbyCountry`).peek()[0].country, 'US');

const openedOpsDemo = await runUICommand({
  method: 'ui.dashboard.openDemo',
  params: {
    windowTitle: 'Operations Dashboard',
    variant: 'operations',
  },
});
assert.equal(openedOpsDemo.ok, true);
assert.equal(openedOpsDemo.variant, 'operations');
assert.equal(getMetricsSignal(`${openedOpsDemo.windowId}DSops`).peek().summary.open_incidents, 7);
assert.equal(getCollectionSignal(`${openedOpsDemo.windowId}DSbyService`).peek()[0].service, 'api');

const openedQualityDemo = await runUICommand({
  method: 'ui.dashboard.openDemo',
  params: {
    windowTitle: 'Quality Dashboard',
    variant: 'quality',
  },
});
assert.equal(openedQualityDemo.ok, true);
assert.equal(openedQualityDemo.variant, 'quality');
assert.equal(getMetricsSignal(`${openedQualityDemo.windowId}DSquality`).peek().summary.failed_rows, 126000);
assert.equal(getCollectionSignal(`${openedQualityDemo.windowId}DSbyDataset`).peek()[0].dataset, 'invoice_fact');

const exportedWindow = await runUICommand({
  method: 'ui.dashboard.exportWindow',
  params: {
    windowId: openedDemo.windowId,
    download: false,
    rootElement: {
      querySelectorAll() {
        return [{
          getAttribute(name) {
            return name === 'data-dashboard-chart-id' ? 'trend' : null;
          },
          querySelector(name) {
            return name === 'svg' ? { outerHTML: '<svg id="window-export"></svg>' } : null;
          },
        }];
      },
    },
  },
});
assert.equal(exportedWindow.ok, true);
assert.match(exportedWindow.html, /Performance Dashboard Demo/);
assert.match(exportedWindow.html, /<svg id="window-export"><\/svg>/);

const setDashboardFilter = await runUICommand({
  method: 'ui.dashboard.filter.set',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
    patch: {
      dateRange: '30d',
      region: ['EMEA'],
    },
  },
});
assert.equal(setDashboardFilter.ok, true);
assert.equal(getDashboardFilterSignal(`${openedDemo.windowId}:demoDashboard`).peek().dateRange, '30d');
assert.deepEqual(getDashboardFilterSignal(`${openedDemo.windowId}:demoDashboard`).peek().region, ['EMEA']);

const clearOneDashboardFilter = await runUICommand({
  method: 'ui.dashboard.filter.clear',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
    fields: ['dateRange'],
  },
});
assert.equal(clearOneDashboardFilter.ok, true);
assert.equal(getDashboardFilterSignal(`${openedDemo.windowId}:demoDashboard`).peek().dateRange, undefined);
assert.deepEqual(getDashboardFilterSignal(`${openedDemo.windowId}:demoDashboard`).peek().region, ['EMEA']);

const clearAllDashboardFilters = await runUICommand({
  method: 'ui.dashboard.filter.clear',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
  },
});
assert.equal(clearAllDashboardFilters.ok, true);
assert.deepEqual(getDashboardFilterSignal(`${openedDemo.windowId}:demoDashboard`).peek(), {});

const setDashboardSelection = await runUICommand({
  method: 'ui.dashboard.selection.set',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
    dimension: 'country',
    entityKey: 'GB',
    selected: { country: 'GB', region: 'EMEA' },
    sourceBlockId: 'byCountry',
  },
});
assert.equal(setDashboardSelection.ok, true);
assert.equal(getDashboardSelectionSignal(`${openedDemo.windowId}:demoDashboard`).peek().entityKey, 'GB');
const busAfterSet = getBusSignal(openedDemo.windowId).peek();
assert.equal(busAfterSet[busAfterSet.length - 1].type, 'dashboard.selection.changed');
assert.equal(busAfterSet[busAfterSet.length - 1].entityKey, 'GB');

const clearDashboardSelection = await runUICommand({
  method: 'ui.dashboard.selection.clear',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
  },
});
assert.equal(clearDashboardSelection.ok, true);
assert.equal(getDashboardSelectionSignal(`${openedDemo.windowId}:demoDashboard`).peek().entityKey, null);

const dashboardState = await runUICommand({
  method: 'ui.dashboard.state.get',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
  },
});
assert.equal(dashboardState.ok, true);
assert.equal(dashboardState.dashboardKey, `${openedDemo.windowId}:demoDashboard`);
assert.deepEqual(dashboardState.filters, {});
assert.equal(dashboardState.selection.entityKey, null);
assert.equal(Array.isArray(dashboardState.blockIds), true);
assert.equal(dashboardState.blockIds.includes('summary'), true);

await runUICommand({
  method: 'ui.dashboard.filter.set',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
    patch: { dateRange: '30d', region: ['EMEA'] },
  },
});
await runUICommand({
  method: 'ui.dashboard.selection.set',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
    dimension: 'country',
    entityKey: 'GB',
  },
});

const resetDashboardState = await runUICommand({
  method: 'ui.dashboard.state.reset',
  params: {
    windowId: openedDemo.windowId,
    dashboardId: 'demoDashboard',
  },
});
assert.equal(resetDashboardState.ok, true);
assert.equal(resetDashboardState.filters.dateRange, '90d');
assert.deepEqual(resetDashboardState.filters.region, ['NA']);
assert.equal(resetDashboardState.selection.entityKey, null);

unregisterControlTarget(regKey);
