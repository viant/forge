import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {runDerivedPipeline} from './workflowModels.js';

export function derivedSourceState(states = []) {
  const error = states.find((state) => state?.error)?.error || null;
  return {error, ready: !error && states.length > 0 && states.every((state) => state?.loaded === true && state?.loading !== true)};
}

export default function DerivedDataSource({container, context}) {
  useSignals();
  const spec = container.derivedDataSource || {};
  const targetRef = container.dataSourceRef || context?.identity?.dataSourceRef;
  const sources = {};
  const sourceStates = [];
  for (const ref of spec.sources || []) {
    const source = context.Context(ref);
    sources[ref] = source?.signals?.collection?.value || [];
    sourceStates.push(source?.signals?.control?.value || {});
  }
  const status = derivedSourceState(sourceStates);
  let error = status.error;
  let ready = sourceStates.length === (spec.sources || []).length && status.ready;
  let rows = [];
  if (ready) try { rows = runDerivedPipeline(sources, spec); } catch (pipelineError) { error = pipelineError; ready = false; }
  const signature = JSON.stringify(rows);
  React.useEffect(() => {
    const target = targetRef ? context.Context(targetRef) : null;
    if (!target?.signals?.collection) return undefined;
    let mounted = true;
    if (target.signals.control) target.signals.control.value = {...(target.signals.control.peek?.() || {}), loading: !ready && !error, loaded: ready, error};
    if (!ready || error) return () => { mounted = false; };
    const current = target.signals.collection.peek?.() || [];
    if (mounted && JSON.stringify(current) !== signature) target.signals.collection.value = rows;
    return () => { mounted = false; };
  }, [context, error, ready, rows, signature, targetRef]);
  return null;
}
