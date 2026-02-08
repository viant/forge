import {
  activeWindows,
  selectedTabId,
  selectedWindowId,
  getMetadataSignal,
  getInputSignal,
  getControlSignal,
  getFormSignal,
  getSelectionSignal,
  getCollectionSignal,
  getCollectionInfoSignal,
  getMetricsSignal,
  getFormStatusSignal,
  getDialogSignal,
} from '../store/signals.js';

import { enableFocusTracking, getFocusedControlMeta } from './registry.js';

function toJSONValue(value, options, seen, depth) {
  const {
    maxDepth = 6,
    maxArray = 100,
    maxKeys = 200,
    maxString = 20000,
  } = options || {};

  if (depth > maxDepth) return '[MaxDepth]';
  if (value === null || value === undefined) return value;

  const type = typeof value;
  if (type === 'string') return value.length > maxString ? `${value.slice(0, maxString)}…` : value;
  if (type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return `${value}n`;
  if (type === 'function') return '[Function]';
  if (type === 'symbol') return value.toString();

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (type !== 'object') return String(value);

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const truncated = value.length > maxArray;
    const items = value.slice(0, maxArray).map((v) => toJSONValue(v, options, seen, depth + 1));
    return truncated ? { items, truncated: true, total: value.length } : items;
  }

  const out = {};
  const keys = Object.keys(value);
  const truncated = keys.length > maxKeys;
  const limit = truncated ? keys.slice(0, maxKeys) : keys;
  for (const key of limit) {
    out[key] = toJSONValue(value[key], options, seen, depth + 1);
  }
  if (truncated) {
    out.truncated = true;
    out.totalKeys = keys.length;
  }
  return out;
}

function safeJSON(value, options) {
  return toJSONValue(value, options, new WeakSet(), 0);
}

function getWindowMetadataSummary(windowId, options) {
  try {
    const meta = getMetadataSignal(windowId).peek();
    if (!meta) return { loaded: false };

    const dataSourceRefs = Object.keys(meta.dataSource || {});
    const dialogs = Array.isArray(meta.dialogs) ? meta.dialogs : [];

    const view = meta.view || {};
    const content = view.content || {};

    return {
      loaded: true,
      namespace: meta.namespace || null,
      ns: meta.ns || [],
      dataSourceRefs,
      dialogs: dialogs.map((d) => ({ id: d.id, title: d.title })),
      view: {
        dataSourceRef: view.dataSourceRef || null,
        contentType: content.type || null,
        contentId: content.id || null,
      },
      raw: options?.includeMetadata ? safeJSON(meta, options) : undefined,
    };
  } catch (e) {
    return { loaded: false, error: String(e?.message || e) };
  }
}

function getDialogStates(windowId, metaSummary, options) {
  const dialogs = metaSummary?.dialogs || [];
  if (!dialogs.length) return [];

  return dialogs.map((d) => {
    const id = `${windowId}Dialog${d.id}`;
    const state = getDialogSignal(id).peek() || {};
    return {
      id: d.id,
      open: !!state.open,
      args: options?.includeDialogArgs ? safeJSON(state.args, options) : undefined,
    };
  });
}

function getDataSourceSnapshot(windowId, dataSourceRef, options) {
  const dataSourceId = `${windowId}DS${dataSourceRef}`;

  const input = getInputSignal(dataSourceId).peek() || {};
  const control = getControlSignal(dataSourceId).peek() || {};
  const form = getFormSignal(dataSourceId).peek() || {};
  const selection = getSelectionSignal(dataSourceId, {}).peek();
  const collection = getCollectionSignal(dataSourceId).peek() || [];
  const collectionInfo = getCollectionInfoSignal(dataSourceId).peek() || {};
  const metrics = getMetricsSignal(dataSourceId).peek() || {};
  const formStatus = getFormStatusSignal(dataSourceId).peek() || {};

  return {
    dataSourceRef,
    dataSourceId,
    input: safeJSON(input, options),
    filter: safeJSON(input.filter || {}, options),
    control: safeJSON(control, options),
    form: safeJSON(form, options),
    selection: safeJSON(selection, options),
    collection: options?.includeCollection ? safeJSON(collection, options) : undefined,
    collectionInfo: safeJSON(collectionInfo, options),
    metrics: safeJSON(metrics, options),
    formStatus: safeJSON(formStatus, options),
  };
}

/**
 * Build a JSON-safe snapshot of the current Forge UI state.
 *
 * This is intentionally "semantic" (window + data-source + dialog state),
 * not DOM-based, so it remains stable across UI refactors.
 */
export function buildUISnapshot(options = {}) {
  const windows = activeWindows.peek() || [];
  let focused = null;
  try {
    enableFocusTracking();
    focused = getFocusedControlMeta();
  } catch (_) {}

  const snapshot = {
    ts: Date.now(),
    selected: {
      windowId: selectedWindowId.peek() || null,
      tabId: selectedTabId.peek() || null,
    },
    focusedControl: focused || null,
    windows: windows.map((w) => {
      const metaSummary = getWindowMetadataSummary(w.windowId, options);
      const dialogStates = getDialogStates(w.windowId, metaSummary, options);

      const dataSourceRefs = metaSummary.loaded ? metaSummary.dataSourceRefs : [];
      const dataSources = {};
      for (const ref of dataSourceRefs) {
        dataSources[ref] = getDataSourceSnapshot(w.windowId, ref, options);
      }

      return {
        windowId: w.windowId,
        windowKey: w.windowKey,
        windowTitle: w.windowTitle,
        parentKey: w.parentKey,
        inTab: w.inTab !== false,
        isModal: !!w.isModal,
        isMinimized: !!w.isMinimized,
        zIndex: w.zIndex ?? null,
        position: { x: w.x ?? null, y: w.y ?? null },
        size: w.size ? safeJSON(w.size, options) : undefined,
        metadata: metaSummary,
        dialogs: dialogStates,
        dataSources,
      };
    }),
  };

  return snapshot;
}
