// Centralized Forge client logger with namespace + level control.
// Usage:
//   import { getLogger, ForgeLog } from '../utils/logger';
//   const log = getLogger('ds');
//   log.debug('message', payload);
// Control via env or window:
//   VITE_FORGE_LOG_ENABLE=1|0
//   VITE_FORGE_LOG_LEVEL=debug|info|warn|error
//   VITE_FORGE_LOG_NS=ds,connector,container,signals (comma list) or '*' for all
//   At runtime: window.ForgeLog.setLevel('debug'); window.ForgeLog.setNamespaces('ds,connector');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function readEnv(key, fallback) {
  try {
    // Vite exposes import.meta.env
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, key)) {
      return import.meta.env[key];
    }
  } catch (_) {}
  if (typeof window !== 'undefined') {
    const k = `__${key}__`;
    if (typeof window[k] !== 'undefined') return window[k];
  }
  return fallback;
}

const state = {
  enabled: (() => {
    const e = readEnv('VITE_FORGE_LOG_ENABLE', undefined);
    if (typeof window !== 'undefined' && typeof window.__FORGE_LOG_ENABLE__ !== 'undefined') {
      return !!window.__FORGE_LOG_ENABLE__;
    }
    if (typeof e !== 'undefined') return String(e) !== '0' && String(e).toLowerCase() !== 'false';
    return false;
  })(),
  level: (() => {
    const l = readEnv('VITE_FORGE_LOG_LEVEL', undefined);
    if (typeof window !== 'undefined' && window.__FORGE_LOG_LEVEL__) return String(window.__FORGE_LOG_LEVEL__).toLowerCase();
    return (l ? String(l).toLowerCase() : 'warn');
  })(),
  namespaces: (() => {
    const ns = readEnv('VITE_FORGE_LOG_NS', undefined);
    const runtime = (typeof window !== 'undefined') ? window.__FORGE_LOG_NS__ : undefined;
    const raw = runtime || ns || '';
    if (raw === '*' || raw === 'all') return '*';
    if (!raw) return '';
    return String(raw)
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  })(),
};

function allowed(ns) {
  if (!state.enabled) return false;
  const lvl = LEVELS[state.level] || LEVELS.warn;
  return (ns && (state.namespaces === '*' || (Array.isArray(state.namespaces) && state.namespaces.includes(String(ns).toLowerCase()))))
    || (state.namespaces === '' && true); // no filter set => allow all
}

function should(level) {
  const cur = LEVELS[state.level] || LEVELS.warn;
  const want = LEVELS[level] || LEVELS.debug;
  return want >= cur;
}

export function getLogger(ns) {
  const prefix = ns ? `[forge][${ns}]` : '[forge]';
  return {
    debug: (...args) => { if (allowed(ns) && should('debug')) try { console.debug(prefix, ...args); } catch(_) {} },
    info:  (...args) => { if (allowed(ns) && should('info'))  try { console.info(prefix, ...args); } catch(_) {} },
    warn:  (...args) => { if (allowed(ns) && should('warn'))  try { console.warn(prefix, ...args); } catch(_) {} },
    error: (...args) => { if (allowed(ns) && should('error')) try { console.error(prefix, ...args); } catch(_) {} },
  };
}

export const ForgeLog = {
  enable(v = true) { state.enabled = !!v; if (typeof window !== 'undefined') window.__FORGE_LOG_ENABLE__ = state.enabled; },
  setLevel(lvl = 'warn') { state.level = String(lvl).toLowerCase(); if (typeof window !== 'undefined') window.__FORGE_LOG_LEVEL__ = state.level; },
  setNamespaces(ns = '') {
    if (ns === '*' || ns === 'all') { state.namespaces = '*'; }
    else if (!ns) { state.namespaces = ''; }
    else { state.namespaces = String(ns).split(',').map(s => s.trim().toLowerCase()).filter(Boolean); }
    if (typeof window !== 'undefined') window.__FORGE_LOG_NS__ = ns;
  },
  get config() { return { ...state }; },
};

// Expose on window for runtime toggling
try {
  if (typeof window !== 'undefined') {
    window.ForgeLog = ForgeLog;
  }
} catch (_) {}
