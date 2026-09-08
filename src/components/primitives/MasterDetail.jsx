import React from 'react';
import {Button, Callout, NonIdealState, Spinner} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {resolveSelector, setSelector} from '../../utils/selector.js';
import {isAuthoritativeMasterState, masterDetailIdentity, masterDetailResponsiveMode, resolveMasterDetailParameters, resolveMasterDetailSelection} from './presentationModels.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {permissionBoundaryAllowsRows} from './PermissionBoundary.jsx';
import {usePredicateSignals} from './usePredicateSignals.js';

export default function MasterDetail({container, context, renderRegion}) {
  useSignals();
  const spec = container.masterDetail || {};
  const masterContainer = (container.containers || []).find((entry) => entry.id === spec.master?.containerId);
  const detailContainer = (container.containers || []).find((entry) => entry.id === spec.detail?.containerId);
  const masterContext = context.Context?.(masterContainer?.dataSourceRef || container.dataSourceRef) || context;
  const detailContext = context.Context?.(detailContainer?.dataSourceRef || container.dataSourceRef) || context;
  usePredicateSignals(masterContext);
  usePredicateSignals(detailContext);
  const rows = masterContext?.signals?.collection?.value || [];
  const masterControl = masterContext?.signals?.control?.value || {};
  const masterAuthoritative = isAuthoritativeMasterState(masterControl);
  const selection = masterContext?.signals?.selection?.value || {};
  const selected = selection.selected || selection.selection?.[0] || null;
  const persisted = spec.stateKey ? resolveSelector(context?.signals?.windowForm?.value || {}, spec.stateKey) : null;
  const validSelected = masterAuthoritative ? resolveMasterDetailSelection(rows, selected, persisted, spec.identityFields || ['id']) : null;
  const selectedID = masterDetailIdentity(validSelected, spec.identityFields || ['id']);
  const contextsDistinct = masterContext !== detailContext;
  const detailBoundaryMode = String(detailContainer?.permissionBoundary?.mode || 'resource').toLowerCase();
  const unsafeResourceBoundary = !!detailContainer?.permissionBoundary && detailBoundaryMode === 'resource';
  const boundaryAllowed = !detailContainer?.permissionBoundary || (!unsafeResourceBoundary && permissionBoundaryAllowsRows(detailContainer.permissionBoundary, detailContext, validSelected ? [validSelected] : []));
  const detailAllowed = !!validSelected
    && (!spec.detail?.allowedWhen || evaluatePlainVisibleWhen(spec.detail.allowedWhen, {...masterContext, row: validSelected}, validSelected))
    && boundaryAllowed;
  const detailParameters = detailAllowed ? resolveMasterDetailParameters(validSelected, spec.detail?.parameters || {}, masterContext) : {};
  const detailParameterSignature = JSON.stringify(detailParameters);
  const host = React.useRef(null);
  const masterHost = React.useRef(null);
  const originFocus = React.useRef(null);
  const generation = React.useRef(0);
  const [target, setTarget] = React.useState('wide');
  const [detailReady, setDetailReady] = React.useState(false);
  const [detailError, setDetailError] = React.useState(null);
  const [drillOpen, setDrillOpen] = React.useState(!!validSelected);
  const [blockReason, setBlockReason] = React.useState('');

  const restoreMasterFocus = React.useCallback(() => {
    const restore = () => {
      const target = originFocus.current;
      if (target?.isConnected !== false && typeof target?.focus === 'function') target.focus();
      else masterHost.current?.focus?.();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(restore));
    else setTimeout(restore, 0);
  }, []);

  const invalidateDetailBinding = React.useCallback(() => {
    const tombstone = `cleared:${++generation.current}`;
    const input = detailContext?.signals?.input;
    if (input) input.value = {...(input.peek?.() || input.value || {}), bindingGeneration: tombstone, fetch: false, refresh: false};
    detailContext?.handlers?.dataSource?.setSelected?.({selected: null, selection: [], rowIndex: -1});
    detailContext?.handlers?.dataSource?.setFormData?.({values: {}});
    if (detailContext?.signals?.collection && (detailContext.signals.collection.peek?.() || []).length) detailContext.signals.collection.value = [];
    setDetailReady(false);
  }, [detailContext]);

  React.useEffect(() => {
    if (!host.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setTarget(entry.contentRect.width <= 800 ? 'narrow' : 'wide'));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!masterAuthoritative || selected || !validSelected || !detailAllowed || !contextsDistinct) return;
    const rowIndex = rows.findIndex((row) => masterDetailIdentity(row, spec.identityFields || ['id']) === selectedID);
    if (rowIndex >= 0) masterContext?.handlers?.dataSource?.setSelected?.({selected: validSelected, rowIndex});
  }, [contextsDistinct, detailAllowed, masterAuthoritative, masterContext, rows, selected, selectedID, validSelected]);

  React.useEffect(() => {
    if (!masterAuthoritative || !selected || validSelected || !contextsDistinct) return;
    if (String(spec.selectionInvalidation || 'clear').toLowerCase() === 'clear') {
      originFocus.current = typeof document !== 'undefined' ? document.activeElement : originFocus.current;
      setBlockReason('removed');
      setDrillOpen(false);
      invalidateDetailBinding();
      masterContext?.handlers?.dataSource?.setSelected?.({selected: null, selection: [], rowIndex: -1});
      restoreMasterFocus();
    }
  }, [contextsDistinct, invalidateDetailBinding, masterAuthoritative, masterContext, restoreMasterFocus, selected, spec.selectionInvalidation, validSelected]);

  React.useEffect(() => {
    if (!masterAuthoritative || !spec.stateKey || !context?.signals?.windowForm || !contextsDistinct) return;
    const current = {...(context.signals.windowForm.peek?.() || context.signals.windowForm.value || {})};
    const identity = validSelected && detailAllowed ? Object.fromEntries((spec.identityFields || ['id']).map((field) => [field, resolveSelector(validSelected, field)])) : null;
    if (JSON.stringify(resolveSelector(current, spec.stateKey) ?? null) === JSON.stringify(identity)) return;
    context.signals.windowForm.value = setSelector(current, spec.stateKey, identity);
  }, [context, contextsDistinct, detailAllowed, masterAuthoritative, selectedID, spec.stateKey, validSelected]);

  React.useEffect(() => {
    if (!contextsDistinct || !masterAuthoritative || !validSelected || detailAllowed) return;
    originFocus.current = typeof document !== 'undefined' ? document.activeElement : originFocus.current;
    setBlockReason('denied');
    setDrillOpen(false);
    invalidateDetailBinding();
    masterContext?.handlers?.dataSource?.setSelected?.({selected: null, selection: [], rowIndex: -1});
    restoreMasterFocus();
  }, [contextsDistinct, detailAllowed, invalidateDetailBinding, masterAuthoritative, masterContext, restoreMasterFocus, selectedID, validSelected]);

  React.useEffect(() => {
    const currentGeneration = ++generation.current;
    setDetailReady(false);
    setDetailError(null);
    if (!contextsDistinct || unsafeResourceBoundary) return;
    if (!masterAuthoritative || !validSelected || !detailAllowed) {
      invalidateDetailBinding();
      return;
    }
    setBlockReason('');
    originFocus.current = typeof document !== 'undefined' ? document.activeElement : null;
    setDrillOpen(true);
    detailContext?.handlers?.dataSource?.setInputParameters?.(detailParameters);
    const result = detailContext?.handlers?.dataSource?.fetchCollection?.({cache: {bypassCache: true}, bindingGeneration: `${selectedID}:${currentGeneration}`});
    if (!result?.then) {
      setDetailError(new Error('Detail datasource does not support request-scoped completion.'));
      return;
    }
    result.then(() => { if (currentGeneration === generation.current) setDetailReady(true); }, (error) => { if (currentGeneration === generation.current) setDetailError(error); });
    return () => {
      if (generation.current === currentGeneration) invalidateDetailBinding();
    };
  }, [contextsDistinct, detailAllowed, detailContext, detailParameterSignature, invalidateDetailBinding, masterAuthoritative, masterContext, selectedID, unsafeResourceBoundary]);

  const mode = masterDetailResponsiveMode(spec.responsive, target);
  const master = <div ref={masterHost} tabIndex={-1} className="forge-master-detail__master">{renderRegion?.(masterContainer)}</div>;
  const emptyMessage = blockReason === 'denied' ? detailContainer?.permissionBoundary?.deniedMessage || 'Selection is not permitted.' : blockReason === 'removed' ? 'The selected item is no longer available.' : spec.emptyDetail?.message || 'Select an item';
  const detail = <div className="forge-master-detail__detail">{unsafeResourceBoundary ? <Callout intent="danger">Master-detail prefetch requires selected-row authorization; resource-mode detail boundaries are not supported.</Callout> : validSelected && detailAllowed ? detailError ? <Callout intent="danger">{String(detailError?.message || detailError)}</Callout> : detailReady ? renderRegion?.(detailContainer) : <div className="forge-data-state"><Spinner size={24}/><span>Loading selection…</span></div> : <NonIdealState icon={blockReason === 'denied' ? 'lock' : 'hand'} title={emptyMessage}/>}</div>;
  const back = () => { setDrillOpen(false); restoreMasterFocus(); };
  if (!contextsDistinct) return <Callout intent="danger" data-forge-primitive="masterDetail">Master and detail must use distinct datasource contexts.</Callout>;
  return <div ref={host} className={`forge-master-detail is-${mode}`} data-forge-primitive="masterDetail" data-selected-identity={selectedID}>
    <span className="forge-master-detail__announcement" aria-live="polite">{blockReason ? emptyMessage : ''}</span>
    {mode === 'drill' ? drillOpen && validSelected ? <><Button minimal icon="chevron-left" onClick={back}>Back</Button>{detail}</> : master : <>{master}{detail}</>}
  </div>;
}
