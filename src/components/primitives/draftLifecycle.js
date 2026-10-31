import {draftSnapshot, retainDraftBaseline} from './draftFormModel.js';
import {assertSafeAssignmentKeys} from '../../utils/selector.js';

const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function defaultsMap(value) {
  if (!object(value)) throw new Error('Draft defaults must be an object.');
  assertSafeAssignmentKeys(value);
  return clone(value); // undefined is omitted; null, false, zero and empty values are explicit.
}
function merge(base, patch) {
  const result = {...base};
  for (const [key, value] of Object.entries(patch)) {
    result[key] = object(value) && object(base[key]) ? merge(base[key], value) : value;
  }
  return result;
}
// Preserve edits (including deleted properties) relative to the accepted baseline.
function preserveEdits(base, current, next) {
  const result = {...next};
  for (const key of new Set([...Object.keys(base), ...Object.keys(current)])) {
    if (Object.hasOwn(base, key) === Object.hasOwn(current, key) && equal(base[key], current[key])) continue;
    if (!Object.hasOwn(current, key)) delete result[key];
    else result[key] = object(base[key]) && object(current[key]) && object(next[key])
      ? preserveEdits(base[key], current[key], next[key]) : current[key];
  }
  return result;
}

// One controller per mounted DraftForm. Datasource handlers remain the sole form
// and dirty-state owner; this only scopes asynchronous defaults to an opening.
export function createDraftLifecycle(context, notify = () => {}) {
  const ds = context.handlers.dataSource;
  const owner = context.signals?.form || context;
  let generation = 0, controller, baseline = {}, active = false, loader, parameters;
  function publish(next, current = next) {
    baseline = clone(next);
    retainDraftBaseline(owner, draftSnapshot(baseline));
    ds.setFormData({values: clone(baseline)});
    if (!equal(current, baseline)) ds.setEditedFormData({values: clone(current)});
  }
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal, revision = ++generation;
    if (!loader) { notify({status: 'ready'}); return; }
    notify({status: 'loading'});
    try {
      const patch = defaultsMap(await loader({context, parameters: clone(parameters), defaults: clone(baseline), signal}));
      if (!active || revision !== generation) return;
      const current = clone(ds.getFormData());
      const next = merge(baseline, patch);
      publish(next, preserveEdits(baseline, current, next));
      notify({status: 'ready'});
    } catch (error) {
      if (active && revision === generation) notify({status: 'failed', error: error?.message || 'Draft defaults could not be loaded.'});
    }
  }
  function suspend() {
    generation++; controller?.abort(); notify({status: 'waiting'});
  }
  return {
    open({defaults = {}, key = {}, load: nextLoader, enabled = true} = {}) {
      controller?.abort(); generation++;
      active = true; loader = nextLoader; parameters = defaultsMap(key);
      publish(defaultsMap(defaults));
      if (!enabled) { suspend(); return; }
      return load();
    },
    refresh(nextLoader, enabled = true) {
      if (!active) return;
      loader = nextLoader;
      if (!enabled) { suspend(); return; }
      return load();
    },
    retry() { if (active) return load(); },
    close() { active = false; generation++; controller?.abort(); notify({status: 'closed'}); },
  };
}
