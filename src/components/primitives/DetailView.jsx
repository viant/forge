import React from 'react';
import {Button} from '@blueprintjs/core';
import {resolveSelector} from '../../utils/selector.js';
import {formatDisplayValue} from '../../utils/formatValue.js';
import {resolveLinkTarget} from '../../utils/linkTarget.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import {copyDetailValue} from './detailViewModel.js';

function openTarget(target, context) {
  if (target?.kind === 'dialog') return context?.handlers?.window?.openDialog?.({context, execution: {args: [target.dialogId, {awaitResult: target.awaitResult === true}]}, parameters: target.parameters});
  if (target?.kind === 'window') return context?.handlers?.window?.openWindow?.({context, execution: {args: [target.windowKey, target.parameters || {}, {newInstance: target.newInstance === true, inTab: target.inTab !== false, windowTitle: target.windowTitle}]}});
  if (target?.kind === 'external' && target.href && typeof window !== 'undefined') return window.open(target.href, target.target || '_blank', 'noopener,noreferrer');
  return false;
}

const fieldVisible = (field, record, context) => !field.visibleWhen || evaluatePlainVisibleWhen(field.visibleWhen, {...context, row: record}, record);

const signalValue = (signal, fallback) => signal?.peek?.() ?? signal?.value ?? fallback;

export function resolveDetailRecord(dataContext, source = '') {
  const normalized = String(source || '').trim().toLowerCase();
  const form = signalValue(dataContext?.signals?.form, {}) || {};
  const collection = signalValue(dataContext?.signals?.collection, []) || [];
  const selection = signalValue(dataContext?.signals?.selection, {}) || {};
  const selected = selection?.selected || (Array.isArray(selection?.selection) ? selection.selection[0] : null);
  const metrics = signalValue(dataContext?.signals?.metrics, {}) || {};
  if (normalized === 'collection') return collection[0] || {};
  if (normalized === 'selection') return selected || {};
  if (normalized === 'metrics') return metrics;
  if (normalized === 'form') return form;
  return form || selected || collection[0] || metrics || {};
}

function DetailField({field, record, context, emptyText, columns}) {
  const [copyStatus, setCopyStatus] = React.useState('');
  const value = resolveSelector(record, field.field);
  const currency = field.currencyField ? resolveSelector(record, field.currencyField) : context?.resource?.currency;
  const display = value == null || value === '' ? field.emptyText || emptyText || '—' : formatDisplayValue(value, field.format || 'raw', 'en-US', {currency, timeZone: context?.resource?.timeZone});
  const target = field.link ? resolveLinkTarget({linkConfig: field.link, row: record, value, context}) : null;
  const copy = async () => {
    setCopyStatus(await copyDetailValue(typeof navigator !== 'undefined' ? navigator.clipboard : null, field.label, value));
  };
  return <div className="forge-detail-view__field" data-detail-field-id={field.id} style={{'--forge-detail-span': Math.min(Math.max(1, Number(field.span) || 1), Math.max(1, columns))}}>
    <dt>{field.label}</dt>
    <dd>{target ? <button type="button" className="forge-detail-view__link" onClick={() => openTarget(target, context)}>{display}</button> : display}{field.copyable && value != null ? <Button minimal small icon="duplicate" aria-label={`Copy ${field.label}`} onClick={copy}/> : null}<span className="forge-detail-view__copy-status" aria-live="polite">{copyStatus}</span></dd>
  </div>;
}

export default function DetailView({container, context}) {
  usePredicateSignals(context);
  const spec = container.detailView || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  usePredicateSignals(dataContext);
  const record = resolveDetailRecord(dataContext, spec.source);
  const host = React.useRef(null);
  const [target, setTarget] = React.useState('wide');
  React.useEffect(() => {
    if (!host.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setTarget(entry.contentRect.width <= 600 ? 'phone' : entry.contentRect.width <= 1000 ? 'narrow' : 'wide'));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const columns = spec.responsiveColumns?.[target] || spec.columns || 2;
  const sections = spec.sections?.length ? spec.sections : [{id: 'details', fields: spec.fields || []}];
  return <div ref={host} className="forge-detail-view" data-forge-primitive="detailView" style={{'--forge-detail-columns': Math.max(1, columns)}}>{sections.map((section) => {
    if (section.visibleWhen && !evaluatePlainVisibleWhen(section.visibleWhen, {...dataContext, row: record}, record)) return null;
    const fields = (section.fields || []).filter((field) => fieldVisible(field, record, dataContext));
    if (!fields.length) return null;
    return <section key={section.id} data-detail-section-id={section.id}>{section.label ? <h3>{section.label}</h3> : null}{section.description ? <p>{section.description}</p> : null}<dl>{fields.map((field) => <DetailField key={field.id} field={field} record={record} context={dataContext} emptyText={spec.emptyText} columns={columns}/>)}</dl></section>;
  })}</div>;
}
