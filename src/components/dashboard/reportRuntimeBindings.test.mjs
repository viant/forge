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
assert.deepEqual(resolveBoundReportRuntime(config,source),{status:'loading',reportFill:null},'prior scope must not leak during refresh');
source.signals.control.value={error:'denied'};
assert.deepEqual(resolveBoundReportRuntime(config,source),{status:'error',reportFill:null});
source.signals.control.value={loaded:true};source.signals.collection.value=[];
assert.deepEqual(resolveBoundReportRuntime(config,source).reportFill.datasets[0].rows,[]);
assert.equal(resolveBoundReportRuntime({...config,datasetBindings:{summary:{dataSourceRef:'missing'}}},{}).status,'error');
assert.deepEqual(resolveBoundReportRuntime({reportFill:{blocks:[]}},{}).reportFill,{blocks:[]},'static reports retain their contract');
console.log('Bound report datasets, refresh isolation, empty/error and static compatibility passed.');
