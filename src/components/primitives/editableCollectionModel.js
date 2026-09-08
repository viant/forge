import {evaluatePlainVisibleWhen} from '../visibleWhen.js';

export function editableCollectionRows(selection = {}) {
  if (Array.isArray(selection.selection)) return selection.selection;
  return selection.selected ? [selection.selected] : [];
}

export function editableCollectionOperationState(operation = {}, context, selection = {}) {
  const rows = editableCollectionRows(selection);
  const required = operation.requiresSelection === true;
  const min = Number(operation?.selection?.min ?? (required ? 1 : 0));
  const max = Number(operation?.selection?.max ?? 0);
  const visible = !operation.visibleWhen || evaluatePlainVisibleWhen(operation.visibleWhen, context);
  const predicateDisabled = !!operation.disabledWhen && evaluatePlainVisibleWhen(operation.disabledWhen, context);
  const selectionPredicateDisabled = !!operation?.selection?.disabledWhen && evaluatePlainVisibleWhen(operation.selection.disabledWhen, context);
  const selectionDisabled = rows.length < min || (max > 0 && rows.length > max);
  const everyFailed = !!operation?.selection?.every && (rows.length === 0 || !rows.every((row) => evaluatePlainVisibleWhen(operation.selection.every, context, row)));
  const anyFailed = !!operation?.selection?.any && (rows.length === 0 || !rows.some((row) => evaluatePlainVisibleWhen(operation.selection.any, context, row)));
  const noneFailed = !!operation?.selection?.none && rows.some((row) => evaluatePlainVisibleWhen(operation.selection.none, context, row));
  return {visible, disabled: !visible || predicateDisabled || selectionPredicateDisabled || selectionDisabled || everyFailed || anyFailed || noneFailed, rows};
}

export function applyPrimitiveState(context, patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) return false;
  const signal = context?.signals?.windowForm;
  if (!signal) return false;
  const current = signal.peek?.() || signal.value || {};
  signal.value = {...current, ...patch};
  return true;
}

export function mutationCommandTargetParameters(resolved = {}, dataSourceRef = '') {
  const envelope = resolved?.inbound && typeof resolved.inbound === 'object' ? resolved.inbound : resolved;
  const scoped = dataSourceRef && envelope?.[dataSourceRef] ? envelope[dataSourceRef] : envelope;
  return scoped?.input?.parameters || scoped?.parameters || scoped || {};
}

export function reconcileEditableCollection(rows = [], resultRows = [], spec = {}) {
  const current = Array.isArray(rows) ? rows : [];
  const incoming = Array.isArray(resultRows) ? resultRows : (resultRows == null ? [] : [resultRows]);
  const mode = String(spec.mode || 'merge').toLowerCase();
  const identities = spec.identityFields?.length ? spec.identityFields : [String(spec.identityField || 'id')];
  const rowKey = (row) => {
    const values = identities.map((field) => row?.[field]);
    if (values.some((value) => value == null || value === '')) throw new Error(`Reconciliation row is missing identity field(s): ${identities.join(', ')}`);
    return values.map(String).join('\u001f');
  };
  if (mode === 'replace') return incoming.map((row) => ({...row}));
  if (!['merge', 'remove'].includes(mode)) throw new Error(`Unsupported reconciliation mode: ${mode}`);
  const keys = new Set(incoming.map(rowKey));
  if (mode === 'remove') return current.filter((row) => !keys.has(rowKey(row)));
  const byKey = new Map(current.map((row) => [rowKey(row), row]));
  for (const row of incoming) {
    const key = rowKey(row);
    byKey.set(key, {...(byKey.get(key) || {}), ...row});
  }
  return [...byKey.values()];
}
