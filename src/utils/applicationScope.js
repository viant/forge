import {signal} from '@preact/signals-react';

// UI context only. Producer authorization remains authoritative for every read.
export function createApplicationScope({windows, closeWindow}) {
  const revision = signal(0);
  let session = '', definitions = new Map(), values = new Map(), owners = new Map(), aliases = new Map();
  const key = app => JSON.stringify([app?.providerIdentity || '', app?.id || '']);
  const copy = value => JSON.parse(JSON.stringify(value));
  const owner = id => {
    const visited = new Set();
    while (id && !visited.has(id)) {
      visited.add(id);
      if (owners.has(id)) return owners.get(id);
      id = aliases.get(id) || windows().find(entry => entry.windowId === id)?.parentKey;
    }
    return null;
  };
  const contextWindowId = context => owner(context?.identity?.windowId) ? context.identity.windowId : context?.windowState?.windowId;
  const sourceKeys = action => Object.values(action?.parameterBindings || {}).flatMap(binding => {
    const from = typeof binding === 'string' ? binding : binding?.from;
    return Array.isArray(from) ? from : typeof from === 'string' ? [from] : [];
  });
  return {
    revision,
    configure(identity, apps = []) {
      if (session !== identity) { values.clear(); owners.clear(); aliases.clear(); session = identity; }
      definitions = new Map(apps.filter(app => Array.isArray(app.scope?.keys)).map(app => [key(app), new Set(app.scope.keys.filter(k => typeof k === 'string' && !['__proto__', 'constructor', 'prototype'].includes(k)))]));
      for (const [id, held] of values) {
        const allowed = definitions.get(id);
        if (!allowed) values.delete(id);
        else values.set(id, Object.fromEntries(Object.entries(held).filter(([name]) => allowed.has(name))));
      }
      revision.value++;
    },
    register(window, app, action) {
      if (window?.windowId && definitions.has(key(app))) owners.set(window.windowId, {key: key(app), dependencies: sourceKeys(action), root: window.windowId});
    },
    bindWindow(windowId, parentId) {
      if (!windowId || !parentId || windowId === parentId || !owner(parentId)) return () => {};
      aliases.set(windowId, parentId);
      return () => { if (aliases.get(windowId) === parentId) aliases.delete(windowId); };
    },
    inputs(app, focused = {}) {
      revision.value;
      const allowed = definitions.get(key(app));
      // Declared application keys never fall back to another focused window.
      const local = Object.fromEntries(Object.entries(focused).filter(([name]) => !allowed?.has(name)));
      return {...local, ...copy(values.get(key(app)) || {})};
    },
    get(context) {
      revision.value;
      const selected = owner(contextWindowId(context));
      return copy(selected ? values.get(selected.key) || {} : {});
    },
    set(context, patch) {
      const selected = owner(contextWindowId(context));
      const allowed = selected && definitions.get(selected.key);
      if (!allowed || !patch || Array.isArray(patch) || typeof patch !== 'object') throw new Error('Application scope is unavailable');
      for (const name of Object.keys(patch)) if (!allowed.has(name)) throw new Error('Undeclared application scope key');
      const before = values.get(selected.key) || {}, next = {...before};
      for (const [name, value] of Object.entries(patch)) {
        if (value == null) delete next[name]; else next[name] = copy(value);
      }
      const changed = [...allowed].filter(name => JSON.stringify(before[name]) !== JSON.stringify(next[name]));
      if (!changed.length) return true;
      values.set(selected.key, next);
      // Keep the selector and its ancestors, but invalidate dependent children.
      const keep = new Set();
      let caller = contextWindowId(context);
      while (caller && !keep.has(caller)) { keep.add(caller); caller = aliases.get(caller) || windows().find(window => window.windowId === caller)?.parentKey; }
      // Invalidate dependent views without fetching or replaying their actions.
      for (const window of [...windows()]) {
        const held = owner(window.windowId);
        const dependencies = [...(held?.dependencies || []), ...Object.keys(window.parameters || {})];
        if (held?.key === selected.key && !keep.has(window.windowId) && dependencies.some(name => changed.includes(name))) closeWindow(window.windowId);
      }
      const live = new Set(windows().map(window => window.windowId));
      for (const id of owners.keys()) if (!live.has(id)) owners.delete(id);
      revision.value++;
      return true;
    },
    clear() { session = ''; definitions.clear(); values.clear(); owners.clear(); aliases.clear(); revision.value++; },
  };
}
