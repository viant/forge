import { encodeSnapshotRequest } from './snapshotRequestEncoding.js';
import { buildUISnapshot } from './snapshot.js';
import { runUICommand } from './commands.js';
import { restoreWindowsFromSnapshot } from '../store/signals.js';

let activeSnapshotPublisher = null;
let activeHTTPTransportContext = null;
const UI_BRIDGE_CLIENT_STORAGE_KEY = 'forge.uiBridge.clientId';
let seededUIBridgeClientId = '';
let activeBridgeReadyState = null;
const DEFAULT_SNAPSHOT_EVENTS = [
  'forge:conversation-select',
  'forge:conversation-new',
  'forge:conversation-active',
  'forge:authorized',
  'popstate',
];
const DEFAULT_AUTH_READY_EVENTS = ['forge:authorized'];

function createBridgeReadyState() {
  let resolve = null;
  const promise = new Promise((res) => {
    resolve = res;
  });
  activeBridgeReadyState = { promise, resolve };
  return activeBridgeReadyState;
}

function settleBridgeReadyState(ok) {
  if (!activeBridgeReadyState?.resolve) return;
  try {
    activeBridgeReadyState.resolve(!!ok);
  } catch (_) {}
  activeBridgeReadyState = null;
}

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
  const preferredText = String(preferred || '').trim();
  if (seededUIBridgeClientId) return seededUIBridgeClientId;
  if (typeof window === 'undefined') {
    seededUIBridgeClientId = preferredText || seededUIBridgeClientId;
    return seededUIBridgeClientId;
  }
  try {
    let existing = '';
    try {
      existing = String(window.__forgeUIBridgeClientId || '').trim();
    } catch (_) {}
    if (existing) {
      seededUIBridgeClientId = existing;
      return existing;
    }
    let stored = '';
    try {
      stored = String(window.sessionStorage?.getItem(UI_BRIDGE_CLIENT_STORAGE_KEY) || '').trim();
    } catch (_) {}
    const next = preferredText || stored || randomId();
    seededUIBridgeClientId = next;
    try {
      window.__forgeUIBridgeClientId = next;
    } catch (_) {}
    try {
      window.sessionStorage?.setItem(UI_BRIDGE_CLIENT_STORAGE_KEY, next);
    } catch (_) {}
    return next;
  } catch (_) {
    seededUIBridgeClientId = preferredText || seededUIBridgeClientId || randomId();
    return seededUIBridgeClientId;
  }
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function isUnauthorizedError(err) {
  const status = Number(err?.status || 0);
  if (status === 401 || status === 403) return true;
  const message = String(err?.message || '').trim();
  return message === 'HTTP 401' || message === 'HTTP 403';
}

function isMissingSessionError(err) {
  const status = Number(err?.status || 0);
  if (status === 404) return true;
  const message = String(err?.message || '').trim();
  return message === 'HTTP 404';
}

function currentVisibilityState() {
  if (typeof document === 'undefined') return 'visible';
  return document.visibilityState === 'hidden' ? 'hidden' : 'visible';
}

function currentWindowFocus() {
  if (typeof document === 'undefined' || typeof document.hasFocus !== 'function') return true;
  try {
    return !!document.hasFocus();
  } catch (_) {
    return true;
  }
}

function snapshotLooksStartupReady(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const conversationId = String(snapshot.conversationId || '').trim();
  return !!conversationId;
}

