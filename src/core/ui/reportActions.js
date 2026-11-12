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
  let result = await handler(input);
  // Older report surfaces may only implement an immediate snapshot. Never
  // silently call that a completed wait, and never start a run on their behalf.
  if (actionName === 'getCurrent' && input.waitForCompletion === true &&
      (['loading','running'].includes(result?.status) || result?.materialization?.status === 'running') && result?.ok !== false) {
    result = {...result,ok:false,status:'wait_unavailable',error:'This report surface cannot wait for completion; inspect its current state.'};
  }
  return actionName === 'getCurrent' ? structuredClone(projectCurrentReport(result, input.include)) : result;
}

// Keep the legacy response when no selection is supplied. Projection happens
// before the bridge serializes the result and never mutates the live report.
export function projectCurrentReport(result, include) {
  if (!include || include.raw === true || !result || typeof result !== 'object') return result;
  const out = {};
  const copy = (source, keys, target) => {
    for (const key of keys) if (Object.hasOwn(source || {}, key)) target[key] = source[key];
  };
  copy(result, ['ok','error','windowId','windowKey','reportId','reportName','sourceKind'], out);
  if (include.visible) copy(result, ['visible'], out);
  if (include.state || include.visible) copy(result, ['request','parameters','draftParameters','status','progress','hasCompletedRun','canRun','canSave','canExport','runControlId','activeSectionId','materialization'], out);
  const spec = {}, fill = {};
  if (include.inputs) copy(result.reportSpec, ['scope','parameters','inputs','refinements'], spec);
  if (include.description) copy(result.reportSpec, ['title','description','semanticSummary'], spec);
  if (include.sources) copy(result.reportSpec, ['datasets','dataSources','source','binding'], spec);
  if (include.visuals) {
    copy(result.reportSpec, ['blocks','layout','layoutIntent','presentation','calculatedFields'], spec);
  }
  if (include.tabs) {
    copy(result, ['activeSectionId'], out);
    for (const [source, target] of [[result.reportSpec, spec], [result.reportFill, fill]]) {
      if (Array.isArray(source?.blocks)) target.blocks = source.blocks.filter(block => ['tabGroupBlock','sectionBlock'].includes(block.kind));
    }
    // The visual selection includes all blocks, not just navigation blocks.
    if (include.visuals && result.reportSpec?.blocks) spec.blocks = result.reportSpec.blocks;
  }
  if (include.data) copy(result.reportFill, ['datasets','blocks','parameters','source'], fill);
  if (Object.keys(spec).length) out.reportSpec = spec;
  if (Object.keys(fill).length) out.reportFill = fill;
  return out;
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
