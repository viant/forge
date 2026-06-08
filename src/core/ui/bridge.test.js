import assert from 'node:assert/strict';

import { ensureUIBridgeClientId, publishUIBridgeSnapshotNow, startUIBridgeHTTP } from './bridge.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

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
  let visibilityState = 'visible';
  let focused = true;
  globalThis.document = {
    visibilityState,
    hasFocus: () => focused,
    addEventListener: windowTarget.addEventListener.bind(windowTarget),
    removeEventListener: windowTarget.removeEventListener.bind(windowTarget),
  };

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

  const authHelloCalls = [];
  let helloAttempts = 0;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    authHelloCalls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-auth-retry' });
    if (body.method === 'ui.hello') {
      helloAttempts += 1;
      if (helloAttempts === 1) {
        return new Response(JSON.stringify({ error: { message: 'unauthorized' } }), { status: 401, headers });
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { snapshot: { selected: { windowId: 'chat/new', tabId: 'chat/new' }, windows: [] } }
      }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return new Response('', { status: 202, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopUnauthorizedHello = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10_000,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [],
      conversationId: 'conv-auth-retry',
    })
  });

  await sleep(25);
  window.dispatchEvent(new Event('agently:authorized'));
  await sleep(40);
  stopUnauthorizedHello();
  assert.deepEqual(authHelloCalls.slice(0, 4), ['ui.hello', 'ui.hello', 'ui.snapshot.get', 'ui.snapshot']);
  console.log('bridge startup auth retry ✓ retries ui.hello after authorization instead of failing permanently');

  const orderedCalls = [];
  let snapshotGetResolved = false;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    orderedCalls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-restore' });
    if (body.method === 'ui.hello') {
      await sleep(20);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get') {
      await sleep(20);
      snapshotGetResolved = true;
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { snapshot: { selected: { windowId: 'chat/new', tabId: 'chat/new' }, windows: [] } }
      }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return new Response('', { status: 202, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopOrdering = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10_000,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [{ windowId: 'chat/new', windowKey: 'chat/new' }],
      conversationId: 'conv-restore',
    })
  });

  await publishUIBridgeSnapshotNow();
  await sleep(80);
  stopOrdering();
  assert.equal(snapshotGetResolved, true);
  assert.deepEqual(orderedCalls.slice(0, 3), ['ui.hello', 'ui.snapshot.get', 'ui.snapshot']);
  console.log('bridge restore ordering ✓ blocks eager snapshot publish until snapshot.get finishes');

  const duplicateRestoreCalls = [];
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    duplicateRestoreCalls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-restore-same' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          snapshot: {
            selected: { windowId: 'chat/new', tabId: 'chat/new' },
            windows: [],
          },
        },
      }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return new Response('', { status: 202, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopDuplicate = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10_000,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [],
    })
  });

  await sleep(60);
  stopDuplicate();
  assert.deepEqual(duplicateRestoreCalls.slice(0, 3), ['ui.hello', 'ui.snapshot.get', 'ui.poll']);
  console.log('bridge restore dedupe ✓ skips immediate snapshot publish when restored snapshot already matches local state');

  const readyEventCalls = [];
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    readyEventCalls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-ready' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { snapshot: { selected: { windowId: 'chat/new', tabId: 'chat/new' }, windows: [] } }
      }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return new Response('', { status: 202, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopReady = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10_000,
    startupReadyEvent: 'forge:conversation-active',
    startupReadyTimeoutMs: 500,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [{ windowId: 'chat/new', windowKey: 'chat/new' }],
      conversationId: '',
    })
  });

  await sleep(25);
  window.dispatchEvent(new Event('forge:conversation-active'));
  await sleep(40);
  stopReady();
  assert.deepEqual(readyEventCalls.slice(0, 4), ['ui.hello', 'ui.snapshot.get', 'ui.snapshot', 'ui.poll']);
  console.log('bridge startup readiness ✓ defers first publish/poll until the configured startup event');

  const immediateReadyCalls = [];
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    immediateReadyCalls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-ready-immediate' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { snapshot: { selected: { windowId: 'chat/new', tabId: 'chat/new' }, windows: [] } }
      }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return new Response('', { status: 202, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopImmediateReady = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10_000,
    startupReadyEvent: 'forge:conversation-active',
    startupReadyTimeoutMs: 10_000,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [{ windowId: 'chat/new', windowKey: 'chat/new' }],
      conversationId: 'conv-ready',
    })
  });

  await sleep(40);
  stopImmediateReady();
  assert.deepEqual(immediateReadyCalls.slice(0, 4), ['ui.hello', 'ui.snapshot.get', 'ui.snapshot', 'ui.poll']);
  console.log('bridge startup readiness ✓ skips startup wait when snapshot already knows the conversation');

  const commandCalls = [];
  let commandPollCount = 0;
  const openedWindowId = 'forecastingCubeBuilder__conv-command';
  visibilityState = 'visible';
  focused = true;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    commandCalls.push(body);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-command-order' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { snapshot: { selected: { windowId: 'chat/new', tabId: 'chat/new' }, windows: [] } }
      }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      commandPollCount += 1;
      if (commandPollCount === 1) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            method: 'ui.command',
            params: {
              id: 'cmd-open-forecasting',
              method: 'ui.window.open',
              params: {
                windowId: openedWindowId,
                windowKey: 'forecastingCubeBuilder',
                windowTitle: 'Forecasting',
                parameters: {},
                options: {
                  conversationId: 'conv-command',
                  presentation: 'hosted',
                  region: 'chat.top',
                  parentKey: 'chat/new',
                }
              }
            }
          }
        }), { status: 200, headers });
      }
      return new Response('', { status: 202, headers });
    }
    if (body.method === 'ui.response') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopCommandOrder = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10,
  });

  await sleep(120);
  stopCommandOrder();
  const responseIndex = commandCalls.findIndex((entry) => entry.method === 'ui.response' && entry.params?.id === 'cmd-open-forecasting');
  assert.equal(responseIndex > 0, true);
  let snapshotBeforeResponse = null;
  for (let i = responseIndex - 1; i >= 0; i -= 1) {
    if (commandCalls[i].method === 'ui.snapshot') {
      snapshotBeforeResponse = commandCalls[i];
      break;
    }
  }
  assert.equal(!!snapshotBeforeResponse, true);
  assert.equal(snapshotBeforeResponse.params?.data?.windows?.some((win) => win?.windowId === openedWindowId), true);
  console.log('bridge command ordering ✓ publishes opened window snapshot before ui.response');

  const commandFailureCalls = [];
  const commandFailureResponses = [];
  let commandFailurePollCount = 0;
  const rejectedWindowId = 'forecastingCubeBuilder__conv-snapshot-fail';
  visibilityState = 'visible';
  focused = true;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    commandFailureCalls.push(body);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-command-failure' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { snapshot: { selected: { windowId: 'chat/new', tabId: 'chat/new' }, windows: [] } }
      }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot') {
      const hasRejectedWindow = body.params?.data?.windows?.some((win) => win?.windowId === rejectedWindowId);
      if (hasRejectedWindow) {
        return new Response('snapshot rejected', { status: 500, headers });
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      commandFailurePollCount += 1;
      if (commandFailurePollCount === 1) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            method: 'ui.command',
            params: {
              id: 'cmd-open-snapshot-fail',
              method: 'ui.window.open',
              params: {
                windowId: rejectedWindowId,
                windowKey: 'forecastingCubeBuilder',
                windowTitle: 'Forecasting',
                parameters: {},
                options: {
                  conversationId: 'conv-snapshot-fail',
                  presentation: 'hosted',
                  region: 'chat.top',
                  parentKey: 'chat/new',
                }
              }
            }
          }
        }), { status: 200, headers });
      }
      return new Response('', { status: 202, headers });
    }
    if (body.method === 'ui.response') {
      commandFailureResponses.push(body.params);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopCommandSnapshotFailure = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 10,
  });

  await sleep(120);
  stopCommandSnapshotFailure();
  assert.equal(commandFailureResponses.length, 1);
  assert.equal(commandFailureResponses[0]?.id, 'cmd-open-snapshot-fail');
  assert.equal(commandFailureResponses[0]?.ok, false);
  assert.match(String(commandFailureResponses[0]?.error || ''), /HTTP 500/);
  console.log('bridge command failure ✓ rejects success response when opened-window snapshot is not accepted');

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

  const ownerCalls = [];
  visibilityState = 'hidden';
  focused = false;
  globalThis.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '{}'));
    ownerCalls.push(body.method);
    const headers = new Headers({ 'Mcp-Session-Id': 'session-owner' });
    if (body.method === 'ui.hello') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.snapshot.get' || body.method === 'ui.snapshot') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { ok: true } }), { status: 200, headers });
    }
    if (body.method === 'ui.poll') {
      return new Response('', { status: 202, headers });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200, headers });
  };

  const stopOwner = startUIBridgeHTTP({
    url: 'http://example.test/v1/ui/rpc',
    snapshotIntervalMs: 10_000,
    reconnectDelayMs: 25,
    snapshotBuilder: () => ({
      selected: { windowId: 'chat/new', tabId: 'chat/new' },
      windows: [],
      conversationId: 'conv-owner'
    })
  });

  await sleep(80);
  assert.equal(ownerCalls.includes('ui.poll'), false);
  visibilityState = 'visible';
  focused = true;
  window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('visibilitychange'));
  await sleep(650);
  stopOwner();
  assert.equal(ownerCalls.includes('ui.poll'), true);
  console.log('bridge polling owner ✓ hidden/unfocused tabs skip ui.poll until focus returns');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
}
