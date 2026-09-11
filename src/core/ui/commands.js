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
    case 'ui.controls.list': {
      const windowId = params.windowId || undefined;
      const dataSourceRef = params.dataSourceRef || undefined;
      const controls = listControlTargets({ windowId, dataSourceRef });
      return { controls };
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
      const windowId = requireString('windowId', params.windowId);
      removeWindow(windowId);
      return { ok: true };
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
      if (params.workspaceObject && w.workspaceObject) {
        activeWindows.value = activeWindows.peek().map((entry) => entry.windowId === windowId ? {...entry,
          hostOpenState: 'fresh', workspaceObject: {...entry.workspaceObject,
            lastActivatedBy: params.workspaceObject.lastActivatedBy,
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
      const operations = Array.isArray(params.operations) ? params.operations : [];
      if (operations.length === 0) throw new Error('operations are required');
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
      const windowId = requireString('windowId', params.windowId);
      const tabId = requireString('tabId', params.tabId);
      const w = getWindowById(windowId);
      if (!w) throw new Error(`window not found: ${windowId}`);
      const containerId = params.containerId ? requireString('containerId', params.containerId) : undefined;
      const viewSignal = getViewSignal(windowId);
      const previous = viewSignal.peek() || {};
      const nextTabs = {
        ...(previous?.tabs || {}),
        ...(containerId ? { [containerId]: tabId } : {}),
      };
      viewSignal.value = {
        ...previous,
        tabs: nextTabs,
      };
      sendBusMessage(windowId, { type: 'selectTab', tabId, containerId });
      if (params.activate !== false) {
        selectedWindowId.value = windowId;
        if (w.inTab !== false) selectedTabId.value = windowId;
        if (w.inTab === false) bringFloatingWindowToFront(windowId);
      }
      return { ok: true };
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

    case 'ui.control.setValue': {
      const windowId = requireString('windowId', params.windowId);
      const controlId = requireString('controlId', params.controlId);
      const item = {
        id: controlId,
        bindingPath: params.bindingPath || controlId,
        dataField: params.dataField,
      };
      const value = params.value;
      const scope = String(params.scope || 'form').trim() || 'form';

      if (scope === 'filter') {
        const { dataSourceId } = getDataSourceId(windowId, params.dataSourceRef);
        const input = getInputSignal(dataSourceId);
        const prev = input.peek() || {};
        const filterPrev = prev.filter || {};
        const fieldKey = item.dataField || item.bindingPath || item.id;
        input.value = {
          ...prev,
          filter: setSelector(filterPrev, fieldKey, value),
        };
      } else if (scope === 'windowForm') {
        const windowForm = getFormSignal(`${windowId}:windowForm`);
        const fieldKey = item.dataField || item.bindingPath || item.id;
        windowForm.value = setSelector(windowForm.peek() || {}, fieldKey, value);
      } else {
        const { dataSourceId } = getDataSourceId(windowId, params.dataSourceRef);
        const form = getFormSignal(dataSourceId);
        const fieldKey = item.dataField || item.bindingPath || item.id;
        form.value = setSelector(form.peek() || {}, fieldKey, value);

        const st = getFormStatusSignal(dataSourceId);
        const prev = st.peek() || {};
        if (prev.dirty !== true) {
          st.value = { ...prev, dirty: true };
        }
      }
      return { ok: true };
    }

    // ------------------------------------------------------------------
    // Filtering / data
    // ------------------------------------------------------------------
    case 'ui.filter.set': {
      const windowId = requireString('windowId', params.windowId);
      const { dataSourceId } = getDataSourceId(windowId, params.dataSourceRef);
      const input = getInputSignal(dataSourceId);
      const prev = input.peek() || {};
      const patch = params.patch || {};
      const fetch = params.fetch !== false;
      input.value = {
        ...prev,
        filter: { ...(prev.filter || {}), ...patch },
        fetch,
      };
      return { ok: true };
    }
    case 'ui.data.fetch': {
      const windowId = requireString('windowId', params.windowId);
      const { dataSourceId } = getDataSourceId(windowId, params.dataSourceRef);
      const input = getInputSignal(dataSourceId);
      input.value = { ...(input.peek() || {}), fetch: true };
      return { ok: true };
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
      const selection = getSelectionSignal(
        dataSourceId,
        selectionMode === 'multi' ? { selection: [] } : { selected: null, rowIndex: -1 }
      );
      if (selectionMode === 'multi') {
        selection.value = { selection: matches.map(({ row }) => row) };
      } else {
        const [{ row, rowIndex }] = matches;
        selection.value = { selected: row, rowIndex };
        const form = getFormSignal(dataSourceId);
        const status = getFormStatusSignal(dataSourceId);
        form.value = { ...(row || {}) };
        status.value = { ...(status.peek() || {}), dirty: false, version: (status.peek()?.version || 0) + 1 };
      }
      return {
        ok: true,
        windowId,
        dataSourceRef,
        selectionMode,
        identityFields,
        selectedIdentities,
        rowIndexes,
      };
    }

    // ------------------------------------------------------------------
    // Table selection (row index)
    // ------------------------------------------------------------------
    case 'ui.table.selectRow': {
      const windowId = requireString('windowId', params.windowId);
      const rowIndex = params.rowIndex;
      if (!Number.isInteger(rowIndex) || rowIndex < 0) {
        throw new Error('rowIndex must be a non-negative integer');
      }
      const { dataSourceId, dataSourceRef } = getDataSourceId(windowId, params.dataSourceRef);
      const meta = getMetadataSignal(windowId).peek();
      const dsCfg = meta?.dataSource?.[dataSourceRef] || {};
      const selectionMode = dsCfg.selectionMode || 'single';

      const items = getCollectionSignal(dataSourceId).peek() || [];
      const row = items[rowIndex];
      if (row === undefined) throw new Error(`rowIndex out of range: ${rowIndex}`);

      const selection = getSelectionSignal(
        dataSourceId,
        selectionMode === 'multi' ? { selection: [] } : { selected: null, rowIndex: -1 }
      );
      const form = getFormSignal(dataSourceId);
      const st = getFormStatusSignal(dataSourceId);

      if (selectionMode === 'multi') {
        const prev = selection.peek() || { selection: [] };
        const arr = Array.isArray(prev.selection) ? prev.selection : [];
        const next = arr.includes(row) ? arr.filter((r) => r !== row) : [...arr, row];
        selection.value = { selection: next };
      } else {
        selection.value = { selected: row, rowIndex };
        form.value = { ...(row || {}) };
        st.value = { ...(st.peek() || {}), dirty: false, version: (st.peek()?.version || 0) + 1 };
      }
      return { ok: true };
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
      return runUICommand({ method: 'ui.table.selectRow', params: { windowId, dataSourceRef, rowIndex } });
    }

    // ------------------------------------------------------------------
    // File browser helpers (tree selection by uri)
    // ------------------------------------------------------------------
    case 'ui.fileBrowser.openFolder': {
      const windowId = requireString('windowId', params.windowId);
      const uri = requireString('uri', params.uri);
      return runUICommand({
        method: 'ui.filter.set',
        params: { windowId, dataSourceRef: params.dataSourceRef, patch: { uri }, fetch: true },
      });
    }

    case 'ui.fileBrowser.selectUri': {
      const windowId = requireString('windowId', params.windowId);
      const uri = requireString('uri', params.uri);
      const { dataSourceId, dataSourceRef } = getDataSourceId(windowId, params.dataSourceRef);
      const meta = getMetadataSignal(windowId).peek();
      const dsCfg = meta?.dataSource?.[dataSourceRef] || {};

      const collection = getCollectionSignal(dataSourceId).peek() || [];
      const found = findNodePathByUri(collection, uri);
      if (!found) {
        if (params.openParents !== false) {
          await runUICommand({
            method: 'ui.fileBrowser.openFolder',
            params: { windowId, dataSourceRef, uri },
          });
        }
        return { ok: false, error: 'not found in current collection', requested: uri };
      }

      const selectionMode = dsCfg.selectionMode || 'single';
      const selection = getSelectionSignal(
        dataSourceId,
        selectionMode === 'multi' ? { selection: [] } : { selected: null, nodePath: null, rowIndex: -1 }
      );
      const form = getFormSignal(dataSourceId);
      const st = getFormStatusSignal(dataSourceId);

      if (dsCfg.selfReference) {
        if (selectionMode === 'multi') {
          const prev = selection.peek() || { selection: [] };
          const arr = Array.isArray(prev.selection) ? prev.selection : [];
          const exists = arr.some((it) => JSON.stringify(it?.nodePath || []) === JSON.stringify(found.nodePath));
          const next = exists
            ? arr.filter((it) => JSON.stringify(it?.nodePath || []) !== JSON.stringify(found.nodePath))
            : [...arr, { selected: found.node, nodePath: found.nodePath }];
          selection.value = { selection: next };
        } else {
          selection.value = { selected: found.node, nodePath: found.nodePath };
          form.value = { ...(found.node || {}) };
          st.value = { ...(st.peek() || {}), dirty: false, version: (st.peek()?.version || 0) + 1 };
        }
      } else {
        const idx = collection.findIndex((n) => (n?.uri || n?.url) === uri);
        if (idx >= 0) {
          selection.value = selectionMode === 'multi' ? { selection: [collection[idx]] } : { selected: collection[idx], rowIndex: idx };
          form.value = { ...(collection[idx] || {}) };
          st.value = { ...(st.peek() || {}), dirty: false, version: (st.peek()?.version || 0) + 1 };
        }
      }
      return { ok: true, nodePath: found.nodePath };
    }

    case 'ui.fileBrowser.openFile': {
      const windowId = requireString('windowId', params.windowId);
      const uri = requireString('uri', params.uri);
      return runUICommand({ method: 'ui.fileBrowser.selectUri', params: { windowId, dataSourceRef: params.dataSourceRef, uri } });
    }

    // ------------------------------------------------------------------
    // Dialog helpers (uses runtime Context when available)
    // ------------------------------------------------------------------
    case 'ui.dialog.open': {
      const windowId = requireString('windowId', params.windowId);
      const dialogId = requireString('dialogId', params.dialogId);
      try {
        const base = getWindowContext(windowId);
        const dsRef = params.dataSourceRef || base?.identity?.dataSourceRef || getDefaultDsRef(windowId);
        const ctx = base?.Context?.(dsRef);
        const opts = params.options || {};
        const execArgs = [dialogId, opts];
        const execution = { args: execArgs, parameters: opts.parameters || [] };
        const ret = ctx?.handlers?.window?.openDialog?.({ execution, context: ctx });
        if (opts.awaitResult) {
          const payload = await ret;
          return { ok: true, payload };
        }
        return { ok: true };
      } catch (e) {
        const meta = getMetadataSignal(windowId).peek();
        const dialogs = meta?.dialogs || [];
        const dialog = dialogs.find((d) => d?.id === dialogId);
        if (!dialog) throw new Error(`dialog not found: ${dialogId}`);
        const sigId = `${windowId}Dialog${dialogId}`;
        const sig = getDialogSignal(sigId);
        sig.value = { ...(sig.peek() || {}), open: true, args: params.args || {}, props: params.props || {} };
        return { ok: true, fallback: true };
      }
    }

    case 'ui.dialog.close': {
      const windowId = requireString('windowId', params.windowId);
      const dialogId = requireString('dialogId', params.dialogId);
      try {
        const base = getWindowContext(windowId);
        const dsRef = params.dataSourceRef || base?.identity?.dataSourceRef || getDefaultDsRef(windowId);
        const ctx = base?.Context?.(dsRef);
        ctx?.handlers?.window?.closeDialog?.({ dialogId, context: ctx });
        return { ok: true };
      } catch (_) {
        const sig = getDialogSignal(`${windowId}Dialog${dialogId}`);
        sig.value = { ...(sig.peek() || {}), open: false };
        return { ok: true, fallback: true };
      }
    }

    case 'ui.dialog.commit': {
      const windowId = requireString('windowId', params.windowId);
      const dialogId = requireString('dialogId', params.dialogId);
      const payload = params.payload;
      const base = getWindowContext(windowId);
      if (!base) throw new Error(`window context not found: ${windowId}`);
      const meta = getMetadataSignal(windowId).peek();
      const dialog = (meta?.dialogs || []).find((d) => d?.id === dialogId);
      if (!dialog) throw new Error(`dialog not found: ${dialogId}`);
      const viewRef = meta?.view?.dataSourceRef || Object.keys(meta?.dataSource || {})[0];
      const dsCtx = base.dialogContext?.(dialog, dialog.dataSourceRef || viewRef);
      if (!dsCtx?.handlers?.dialog?.commit) throw new Error(`dialog handlers not available: ${dialogId}`);
      dsCtx.handlers.dialog.commit({ payload, context: dsCtx });
      return { ok: true };
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
