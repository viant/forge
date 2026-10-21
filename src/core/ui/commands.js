import {refreshWorkspace,listWorkspaceRefreshCapabilities} from './workspaceRefresh.js';
import {invokeRegisteredControlAction,readRegisteredControlActions} from './controlActions.js';
import {assertOperationTarget,getOperationRevision} from './operationRevision.js';
import { waitForWorkspaceReady } from './workspaceReady.js';
import {
  addWindow,
  removeWindow,
  dockWindow,
  undockWindow,
  bringFloatingWindowToFront,
  activeWindows,
  selectedTabId,
  selectedWindowId,
  getMetadataSignal,
  getInputSignal,
  getFormSignal,
  getSelectionSignal,
  getCollectionSignal,
  getMetricsSignal,
  getControlSignal,
  getViewSignal,
  getBusSignal,
  getDashboardFilterSignal,
  getDashboardSelectionSignal,
  getFormStatusSignal,
  getDialogSignal,
} from '../store/signals.js';

import { focusControl, listControlTargets, getFocusedControlMeta, enableFocusTracking } from './registry.js';
import { sendBusMessage } from '../bus.js';
import { setSelector } from '../../utils/selector.js';
import { resolveSelector } from '../../utils/selector.js';
import { buildStandaloneDashboardDocument, buildStandaloneDashboardHtml, downloadDashboardHtml } from './dashboardExport.js';
import { createDashboardDemoBundle, createDashboardDemoMetadata, createDashboardDemoSeed, DEFAULT_DASHBOARD_DEMO_VARIANT, listDashboardDemoVariants } from './dashboardDemo.js';
import { buildDashboardDemoStandaloneHtml, getDashboardDemoExportFilename, listDashboardDemoArtifacts } from './dashboardDemoArtifacts.js';
import { DASHBOARD_BLOCK_KINDS, DASHBOARD_CHART_TYPES, DASHBOARD_COMMANDS, DASHBOARD_METADATA_SCHEMA } from './dashboardCapabilities.js';
import { getWindowContext } from '../context/registry.js';
import { buildDashboardDefaultFilters, setDashboardSelectionState } from '../../components/dashboard/dashboardUtils.js';
import { mergeWindowFormValues, withWindowFormPrefillRevision } from '../../hooks/dataSource.js';
import { invokeReportWindowAction } from './reportActions.js';

function requireString(name, v) {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return v;
}

function getWindowById(windowId) {
  return (activeWindows.peek() || []).find((w) => w.windowId === windowId) || null;
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function pressKeyBrowserOnly(key, opts = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('keyboard commands require a browser environment');
  }
  const eventInit = {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: !!opts.ctrlKey,
    shiftKey: !!opts.shiftKey,
    altKey: !!opts.altKey,
    metaKey: !!opts.metaKey,
  };
  const ev = new KeyboardEvent(opts.type || 'keydown', eventInit);
  const el = document.activeElement || window;
  try {
    el.dispatchEvent(ev);
  } catch (_) {
    window.dispatchEvent(ev);
  }
  return true;
}

function getDefaultDsRef(windowId) {
  try {
    const meta = getMetadataSignal(windowId).peek();
    const view = meta?.view || {};
    if (view.dataSourceRef) return view.dataSourceRef;
    const keys = Object.keys(meta?.dataSource || {});
    return keys[0] || null;
  } catch (_) {
    return null;
  }
}

function getDataSourceId(windowId, dataSourceRef) {
  const dsRef = dataSourceRef || getDefaultDsRef(windowId);
  if (!dsRef) throw new Error(`dataSourceRef not found for window: ${windowId}`);
  return { dataSourceRef: dsRef, dataSourceId: `${windowId}DS${dsRef}` };
}

function getDashboardKey(windowId, dashboardId) {
  if (dashboardId) {
    return `${windowId}:${dashboardId}`;
  }
  const metadata = getMetadataSignal(windowId).peek();
  const containerId = metadata?.view?.content?.id || 'dashboard';
  return `${windowId}:${containerId}`;
}

function seedDataSource(windowId, dataSourceRef, seed = {}) {
  const dataSourceId = `${windowId}DS${dataSourceRef}`;
  if (seed.collection) {
    getCollectionSignal(dataSourceId).value = seed.collection;
  }
  if (seed.metrics) {
    getMetricsSignal(dataSourceId).value = seed.metrics;
  }
  getControlSignal(dataSourceId).value = { loading: false, error: null };
}

