import assert from 'node:assert/strict';
import {resolveBoundReportRuntime} from './reportRuntimeBindings.js';
const source = {signals: {collection: {value: [{summary: [{spend: 42}]}]}, control: {value: {loaded: true}}}};
const config = {datasetBindings: {summary: {selector: '0.summary'}}, reportSpec: {
 version: 1, datasets: [{id:'summary'}], blocks: [{id:'spend', kind:'kpiBlock', title:'Spend', datasetRef:'summary', valueField:'spend', valueLabel:'Spend', valueFormat:'currency'}]
}};
let result=resolveBoundReportRuntime(config, source);
assert.equal(result.status,'ready');
assert.equal(result.reportFill.datasets[0].rows[0].spend,42);
source.signals.control.value={loading:true};
result=resolveBoundReportRuntime(config,source);
assert.equal(result.status,'loading');assert.equal(result.reportFill,null);
assert.deepEqual(result.pendingReportFill.datasets[0].rows,[],'prior scope must not leak during refresh');
assert.equal(result.pendingReportFill.blocks[0].content.value,null,'pending metric must not retain prior value');
source.signals.control.value={error:'denied'};
result=resolveBoundReportRuntime(config,source);
assert.equal(result.status,'error');assert.equal(result.reportFill,null);assert.deepEqual(result.pendingReportFill.datasets[0].rows,[]);
source.signals.control.value={loaded:true};source.signals.collection.value=[];
assert.deepEqual(resolveBoundReportRuntime(config,source).reportFill.datasets[0].rows,[]);
assert.equal(resolveBoundReportRuntime({...config,datasetBindings:{summary:{dataSourceRef:'missing'}}},{}).status,'error');
assert.deepEqual(resolveBoundReportRuntime({reportFill:{blocks:[]}},{}).reportFill,{blocks:[]},'static reports retain their contract');
console.log('Bound report datasets, refresh isolation, empty/error and static compatibility passed.');

const optional = resolveBoundReportRuntime({
 ...config,
 datasetBindings:{summary:{selector:'0.summary'}, delivery:{dataSourceRef:'unavailable', optional:true}},
}, {...source, Context:() => ({signals:{control:{value:{error:'backend unavailable'}}}})});
assert.equal(optional.status,'ready');
assert.deepEqual(optional.unavailableDatasets,['delivery']);

// A declared editable scope must not turn unavailable datasource handlers into
// a render-time exception or reveal the collection from the previous request.
const controlledConfig = {...config,
 datasetBindings: {summary: {dataSourceRef: 'reader', queryPath: 'query', selector: '0.summary'}},
 reportSpec: {...config.reportSpec, scope: {params: [{id: 'mode', kind: 'text', value: 'all', filterBindings: [{datasetRef: 'summary', path: 'mode'}]}]}},
};
for (const unavailable of [undefined, {signals: {control: {value: {error: 'denied'}}, collection: {value: [{summary: [{spend: 42}]}]}}}, {signals: {control: {value: {loaded: true}}, collection: {value: [{summary: [{spend: 42}]}]}}, handlers: {dataSource: {peekInput: () => ({})}}}]) {
 const unavailableResult = resolveBoundReportRuntime(controlledConfig, {Context: () => unavailable});
 assert.equal(unavailableResult.status, 'error');
 assert.equal(unavailableResult.scopeControlsUnavailable, true);
 assert.equal(unavailableResult.reportFill, null);
 assert.deepEqual(unavailableResult.pendingReportFill.datasets[0].rows, []);
 assert.equal(unavailableResult.pendingReportFill.blocks[0].content.value, null);
}

for (const datasetBindings of [undefined, {}, {unrelated: {dataSourceRef: 'reader'}}]) {
 const missingBinding = resolveBoundReportRuntime({...controlledConfig, datasetBindings}, {});
 assert.equal(missingBinding.status, 'error');
 assert.equal(missingBinding.scopeControlsUnavailable, true);
 assert.equal(missingBinding.reportFill, null);
 assert.deepEqual(missingBinding.pendingReportFill.datasets[0].rows, []);
 assert.equal(missingBinding.pendingReportFill.blocks[0].content.value, null);
}
assert.throws(() => resolveBoundReportRuntime({...controlledConfig, datasetBindings: {summary: {dataSourceRef:'reader'}}}, {Context:()=>({handlers:{dataSource:Object.fromEntries(['peekInput','setInputParameters','setPage','fetchCollection','setLoading','setError'].map(key=>[key,()=>({})]))}})}), /Missing report control dataset binding/, 'malformed authored query paths remain contract errors');

const staticFill = {datasets:[{id:'summary',rows:[{spend:42}]}],blocks:[]};
const staticResult = resolveBoundReportRuntime({...controlledConfig,datasetBindings:undefined,reportFill:staticFill}, {});
assert.equal(staticResult.status,'ready');assert.equal(staticResult.reportFill,staticFill);assert.equal(staticResult.scopeControlsUnavailable,true);
const noRequestSource = {handlers:{dataSource:Object.fromEntries(['peekInput','setInputParameters','setPage','fetchCollection','setLoading','setError'].map(key=>[key,()=>({})]))}};
const noRequestResult = resolveBoundReportRuntime(controlledConfig,{Context:()=>noRequestSource});
assert.equal(noRequestResult.status,'error');assert.equal(noRequestResult.scopeControlsUnavailable,true);assert.deepEqual(noRequestResult.pendingReportFill.datasets[0].rows,[]);
assert.throws(()=>resolveBoundReportRuntime({...controlledConfig,reportSpec:{...controlledConfig.reportSpec,datasets:[{id:'summary',request:'malformed'}]}},{Context:()=>noRequestSource}), /Report request is unavailable/);

const emptyBindingStatic = resolveBoundReportRuntime({...controlledConfig,datasetBindings:{},reportFill:staticFill},{});
assert.equal(emptyBindingStatic.status,'ready');assert.equal(emptyBindingStatic.reportFill,staticFill);assert.equal(emptyBindingStatic.scopeControlsUnavailable,true);
