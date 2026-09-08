import {resolveSelector} from '../../utils/selector.js';
import {formatDisplayValue} from '../../utils/formatValue.js';
import {resolveLinkTarget} from '../../utils/linkTarget.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {primitiveIdentity} from './workflowModels.js';

export function dataBoundaryState(states = [], collections = [], allowPartial = false) {
  const loading = states.some((state) => state?.loading === true || state?.loaded !== true);
  const errors = states.map((state) => state?.error).filter(Boolean);
  const stale = states.some((state) => state?.stale === true);
  const hasRows = collections.some((rows) => Array.isArray(rows) && rows.length > 0);
  if (errors.length && !(allowPartial && hasRows)) return {kind: 'error', errors};
  if (loading && !(allowPartial && hasRows)) return {kind: 'loading', errors};
  if (!hasRows && states.every((state) => state?.loaded === true)) return {kind: stale ? 'stale_empty' : 'empty', errors};
  if (errors.length || loading) return {kind: 'partial', errors};
  if (stale) return {kind: 'stale', errors};
  return {kind: 'ready', errors};
}

export function relationDrillValue(record = {}, spec = {}) {
  const count = Number(resolveSelector(record, spec.countField || 'count') || 0);
  const label = resolveSelector(record, spec.labelField || 'label');
  const noun = count === 1 ? spec.singularLabel || 'item' : spec.pluralLabel || 'items';
  return {count, label: label || `${count} ${noun}`, actionable: count > 0 && !!spec.link};
}

export function resolveRelationDrillTarget(record = {}, spec = {}, context = {}) {
  const relation = relationDrillValue(record, spec);
  return relation.actionable ? resolveLinkTarget({linkConfig: spec.link, row: record, value: record, context}) : null;
}

export function notificationActionState(action = {}, context = {}) {
  const visible = !action.visibleWhen || evaluatePlainVisibleWhen(action.visibleWhen, context);
  const disabled = !visible || (!!action.disabledWhen && evaluatePlainVisibleWhen(action.disabledWhen, context));
  return {visible, disabled};
}

export function masterDetailIdentity(row = null, identityFields = ['id']) {
  if (!row) return '';
  const values = identityFields.map((field) => resolveSelector(row, field));
  if (values.some((value) => value == null || value === '')) return '';
  return primitiveIdentity(row, identityFields);
}

export function resolveMasterDetailSelection(rows = [], selected = null, persisted = null, identityFields = ['id']) {
  const currentID = masterDetailIdentity(selected, identityFields);
  const findUnique = (identity) => {
    if (!identity) return null;
    const matches = rows.filter((row) => masterDetailIdentity(row, identityFields) === identity);
    return matches.length === 1 ? matches[0] : null;
  };
  if (currentID) return findUnique(currentID);
  const persistedID = masterDetailIdentity(persisted, identityFields);
  return findUnique(persistedID);
}

export function isAuthoritativeMasterState(control = {}) {
  return control.loaded === true && control.loading !== true && !control.error && control.stale !== true;
}

export function resolveMasterDetailParameters(row = null, parameters = {}, context = {}) {
  if (!row) return {};
  return resolveLinkTarget({linkConfig: {kind: 'window', windowKey: '__detail__', parameters}, row, value: row, context})?.parameters || {};
}

export function masterDetailResponsiveMode(responsive = {}, target = 'wide') {
  return responsive?.[target] || responsive?.wide || 'split';
}

export function metricSummaryValue(record = {}, item = {}, context = {}) {
  const value = resolveSelector(record, item.field);
  const rawComparison = item.comparisonField ? Number(resolveSelector(record, item.comparisonField)) : null;
  const comparison = Number.isFinite(rawComparison) ? rawComparison : null;
  const timeZone = context?.resource?.timeZone;
  const currency = item.currencyField ? resolveSelector(record, item.currencyField) : context?.resource?.currency;
  const direction = comparison == null ? 'neutral' : comparison > 0 ? 'up' : comparison < 0 ? 'down' : 'neutral';
  const betterWhen = String(item.betterWhen || 'neutral').toLowerCase();
  const sentiment = direction === 'neutral' || betterWhen === 'neutral' ? 'neutral'
    : (betterWhen === 'higher' ? direction === 'up' : direction === 'down') ? 'positive' : 'negative';
  return {
    value,
    display: value == null || value === '' ? item.emptyText || '—' : formatDisplayValue(value, item.format || 'raw', 'en-US', {timeZone, currency}),
    comparison,
    comparisonDisplay: comparison == null ? '' : formatDisplayValue(Math.abs(comparison), item.comparisonFormat || item.format || 'number', 'en-US', {timeZone, currency}),
    direction,
    sentiment,
  };
}