function createDashboardExportContext(windowId, metadata, dataSourceRef, dashboardKey) {
  const defaultDsRef = dataSourceRef || metadata?.view?.dataSourceRef || Object.keys(metadata?.dataSource || {})[0];
  const makeContext = (dsRef) => {
    const actualDsRef = dsRef || defaultDsRef;
    const dataSourceId = `${windowId}DS${actualDsRef}`;
    const nextDashboardKey = dashboardKey || `${windowId}:${metadata?.view?.content?.id || 'dashboard'}`;
    const ctx = {
      identity: {
        windowId,
        dataSourceRef: actualDsRef,
        dataSourceId,
        dashboardKey: nextDashboardKey,
      },
      dashboardKey: nextDashboardKey,
      locale: metadata?.view?.content?.locale || 'en-US',
      metadata,
      signals: {
        metrics: getMetricsSignal(dataSourceId),
        collection: getCollectionSignal(dataSourceId),
        control: getControlSignal(dataSourceId),
      },
      Context(nextDsRef) {
        return makeContext(nextDsRef);
      },
    };

    Object.defineProperties(ctx, {
      dashboardSelection: {
        enumerable: true,
        get() {
          return getDashboardSelectionSignal(nextDashboardKey).peek();
        },
      },
      dashboardFilters: {
        enumerable: true,
        get() {
          return getDashboardFilterSignal(nextDashboardKey).peek();
        },
      },
    });

    return ctx;
  };

  return makeContext(defaultDsRef);
}

function computeUniqueKeyValue(record, uniqueKey = []) {
  if (!uniqueKey || uniqueKey.length === 0) return null;
  if (!record) return null;
  if (uniqueKey.length === 1) {
    const field = uniqueKey[0]?.field;
    return field ? String(resolveSelector(record, field) ?? '') : null;
  }
  return uniqueKey
    .map((k) => String(resolveSelector(record, k?.field) ?? ''))
    .join('_');
}

function getIdentityFields(dataSource, requestedFields) {
  const rawFields = Array.isArray(requestedFields) && requestedFields.length > 0
    ? requestedFields
    : (Array.isArray(dataSource?.uniqueKey) ? dataSource.uniqueKey : []);
  const fields = rawFields
    .map((item) => String(typeof item === 'string' ? item : (item?.field || '')).trim())
    .filter(Boolean);
  if (fields.length === 0) {
    throw new Error('identityFields are required when the datasource has no uniqueKey');
  }
  if (new Set(fields).size !== fields.length) {
    throw new Error('identityFields must be unique');
  }
  return fields;
}

function resolveIdentityField(holder, field) {
  if (holder != null && typeof holder === 'object' && Object.prototype.hasOwnProperty.call(holder, field)) {
    return holder[field];
  }
  return resolveSelector(holder, field);
}

function normalizeIdentity(identity, fields) {
  if (identity == null) throw new Error('identity values cannot be null');
  if (typeof identity !== 'object' || Array.isArray(identity)) {
    if (fields.length !== 1) {
      throw new Error('composite identities must be objects keyed by identityFields');
    }
    return { [fields[0]]: identity };
  }
  const normalized = {};
  for (const field of fields) {
    const value = resolveIdentityField(identity, field);
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      throw new Error(`identity field is required: ${field}`);
    }
    normalized[field] = value;
  }
  return normalized;
}

function identityValueEquals(actual, requested) {
  if (actual === requested) return true;
  if (actual == null || requested == null) return false;
  if (typeof actual === 'object' || typeof requested === 'object') {
    return JSON.stringify(actual) === JSON.stringify(requested);
  }
  return String(actual) === String(requested);
}

function rowMatchesIdentity(row, identity, fields) {
  return fields.every((field) => identityValueEquals(resolveIdentityField(row, field), identity[field]));
}

function observeIdentity(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, resolveIdentityField(row, field)]));
}

function findNodePathByUri(nodes, uri, path = []) {
  if (!Array.isArray(nodes)) return null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const u = node?.uri || node?.url;
    const nextPath = [...path, i];
    if (u === uri) return { node, nodePath: nextPath };
    const children = node?.childNodes;
    const found = findNodePathByUri(children, uri, nextPath);
    if (found) return found;
  }
  return null;
}

