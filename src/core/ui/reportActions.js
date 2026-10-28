const reportWindowActions = new Map();

// Live runs have an execution identity even when the host declines snapshot
// persistence. Preserve that receipt instead of claiming a durable saved run.
export function reportWindowRunReceipt(begun = {}) {
  if (!begun.ok) return begun;
  const id = String(begun.runId || '').trim();
  if (!id) return { ok: false, error: 'Report execution did not return a run identity.' };
  return begun.durable === true
    ? { ok: true, durable: true, reportRunId: id }
    : { ok: true, accepted: true, status: 'running', materializationId: id };
}

export function reportWindowMaterialization(run, materialization) {
  if (!run || run.durable === true || !String(run.runId || '').trim()) return materialization;
  const status = String(run.status || '').toLowerCase();
  const error = run.error?.message || run.error || '';
  return {
    ...materialization,
    id: run.runId,
    status: status === 'completed' && materialization?.fresh !== true ? 'running'
      : ['completed', 'failed', 'superseded'].includes(status)
        ? (status === 'superseded' ? 'failed' : status) : 'running',
    errors: status === 'superseded' ? ['Report execution was superseded.']
      : error ? [String(error)] : [],
  };
}

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
