import { startUIBridge, startUIBridgeHTTP } from './bridge.js';

let stopFn = null;
let started = false;

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
  if (started) return stopFn;
  if (!isBrowser()) return null;

  const envEnabled = truthy(readViteEnv('VITE_FORGE_UI_BRIDGE_ENABLED'));

  const cfgURL =
    url ||
    endpoints?.uiBridgeWS ||
    endpoints?.forgeUIWS ||
    endpoints?.uiBridgeHTTP ||
    endpoints?.forgeUIHTTP ||
    connectorConfig?.uiBridge?.url ||
    readViteEnv('VITE_FORGE_UI_BRIDGE_URL');

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
    if (cfgURL.startsWith('http://') || cfgURL.startsWith('https://')) {
      stopFn = startUIBridgeHTTP({ url: cfgURL, token: cfgToken });
    } else {
      stopFn = startUIBridge({ url: cfgURL, token: cfgToken });
    }
    started = true;
    return stopFn;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[forge][uiBridge] auto-start failed', e);
    return null;
  }
}

export function stopAutoUIBridge() {
  try {
    stopFn?.();
  } catch (_) {}
  stopFn = null;
  started = false;
}
