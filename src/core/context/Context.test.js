import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {Context, resolveWindowContentContext} from './Context.jsx';
import {clearWindowContext, getWindowContext, setWindowContext} from './registry.js';
import {activeWindows, restoreWindowsFromSnapshot} from '../store/signals.js';
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
  },
  view: {},
};

const context = Context('W_ctx_override', metadata, 'lookup', {});
context.init();

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
          stewardReportBuilder: {
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
const lazyHandler = lazyContext.lookupHandler('Performance Metrics.stewardReportBuilder.buildRequest');
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
