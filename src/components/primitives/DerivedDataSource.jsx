import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {runDerivedPipeline} from './workflowModels.js';

const errorText = (error) => String(error?.detail || error?.message || error || '').trim();

export function derivedSourceState(states = [], optional = []) {
  const optionalSet = new Set(optional);
  const requiredError = states.find(({ref, state}) => !optionalSet.has(ref) && state?.error)?.state?.error || null;
  const warnings = states
    .filter(({ref, state}) => optionalSet.has(ref) && state?.error)
    .map(({ref, state}) => ({ref, message: errorText(state.error)}));
  const settled = states.length > 0 && states.every(({ref, state}) => optionalSet.has(ref)
    ? (state?.error || (state?.loaded === true && state?.loading !== true))
    : (state?.loaded === true && state?.loading !== true));
  return {error: requiredError, warnings, ready: !requiredError && settled};
}

export function nextDerivedControl(current = {}, {ready = false, error = null, warnings = [], preservePrimary = false} = {}) {
  const normalizedWarnings = Array.isArray(warnings) ? warnings : [];
  const next = preservePrimary
    ? {...current, derivedLoading: !ready && !error, derivedLoaded: ready, derivedError: errorText(error) || null, derivedWarnings: normalizedWarnings}
    : {...current, loading: !ready && !error, loaded: ready, error, derivedWarnings: normalizedWarnings};
  const same = preservePrimary
    ? current.derivedLoading === next.derivedLoading
      && current.derivedLoaded === next.derivedLoaded
      && current.derivedError === next.derivedError
      && JSON.stringify(current.derivedWarnings || []) === JSON.stringify(next.derivedWarnings)
    : current.loading === next.loading
      && current.loaded === next.loaded
      && current.error === next.error
      && JSON.stringify(current.derivedWarnings || []) === JSON.stringify(next.derivedWarnings);
  return same ? current : next;
}

export default function DerivedDataSource({container, context}) {
  useSignals();
  const spec = container.derivedDataSource || {};
  const targetRef = container.dataSourceRef || context?.identity?.dataSourceRef;
  const sources = {};
  const sourceStates = [];
  const optionalSources = Array.isArray(spec.optionalSources) ? spec.optionalSources : [];
  const optionalSet = new Set(optionalSources);
  for (const ref of spec.sources || []) {
    const source = context.Context(ref);
    const state = source?.signals?.control?.value || {};
    sources[ref] = optionalSet.has(ref) && state?.error ? [] : (source?.signals?.collection?.value || []);
    sourceStates.push({ref, state});
  }
  const status = derivedSourceState(sourceStates, optionalSources);
  let error = status.error;
  let ready = sourceStates.length === (spec.sources || []).length && status.ready;
  let rows = [];
  if (ready) try { rows = runDerivedPipeline(sources, spec); } catch (pipelineError) { error = pipelineError; ready = false; }
  const signature = JSON.stringify(rows);
  React.useEffect(() => {
    const target = targetRef ? context.Context(targetRef) : null;
    if (!target?.signals?.collection) return undefined;
    let mounted = true;
    if (target.signals.control) {
      const current = target.signals.control.peek?.() || {};
      const next = nextDerivedControl(current, {
        ready,
        error,
        warnings: status.warnings,
        preservePrimary: (spec.sources || []).includes(targetRef),
      });
      if (next !== current) target.signals.control.value = next;
    }
    if (!ready || error) return () => { mounted = false; };
    const current = target.signals.collection.peek?.() || [];
    if (mounted && JSON.stringify(current) !== signature) target.signals.collection.value = rows;
    return () => { mounted = false; };
  }, [context, error, ready, signature, status.warnings, targetRef]);
  return null;
}
