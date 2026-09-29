import assert from 'node:assert/strict';
import {fetchReportRuntimePreviewDatasetPayloadResult} from './useReportRuntimePreviewDatasetPayloads.js';
import {createReportDatasetScheduler} from './reportDatasetScheduler.js';
import {createDataConnector} from '../../hooks/dataconnector.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
let running = 0;
let peak = 0;
const releases = [];
const progress = [];
const builderContext = {handlers:{reportBuilderPreview:{fetchByRef:async ({parameters}) => {
    running++; peak = Math.max(peak,running);
    await new Promise(resolve => releases.push({index:parameters.index,resolve}));
    running--;
    return {rows:[{value:parameters.index}]};
}}}};
const dataset = index => ({id:`part-${index}`,dataSourceRef:'report',request:{index},resultContract:{rowPath:'rows'}});
const result = fetchReportRuntimePreviewDatasetPayloadResult({builderContext,datasets:Array.from({length:6},(_,i)=>dataset(i)),onProgress:p=>progress.push(p)});
await tick();
assert.equal(running,1,'one report must leave room for another report');
const second = fetchReportRuntimePreviewDatasetPayloadResult({builderContext,datasets:[dataset(99)]});
await tick();
assert.equal(running,2,'another report must start ahead of the first report backlog');
assert.deepEqual(progress.at(-1),{total:6,completed:0,running:1,failed:0});
const originalFetch = globalThis.fetch;
try {
    globalThis.fetch = async () => new Response(JSON.stringify({rows:[{id:1}]}),{status:200});
    const ordinaryWindow = createDataConnector({service:{endpoint:'test',uri:'/v1/api/datasources/advertisers/fetch',method:'POST'}},
        {endpoints:{test:{baseURL:'http://example.test'}}});
    assert.deepEqual(await ordinaryWindow.get({}),{rows:[{id:1}]},'ordinary windows must finish while both report slots are occupied');
} finally { globalThis.fetch = originalFetch; }
releases.splice(releases.findIndex(entry=>entry.index===99),1)[0].resolve();
assert.equal(Object.keys((await second).payloads).length,1);
for(let i=0;i<6;i++) { releases.shift().resolve(); await tick(); }
assert.equal(Object.keys((await result).payloads).length,6);
assert.equal(peak,2);
assert.deepEqual(progress.at(-1),{total:6,completed:6,running:0,failed:0});

const controller = new AbortController();
let calls = 0;
let forwardedSignal;
const cancelled = fetchReportRuntimePreviewDatasetPayloadResult({
    datasets:Array.from({length:6},(_,i)=>dataset(i)),signal:controller.signal,
    builderContext:{handlers:{reportBuilderPreview:{fetchByRef:async({signal})=>{
        calls++; forwardedSignal=signal; return new Promise(()=>{});
    }}}},
});
await tick(); controller.abort();
assert.equal((await cancelled).cancelled,true);
assert.equal(calls,1,'queued work from the abandoned report must never start');
assert.equal(forwardedSignal.aborted,true);
const recovered = await fetchReportRuntimePreviewDatasetPayloadResult({datasets:[dataset(42)],
    builderContext:{handlers:{reportBuilderPreview:{fetchByRef:async()=>({rows:[{value:42}]})}}}});
assert.deepEqual(recovered.payloads['part-42'].rows,[{value:42}],'abandoned in-flight work must release its slot even if a host ignores abort');

const schedule = createReportDatasetScheduler(1);
const immediate = new AbortController();
const grantRace = schedule(()=>assert.fail('cancelled operation must not start'),{signal:immediate.signal});
immediate.abort();
await assert.rejects(grantRace,error=>error.name==='AbortError');
assert.equal(await schedule(async()=>42),42,'cancellation between grant and start must release the slot');
console.log('report isolation: fairness, ordinary requests, in-flight cancellation, queued cancellation and grant race passed');
