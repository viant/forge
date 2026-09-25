const registry = new Map();

function makeKey({ windowId, dataSourceRef, controlId }) {
  return `${windowId || ''}:${dataSourceRef || ''}:${controlId || ''}`;
}

function isElementUsable(el) {
  if (!el) return false;
  if (typeof el.isConnected === 'boolean' && !el.isConnected) return false;
  return typeof el.focus === 'function';
}

/**
 * Register a semantic UI control target.
 *
 * `resolver()` (optional) can be used to dynamically locate the actual focusable
 * element (e.g. find first input under a wrapper).
 */
export function registerControlTarget(meta, target) {
  const { windowId, dataSourceRef, controlId } = meta || {};
  if (!windowId || !controlId) return null;

  const key = makeKey({ windowId, dataSourceRef, controlId });
  registry.set(key, {
    key,
    meta: {
      windowId,
      dataSourceRef: dataSourceRef || null,
      controlId,
      label: meta?.label || null,
      type: meta?.type || null,
      scope: meta?.scope || null,
    },
    target: {
      element: target?.element || null,
      wrapper: target?.wrapper || null,
      resolver: typeof target?.resolver === 'function' ? target.resolver : null,
    },
    ts: Date.now(),
  });
  return key;
}

export function unregisterControlTarget(metaOrKey) {
  if (!metaOrKey) return false;
  const key =
    typeof metaOrKey === 'string' ? metaOrKey : makeKey(metaOrKey);
  return registry.delete(key);
}

export function listControlTargets(filter = {}) {
  const out = [];
  for (const entry of registry.values()) {
    if (filter.windowId && entry.meta.windowId !== filter.windowId) continue;
    if (filter.dataSourceRef && entry.meta.dataSourceRef !== filter.dataSourceRef) continue;
    out.push({ ...entry.meta, key: entry.key, ts: entry.ts });
  }
  return out;
}

export function getControlTarget(metaOrKey) {
  const key =
    typeof metaOrKey === 'string' ? metaOrKey : makeKey(metaOrKey || {});
  return registry.get(key) || null;
}

export function focusControl(metaOrKey, options = {}) {
  const entry = getControlTarget(metaOrKey);
  if (!entry) return false;

  const { preventScroll = true } = options || {};

  const resolve = () => {
    if (entry.target.resolver) {
      try {
        return entry.target.resolver(entry.target);
      } catch (_) {
        return null;
      }
    }
    return entry.target.element || entry.target.wrapper || null;
  };

  const el = resolve();
  if (!isElementUsable(el)) return false;

  try {
    el.focus({ preventScroll });
    return true;
  } catch (_) {
    try {
      el.focus();
      return true;
    } catch (_) {
      return false;
    }
  }
}

let focusTrackingEnabled = false;
let lastFocusKey = null;

export function getFocusedControlKey() {
  return lastFocusKey;
}

export function getFocusedControlMeta() {
  if (!lastFocusKey) return null;
  const entry = registry.get(lastFocusKey);
  return entry ? { ...entry.meta, key: entry.key, ts: entry.ts } : null;
}

export function enableFocusTracking() {
  if (focusTrackingEnabled) return;
  focusTrackingEnabled = true;
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'focusin',
    (e) => {
      const target = e?.target;
      if (!target) return;
      for (const entry of registry.values()) {
        const resolved =
          (entry.target.resolver && entry.target.resolver(entry.target)) ||
          entry.target.element ||
          entry.target.wrapper;
        if (resolved && (resolved === target || resolved.contains?.(target))) {
          lastFocusKey = entry.key;
          return;
        }
      }
    },
    { capture: true }
  );
}
