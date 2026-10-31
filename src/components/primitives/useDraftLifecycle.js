import React from 'react';
import {loadDraftSource} from './draftLifecycleSource.js';
import {resolveParameters} from '../../hooks/parameters.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import {createDraftLifecycle} from './draftLifecycle.js';

export function useDraftLifecycle(spec, context) {
  usePredicateSignals(context, [spec?.openWhen, spec?.source?.when]);
  // Parameter resolution uses peek. Track only key sources, avoiding unrelated
  // datasource contexts and default changes that must not reset an active draft.
  if (spec) {
    const refs = new Set([context.identity?.dataSourceRef]);
    for (const row of [...(spec.key || []), ...(spec.source?.watch || [])]) {
      const prefix = row.from?.includes(':') ? row.from.split(':')[0] : String(row.location || '').split('.')[0];
      if (prefix && Object.hasOwn(context.metadata?.dataSource || {}, prefix)) refs.add(prefix);
    }
    for (const ref of refs) {
      const target = !ref || ref === context.identity?.dataSourceRef ? context : context.Context?.(ref);
      for (const name of ['form', 'selection', 'input', 'windowForm', 'metrics']) target?.signals?.[name]?.value;
    }
  }
  const open = !!spec && (!spec.openWhen || evaluatePlainVisibleWhen(spec.openWhen, context));
  const key = spec ? JSON.stringify(resolveParameters(spec.key || [], context)) : '{}';
  const watch = spec?.source?.watch ? JSON.stringify(resolveParameters(spec.source.watch, context)) : '{}';
  const enabled = !spec?.source?.when || evaluatePlainVisibleWhen(spec.source.when, context);
  const previousOpening = React.useRef(null);
  const configuration = JSON.stringify([spec?.source, spec?.defaults, spec?.load]);
  const [state, setState] = React.useState({status: spec ? 'closed' : 'ready'});
  const lifecycle = React.useMemo(() => spec ? createDraftLifecycle(context, setState) : null, [!!spec, context.signals?.form]);
  React.useEffect(() => {
    if (!lifecycle) return;
    if (!open) { previousOpening.current = null; lifecycle.close(); return; }
    const load = spec.load || spec.source ? async args => {
      const sourceDefaults = spec.source ? await loadDraftSource(context, spec.source, args.signal) : {};
      if (!spec.load || args.signal.aborted) return sourceDefaults;
      const handler = context.lookupHandler?.(spec.load);
      if (typeof handler !== 'function') throw new Error(`Draft defaults handler is unavailable: ${spec.load}`);
      const prepared = await handler({...args, defaults: {...args.defaults, ...sourceDefaults}});
      if (!prepared || typeof prepared !== 'object' || Array.isArray(prepared)) throw new Error('Draft defaults handler must return an object.');
      return {...sourceDefaults, ...prepared};
    } : undefined;
    const previous = previousOpening.current;
    const sameOpening = previous?.lifecycle === lifecycle && previous.key === key && previous.configuration === configuration;
    previousOpening.current = {lifecycle, key, configuration};
    if (sameOpening) lifecycle.refresh(load, enabled);
    else lifecycle.open({key: JSON.parse(key), defaults: resolveParameters(spec.defaults || [], context), load, enabled});
  }, [lifecycle, open, key, configuration, watch, enabled]);
  React.useEffect(() => () => { previousOpening.current = null; lifecycle?.close(); }, [lifecycle]);
  return { ...state, ready: !spec || (open && enabled && state.status === 'ready'), retry: () => lifecycle?.retry() };
}
