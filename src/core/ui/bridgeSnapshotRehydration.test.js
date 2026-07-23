import assert from 'node:assert/strict';

import { startUIBridgeHTTP } from './bridge.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const target = new EventTarget();
  target.sessionStorage = { getItem: () => '', setItem: () => {} };
  globalThis.window = target;
  globalThis.document = {
    visibilityState: 'visible',
    hasFocus: () => true,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };

  const calls = [];
  let statusChecks = 0;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    calls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': 'snapshot-rehydration' });
    let result = {};
    if (body.method === 'ui.hello') result = { ok: true };
    if (body.method === 'ui.snapshot.get') result = { connected: true, snapshot: { conversationId: 'conv-1', windows: [] } };
    if (body.method === 'ui.snapshot.status') {
      statusChecks += 1;
      result = { connected: statusChecks > 1 };
    }
    if (body.method === 'ui.poll') return new Response('', { status: 202, headers });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200, headers });
  };

  const stop = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    snapshotStatusIntervalMs: 10,
    reconnectDelayMs: 10_000,
    snapshotBuilder: () => ({ conversationId: 'conv-1', windows: [] }),
  });
  await sleep(2200);
  stop();

  assert.equal(statusChecks >= 1, true);
  assert.equal(calls.filter((method) => method === 'ui.snapshot').length, 1);

  const reconnectCalls = [];
  let reconnectStatusChecks = 0;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    reconnectCalls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': `restart-${reconnectCalls.filter((method) => method === 'ui.hello').length}` });
    if (body.method === 'ui.snapshot.status') {
      reconnectStatusChecks += 1;
      if (reconnectStatusChecks === 1) {
        return new Response('', { status: 404, headers });
      }
    }
    if (body.method === 'ui.poll') return new Response('', { status: 202, headers });
    const result = body.method === 'ui.snapshot.get'
      ? { connected: false }
      : { ok: true };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200, headers });
  };

  const stopAfterRestart = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    snapshotStatusIntervalMs: 10,
    reconnectDelayMs: 10_000,
    snapshotBuilder: () => ({ conversationId: 'conv-1', windows: [{ windowId: 'reportBuilder__conv-1' }] }),
  });
  await sleep(2300);
  stopAfterRestart();

  assert.equal(reconnectCalls.filter((method) => method === 'ui.hello').length >= 2, true);
  assert.equal(reconnectCalls.filter((method) => method === 'ui.snapshot').length >= 2, true);
  console.log('bridge snapshot rehydration ✓ republishes unchanged state after backend loss');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
}
