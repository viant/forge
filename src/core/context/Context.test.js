import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {Context, resolveWindowContentContext} from './Context.jsx';
import {clearWindowContext, getWindowContext, setWindowContext} from './registry.js';
import {activeWindows, clearProtectedWindowState, restoreWindowsFromSnapshot} from '../store/signals.js';
import {runUICommand} from '../ui/commands.js';
import {resolveHostedExecuteOnOpenHostAction} from '../../components/dashboard/reportBuilderHooks.js';

const metadata = {
  actions: {
    import() {
      return {};
    },
  },
  dataSource: {
    lookup: {
      selectionMode: 'single',
      selectors: {},
      uniqueKey: [{field: 'id', parameter: 'id'}],
    },
    timeline: {
      selectionMode: 'none',
      selectors: {},
      uniqueKey: [{field: 'date', parameter: 'date'}],
    },
  },
  view: {},
};

const context = Context('W_ctx_override', metadata, 'lookup', {});
context.init();

const staticWindow = Context('W_static_controls', {dataSource: {}, view: {}}, '', {});
staticWindow.init();
assert.equal(staticWindow.signals.form, staticWindow.signals.windowForm);
staticWindow.signals.form.value = {title: 'Local preview'};
const restoredStaticWindow = Context('W_static_controls', {dataSource: {}, view: {}}, '', {});
assert.equal(restoredStaticWindow.signals.form.value.title, 'Local preview');
assert.equal(restoredStaticWindow.signals.message, staticWindow.signals.message);
const otherStaticWindow = Context('W_other_static_controls', {dataSource: {}, view: {}}, '', {});
assert.notEqual(otherStaticWindow.signals.form, staticWindow.signals.form);
otherStaticWindow.signals.form.value = {title: 'Other window'};
staticWindow.signals.message.value = [{event: 'pending'}];
clearProtectedWindowState('W_static_controls');
assert.deepEqual(staticWindow.signals.form.value, {});
assert.deepEqual(staticWindow.signals.message.value, []);
assert.equal(otherStaticWindow.signals.form.value.title, 'Other window');
assert.equal(context.signals, undefined, 'datasource windows must retain their scoped context resolution');
assert.ok(context.Context('lookup').signals.message);

const previewOpenTarget = () => 'preview-target';
const mergedWindowHandlerContext = Context('W_ctx_window_handlers', metadata, 'lookup', {
  window: {openTarget: previewOpenTarget},
});
assert.equal(mergedWindowHandlerContext.handlers.window.openTarget, previewOpenTarget);
assert.equal(typeof mergedWindowHandlerContext.handlers.window.openDialog, 'function');
assert.equal(typeof mergedWindowHandlerContext.handlers.window.closeDialog, 'function');
const mergedWindowDataSourceContext = mergedWindowHandlerContext.Context('lookup');
assert.equal(mergedWindowDataSourceContext.handlers.window.openTarget, previewOpenTarget);
assert.equal(typeof mergedWindowDataSourceContext.handlers.window.openDialog, 'function');
assert.equal(typeof mergedWindowDataSourceContext.handlers.window.closeDialog, 'function');

const multiCtx = context.Context('lookup', {selectionMode: 'multi'});
const rows = [{id: 'one'}, {id: 'two'}];
multiCtx.signals.collection.value = rows;

multiCtx.handlers.dataSource.toggleSelection({row: rows[0], rowIndex: 0});
let selection = multiCtx.handlers.dataSource.getSelection();
assert.ok(Array.isArray(selection.selection));
assert.equal(selection.selection.length, 1);
assert.deepEqual(selection.selection[0], rows[0]);

multiCtx.handlers.dataSource.toggleSelection({row: rows[1], rowIndex: 1});
selection = multiCtx.handlers.dataSource.getSelection();
assert.equal(selection.selection.length, 2);
assert.deepEqual(selection.selection[1], rows[1]);

