import React from 'react';
import {Callout, NonIdealState, Spinner} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {dataBoundaryState} from './presentationModels.js';

export default function DataStateBoundary({container, context, children}) {
  useSignals();
  const spec = container.dataStateBoundary;
  if (!spec) return <>{children}</>;
  const renderEmptyContent = spec.renderEmptyContent === true;
  const contexts = (spec.dataSourceRefs?.length ? spec.dataSourceRefs : [container.dataSourceRef]).filter(Boolean).map((ref) => context.Context?.(ref) || context);
  const states = contexts.map((entry) => entry?.signals?.control?.value || {});
  const collections = contexts.map((entry) => {
    const rows = entry?.signals?.collection?.value;
    if (Array.isArray(rows) && rows.length) return rows;
    const form = entry?.signals?.form?.value;
    if (form && typeof form === 'object' && Object.keys(form).length) return [form];
    const metrics = entry?.signals?.metrics?.value;
    if (metrics && typeof metrics === 'object' && Object.keys(metrics).length) return [metrics];
    return Array.isArray(rows) ? rows : [];
  });
  const state = dataBoundaryState(states, collections, spec.allowPartial);
  if (state.kind === 'loading') return <div className="forge-data-state" data-forge-primitive="dataStateBoundary"><Spinner size={24}/><span>{spec.loadingMessage || 'Loading…'}</span></div>;
  if (state.kind === 'error') return <Callout intent="danger" data-forge-primitive="dataStateBoundary">{spec.errorMessage || String(state.errors[0]?.message || state.errors[0] || 'Unable to load data.')}</Callout>;
  if (state.kind === 'empty' && !renderEmptyContent) return <NonIdealState icon="search" title={spec.emptyMessage || 'No data'}/>;
  if (state.kind === 'stale_empty' && !renderEmptyContent) return <div data-forge-primitive="dataStateBoundary"><Callout intent="warning">{spec.staleMessage || 'Cached data may be stale.'}</Callout><NonIdealState icon="search" title={spec.emptyMessage || 'No data'}/></div>;
  return <div data-forge-primitive="dataStateBoundary">{(state.kind === 'partial' || state.kind === 'stale' || state.kind === 'stale_empty') ? <Callout intent="warning">{(state.kind === 'stale' || state.kind === 'stale_empty') ? spec.staleMessage || 'Showing cached data.' : 'Some data is unavailable.'}</Callout> : null}{children}</div>;
}
