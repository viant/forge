import {formatDataSourceError} from '../../utils/dataSourceError.js';
import {containerSizingStyle} from '../containerSizing.js';
import React from 'react';
import {Button, Callout, Icon, NonIdealState, Spinner} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {dataBoundaryState} from './presentationModels.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';

export default function DataStateBoundary({sizingMode = 'fill', container, context, children}) {
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
  const errorAction = spec.errorAction && typeof spec.errorAction === 'object' ? spec.errorAction : null;
  const retryError = () => {
    const ref = errorAction?.dataSourceRef || spec.dataSourceRefs?.[0] || container.dataSourceRef;
    const target = ref ? (context.Context?.(ref) || context) : context;
    return target?.handlers?.dataSource?.fetchCollection?.({cache: {bypassCache: errorAction?.bypassCache !== false}});
  };
  if (state.kind === 'loading') return <div className="forge-data-state" data-forge-primitive="dataStateBoundary"><Spinner size={24}/><span>{spec.loadingMessage || 'Loading…'}</span></div>;
  if (state.kind === 'error' && spec.suppressErrorWhen && evaluatePlainVisibleWhen(spec.suppressErrorWhen, context)) return null;
  if (state.kind === 'error') return <div className="forge-data-error" role="alert" data-forge-primitive="dataStateBoundary">
    <Icon icon="error" aria-hidden="true"/>
    <div><strong>Unable to load data</strong><div>{String(spec.errorMessage || '').trim() || formatDataSourceError(state.errors[0]) || 'Please retry. If the problem continues, check the connection.'}</div></div>
    {errorAction ? <Button minimal icon={errorAction.icon || 'refresh'} onClick={retryError} aria-label={errorAction.label || 'Retry'} title={errorAction.label || 'Retry'}/> : null}
  </div>;
  if (state.kind === 'empty' && !renderEmptyContent) return <NonIdealState icon="search" title={spec.emptyMessage || 'No data'}/>;
  if (state.kind === 'stale_empty' && !renderEmptyContent) return <div style={containerSizingStyle(container,sizingMode,{chrome:true})} data-forge-primitive="dataStateBoundary"><Callout intent="warning">{spec.staleMessage || 'Cached data may be stale.'}</Callout><NonIdealState icon="search" title={spec.emptyMessage || 'No data'}/></div>;
  return <div style={containerSizingStyle(container,sizingMode,{chrome:true})} data-forge-primitive="dataStateBoundary">{(state.kind === 'partial' || state.kind === 'stale' || state.kind === 'stale_empty') ? <Callout intent="warning">{(state.kind === 'stale' || state.kind === 'stale_empty') ? spec.staleMessage || 'Showing cached data.' : 'Some data is unavailable.'}</Callout> : null}{children}</div>;
}