const singleCtx = context.Context('lookup');
assert.equal(singleCtx.dataSource.selectionMode, 'single');
assert.equal(multiCtx.dataSource.selectionMode, 'multi');

const importedInstanceA = Context('W_import_instance_a', metadata, 'lookup', {});
const importedInstanceB = Context('W_import_instance_b', metadata, 'lookup', {});
importedInstanceA.init();
importedInstanceB.init();
const importedLookupA = importedInstanceA.Context('lookup');
const importedLookupB = importedInstanceB.Context('lookup');
importedLookupA.signals.collection.value = [{id: 'a'}];
importedLookupA.signals.form.value = {query: 'only-a'};
assert.notEqual(importedLookupA.signals.collection, importedLookupB.signals.collection);
assert.notEqual(importedLookupA.signals.form, importedLookupB.signals.form);
assert.deepEqual(importedLookupB.signals.collection.peek(), []);
assert.deepEqual(importedLookupB.signals.form.peek(), {});

const noSelectionCtx = context.Context('timeline');
assert.equal(noSelectionCtx.dataSource.selectionMode, 'none');
assert.equal(typeof noSelectionCtx.signals.collection?.peek, 'function');
assert.equal(typeof noSelectionCtx.signals.collectionInfo?.peek, 'function');
assert.equal(typeof noSelectionCtx.signals.metrics?.peek, 'function');
assert.equal(typeof noSelectionCtx.signals.selection?.peek, 'function');
assert.deepEqual(noSelectionCtx.signals.selection.peek(), {selected: null, rowIndex: -1});

const actorContext = Context('W_ctx_actor', metadata, 'lookup', {
  __connectorRuntime: {
    targetContext: {
      actorRef: 'user://awitas',
    },
  },
});
actorContext.init();
assert.equal(actorContext.identity.actorRef, 'user://awitas');
assert.equal(actorContext.Context('lookup').identity.actorRef, 'user://awitas');

const lazyMetadata = {
  namespace: 'Performance Metrics',
  actions: {
    import() {
      return {
        'Performance Metrics': {
          exampleReportBuilder: {
            buildRequest() {
              return 'ok';
            },
          },
        },
      };
    },
  },
  dataSource: {
    lookup: {
      selectionMode: 'single',
      selectors: {},
      uniqueKey: [{ field: 'id', parameter: 'id' }],
    },
  },
  view: {},
};

const lazyContext = Context('W_ctx_lazy', lazyMetadata, 'lookup', {});
const lazyHandler = lazyContext.lookupHandler('Performance Metrics.exampleReportBuilder.buildRequest');
assert.equal(typeof lazyHandler, 'function');
assert.equal(lazyHandler(), 'ok');

const runtimeWindowId = 'reportBuilder__context-runtime';
const runtimeConversationId = 'conversation-context-runtime';
const runtimeSnapshot = {
  conversationId: runtimeConversationId,
  selected: {windowId: runtimeWindowId, tabId: runtimeWindowId},
  windows: [{
    windowId: runtimeWindowId,
    windowKey: 'reportBuilder',
    windowTitle: 'Performance Inventory Brief',
    conversationId: runtimeConversationId,
    presentation: 'hosted',
    region: 'chat.top',
    parentKey: 'chat/new',
    inTab: true,
    parameters: {
      executeOnOpen: true,
      reportStarterId: 'performance_inventory_brief',
    },
  }],
};
const runtimeServices = (windowState, marker) => ({
  windowState,
  runtimeMarker: () => marker,
});