export async function runUICommand(cmd = {}) {
  const { method, params = {} } = cmd || {};
  requireString('method', method);

  switch (method) {
    // ------------------------------------------------------------------
    // Focus info
    // ------------------------------------------------------------------
    case 'ui.focus.get': {
      enableFocusTracking();
      return { focused: getFocusedControlMeta() };
    }
    // ------------------------------------------------------------------
    // Control registry introspection
    // ------------------------------------------------------------------
    case 'ui.controls.list':
    case 'ui.controls.get': {
      requireString('windowId',params.windowId);
      assertOperationTarget(params);
      return {...readRegisteredControlActions(params),operationRevision:getOperationRevision(params.windowId)};
    }

    case 'ui.controls.search': {
      const q = String(params.query || params.q || '').trim().toLowerCase();
      const windowId = params.windowId || undefined;
      const dataSourceRef = params.dataSourceRef || undefined;
      const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(200, params.limit)) : 50;
      const candidates = listControlTargets({ windowId, dataSourceRef });
      if (!q) return { controls: candidates.slice(0, limit) };

      const hit = (c) => {
        const hay = [
          c.controlId,
          c.label,
          c.type,
          c.scope,
          c.dataSourceRef,
          c.windowId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      };

      const controls = candidates.filter(hit).slice(0, limit);
      return { controls };
    }

    case 'ui.dashboard.exportHtml': {
      const model = params.model || {};
      const filename = params.filename || 'dashboard.html';
      const html = buildStandaloneDashboardHtml(model);
      if (params.download !== false) {
        downloadDashboardHtml({ html, filename });
      }
      return { ok: true, filename, html };
    }

    case 'ui.dashboard.exportFromContainer': {
      const filename = params.filename || 'dashboard.html';
      const { model, html } = buildStandaloneDashboardDocument({
        container: params.container,
        context: params.context,
        chartSvgs: params.chartSvgs,
        rootElement: params.rootElement || (typeof document !== 'undefined' && params.rootSelector ? document.querySelector(params.rootSelector) : null),
        title: params.title,
        subtitle: params.subtitle,
        generatedAt: params.generatedAt,
      });
      if (params.download !== false) {
        downloadDashboardHtml({ html, filename });
      }
      return { ok: true, filename, model, html };
    }

    case 'ui.dashboard.openDemo': {
      const variant = params.variant || DEFAULT_DASHBOARD_DEMO_VARIANT;
      const { metadata, seed } = createDashboardDemoBundle(variant);
      const windowKey = params.windowKey || `dashboard-demo-${randomSuffix()}`;
      const windowTitle = params.windowTitle || params.title || 'Dashboard Demo';
      const rawOptions = params.options || {};
      const parentKey = rawOptions.parentKey || params.parentKey || selectedWindowId.peek() || 'root';
      const inTab = params.inTab !== false;
      const options = {
        ...rawOptions,
        inlineMetadata: metadata,
        newInstance: true,
      };
      const win = addWindow(windowTitle, parentKey, windowKey, params.windowData || '', inTab, params.parameters || {}, options);
      Object.entries(seed).forEach(([dataSourceRef, value]) => seedDataSource(win.windowId, dataSourceRef, value));
      return { ok: true, windowId: win?.windowId || null, windowKey, variant };
    }

    case 'ui.dashboard.listDemos': {
      return {
        ok: true,
        demos: listDashboardDemoVariants(),
      };
    }

    case 'ui.dashboard.getDemo': {
      const variant = params.variant || DEFAULT_DASHBOARD_DEMO_VARIANT;
      const bundle = createDashboardDemoBundle(variant);
      return {
        ok: true,
        variant,
        metadata: bundle.metadata,
        seed: bundle.seed,
      };
    }

    case 'ui.dashboard.capabilities': {
      return {
        ok: true,
        blockKinds: DASHBOARD_BLOCK_KINDS,
        chartTypes: DASHBOARD_CHART_TYPES,
        commands: DASHBOARD_COMMANDS,
        schema: DASHBOARD_METADATA_SCHEMA,
        demos: listDashboardDemoVariants(),
      };
    }

    case 'ui.dashboard.listDemoArtifacts': {
      return {
        ok: true,
        artifacts: listDashboardDemoArtifacts(),
      };
    }

    case 'ui.dashboard.generateDemoArtifacts': {
      const variants = Array.isArray(params.variants) && params.variants.length > 0
        ? params.variants
        : listDashboardDemoArtifacts().map((artifact) => artifact.id);

      const artifacts = variants.map((variant) => {
        const { model, html } = buildDashboardDemoStandaloneHtml(variant, {
          generatedAt: params.generatedAt,
          locale: params.locale,
        });
        return {
          id: variant,
          filename: getDashboardDemoExportFilename(variant),
          title: model?.title || variant,
          html,
          model,
        };
      });

      return {
        ok: true,
        artifacts,
      };
    }

    case 'ui.dashboard.exportWindow': {
      const windowId = requireString('windowId', params.windowId);
      const metadata = params.metadata || getMetadataSignal(windowId).peek() || getWindowById(windowId)?.inlineMetadata;
      const container = metadata?.view?.content;
      if (!container) {
        throw new Error(`window view content not found: ${windowId}`);
      }
      const dsRef = params.dataSourceRef || metadata?.view?.dataSourceRef || getDefaultDsRef(windowId);
      const context = params.context || createDashboardExportContext(windowId, metadata, dsRef, `${windowId}:${container.id || 'dashboard'}`);
      const rootElement = params.rootElement
        || (typeof document !== 'undefined' ? document.querySelector(`[data-window-id="${windowId}"]`) : null);
      const filename = params.filename || `${windowId}-dashboard.html`;
      const { model, html } = buildStandaloneDashboardDocument({
        container,
        context,
        rootElement,
        title: params.title || container?.title,
        subtitle: params.subtitle || container?.subtitle,
        generatedAt: params.generatedAt,
      });
      if (params.download !== false) {
        downloadDashboardHtml({ html, filename });
      }
      return { ok: true, filename, model, html };
    }

    case 'ui.dashboard.filter.set': {
      const windowId = requireString('windowId', params.windowId);
      const dashboardKey = params.dashboardKey || getDashboardKey(windowId, params.dashboardId);
      const filterSignal = getDashboardFilterSignal(dashboardKey);
      const prev = filterSignal.peek() || {};
      const patch = params.patch || {};
      filterSignal.value = {
        ...prev,
        ...patch,
      };
      return { ok: true, dashboardKey, filters: filterSignal.value };
    }

    case 'ui.dashboard.filter.clear': {
      const windowId = requireString('windowId', params.windowId);
      const dashboardKey = params.dashboardKey || getDashboardKey(windowId, params.dashboardId);
      const filterSignal = getDashboardFilterSignal(dashboardKey);
      if (Array.isArray(params.fields) && params.fields.length > 0) {
        const next = { ...(filterSignal.peek() || {}) };
        params.fields.forEach((field) => {
          delete next[field];
        });
        filterSignal.value = next;
      } else {
        filterSignal.value = {};
      }
      return { ok: true, dashboardKey, filters: filterSignal.value };
    }

    case 'ui.dashboard.selection.set': {
      const windowId = requireString('windowId', params.windowId);
      const dashboardKey = params.dashboardKey || getDashboardKey(windowId, params.dashboardId);
      const payload = setDashboardSelectionState({
        windowId,
        dashboardKey,
        dimension: params.dimension || null,
        entityKey: params.entityKey ?? null,
        pointKey: params.pointKey ?? null,
        selected: params.selected ?? null,
        sourceBlockId: params.sourceBlockId || null,
      });
      return { ok: true, dashboardKey, selection: payload };
    }

    case 'ui.dashboard.selection.clear': {
      const windowId = requireString('windowId', params.windowId);
      const dashboardKey = params.dashboardKey || getDashboardKey(windowId, params.dashboardId);
      const payload = setDashboardSelectionState({
        windowId,
        dashboardKey,
        dimension: null,
        entityKey: null,
        pointKey: null,
        selected: null,
        sourceBlockId: params.sourceBlockId || null,
      });
      return { ok: true, dashboardKey, selection: payload };
    }

    case 'ui.dashboard.state.get': {
      const windowId = requireString('windowId', params.windowId);
      const metadata = params.metadata || getMetadataSignal(windowId).peek() || getWindowById(windowId)?.inlineMetadata || {};
      const dashboardId = params.dashboardId || metadata?.view?.content?.id || 'dashboard';
      const dashboardKey = params.dashboardKey || getDashboardKey(windowId, dashboardId);
      const container = metadata?.view?.content || null;
      return {
        ok: true,
        windowId,
        dashboardId,
        dashboardKey,
        filters: getDashboardFilterSignal(dashboardKey).peek() || {},
        selection: getDashboardSelectionSignal(dashboardKey).peek() || {},
        title: container?.title || '',
        blockIds: Array.isArray(container?.containers) ? container.containers.map((block) => block?.id).filter(Boolean) : [],
      };
    }

    case 'ui.dashboard.state.reset': {
      const windowId = requireString('windowId', params.windowId);
      const metadata = params.metadata || getMetadataSignal(windowId).peek() || getWindowById(windowId)?.inlineMetadata || {};
      const container = metadata?.view?.content || null;
      const dashboardId = params.dashboardId || container?.id || 'dashboard';
      const dashboardKey = params.dashboardKey || getDashboardKey(windowId, dashboardId);
      const defaultFilters = buildDashboardDefaultFilters(container);
      const filterSignal = getDashboardFilterSignal(dashboardKey);
      filterSignal.value = defaultFilters;
      const payload = setDashboardSelectionState({
        windowId,
        dashboardKey,
        dimension: null,
        entityKey: null,
        pointKey: null,
        selected: null,
        sourceBlockId: params.sourceBlockId || 'ui.dashboard.state.reset',
      });

      return {
        ok: true,
        dashboardId,
        dashboardKey,
        filters: filterSignal.value,
        selection: payload,
      };
    }

    // ------------------------------------------------------------------
    // Windows
    // ------------------------------------------------------------------
    case 'ui.window.open': {
      const windowKey = requireString('windowKey', params.windowKey);
      const windowTitle = params.windowTitle || params.title || windowKey;
      const options = params.options || {};
      const parentKey = options.parentKey || params.parentKey || selectedWindowId.peek() || 'root';
      const inTab = params.inTab !== false;
      const windowData = params.windowData || '';
      const win = addWindow(windowTitle, parentKey, windowKey, windowData, inTab, params.parameters || {}, {
        ...options,
        windowId: params.windowId || options.windowId,
      });
      // Seed a declared list search before the hosted window's datasource
      // effect runs, so opening a filtered list needs only one UI command.
      if (win?.windowId && params.initialFilters && typeof params.initialFilters === 'object') {
        for (const [dataSourceRef, filter] of Object.entries(params.initialFilters)) {
          if (!dataSourceRef || !filter || typeof filter !== 'object' || Array.isArray(filter)) continue;
          const input = getInputSignal(`${win.windowId}DS${dataSourceRef}`);
          const previous = input.peek() || {};
          input.value = {...previous, filter: {...(previous.filter || {}), ...filter}, page: 1, fetch: true};
        }
      }
      if (options.workspaceObject && win?.windowId) {
        const workspaceObject = await waitForWorkspaceReady(activeWindows, win.windowId);
        return { windowId: win.windowId, workspaceObject };
      }
      return { windowId: win?.windowId || null };
    }

    case 'ui.window.openDynamic': {
      const metadata = params.metadata;
      if (!metadata || typeof metadata !== 'object') throw new Error('metadata is required');

      const windowKey = params.windowKey || `dynamic__${randomSuffix()}`;
      const windowTitle = params.windowTitle || params.title || windowKey;
      const rawOptions = params.options || {};
      const parentKey = rawOptions.parentKey || params.parentKey || selectedWindowId.peek() || 'root';
      const inTab = params.inTab !== false;
      const windowData = params.windowData || '';
      const options = {
        ...rawOptions,
        inlineMetadata: metadata,
        newInstance: true,
      };
      const win = addWindow(windowTitle, parentKey, windowKey, windowData, inTab, params.parameters || {}, options);
      return { windowId: win?.windowId || null, windowKey };
    }

    case 'ui.window.close': {
      requireString('windowId',params.windowId);assertOperationTarget(params);
      const result=await invokeRegisteredControlAction({...params,controlId:'window:close'},'click');
      return {...result,...(getWindowById(params.windowId)?{operationRevision:getOperationRevision(params.windowId)}:{})};
    }
    case 'ui.window.setFormData': {
      const windowId = requireString('windowId', params.windowId);
      const values = params.values || params.parameters || {};
      if (!values || typeof values !== 'object' || Array.isArray(values)) {
        throw new Error('values must be an object');
      }
      const windowForm = getFormSignal(`${windowId}:windowForm`);
      const previous = windowForm.peek() || {};
      const replace = params.replace === true;
      const nextValues = withWindowFormPrefillRevision(previous, values);
      windowForm.value = replace ? nextValues : mergeWindowFormValues(previous, nextValues);
      return { ok: true };
    }
    case 'ui.window.activate': {
      const windowId = requireString('windowId', params.windowId);
      const w = getWindowById(windowId);
      if (!w) throw new Error(`window not found: ${windowId}`);
      if (['opening', 'failed'].includes(w.workspaceObject?.lifecycle?.state)) {
        await waitForWorkspaceReady(activeWindows, windowId);
      }
      if (params.workspaceObject) {
        activeWindows.value = activeWindows.peek().map((entry) => entry.windowId === windowId ? {...entry,
          hostOpenState: 'fresh', workspaceObject: {...params.workspaceObject,
            ...(entry.workspaceObject || {}), lastActivatedBy: params.workspaceObject.lastActivatedBy,
          },
        } : entry);
      }
      selectedWindowId.value = windowId;
      if (w.inTab !== false) selectedTabId.value = windowId;
      if (w.inTab === false) bringFloatingWindowToFront(windowId);
      return { ok: true };
    }
    case 'ui.feed.get': {
      const feedId = requireString('feedId', params.feedId);
      const conversationId = requireString('conversationId', params.conversationId);
      const refs = Array.isArray(params.dataSourceRefs) ? params.dataSourceRefs.map((value) => String(value || '').trim()).filter(Boolean) : [];
      if (refs.length === 0) throw new Error('dataSourceRefs are required');
      const windowId = `feed-${feedId}-${conversationId}`;
      const context = getWindowContext(windowId);
      if (context?.identity?.feedId !== feedId || context?.identity?.conversationId !== conversationId) throw new Error('active conversation feed is required');
      for (const ref of refs) if (!Object.prototype.hasOwnProperty.call(context.metadata?.dataSource || {}, ref)) throw new Error('feed datasource is unavailable');
      const dataSources = {};
      for (const ref of refs) {
        const { dataSourceId } = getDataSourceId(windowId, ref);
        dataSources[ref] = {
          form: getFormSignal(dataSourceId).peek() || {},
          collection: getCollectionSignal(dataSourceId).peek() || [],
          selection: getSelectionSignal(dataSourceId).peek() || {},
        };
      }
      return { feedId, conversationId, dataSources };
    }
    case 'ui.feed.update': {
      const feedId = requireString('feedId', params.feedId);
      const conversationId = requireString('conversationId', params.conversationId);
      const context = getWindowContext(`feed-${feedId}-${conversationId}`);
      if (context?.identity?.feedId !== feedId || context?.identity?.conversationId !== conversationId) throw new Error('active conversation feed is required');
      const operations = Array.isArray(params.operations) ? params.operations : [];
      if (operations.length === 0) throw new Error('operations are required');
      for (const operation of operations) if (!Object.prototype.hasOwnProperty.call(context.metadata?.dataSource || {}, operation.dataSourceRef)) throw new Error('feed datasource is unavailable');
      if (typeof window === 'undefined') throw new Error('feed updates require a browser client');
      window.dispatchEvent(new CustomEvent('forge:feed-update', {
        detail: {
          ...params,
          feedId,
          operations,
        },
      }));
      return { ok: true };
    }
    case 'ui.window.selectTab': {
      const windowId=requireString('windowId',params.windowId);
      requireString('tabId',params.tabId);
      assertOperationTarget(params);
      const result=await invokeRegisteredControlAction({...params,controlId:params.containerId},'selectTab');
      return {...result,operationRevision:getOperationRevision(windowId)};
    }
    case 'ui.window.dock': {
      const windowId = requireString('windowId', params.windowId);
      dockWindow(windowId);
      return { ok: true };
    }
    case 'ui.window.undock': {
      const windowId = requireString('windowId', params.windowId);
      undockWindow(windowId);
      return { ok: true };
    }

    // ------------------------------------------------------------------
    // Reports
    // ------------------------------------------------------------------
    case 'ui.report.getCurrent': {
      const windowId = requireString('windowId', params.windowId);
      return invokeReportWindowAction(windowId, 'getCurrent', params);
    }
    case 'ui.report.run': {
      const windowId = requireString('windowId', params.windowId);
      return invokeReportWindowAction(windowId, 'run', params);
    }
    case 'ui.report.save': {
      const windowId = requireString('windowId', params.windowId);
      return invokeReportWindowAction(windowId, 'save', params);
    }

    // ------------------------------------------------------------------
    // Focus / controls
    // ------------------------------------------------------------------
    case 'ui.focus.set': {
      const windowId = requireString('windowId', params.windowId);
      const controlId = requireString('controlId', params.controlId);
      const ok = focusControl({
        windowId,
        dataSourceRef: params.dataSourceRef || null,
        controlId,
      });
      if (!ok) throw new Error(`unable to focus control: ${controlId}`);
      return { ok: true };
    }

    case 'ui.workspace.refresh':
      return refreshWorkspace(params);
    case 'ui.workspace.refreshCapabilities':
      assertOperationTarget(params);
      return {capabilities:listWorkspaceRefreshCapabilities(params.windowId),operationRevision:getOperationRevision(params.windowId)};
    case 'ui.control.setValue':
    case 'ui.control.focus':
    case 'ui.control.click': {
      const windowId = requireString('windowId', params.windowId);
      requireString('controlId', params.controlId);
      assertOperationTarget(params);
      const result = await invokeRegisteredControlAction(params, method === 'ui.control.click' ? 'click' : method === 'ui.control.focus'?'focus':'setValue');
      return {...result,...(getWindowById(windowId)?{operationRevision:getOperationRevision(windowId)}:{})};
    }

    // ------------------------------------------------------------------
    // Filtering / data
    // ------------------------------------------------------------------
    case 'ui.filter.set':
    case 'ui.data.fetch': {
      const windowId=requireString('windowId',params.windowId);
      assertOperationTarget(params);
      const result=await invokeRegisteredControlAction(params,method==='ui.filter.set'?'applyFilter':'refresh');
      return {...result,operationRevision:getOperationRevision(windowId)};
    }

    // ------------------------------------------------------------------
    // Datasource selection (stable identity)
    // ------------------------------------------------------------------
    case 'ui.datasource.setSelection': {
      const windowId = requireString('windowId', params.windowId);
      if (!getWindowById(windowId)) throw new Error(`window not found: ${windowId}`);
      const dataSourceRef = requireString('dataSourceRef', params.dataSourceRef);
      const meta = getMetadataSignal(windowId).peek();
      const dsCfg = meta?.dataSource?.[dataSourceRef];
      if (!dsCfg) throw new Error(`datasource not found: ${dataSourceRef}`);

      const identities = Array.isArray(params.identities) ? params.identities : [];
      if (identities.length === 0) throw new Error('identities are required');
      const identityFields = getIdentityFields(dsCfg, params.identityFields);
      const normalizedIdentities = identities.map((identity) => normalizeIdentity(identity, identityFields));
      const selectionMode = String(dsCfg.selectionMode || 'single').trim().toLowerCase();
      if (selectionMode === 'none') throw new Error(`datasource does not support selection: ${dataSourceRef}`);
      if (selectionMode !== 'multi' && normalizedIdentities.length !== 1) {
        throw new Error('single-selection datasource requires exactly one identity');
      }

      const { dataSourceId } = getDataSourceId(windowId, dataSourceRef);
      const items = getCollectionSignal(dataSourceId).peek();
      if (!Array.isArray(items)) throw new Error(`datasource collection is not a row list: ${dataSourceRef}`);

      // Resolve every requested identity before mutating any signal. Missing,
      // ambiguous, and duplicate targets therefore leave the prior selection intact.
      const matches = normalizedIdentities.map((identity) => {
        const rowIndexes = [];
        for (let index = 0; index < items.length; index++) {
          if (rowMatchesIdentity(items[index], identity, identityFields)) rowIndexes.push(index);
        }
        const printable = JSON.stringify(identity);
        if (rowIndexes.length === 0) throw new Error(`no row found for identity: ${printable}`);
        if (rowIndexes.length > 1) throw new Error(`ambiguous row identity: ${printable}`);
        return { rowIndex: rowIndexes[0], row: items[rowIndexes[0]] };
      });
      if (new Set(matches.map(({ rowIndex }) => rowIndex)).size !== matches.length) {
        throw new Error('identities resolve to the same row');
      }

      const selectedIdentities = matches.map(({ row }) => observeIdentity(row, identityFields));
      const rowIndexes = matches.map(({ rowIndex }) => rowIndex);
      assertOperationTarget(params);
      await invokeRegisteredControlAction({...params,rows:matches.map(({row})=>row)},'selectRows');
      return {
        ok: true,
        windowId,
        dataSourceRef,
        selectionMode,
        identityFields,
        selectedIdentities,
        rowIndexes,
        operationRevision: getOperationRevision(windowId),
      };
    }

    // ------------------------------------------------------------------
    // Table selection (row index)
    // ------------------------------------------------------------------
    case 'ui.table.selectRow': {
      const windowId=requireString('windowId',params.windowId);
      assertOperationTarget(params);
      const {dataSourceId,dataSourceRef}=getDataSourceId(windowId,params.dataSourceRef);
      const rows=getCollectionSignal(dataSourceId).peek() || [];
      if(!Number.isInteger(params.rowIndex) || params.rowIndex<0 || !rows[params.rowIndex])throw new Error('rowIndex is outside the current collection');
      const result=await invokeRegisteredControlAction({...params,dataSourceRef,rows:[rows[params.rowIndex]]},'selectRows');
      return {...result,operationRevision:getOperationRevision(windowId)};
    }

    // ------------------------------------------------------------------
    // Table selection (unique key)
    // ------------------------------------------------------------------
    case 'ui.table.selectByKey': {
      const windowId = requireString('windowId', params.windowId);
      const key = params.key;
      if (key === undefined || key === null || String(key).trim() === '') {
        throw new Error('key is required');
      }
      const { dataSourceId, dataSourceRef } = getDataSourceId(windowId, params.dataSourceRef);
      const meta = getMetadataSignal(windowId).peek();
      const dsCfg = meta?.dataSource?.[dataSourceRef] || {};
      const uniqueKey = Array.isArray(params.uniqueKey) ? params.uniqueKey : (dsCfg.uniqueKey || []);

      const items = getCollectionSignal(dataSourceId).peek() || [];
      let rowIndex = -1;
      let row = null;

      const keyStr = String(key);
      for (let i = 0; i < items.length; i++) {
        const rec = items[i];
        const v = computeUniqueKeyValue(rec, uniqueKey);
        if (v !== null && String(v) === keyStr) {
          rowIndex = i;
          row = rec;
          break;
        }
      }
      if (rowIndex < 0) {
        throw new Error(`no row found for key: ${keyStr}`);
      }
      return runUICommand({ method: 'ui.table.selectRow', params: { ...params, windowId, dataSourceRef, rowIndex } });
    }

    // ------------------------------------------------------------------
    // File browser helpers (tree selection by uri)
    // ------------------------------------------------------------------
    case 'ui.fileBrowser.openFolder': {
      const windowId = requireString('windowId', params.windowId);
      const uri = requireString('uri', params.uri);
      return runUICommand({
        method: 'ui.filter.set',
        params: { ...params, windowId, dataSourceRef: params.dataSourceRef, patch: { uri }, fetch: true },
      });
    }

    case 'ui.fileBrowser.selectUri': {
      requireString('windowId',params.windowId);requireString('uri',params.uri);
      assertOperationTarget(params);
      const result=await invokeRegisteredControlAction(params,'selectUri');
      return {...result,operationRevision:getOperationRevision(params.windowId)};
    }

    case 'ui.fileBrowser.openFile': {
      const windowId = requireString('windowId', params.windowId);
      const uri = requireString('uri', params.uri);
      return runUICommand({ method: 'ui.fileBrowser.selectUri', params: { ...params, windowId, dataSourceRef: params.dataSourceRef, uri } });
    }

    // ------------------------------------------------------------------
    // Dialog helpers (uses runtime Context when available)
    // ------------------------------------------------------------------
    case 'ui.dialog.open':
    case 'ui.dialog.close': {
      const windowId = requireString('windowId', params.windowId);
      requireString('dialogId', params.dialogId);
      assertOperationTarget(params);
      // A dialog's authored trigger owns initialization, validation and guards.
      // Opening/closing raw dialog signals skips those callbacks and is unsafe.
      throw new Error('Direct dialog operation is unsupported; invoke its registered visible trigger or cancel control');
    }

    case 'ui.dialog.commit': {
      assertOperationTarget(params);
      throw new Error('Direct dialog commit is unsupported; invoke its registered visible confirmation control');
    }

    // ------------------------------------------------------------------
    // Keyboard / navigation (browser only)
    // ------------------------------------------------------------------
    case 'ui.key.press': {
      const key = requireString('key', params.key);
      pressKeyBrowserOnly(key, params);
      return { ok: true };
    }

    case 'ui.key.sequence': {
      const keys = params.keys;
      if (!Array.isArray(keys) || keys.length === 0) throw new Error('keys must be a non-empty array');
      for (const k of keys) {
        if (typeof k === 'string') {
          pressKeyBrowserOnly(k, params);
        } else if (k && typeof k === 'object') {
          pressKeyBrowserOnly(requireString('key', k.key), { ...params, ...k });
        }
      }
      return { ok: true };
    }

    default:
      throw new Error(`unsupported method: ${method}`);
  }
}
