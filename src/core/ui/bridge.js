import { buildUISnapshot } from './snapshot.js';
import { runUICommand } from './commands.js';

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return `ui_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
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

  const clientId = options.clientId || randomId();
  const snapshotOptions = options.snapshotOptions || { includeCollection: false };
  const snapshotIntervalMs = Math.max(100, options.snapshotIntervalMs || 750);

  let closed = false;
  let ws = null;
  let lastSnapshotText = '';
  let timer = null;

  const send = (obj) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  };

  const publishSnapshot = () => {
    const snap = buildUISnapshot(snapshotOptions);
    const text = JSON.stringify(snap);
    if (text === lastSnapshotText) return;
    lastSnapshotText = text;
    send({ type: 'ui.snapshot', clientId, data: snap });
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

  const clientId = options.clientId || randomId();
  const snapshotOptions = options.snapshotOptions || { includeCollection: false };
  const snapshotIntervalMs = Math.max(200, options.snapshotIntervalMs || 1000);
  const reconnectDelayMs = Math.max(500, options.reconnectDelayMs || 1000);
  const sessionHeader = options.sessionHeader || 'Mcp-Session-Id';

  let stopped = false;
  let snapshotTimer = null;
  let lastSnapshotText = '';
  let sessionId = null;
  let lastEventId = null;
  let streamAbort = null;

  const rpc = async (method, params, id) => {
    const body = {
      jsonrpc: '2.0',
      id: id ?? null,
      method,
      params: params || {},
    };
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers[sessionHeader] = sessionId;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
  };

  const publishSnapshot = async () => {
    const snap = buildUISnapshot(snapshotOptions);
    const text = JSON.stringify(snap);
    if (text === lastSnapshotText) return;
    lastSnapshotText = text;
    try {
      await rpc('ui.snapshot', { clientId, data: snap });
    } catch (_) {}
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
      await rpc('ui.response', { id: payload.id, ok: true, result });
      if (options.snapshotAfterCommand !== false) {
        publishSnapshot();
      }
    } catch (e) {
      await rpc('ui.response', { id: payload.id, ok: false, error: String(e?.message || e) });
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

  const streamLoop = async () => {
    while (!stopped) {
      if (!sessionId) {
        await sleep(200);
        continue;
      }
      streamAbort = new AbortController();
      try {
        const headers = { Accept: 'text/event-stream' };
        headers[sessionHeader] = sessionId;
        if (lastEventId) headers['Last-Event-ID'] = String(lastEventId);
        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: streamAbort.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf('\n\n');
          while (idx !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            await handleSSE(chunk);
            idx = buffer.indexOf('\n\n');
          }
        }
      } catch (_) {
        // reconnect on any error
      } finally {
        streamAbort = null;
      }
      await sleep(reconnectDelayMs);
    }
  };

  const start = async () => {
    await rpc('ui.hello', { clientId, token: options.token || undefined }, 1);
    await publishSnapshot();
    snapshotTimer = setInterval(publishSnapshot, snapshotIntervalMs);
    streamLoop();
  };

  start();

  return function stop() {
    stopped = true;
    try { streamAbort?.abort(); } catch (_) {}
    if (snapshotTimer) clearInterval(snapshotTimer);
    snapshotTimer = null;
  };
}