restoreWindowsFromSnapshot(runtimeSnapshot);
const restoredWindow = activeWindows.peek()[0];
const restoredServices = runtimeServices(restoredWindow, 'restored-first');
const restoredHookContext = Context(runtimeWindowId, metadata, 'lookup', restoredServices);
const restoredContext = resolveWindowContentContext({
  existingContext: getWindowContext(runtimeWindowId),
  hookContext: restoredHookContext,
  metadata,
  services: restoredServices,
  windowState: restoredWindow,
});
restoredContext.init();
setWindowContext(runtimeWindowId, restoredContext);
const restoredDataSourceContext = restoredContext.Context('lookup');
assert.equal(restoredContext.windowState.hostOpenState, 'historical_replay');
assert.equal(restoredDataSourceContext.windowState.hostOpenState, 'historical_replay');
assert.equal(restoredDataSourceContext.handlers.runtimeMarker(), 'restored-first');
assert.equal(resolveHostedExecuteOnOpenHostAction({
  executeOnOpen: true,
  windowState: restoredDataSourceContext.windowState,
}), 'restore');
const stableRestoredHookContext = Context(runtimeWindowId, metadata, 'lookup', restoredServices);
const stableRestoredInnerWindow = {...restoredWindow, isInTab: true};
const stableRestoredContext = resolveWindowContentContext({
  existingContext: getWindowContext(runtimeWindowId),
  hookContext: stableRestoredHookContext,
  metadata,
  services: restoredServices,
  windowState: stableRestoredInnerWindow,
});
assert.equal(
  stableRestoredContext,
  restoredContext,
  'a decorative inner window spread must not replace the canonical outer-window Context',
);
assert.equal(
  stableRestoredContext.Context('lookup'),
  restoredDataSourceContext,
  'stable production rerenders must preserve the exact datasource context and connector cache',
);
const stableRestoredDecoratedHookContext = Context(runtimeWindowId, metadata, 'lookup', restoredServices);
const stableRestoredDecoratedContext = resolveWindowContentContext({
  existingContext: getWindowContext(runtimeWindowId),
  hookContext: stableRestoredDecoratedHookContext,
  metadata,
  services: restoredServices,
  windowState: {...restoredWindow, isInTab: false},
});
assert.equal(
  stableRestoredDecoratedContext,
  restoredContext,
  'changing only the inner isInTab decoration must not churn Context',
);
const replacedCanonicalWindow = {
  ...restoredWindow,
  windowTitle: 'Performance Inventory Brief — canonical update',
};
restoredServices.windowState = replacedCanonicalWindow;
const replacedCanonicalHookContext = Context(runtimeWindowId, metadata, 'lookup', restoredServices);
const replacedCanonicalContext = resolveWindowContentContext({
  existingContext: getWindowContext(runtimeWindowId),
  hookContext: replacedCanonicalHookContext,
  metadata,
  services: restoredServices,
  windowState: {...replacedCanonicalWindow, isInTab: true},
});
assert.notEqual(
  replacedCanonicalContext,
  restoredContext,
  'a changed canonical outer window must replace Context even when services identity is stable',
);
assert.equal(replacedCanonicalContext.windowState, replacedCanonicalWindow);
restoredServices.windowState = restoredWindow;
const refreshedRestoredServices = runtimeServices(restoredWindow, 'restored-service-refresh');
const refreshedRestoredHookContext = Context(
  runtimeWindowId,
  metadata,
  'lookup',
  refreshedRestoredServices,
);
const refreshedRestoredContext = resolveWindowContentContext({
  existingContext: getWindowContext(runtimeWindowId),
  hookContext: refreshedRestoredHookContext,
  metadata,
  services: refreshedRestoredServices,
  windowState: {...restoredWindow, isInTab: true},
});
assert.notEqual(
  refreshedRestoredContext,
  restoredContext,
  'a changed canonical runtime services object must replace Context',
);
assert.equal(
  refreshedRestoredContext.Context('lookup').handlers.runtimeMarker(),
  'restored-service-refresh',
);
setWindowContext(runtimeWindowId, refreshedRestoredContext);

