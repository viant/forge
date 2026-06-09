import { startUIBridge, startUIBridgeHTTP } from './bridge.js';

const UI_BRIDGE_STOP_KEY = '__forgeUIBridgeAutoStartStop';
const UI_BRIDGE_STARTED_KEY = '__forgeUIBridgeAutoStartStarted';
let startedState = false;
let stopFnState = null;

function getGlobalBridgeState() {
  if (typeof window === 'undefined') {
    return { started: startedState, stopFn: stopFnState };
  }
  let started = false;
  let stopFn = null;
  try {
    started = !!window[UI_BRIDGE_STARTED_KEY];
  } catch (_) {}
  try {
    stopFn = typeof window[UI_BRIDGE_STOP_KEY] === 'function' ? window[UI_BRIDGE_STOP_KEY] : null;
  } catch (_) {}
  return {
    started: started || startedState,
    stopFn: stopFn || stopFnState,
  };
}

function setGlobalBridgeState(started, stopFn) {
  startedState = !!started;
  stopFnState = typeof stopFn === 'function' ? stopFn : null;
  if (typeof window === 'undefined') return;
  try {
    window[UI_BRIDGE_STARTED_KEY] = startedState;
  } catch (_) {}
  try {
    window[UI_BRIDGE_STOP_KEY] = stopFnState;
  } catch (_) {}
}

function readViteEnv(key) {
  try {
    // eslint-disable-next-line no-undef
    return (import.meta && import.meta.env) ? import.meta.env[key] : undefined;
  } catch (_) {
    return undefined;
  }
}

function truthy(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Attempts to start the Forge UI WS bridge once per page load.
 *
 * Opt-in sources (first match wins):
 * - options.url/options.token
 * - endpoints.uiBridgeWS / endpoints.uiBridgeToken
 * - connectorConfig.uiBridge.{url,token}
 * - Vite env: VITE_FORGE_UI_BRIDGE_URL / VITE_FORGE_UI_BRIDGE_TOKEN
 *
 * Enable logic:
 * - If a URL is found, it starts automatically.
 * - Or set VITE_FORGE_UI_BRIDGE_ENABLED=true with a URL.
 */
export function maybeAutoStartUIBridge({ endpoints, connectorConfig, url, token } = {}) {
  if (!isBrowser()) return null;
  const state = getGlobalBridgeState();
  if (state.started) return state.stopFn;

  const envEnabled = truthy(readViteEnv('VITE_FORGE_UI_BRIDGE_ENABLED'));

  const cfgURL =
    url ||
    endpoints?.uiBridgeWS ||
    endpoints?.forgeUIWS ||
    endpoints?.uiBridgeHTTP ||
    endpoints?.forgeUIHTTP ||
    connectorConfig?.uiBridge?.url ||
    readViteEnv('VITE_FORGE_UI_BRIDGE_URL');
  const cfgTransport = String(
    connectorConfig?.uiBridge?.transport
    || endpoints?.uiBridgeTransport
    || endpoints?.forgeUITransport
    || ''
  ).trim().toLowerCase();

  if (!cfgURL) return null;
  if (!envEnabled && readViteEnv('VITE_FORGE_UI_BRIDGE_ENABLED') !== undefined && !envEnabled) {
    return null;
  }

  const cfgToken =
    token ||
    endpoints?.uiBridgeToken ||
    endpoints?.forgeUIToken ||
    connectorConfig?.uiBridge?.token ||
    readViteEnv('VITE_FORGE_UI_BRIDGE_TOKEN');

  try {
    const isHTTP = cfgTransport === 'http'
      || cfgURL.startsWith('http://')
      || cfgURL.startsWith('https://')
      || cfgURL.startsWith('/');
    if (isHTTP) {
      const stopFn = startUIBridgeHTTP({
        url: cfgURL,
        token: cfgToken,
        snapshotOptions: connectorConfig?.uiBridge?.snapshotOptions,
        snapshotBuilder: connectorConfig?.uiBridge?.snapshotBuilder,
        clientId: connectorConfig?.uiBridge?.clientId,
        startupReadyEvent: connectorConfig?.uiBridge?.startupReadyEvent,
        startupReadyTimeoutMs: connectorConfig?.uiBridge?.startupReadyTimeoutMs,
      });
      setGlobalBridgeState(true, stopFn);
      return stopFn;
    } else {
      const stopFn = startUIBridge({
        url: cfgURL,
        token: cfgToken,
        snapshotOptions: connectorConfig?.uiBridge?.snapshotOptions,
        snapshotBuilder: connectorConfig?.uiBridge?.snapshotBuilder,
        clientId: connectorConfig?.uiBridge?.clientId,
        startupReadyEvent: connectorConfig?.uiBridge?.startupReadyEvent,
        startupReadyTimeoutMs: connectorConfig?.uiBridge?.startupReadyTimeoutMs,
      });
      setGlobalBridgeState(true, stopFn);
      return stopFn;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[forge][uiBridge] auto-start failed', e);
    return null;
  }
}

export function stopAutoUIBridge() {
  const state = getGlobalBridgeState();
  try {
    state.stopFn?.();
  } catch (_) {}
  setGlobalBridgeState(false, null);
}
