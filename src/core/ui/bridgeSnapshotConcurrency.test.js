import assert from 'node:assert/strict';
import {startUIBridgeHTTP, publishUIBridgeSnapshotNow} from './bridge.js';

const originalFetch = globalThis.fetch;
let version = 1;
let snapshots = 0;
let active = 0;
let peak = 0;
const releases = [];
const response = (id, result = {}) => new Response(JSON.stringify({jsonrpc:'2.0', id, result}), {
    status:200, headers:{'Mcp-Session-Id':'test-session'},
});
globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.method === 'ui.snapshot') {
        snapshots++; active++; peak = Math.max(peak, active);
        if (snapshots > 1) await new Promise(resolve => releases.push(resolve));
        active--;
    }
    if (body.method === 'ui.poll') await new Promise(resolve => {
        options.signal.addEventListener('abort', resolve, {once:true});
    });
    return response(body.id);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stop = startUIBridgeHTTP({url:'http://example.test/ui/rpc',
    snapshotIntervalMs:10000, snapshotStatusIntervalMs:10000,
    snapshotBuilder:()=>({windows:[], version})});
try {
    await sleep(25);
    assert.equal(snapshots, 1);
    version = 2;
    const requests = Array.from({length:30},()=>publishUIBridgeSnapshotNow());
    await sleep(25);
    assert.equal(snapshots, 2);
    assert.equal(active, 1);
    version = 3;
    releases.shift()();
    await sleep(25);
    assert.equal(snapshots, 3, 'publish the latest state once after the blocked snapshot finishes');
    releases.shift()();
    await Promise.all(requests);
    assert.equal(peak, 1);
    assert.equal(snapshots, 3);
    console.log('bridge snapshot concurrency: one in-flight snapshot and latest-state recovery passed');
} finally {
    stop(); globalThis.fetch = originalFetch;
}

snapshots = 0;
version = 1;
let failSnapshot;
globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.method === 'ui.snapshot') {
        snapshots++;
        if (snapshots === 2) {
            await new Promise(resolve => { failSnapshot = resolve; });
            return new Response('unavailable',{status:503});
        }
    }
    if (body.method === 'ui.poll') await new Promise(resolve => options.signal.addEventListener('abort',resolve,{once:true}));
    return response(body.id);
};
const stopFailure = startUIBridgeHTTP({url:'http://example.test/ui/rpc',
    snapshotIntervalMs:10000,snapshotStatusIntervalMs:10000,
    snapshotBuilder:()=>({windows:[],version})});
try {
    await sleep(25);
    version = 2;
    const requests = Array.from({length:30},()=>publishUIBridgeSnapshotNow());
    await sleep(25);
    assert.equal(snapshots,2);
    failSnapshot();
    assert.deepEqual(await Promise.all(requests),Array(30).fill(false));
    assert.equal(snapshots,2,'failed snapshots must not trigger a backlog of immediate retries');
    version = 3;
    assert.equal(await publishUIBridgeSnapshotNow(),true);
    assert.equal(snapshots,3,'a later explicit request can recover after failure');
    console.log('bridge snapshot failure: coalesced failures, honest status and later recovery passed');
} finally { stopFailure(); globalThis.fetch = originalFetch; }