await runUICommand({
  method: 'ui.window.open',
  params: {
    windowId: runtimeWindowId,
    windowKey: 'reportBuilder',
    windowTitle: 'Performance Inventory Brief',
    parameters: runtimeSnapshot.windows[0].parameters,
    options: {
      conversationId: runtimeConversationId,
      presentation: 'hosted',
      region: 'chat.top',
      parentKey: 'chat/new',
    },
  },
});
const freshWindow = activeWindows.peek()[0];
const freshServices = runtimeServices(freshWindow, 'fresh-reopen');
const freshHookContext = Context(runtimeWindowId, metadata, 'lookup', freshServices);
const cachedFreshContext = resolveWindowContentContext({
  existingContext: getWindowContext(runtimeWindowId),
  hookContext: freshHookContext,
  metadata,
  services: freshServices,
  windowState: {...freshWindow, isInTab: true},
});
const cachedFreshDataSourceContext = cachedFreshContext.Context('lookup');
assert.equal(
  cachedFreshContext.windowState.hostOpenState,
  'fresh',
  'WindowContent must not reuse a metadata-matching context whose runtime windowState is historical',
);
assert.equal(cachedFreshDataSourceContext.windowState.hostOpenState, 'fresh');
assert.equal(cachedFreshDataSourceContext.handlers.runtimeMarker(), 'fresh-reopen');
assert.equal(resolveHostedExecuteOnOpenHostAction({
  executeOnOpen: true,
  windowState: cachedFreshDataSourceContext.windowState,
}), 'execute');
assert.equal(cachedFreshContext.identity.windowId, runtimeWindowId);
assert.equal(cachedFreshDataSourceContext.identity.windowId, runtimeWindowId);
assert.equal(cachedFreshDataSourceContext.signals.input, restoredDataSourceContext.signals.input);
assert.equal(cachedFreshDataSourceContext.signals.form, restoredDataSourceContext.signals.form);
assert.equal(cachedFreshDataSourceContext.signals.windowForm, restoredDataSourceContext.signals.windowForm);
assert.deepEqual(cachedFreshDataSourceContext.actions, restoredDataSourceContext.actions);
assert.equal(typeof cachedFreshDataSourceContext.lookupHandler, 'function');
assert.equal(typeof cachedFreshDataSourceContext.handlers.dataSource.fetchCollection, 'function');

setWindowContext(runtimeWindowId, cachedFreshContext);
restoreWindowsFromSnapshot(runtimeSnapshot);
const restoredAgainWindow = activeWindows.peek()[0];
const restoredAgainServices = runtimeServices(restoredAgainWindow, 'restored-again');
const restoredAgainHookContext = Context(runtimeWindowId, metadata, 'lookup', restoredAgainServices);
const cachedRestoredAgainContext = resolveWindowContentContext({
  existingContext: getWindowContext(runtimeWindowId),
  hookContext: restoredAgainHookContext,
  metadata,
  services: restoredAgainServices,
  windowState: {...restoredAgainWindow, isInTab: false},
});
const cachedRestoredAgainDataSourceContext = cachedRestoredAgainContext.Context('lookup');
assert.equal(cachedRestoredAgainContext.windowState.hostOpenState, 'historical_replay');
assert.equal(cachedRestoredAgainDataSourceContext.windowState.hostOpenState, 'historical_replay');
assert.equal(cachedRestoredAgainDataSourceContext.handlers.runtimeMarker(), 'restored-again');
assert.equal(resolveHostedExecuteOnOpenHostAction({
  executeOnOpen: true,
  windowState: cachedRestoredAgainDataSourceContext.windowState,
}), 'restore');
assert.equal(cachedRestoredAgainDataSourceContext.identity.windowId, runtimeWindowId);
assert.equal(typeof cachedRestoredAgainDataSourceContext.signals.input.peek, 'function');
assert.equal(typeof cachedRestoredAgainDataSourceContext.handlers.dataSource.fetchCollection, 'function');
clearWindowContext(runtimeWindowId);

