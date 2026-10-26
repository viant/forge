import assert from 'node:assert/strict';
import {materialize,materializeFill} from './entry.js';
const spec={version:1,kind:'reportSpec',title:'Timing privacy',source:{kind:'dashboard.reportBuilder',containerId:'timing',stateKey:'timing',dataSourceRef:'rows'},parameters:{viewMode:'table',groupBy:'',pageSize:100,orderField:'',orderDir:'asc'},layoutIntent:{kind:'stack',resultPanePosition:'bottom',blockOrder:['table']},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'rows',request:{limit:100,offset:0}}],blocks:[{id:'table',kind:'tableBlock',datasetRef:'primary',columns:[{key:'id',format:'id',rowIdentity:true},{key:'amount',format:'number5'}],runtime:{printRowReference:true}}]};
const input=JSON.stringify({reportSpec:spec,datasets:{primary:{rows:[{id:'000123',amount:.00123},{id:'9007199254740993',amount:null}]}},stage:'untrusted payload cannot enable a callback'});
for(const [fn,expected] of [[materialize,['parse','fill','print','serialize','done']],[materializeFill,['parse','fill','serialize','done']]]) {
 const plain=fn(input);const phases=[];const observed=fn(input,phase=>phases.push(phase));
 assert.equal(observed,plain,'observation must preserve exact serialized artifacts');
 assert.deepEqual(phases,expected);
 const body=JSON.parse(observed);assert.ok(body.reportFill);
 assert.equal(Boolean(body.reportPrint),fn===materialize);
 assert.equal(observed.includes('report.materializer.'),false,'no trace data in artifacts');
}
for(const input of ['not JSON',JSON.stringify({reportSpec:null,datasets:{}})]) {
 const phases=[];assert.throws(()=>materialize(input,phase=>phases.push(phase)));assert.deepEqual(phases,['parse'],'parse/validation failure must not start fill/print/serialization');
}
console.log('stage observer ✓ identical serialized artifacts, ordered boundaries, fillOnly omits print, input cannot enable tracing, failures retain active phase');
