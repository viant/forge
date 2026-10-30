import {resolveParameters} from '../../hooks/parameters.js';

// Reuse the native datasource transport, selectors, transforms and authorization.
// Resolve mappings against this invocation's returned records, never a later
// response/selection published by another opening of the same datasource.
export async function loadDraftSource(context, source, signal) {
  if (source.dataSourceRef === context.identity?.dataSourceRef) throw new Error('Draft defaults source must differ from the draft datasource.');
  const target = context.Context?.(source.dataSourceRef);
  const ds = target?.handlers?.dataSource;
  if (!ds?.fetchCollection || !ds?.setInputParameters) throw new Error('Draft defaults datasource is unavailable.');
  const parameters = resolveParameters(source.parameters || [], context);
  ds.setInputParameters(parameters);
  const completion = ds.fetchCollection({invocationId: crypto.randomUUID(), cache: {bypassCache: true}});
  if (!completion?.then) throw new Error('Draft defaults datasource must return a completion promise.');
  const records = await completion;
  if (signal.aborted) return {};
  if (!Array.isArray(records)) throw new Error('Draft defaults datasource did not return records.');
  const selected = records[0] || {};
  const snapshot = {...target, metadata: target.metadata || context.metadata, signals: {...target.signals}, handlers: {...target.handlers, dataSource: {...ds,
    peekFormData: () => selected, getFormData: () => selected,
    peekSelection: () => ({selected, selection: records}),
  }}};
  for (const [name, value] of Object.entries({form: selected, selection: {selected, selection: records}, collection: records})) {
    snapshot.signals[name] = {value, peek: () => value};
  }
  snapshot.Context = ref => ref === source.dataSourceRef ? snapshot : context.Context(ref);
  return resolveParameters(source.defaults || [], snapshot);
}