function normalizeEventList(value, fallback = []) {
  const raw = Array.isArray(value) ? value : [value];
  const events = raw
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (!events.length) return [...fallback];
  return Array.from(new Set(events));
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
  const snapshotEvents = normalizeEventList(options.snapshotEvents, DEFAULT_SNAPSHOT_EVENTS);

  let closed = false;
  let ws = null;
  let lastSnapshotText = '';
  let timer = null;
  let detachListeners = null;
  let readyToPublish = false;

  const send = (obj) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  };

  const publishSnapshot = () => {
    if (!readyToPublish) return;
    const snap = snapshotBuilder();
    const text = snapshotFingerprint(snap);
    if (text === lastSnapshotText) return;
    lastSnapshotText = text;
    send({ type: 'ui.snapshot', clientId, data: snap });
  };
  activeSnapshotPublisher = () => {
    if (!readyToPublish) return Promise.resolve(false);
    publishSnapshot();
    return Promise.resolve(true);
  };

  const bindImmediateSnapshotListeners = () => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => {
      try { publishSnapshot(); } catch (_) {}
    };
    snapshotEvents.forEach((eventName) => window.addEventListener(eventName, handler));
    return () => {
      snapshotEvents.forEach((eventName) => window.removeEventListener(eventName, handler));
    };
  };

  ws = new WebSocket(url);
  createBridgeReadyState();

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
    readyToPublish = true;
    publishSnapshot();
    settleBridgeReadyState(true);
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
      if (options.snapshotAfterCommand !== false) {
        publishSnapshot();
      }
      send({ id, ok: true, result });
    } catch (e) {
      send({ id, ok: false, error: String(e?.message || e) });
    }
  });

  ws.addEventListener('close', () => {
    settleBridgeReadyState(false);
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
    settleBridgeReadyState(false);
    readyToPublish = false;
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
  const snapshotStatusIntervalMs = Math.max(1000, options.snapshotStatusIntervalMs || 5000);
  const reconnectDelayMs = Math.max(500, options.reconnectDelayMs || 1000);
  const pollWhenHidden = options.pollWhenHidden === true;
  const pollCycleDelayMs = options.pollCycleDelayMs === 0
    ? 0
    : Math.max(0, Number(options.pollCycleDelayMs ?? reconnectDelayMs) || 0);
  const sessionHeader = options.sessionHeader || 'Mcp-Session-Id';
  const snapshotEvents = normalizeEventList(options.snapshotEvents, DEFAULT_SNAPSHOT_EVENTS);
  const authReadyEvents = normalizeEventList(options.authReadyEvents, DEFAULT_AUTH_READY_EVENTS);

  let stopped = false;
  let snapshotTimer = null;
  let snapshotStatusTimer = null;
  let lastSnapshotText = '';
  let sessionId = null;
  let snapshotGzip = false;
  let maxInflatedSnapshotBytes = 32 * 1024 * 1024;
  const transportContext = () => !stopped && readyToPublish && sessionId ? { url, clientId, sessionHeader, sessionId } : null;
  activeHTTPTransportContext = transportContext;
  let lastEventId = null;
  let streamAbort = null;
  let detachListeners = null;
  let detachLifecycle = null;
  let detachOwner = null;
  let detachAuthRetry = null;
  let readyToPublish = false;
  let readyToPoll = false;
  let generation = 0;
  let startInFlight = null;
  let startGeneration = null;
  let pollInFlight = null;
  let cancelPollSleep = null;
  let detachStartupWait = null;
  let snapshotInFlight = null;
  let snapshotGeneration = null;
  let snapshotStatusInFlight = false;
  const inflightRPC = new Set();
  const startupReadyEvent = String(options.startupReadyEvent || '').trim();
  const startupReadyTimeoutMs = Math.max(0, Number(options.startupReadyTimeoutMs || 0) || 0);
  let visibilityState = currentVisibilityState();
  let hasWindowFocus = currentWindowFocus();

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

  const current = (scope) => !stopped && scope === generation;
  const requireCurrent = (scope) => {
    if (!current(scope)) throw new Error('UI bridge session changed');
  };

  const rpc = async (method, params, id, scope = generation) => {
    requireCurrent(scope);
    const body = {
      jsonrpc: '2.0',
      id: id ?? null,
      method,
      params: params || {},
    };
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers[sessionHeader] = sessionId;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const pollTimeout = Number(params?.timeoutMs);
    const requestTimeoutMs = method === 'ui.poll' ? (Number.isFinite(pollTimeout) && pollTimeout > 0 ? pollTimeout : 20000) + 5000 : 10000;
    const requestTimer = controller ? setTimeout(() => controller.abort(), requestTimeoutMs) : null;
    registerRPC(controller);
    try {
      const requestText = JSON.stringify(body);
      const encoded = method === 'ui.snapshot'
        ? await encodeSnapshotRequest(requestText, {enabled: snapshotGzip, maxInflatedBytes: maxInflatedSnapshotBytes, signal: controller?.signal}) : {body: requestText};
      requireCurrent(scope);
      if (controller?.signal.aborted) throw controller.signal.reason || new Error('UI bridge request cancelled');
      if (encoded.contentEncoding) headers['Content-Encoding'] = encoded.contentEncoding;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: encoded.body,
        signal: controller?.signal,
      });
      if (!current(scope)) {
        await res.body?.cancel().catch(() => {});
        requireCurrent(scope);
      }
      const nextSession = res.headers.get(sessionHeader);
      if (nextSession) sessionId = nextSession;
      if (res.status === 202 || res.status === 204) return null;
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const text = await res.text();
      requireCurrent(scope);
      if (!text) return null;
      const data = safeParseJSON(text);
      if (!data) throw new Error('invalid jsonrpc response');
      if (data.error) throw new Error(data.error.message || 'rpc error');
      return data.result;
    } finally {
      if (requestTimer) clearTimeout(requestTimer);
      unregisterRPC(controller);
    }
  };

  const publishSnapshotOnce = async (publishOptions = {}, scope = generation) => {
    const strict = publishOptions.strict === true;
    if (!readyToPublish || !current(scope)) return false;
    const snap = snapshotBuilder();
    const text = snapshotFingerprint(snap);
    if (text === lastSnapshotText) return true;
    try {
      const result = await rpc('ui.snapshot', { clientId, data: snap }, `snapshot_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, scope);
      requireCurrent(scope);
      if (strict && result == null) {
        throw new Error('UI bridge snapshot was not accepted');
      }
      lastSnapshotText = text;
      return true;
    } catch (err) {
      if (strict) throw err;
      return false;
    }
  };

  const publishSnapshot = async (publishOptions = {}, scope = generation) => {
    if (!current(scope)) return false;
    if (snapshotInFlight) {
      const heldGeneration = snapshotGeneration;
      let accepted, failure;
      try {
        accepted = await snapshotInFlight;
      } catch (error) {
        failure = error;
      }
      if (!current(scope)) return false;
      // Drain a retired publication, then publish the new scope's snapshot.
      if (heldGeneration !== scope) return publishSnapshot(publishOptions, scope);
      if (failure || !accepted) {
        if (publishOptions.strict === true) throw failure || new Error('UI bridge snapshot was not accepted');
        return false;
      }
      return publishSnapshot(publishOptions, scope);
    }
    const pending = publishSnapshotOnce(publishOptions, scope);
    snapshotInFlight = pending;
    snapshotGeneration = scope;
    try { return await pending; }
    finally { if (snapshotInFlight === pending) snapshotInFlight = null; }
  };

  const checkSnapshotStatus = async () => {
    if (!readyToPublish || stopped || snapshotStatusInFlight) return false;
    const scope = generation;
    snapshotStatusInFlight = true;
    try {
      const result = await rpc(
        'ui.snapshot.status',
        { clientId },
        `snapshot_status_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        scope,
      );
      requireCurrent(scope);
      if (result?.connected !== false) return true;
      // The backend may have restarted while this browser retained an unchanged
      // semantic snapshot. Reset only transport dedupe and republish once.
      lastSnapshotText = '';
      return await publishSnapshot({ strict: true }, scope);
    } catch (err) {
      if (current(scope) && isMissingSessionError(err)) {
        resetSessionAndRestart();
      }
      return false;
    } finally {
      snapshotStatusInFlight = false;
    }
  };
  activeSnapshotPublisher = async () => {
    if (stopped) return false;
    // Chat submission can arrive while ui.hello is still in flight, or after
    // a failed startup. Join/retry that handshake before declaring the local
    // conversation snapshot published.
    if (!readyToPublish) await ensureStarted();
    if (!readyToPublish || stopped) return false;
    return publishSnapshot();
  };

  const bindImmediateSnapshotListeners = () => {
    if (typeof window === 'undefined') return () => {};
    const handler = () => {
      void publishSnapshot();
    };
    snapshotEvents.forEach((eventName) => window.addEventListener(eventName, handler));
    return () => {
      snapshotEvents.forEach((eventName) => window.removeEventListener(eventName, handler));
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

  const isPollingOwner = () => pollWhenHidden || visibilityState === 'visible';

  const bindOwnerListeners = () => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
    const syncOwnerState = () => {
      visibilityState = currentVisibilityState();
      hasWindowFocus = currentWindowFocus();
    };
    const onVisibility = () => syncOwnerState();
    const onFocus = () => {
      hasWindowFocus = true;
      visibilityState = currentVisibilityState();
    };
    const onBlur = () => {
      hasWindowFocus = false;
      visibilityState = currentVisibilityState();
    };
    syncOwnerState();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  };

  const waitForStartupReady = () => {
    if (typeof window === 'undefined' || !startupReadyEvent) {
      return Promise.resolve();
    }
    try {
      if (snapshotLooksStartupReady(snapshotBuilder())) {
        return Promise.resolve();
      }
    } catch (_) {}
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        window.removeEventListener(startupReadyEvent, onReady);
        if (detachStartupWait === finish) detachStartupWait = null;
        resolve();
      };
      const onReady = () => finish();
      window.addEventListener(startupReadyEvent, onReady, { once: true });
      detachStartupWait = finish;
      if (startupReadyTimeoutMs > 0) {
        timer = setTimeout(finish, startupReadyTimeoutMs);
      }
    });
  };

  const sleep = (ms) => new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      if (cancelPollSleep === finish) cancelPollSleep = null;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    cancelPollSleep = finish;
    if (stopped) finish();
  });

  const scheduleAuthRetry = () => {
    if (typeof window === 'undefined' || stopped || detachAuthRetry) return;
    const scope = generation;
    const onAuthorized = () => {
      try { detachAuthRetry?.(); } catch (_) {}
      detachAuthRetry = null;
      // Authorization can arrive while the failed startup is still settling.
      // Retry through the same owner after that startup releases its slot.
      void Promise.resolve(startInFlight).then(() => {
        if (current(scope) && !readyToPublish) return ensureStarted();
      });
    };
    authReadyEvents.forEach((eventName) => window.addEventListener(eventName, onAuthorized, { once: true }));
    detachAuthRetry = () => {
      authReadyEvents.forEach((eventName) => window.removeEventListener(eventName, onAuthorized));
    };
  };

  const resetSessionAndRestart = () => {
    if (stopped) return;
    generation++;
    sessionId = null;
    snapshotGzip = false;
    readyToPublish = false;
    readyToPoll = false;
    lastSnapshotText = '';
    abortInflightRPC();
    try { detachListeners?.(); } catch (_) {}
    detachListeners = null;
    try { detachLifecycle?.(); } catch (_) {}
    detachLifecycle = null;
    try { detachOwner?.(); } catch (_) {}
    detachOwner = null;
    try { detachStartupWait?.(); } catch (_) {}
    detachStartupWait = null;
    try { detachAuthRetry?.(); } catch (_) {}
    detachAuthRetry = null;
    if (snapshotTimer) clearInterval(snapshotTimer);
    snapshotTimer = null;
    if (snapshotStatusTimer) clearInterval(snapshotStatusTimer);
    snapshotStatusTimer = null;
    void ensureStarted();
  };

  const normalizeCommand = (params) => {
    if (!params || typeof params !== 'object') return null;
    if (params.jsonrpc && params.method === 'ui.command' && params.params) return params.params;
    if (params.id && params.method) return params;
    return params;
  };

  const handleMessage = async (msg, scope = generation) => {
    requireCurrent(scope);
    if (!msg || typeof msg !== 'object') return;
    const method = msg.method || msg.type;
    if (method !== 'ui.command') return;
    const payload = normalizeCommand(msg.params);
    if (!payload || !payload.method || !payload.id) return;
    try {
      const result = await runUICommand({ method: payload.method, params: payload.params || {} });
      requireCurrent(scope);
      if (options.snapshotAfterCommand !== false) {
        await publishSnapshot({ strict: true }, scope);
      }
      await rpc('ui.response', { id: payload.id, ok: true, result }, `response_${payload.id}`, scope);
    } catch (e) {
      if (!current(scope)) return;
      await rpc('ui.response', { id: payload.id, ok: false, error: String(e?.message || e) }, `response_${payload.id}`, scope);
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
      if (!sessionId || !readyToPoll) {
        await sleep(200);
        continue;
      }
      if (!isPollingOwner()) {
        await sleep(reconnectDelayMs);
        continue;
      }
      const scope = generation;
      try {
        const msg = await rpc('ui.poll', {
          clientId,
          timeoutMs: Math.max(1000, Math.min(20000, snapshotIntervalMs * 4)),
        }, `poll_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, scope);
        if (msg) {
          await handleMessage(msg, scope);
        }
      } catch (err) {
        if (current(scope) && isMissingSessionError(err)) {
          resetSessionAndRestart();
        }
        if (stopped) return;
        await sleep(reconnectDelayMs);
      }
      streamAbort = null;
      if (pollCycleDelayMs > 0) {
        await sleep(pollCycleDelayMs);
      }
    }
  };

  const ensurePolling = () => {
    if (pollInFlight || stopped) return;
    // Recovery replaces the session, never the owner of this polling lane.
    pollInFlight = pollLoop().finally(() => { pollInFlight = null; });
  };

  const restoreSnapshot = async (scope) => {
    try {
      const result = await rpc('ui.snapshot.get', { clientId }, `snapshot_get_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, scope);
      requireCurrent(scope);
      const snapshot = result?.snapshot;
      if (snapshot && typeof snapshot === 'object') {
        restoreWindowsFromSnapshot(snapshot);
        lastSnapshotText = snapshotFingerprint(snapshot);
      }
    } catch (_) {}
  };

  const start = async (scope) => {
    try {
      const hello = await rpc('ui.hello', { clientId, token: options.token || undefined }, 1, scope);
      requireCurrent(scope);
      snapshotGzip = Array.isArray(hello?.capabilities?.snapshotRequestEncodings) && hello.capabilities.snapshotRequestEncodings.includes('gzip');
      const advertisedLimit = hello?.capabilities?.maxInflatedSnapshotBytes;
      maxInflatedSnapshotBytes = Number.isSafeInteger(advertisedLimit) && advertisedLimit > 0
        ? Math.min(advertisedLimit, 32 * 1024 * 1024) : 32 * 1024 * 1024;
      await restoreSnapshot(scope);
      requireCurrent(scope);
      await waitForStartupReady();
      requireCurrent(scope);
      readyToPublish = true;
      await publishSnapshot({}, scope);
      requireCurrent(scope);
      settleBridgeReadyState(true);
      snapshotTimer = setInterval(publishSnapshot, snapshotIntervalMs);
      snapshotStatusTimer = setInterval(checkSnapshotStatus, snapshotStatusIntervalMs);
      detachListeners = bindImmediateSnapshotListeners();
      detachLifecycle = bindLifecycleListeners(stop);
      detachOwner = bindOwnerListeners();
      readyToPoll = true;
      ensurePolling();
    } catch (err) {
      if (!current(scope)) return;
      settleBridgeReadyState(false);
      if (isUnauthorizedError(err)) {
        readyToPublish = false;
        scheduleAuthRetry();
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('[forge][uiBridge] http bridge start failed', err);
    }
  };

  const ensureStarted = () => {
    if (stopped) return Promise.resolve();
    const scope = generation;
    if (startInFlight) {
      if (startGeneration === scope) return startInFlight;
      return startInFlight.then(() => { if (current(scope)) return ensureStarted(); });
    }
    startGeneration = scope;
    startInFlight = start(scope).finally(() => {
      startInFlight = null;
    });
    return startInFlight;
  };

  createBridgeReadyState();
  void ensureStarted();

  function stop() {
    if (stopped) return;
    stopped = true;
    generation++;
    if (activeHTTPTransportContext === transportContext) activeHTTPTransportContext = null;
    sessionId = null;
    snapshotGzip = false;
    try { detachListeners?.(); } catch (_) {}
    detachListeners = null;
    try { detachLifecycle?.(); } catch (_) {}
    detachLifecycle = null;
    try { detachOwner?.(); } catch (_) {}
    detachOwner = null;
    try { detachAuthRetry?.(); } catch (_) {}
    detachAuthRetry = null;
    try { detachStartupWait?.(); } catch (_) {}
    detachStartupWait = null;
    if (activeSnapshotPublisher) activeSnapshotPublisher = null;
    settleBridgeReadyState(false);
    readyToPublish = false;
    readyToPoll = false;
    cancelPollSleep?.();
    abortInflightRPC();
    try { streamAbort?.abort(); } catch (_) {}
    if (snapshotTimer) clearInterval(snapshotTimer);
    snapshotTimer = null;
    if (snapshotStatusTimer) clearInterval(snapshotStatusTimer);
    snapshotStatusTimer = null;
  }

  return stop;
}

export async function publishUIBridgeSnapshotNow() {
  if (typeof activeSnapshotPublisher !== 'function') return false;
  return (await activeSnapshotPublisher()) === true;
}

export async function waitForUIBridgeReady(timeoutMs = 1500) {
  if (typeof activeSnapshotPublisher === 'function') {
    try {
      if (await activeSnapshotPublisher()) {
        return true;
      }
    } catch (_) {}
  }
  const promise = activeBridgeReadyState?.promise;
  if (!promise) return false;
  const timeout = Math.max(0, Number(timeoutMs || 0) || 0);
  if (!timeout) {
    return !!(await promise);
  }
  return await Promise.race([
    promise.then((value) => !!value).catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(false), timeout)),
  ]);
}

// Returns only the current negotiated bridge transport, never identity grants.
export function getActiveUIBridgeTransportContext() {
  return activeHTTPTransportContext?.() || null;
}
