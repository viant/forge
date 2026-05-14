import assert from 'node:assert/strict';

import { ensureUIBridgeClientId, startUIBridgeHTTP } from './bridge.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const windowTarget = new EventTarget();
  windowTarget.setTimeout = setTimeout.bind(globalThis);
  windowTarget.clearTimeout = clearTimeout.bind(globalThis);
  let storedClientId = '';
  windowTarget.sessionStorage = {
    getItem(key) {
      return key === 'forge.uiBridge.clientId' ? storedClientId : null;
    },
    setItem(key, value) {
      if (key === 'forge.uiBridge.clientId') storedClientId = String(value || '');
    }
  };
  globalThis.window = windowTarget;

  const seededId = ensureUIBridgeClientId();
  assert.equal(typeof seededId, 'string');
  assert.equal(seededId.length > 0, true);
  assert.equal(ensureUIBridgeClientId(), seededId);
  assert.equal(storedClientId, seededId);

  const calls = [];
  let snapshotAttempts = 0;

  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    calls.push(body);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-1' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      snapshotAttempts += 1;
      if (snapshotAttempts === 1) {
        return new Response(JSON.stringify({ error: { message: 'unauthorized' } }), { status: 401, headers });
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return new Response('', { status: 202, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stop = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10_000,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [],
      conversationId: 'conv-1'
    })
  });

  await sleep(25);
  window.dispatchEvent(new Event('agently:authorized'));
  await sleep(25);
  stop();

  const snapshotCalls = calls.filter((entry) => entry.method === 'ui.snapshot');
  assert.equal(snapshotCalls.length, 2);
  assert.deepEqual(snapshotCalls[0].params?.data, snapshotCalls[1].params?.data);
  console.log('bridge auth snapshot retry ✓ resends identical snapshot after auth recovery');

  let aborted = false;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    const headers = new Headers({ 'Mcp-Session-Id': 'session-2' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot' || body.method === 'ui.snapshot.get') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return await new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }, { once: true });
      });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopAbort = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10_000,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [],
      conversationId: 'conv-2'
    })
  });

  await sleep(25);
  stopAbort();
  await sleep(25);
  assert.equal(aborted, true);
  console.log('bridge stop abort ✓ cancels in-flight poll requests');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
}
