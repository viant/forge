const reportWindowActions = new Map();

function normalizeWindowId(windowId) {
  return String(windowId || '').trim();
}

export function registerReportWindowActions(windowId, actions = {}) {
  const key = normalizeWindowId(windowId);
  if (!key) {
    throw new Error('windowId is required');
  }
  const value = actions && typeof actions === 'object' && !Array.isArray(actions)
    ? actions
    : {};
  reportWindowActions.set(key, value);
  return () => {
    if (reportWindowActions.get(key) === value) {
      reportWindowActions.delete(key);
    }
  };
}

export async function invokeReportWindowAction(windowId, action, input = {}) {
  const key = normalizeWindowId(windowId);
  const actionName = String(action || '').trim();
  if (!key) {
    throw new Error('windowId is required');
  }
  if (!actionName) {
    throw new Error('report action is required');
  }
  const actions = reportWindowActions.get(key);
  if (!actions) {
    throw new Error(`report surface not found for window: ${key}`);
  }
  const handler = actions[actionName];
  if (typeof handler !== 'function') {
    throw new Error(`report action is unavailable: ${actionName}`);
  }
  return handler(input);
}

export function clearReportWindowActions(windowId) {
  reportWindowActions.delete(normalizeWindowId(windowId));
}

export function scheduleReportWindowMutation(handler, schedule = globalThis.setTimeout) {
  if (typeof handler !== 'function') {
    throw new Error('report mutation handler is required');
  }
  if (typeof schedule !== 'function') {
    throw new Error('report mutation scheduler is required');
  }
  schedule(handler, 0);
}
