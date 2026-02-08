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
  getFormStatusSignal,
  getDialogSignal,
} from '../store/signals.js';

import { focusControl, listControlTargets, getFocusedControlMeta, enableFocusTracking } from './registry.js';
import { setSelector } from '../../utils/selector.js';
import { resolveSelector } from '../../utils/selector.js';

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

    // ------------------------------------------------------------------
    // Windows
    // ------------------------------------------------------------------
    case 'ui.window.open': {
      const windowKey = requireString('windowKey', params.windowKey);
      const windowTitle = params.windowTitle || params.title || windowKey;
      const parentKey = params.parentKey || selectedWindowId.peek() || 'root';
      const inTab = params.inTab !== false;
      const windowData = params.windowData || '';
      const options = params.options || {};
      const win = addWindow(windowTitle, parentKey, windowKey, windowData, inTab, params.parameters || {}, options);
      return { windowId: win?.windowId || null };
    }

    case 'ui.window.openDynamic': {
      const metadata = params.metadata;
      if (!metadata || typeof metadata !== 'object') throw new Error('metadata is required');

      const windowKey = params.windowKey || `dynamic__${randomSuffix()}`;
      const windowTitle = params.windowTitle || params.title || windowKey;
      const parentKey = params.parentKey || selectedWindowId.peek() || 'root';
      const inTab = params.inTab !== false;
      const windowData = params.windowData || '';
      const options = {
        ...(params.options || {}),
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
    case 'ui.window.activate': {
      const windowId = requireString('windowId', params.windowId);
      const w = getWindowById(windowId);
      if (!w) throw new Error(`window not found: ${windowId}`);
      selectedWindowId.value = windowId;
      if (w.inTab !== false) selectedTabId.value = windowId;
      if (w.inTab === false) bringFloatingWindowToFront(windowId);
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
      const { dataSourceId } = getDataSourceId(windowId, params.dataSourceRef);

      const item = {
        id: controlId,
        bindingPath: params.bindingPath || controlId,
        dataField: params.dataField,
      };
      const value = params.value;
      const scope = params.scope || 'form';

      if (scope === 'filter') {
        const input = getInputSignal(dataSourceId);
        const prev = input.peek() || {};
        const filterPrev = prev.filter || {};
        const fieldKey = item.dataField || item.bindingPath || item.id;
        input.value = {
          ...prev,
          filter: setSelector(filterPrev, fieldKey, value),
        };
      } else {
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
        const mod = await import('../context/Context.jsx');
        const base = mod.getWindowContext?.(windowId);
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
        const mod = await import('../context/Context.jsx');
        const base = mod.getWindowContext?.(windowId);
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
      const mod = await import('../context/Context.jsx');
      const base = mod.getWindowContext?.(windowId);
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
