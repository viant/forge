import { buildUISnapshot } from './snapshot.js';
import { runUICommand } from './commands.js';
import { restoreWindowsFromSnapshot } from '../store/signals.js';

let activeSnapshotPublisher = null;
const UI_BRIDGE_CLIENT_STORAGE_KEY = 'forge.uiBridge.clientId';

function snapshotFingerprint(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return String(snapshot || '');
  const clone = { ...snapshot };
  if (Object.prototype.hasOwnProperty.call(clone, 'ts')) {
    clone.ts = 0;
  }
  return JSON.stringify(clone);
}

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return `ui_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

export function ensureUIBridgeClientId(preferred = '') {
  if (typeof window === 'undefined') return String(preferred || '').trim();
  try {
    const existing = String(window.__forgeUIBridgeClientId || '').trim();
    if (existing) return existing;
    let stored = '';
    try {
      stored = String(window.sessionStorage?.getItem(UI_BRIDGE_CLIENT_STORAGE_KEY) || '').trim();
    } catch (_) {}
    const next = String(preferred || '').trim() || stored || randomId();
    window.__forgeUIBridgeClientId = next;
    try {
      window.sessionStorage?.setItem(UI_BRIDGE_CLIENT_STORAGE_KEY, next);
    } catch (_) {}
    return next;
  } catch (_) {
    return String(preferred || '').trim();
  }
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

/**
 * Optional UI bridge for "reverse API" control.
 *
 * Usage (app side):
 *   import { startUIBridge } from 'forge/core';
 *   const stop = startUIBridge({ url: 'ws://localhost:8787/ui' });
 *   // later: stop()
 */
export function startUIBridge(options = {}) {
  const url = options.url || options.wsURL;
  if (!url) throw new Error('startUIBridge: url is required');
  if (typeof WebSocket === 'undefined') throw new Error('startUIBridge: WebSocket is not available');

  const clientId = ensureUIBridgeClientId(options.clientId);
  const snapshotOptions = options.snapshotOptions || { includeCollection: false };
  const snapshotBuilder = typeof options.snapshotBuilder === 'function'
    ? options.snapshotBuilder
    : () => buildUISnapshot(snapshotOptions);
  const snapshotIntervalMs = Math.max(100, options.snapshotIntervalMs || 750);

  let closed = false;
  let ws = null;
  let lastSnapshotText = '';
  let timer = null;
  let detachListeners = null;

  const send = (obj) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  };

  const publishSnapshot = () => {
    const snap = snapshotBuilder();
    const text = snapshotFingerprint(snap);
    if (text === lastSnapshotText) return;
    lastSnapshotText = text;
    send({ type: 'ui.snapshot', clientId, data: snap });
  };
  activeSnapshotPublisher = () => {
    publishSnapshot();
    return Promise.resolve(true);
  };

  const bindImmediateSnapshotListeners = () => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => {
      try { publishSnapshot(); } catch (_) {}
    };
    const events = ['agently:conversation-select', 'agently:conversation-new', 'forge:conversation-active', 'agently:authorized', 'popstate'];
    events.forEach((eventName) => window.addEventListener(eventName, handler));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler));
    };
  };

  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    send({
      type: 'ui.hello',
      clientId,
      token: options.token || undefined,
      capabilities: {
        snapshot: true,
        commands: true,
      },
    });
    publishSnapshot();
    timer = setInterval(publishSnapshot, snapshotIntervalMs);
    detachListeners = bindImmediateSnapshotListeners();
  });

  ws.addEventListener('message', async (ev) => {
    const msg = safeParseJSON(ev?.data);
    if (!msg) return;

    // Expected: {id, method, params}
    const id = msg.id || null;
    const method = msg.method || msg.type;
    const params = msg.params || {};

    if (method === 'ui.snapshot.get') {
      const snap = buildUISnapshot(snapshotOptions);
      send({ id, ok: true, result: snap });
      return;
    }

    if (!method || typeof method !== 'string') return;

    try {
      const result = await runUICommand({ method, params });
      send({ id, ok: true, result });
      if (options.snapshotAfterCommand !== false) {
        publishSnapshot();
      }
    } catch (e) {
      send({ id, ok: false, error: String(e?.message || e) });
    }
  });

  ws.addEventListener('close', () => {
    if (timer) clearInterval(timer);
    timer = null;
  });

  ws.addEventListener('error', () => {
    // Do not throw; let caller decide whether to retry.
  });

  return function stop() {
    if (closed) return;
    closed = true;
    try { detachListeners?.(); } catch (_) {}
    detachListeners = null;
    if (activeSnapshotPublisher) activeSnapshotPublisher = null;
    if (timer) clearInterval(timer);
    timer = null;
    try {
      ws?.close();
    } catch (_) {}
    ws = null;
  };
}

/**
 * HTTP/JSON-RPC bridge with streamable SSE for commands.
 *
 * Expected server endpoint: POST /forge/ui/rpc
 */
export function startUIBridgeHTTP(options = {}) {
  const url = options.url || options.httpURL;
  if (!url) throw new Error('startUIBridgeHTTP: url is required');
  if (typeof fetch === 'undefined') throw new Error('startUIBridgeHTTP: fetch is not available');

  const clientId = ensureUIBridgeClientId(options.clientId);
  const snapshotOptions = options.snapshotOptions || { includeCollection: false };
  const snapshotBuilder = typeof options.snapshotBuilder === 'function'
    ? options.snapshotBuilder
    : () => buildUISnapshot(snapshotOptions);
  const snapshotIntervalMs = Math.max(200, options.snapshotIntervalMs || 1000);
  const reconnectDelayMs = Math.max(500, options.reconnectDelayMs || 1000);
  const sessionHeader = options.sessionHeader || 'Mcp-Session-Id';

  let stopped = false;
  let snapshotTimer = null;
  let lastSnapshotText = '';
  let sessionId = null;
  let lastEventId = null;
  let streamAbort = null;
  let detachListeners = null;
  let detachLifecycle = null;
  const inflightRPC = new Set();

  const registerRPC = (controller) => {
    if (controller) inflightRPC.add(controller);
  };

  const unregisterRPC = (controller) => {
    if (controller) inflightRPC.delete(controller);
  };

  const abortInflightRPC = () => {
    for (const controller of inflightRPC) {
      try { controller.abort(); } catch (_) {}
    }
    inflightRPC.clear();
  };

  const rpc = async (method, params, id) => {
    const body = {
      jsonrpc: '2.0',
      id: id ?? null,
      method,
      params: params || {},
    };
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers[sessionHeader] = sessionId;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    registerRPC(controller);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      const nextSession = res.headers.get(sessionHeader);
      if (nextSession) sessionId = nextSession;
      if (res.status === 202 || res.status === 204) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text) return null;
      const data = safeParseJSON(text);
      if (!data) throw new Error('invalid jsonrpc response');
      if (data.error) throw new Error(data.error.message || 'rpc error');
      return data.result;
    } finally {
      unregisterRPC(controller);
    }
  };

  const publishSnapshot = async () => {
    const snap = snapshotBuilder();
    const text = snapshotFingerprint(snap);
    if (text === lastSnapshotText) return;
    try {
      await rpc('ui.snapshot', { clientId, data: snap }, `snapshot_${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
      lastSnapshotText = text;
    } catch (_) {}
  };
  activeSnapshotPublisher = async () => {
    await publishSnapshot();
    return true;
  };

  const bindImmediateSnapshotListeners = () => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => {
      void publishSnapshot();
    };
    const events = ['agently:conversation-select', 'agently:conversation-new', 'forge:conversation-active', 'agently:authorized', 'popstate'];
    events.forEach((eventName) => window.addEventListener(eventName, handler));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler));
    };
  };

  const bindLifecycleListeners = (stop) => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => {
      stop();
    };
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('pagehide', handler);
      window.removeEventListener('beforeunload', handler);
    };
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeCommand = (params) => {
    if (!params || typeof params !== 'object') return null;
    if (params.jsonrpc && params.method === 'ui.command' && params.params) return params.params;
    if (params.id && params.method) return params;
    return params;
  };

  const handleMessage = async (msg) => {
    if (!msg || typeof msg !== 'object') return;
    const method = msg.method || msg.type;
    if (method !== 'ui.command') return;
    const payload = normalizeCommand(msg.params);
    if (!payload || !payload.method || !payload.id) return;
    try {
      const result = await runUICommand({ method: payload.method, params: payload.params || {} });
      await rpc('ui.response', { id: payload.id, ok: true, result }, `response_${payload.id}`);
      if (options.snapshotAfterCommand !== false) {
        publishSnapshot();
      }
    } catch (e) {
      await rpc('ui.response', { id: payload.id, ok: false, error: String(e?.message || e) }, `response_${payload.id}`);
    }
  };

  const handleSSE = async (chunk) => {
    const lines = chunk.split(/\r?\n/);
    let dataLines = [];
    let eventId = null;
    for (const line of lines) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('id:')) {
        eventId = line.slice(3).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (eventId) lastEventId = eventId;
    if (!dataLines.length) return;
    const payload = dataLines.join('\n');
    const msg = safeParseJSON(payload);
    if (!msg) return;
    await handleMessage(msg);
  };

  const pollLoop = async () => {
    while (!stopped) {
      if (!sessionId) {
        await sleep(200);
        continue;
      }
      try {
        const msg = await rpc('ui.poll', {
          clientId,
          timeoutMs: Math.max(1000, Math.min(20000, snapshotIntervalMs * 4)),
        }, `poll_${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
        if (msg) {
          await handleMessage(msg);
        }
      } catch (_) {
      } finally {
        streamAbort = null;
      }
      await sleep(reconnectDelayMs);
    }
  };

  const restoreSnapshot = async () => {
    try {
      const result = await rpc('ui.snapshot.get', { clientId }, `snapshot_get_${Date.now()}_${Math.floor(Math.random() * 1e6)}`);
      const snapshot = result?.snapshot;
      if (snapshot && typeof snapshot === 'object') {
        restoreWindowsFromSnapshot(snapshot);
      }
    } catch (_) {}
  };

  const start = async () => {
    await rpc('ui.hello', { clientId, token: options.token || undefined }, 1);
    await restoreSnapshot();
    await publishSnapshot();
    snapshotTimer = setInterval(publishSnapshot, snapshotIntervalMs);
    detachListeners = bindImmediateSnapshotListeners();
    detachLifecycle = bindLifecycleListeners(stop);
    pollLoop();
  };

  start();

  function stop() {
    if (stopped) return;
    stopped = true;
    try { detachListeners?.(); } catch (_) {}
    detachListeners = null;
    try { detachLifecycle?.(); } catch (_) {}
    detachLifecycle = null;
    if (activeSnapshotPublisher) activeSnapshotPublisher = null;
    abortInflightRPC();
    try { streamAbort?.abort(); } catch (_) {}
    if (snapshotTimer) clearInterval(snapshotTimer);
    snapshotTimer = null;
  }

  return stop;
}

export async function publishUIBridgeSnapshotNow() {
  if (typeof activeSnapshotPublisher !== 'function') return false;
  await activeSnapshotPublisher();
  return true;
}