const identityWindowId = `${runtimeWindowId}-identity`;
const identityWindow = {...restoredAgainWindow, windowId: identityWindowId};
const sharedRuntimeIdentity = {};
const identityServicesA = {
  ...runtimeServices(identityWindow, 'identity-a'),
  __contextRuntimeIdentity: sharedRuntimeIdentity,
};
const identityContextA = Context(identityWindowId, metadata, 'lookup', identityServicesA);
identityContextA.init();
setWindowContext(identityWindowId, identityContextA);
const identityServicesB = {
  ...runtimeServices(identityWindow, 'identity-b'),
  __contextRuntimeIdentity: sharedRuntimeIdentity,
};
const identityContextB = resolveWindowContentContext({
  existingContext: getWindowContext(identityWindowId),
  hookContext: Context(identityWindowId, metadata, 'lookup', identityServicesB),
  metadata,
  services: identityServicesB,
  windowState: identityWindow,
});
assert.equal(
  identityContextB,
  identityContextA,
  'equivalent runtime wrappers must preserve Context when their explicit identity is unchanged',
);
const identityServicesC = {
  ...runtimeServices(identityWindow, 'identity-c'),
  __contextRuntimeIdentity: {},
};
const identityContextC = resolveWindowContentContext({
  existingContext: getWindowContext(identityWindowId),
  hookContext: Context(identityWindowId, metadata, 'lookup', identityServicesC),
  metadata,
  services: identityServicesC,
  windowState: identityWindow,
});
assert.notEqual(
  identityContextC,
  identityContextA,
  'a changed explicit runtime identity must replace Context',
);
clearWindowContext(identityWindowId);

const windowContentSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/WindowContent.jsx'),
  'utf8',
);
assert.equal(
  windowContentSource.includes('const context = resolveWindowContentContext({')
    && windowContentSource.includes('existingContext,')
    && windowContentSource.includes('hookContext,')
    && windowContentSource.includes('services,')
    && windowContentSource.includes('windowState: services?.windowState || window,'),
  true,
  'WindowContent must use the runtime-current context selector at the registry reuse boundary',
);

console.log('Context ✓ preserves selectionMode overrides for dataSource handlers');

// Real Context uses mode-qualified cache keys. Authored datasource prefixes
// must resolve against declarations even before the default context is cached.
const {resolveParameters: resolveCachedParameters} = await import('../../hooks/parameters.js');
const parameterCacheRoot = Context('W_ctx_parameter_prefix', {
  actions: {import: () => ({})}, view: {},
  dataSource: {current: {selectors: {}}, detail: {selectors: {}, selectionMode: 'single'}},
}, 'current', {});
parameterCacheRoot.init();
const parameterCurrent = parameterCacheRoot.Context('current');
const parameterDetail = parameterCacheRoot.Context('detail', {selectionMode: 'multi'});
parameterCurrent.signals.input.value = {parameters: {Items: [{id: 7}]}};
parameterDetail.signals.input.value = {args: {Id: [42]}, filter: {state: 'active'}};
parameterDetail.signals.form.value = {name: 'Synthetic detail'};
parameterDetail.signals.selection.value = {selected: {id: 42}, rowIndex: 0};
parameterDetail.signals.metrics.value = {total: 2};
assert.equal(parameterCacheRoot.dataSources.detail, undefined);
assert.ok(parameterCacheRoot.dataSources['detail::multi']);
assert.deepEqual(resolveCachedParameters([
  {name: 'Id', in: 'input', location: 'detail.args.Id', codec: {name: 'int[]'}},
  {name: 'name', in: 'form', location: 'detail.name'},
  {name: 'selectedId', in: 'selection', location: 'detail.id'},
  {name: 'total', in: 'metrics', location: 'detail.total'},
  {name: 'state', in: 'filter', location: 'detail.state'},
  {name: 'Items', in: 'input', location: 'parameters.Items'},
], parameterCurrent), {Id: [42], name: 'Synthetic detail', selectedId: 42, total: 2, state: 'active', Items: [{id: 7}]});
parameterCacheRoot.dispose();
console.log('parameter prefixes resolve from the declared graph with mode-qualified Context caches');
