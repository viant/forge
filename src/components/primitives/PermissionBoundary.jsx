import {containerSizingStyle} from '../containerSizing.js';
import React from 'react';
import {Callout} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {isContainerVisible} from '../visibleWhen.js';

export function permissionBoundaryAllows(spec = {}, context = {}) {
  if (spec.visibleWhen && !isContainerVisible({visibleWhen: spec.visibleWhen}, context)) return false;
  const authorization = context?.signals?.authorization?.value || context?.signals?.authorization?.peek?.() || context?.authorization || {};
  const capabilities = authorization?.resource?.capabilities || {};
  if (!spec.capability) return true;
  const mode = String(spec.mode || 'resource').toLowerCase();
  if (mode === 'resource') return capabilities[spec.capability] === true;
  const selected = context?.signals?.selection?.value?.selection || (context?.signals?.selection?.value?.selected ? [context.signals.selection.value.selected] : []);
  const rows = mode === 'selection' ? selected : context?.signals?.collection?.value || [];
  return permissionBoundaryAllowsRows(spec, context, rows);
}

export function permissionBoundaryAllowsRows(spec = {}, context = {}, rows = []) {
  if (!spec.capability || !rows.length) return true;
  const authContext = spec.dataSourceRef ? context?.Context?.(spec.dataSourceRef) : null;
  const grants = authContext?.signals?.collection?.value || authContext?.signals?.collection?.peek?.() || [];
  const identityField = spec.identityField || 'id';
  const byID = new Map(grants.map((grant) => [String(grant?.resourceId ?? grant?.[identityField] ?? ''), grant]));
  return rows.every((row) => byID.get(String(row?.[identityField] ?? ''))?.capabilities?.[spec.capability] === true);
}

export default function PermissionBoundary({sizingMode = 'fill', container, context, children}) {
  useSignals();
  const spec = container.permissionBoundary || {};
  const enabled = !!container.permissionBoundary;
  const allowed = permissionBoundaryAllows(spec, context);
  const mode = String(spec.mode || 'resource').toLowerCase();
  React.useEffect(() => {
    if (!enabled || allowed || mode !== 'selection') return;
    const protectedContext = container.dataSourceRef ? context?.Context?.(container.dataSourceRef) || context : context;
    const selection = protectedContext?.signals?.selection;
    if (selection) selection.value = {selected: null, selection: [], rowIndex: -1};
  }, [allowed, context, container.dataSourceRef, enabled, mode]);
  if (!enabled) return <>{children}</>;
  if (mode === 'resource' && !allowed) return <Callout intent="warning" icon="lock" data-forge-primitive="permissionBoundary">{spec.deniedMessage || 'You do not have permission to view this content.'}</Callout>;
  return <div style={containerSizingStyle(container,sizingMode,{chrome:true})} data-forge-primitive="permissionBoundary">
    {children}
    {!allowed ? <Callout intent="warning" icon="lock">{spec.deniedMessage || (mode === 'selection' ? 'The current selection is not permitted.' : 'Some rows are not permitted for this action.')}</Callout> : null}
  </div>;
}
