import assert from 'node:assert/strict';
import {hydrateReportRequestEnvelope,mapReportRequestEnvelope,reportRequestWindowIdentity} from './reportRequestEnvelope.js';
import {applyReportBuilderRequestHook} from '../components/dashboard/reportBuilderHooks.js';

const definition={entity:7,variant:8,trial:false,catalog:{id:'fixture:7:8:false',profile:'overview',defaults:['count']}};
const config={dimensions:[{id:'region',key:'region'}],measures:[{id:'count',key:'count'}],dataSources:[{id:'summary',queryDefaultsFromDefinition:{measures:{path:'catalog.defaults',type:'enabledNames'}}}],
 reportOptions:[{name:'enabled',type:'boolean'},{name:'threshold',type:'number'}],request:{maxRows:5,
 definitionIdentity:{fields:{Entity:{path:'entity',type:'singlePositiveInteger'},Variant:{path:'variant',type:'positiveInteger',resolveWhenAbsent:true},Trial:{path:'trial',type:'boolean'}},catalog:{path:'catalog.id',prefix:'fixture:',separator:':',fields:['Entity','Variant','Trial']}},
 profileQueryDefaults:{path:'catalog.profile',values:{overview:{resultSet:'all'}}},
 envelope:{version:1,fields:{'Body.entity':{window:'Entity',type:'singlePositiveInteger'},'Body.variant':{window:'Variant',type:'positiveInteger'},'Body.trial':{window:'Trial',type:'boolean'},'Body.fields':{query:'measures',type:'enabledNames'},'Body.options':{query:'options',type:'declaredOptions',optional:true,omitEmpty:true},'Body.offset':{query:'offset',type:'nonNegativeInteger'},'Body.limit':{query:'limit',type:'positiveInteger'},'Body.resultSet':{query:'resultSet',type:'string',optional:true}}}}};
const parameters={Entity:[7],Trial:false},hydrated=hydrateReportRequestEnvelope(config,parameters,definition);
const query={measures:{},options:{enabled:false,threshold:0},offset:0,limit:20};
const actual=mapReportRequestEnvelope(hydrated,query,'summary');
assert.deepEqual(actual,{Body:{entity:7,variant:8,trial:false,fields:['count'],options:{enabled:false,threshold:0},offset:0,limit:5,resultSet:'all'}});
assert.deepEqual(query.measures,{});
assert.equal(config.request.envelopeContext,undefined);
assert.deepEqual(mapReportRequestEnvelope(hydrated,{...query,measures:{count:true}},'summary').Body.fields,['count']);
assert.deepEqual(mapReportRequestEnvelope(hydrated,{...query,options:{}},'summary').Body.options,undefined);
assert.deepEqual(applyReportBuilderRequestHook(null,hydrated,{},query,{datasetId:'summary'}),actual);
assert.equal(applyReportBuilderRequestHook(null,config,{},query),null,'unverified metadata never falls back to a raw request');
assert.deepEqual(mapReportRequestEnvelope({},query),query,'legacy queries preserve their existing shape');
for(const values of [{Entity:[7,9],Trial:false},{Entity:0,Trial:false},{Entity:7,Trial:'false'}])assert.throws(()=>reportRequestWindowIdentity(config,values));
assert.throws(()=>hydrateReportRequestEnvelope(config,{...parameters,Variant:9},definition),/identity/);
assert.throws(()=>hydrateReportRequestEnvelope(config,parameters,{...definition,catalog:{...definition.catalog,id:'wrong'}}),/catalog/);
for(const changed of [{...query,measures:{count:1}},{...query,measures:{unknown:true}},{...query,options:{enabled:'false'}},{...query,options:{foreign:0}}])assert.throws(()=>mapReportRequestEnvelope(hydrated,changed,'summary'));
assert.throws(()=>mapReportRequestEnvelope(hydrated,query,'foreign'),/dataset/);
for(const destination of ['__proto__.x','Body.constructor.x','backend.method','Body..field','a.b.c.d.e.f.g.h.i']){
 const changed=structuredClone(hydrated);changed.request.envelope.fields[destination]={literal:'bad',type:'string'};
 assert.throws(()=>mapReportRequestEnvelope(changed,query,'summary'),/path/);
}
const tooMany=structuredClone(hydrated);tooMany.request.envelope.fields=Object.fromEntries(Array.from({length:33},(_,i)=>[`field${i}`,{literal:1,type:'positiveInteger'}]));
assert.throws(()=>mapReportRequestEnvelope(tooMany,query),/declaration/);
const conflict=structuredClone(hydrated);conflict.request.envelope.fields.Body={literal:'conflict',type:'string'};
assert.throws(()=>mapReportRequestEnvelope(conflict,query),/Conflicting/);
const executable=structuredClone(hydrated);executable.request.envelope.fields['Body.execute']={literal:'while(true){}',type:'evaluateJavaScript'};
assert.throws(()=>mapReportRequestEnvelope(executable,query),/Unknown/);
console.log('Generic report request envelope contracts passed; no producer or browser acceptance claimed.');
