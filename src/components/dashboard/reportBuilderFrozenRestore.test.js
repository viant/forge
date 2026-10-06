import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reportAdmissionDigest,reportRestoreSnapshot,reportRestoreSnapshotKey,verifyFrozenReportRestore,loadFrozenReportRestore,nativeReportArtifactHash} from './reportBuilderFrozenRestore.js';

const vectors=JSON.parse(fs.readFileSync(new URL('../../../testdata/native-report-preparation/admission-digest-v1.json',import.meta.url)));
for(const item of vectors.cases){if(item.error)await assert.rejects(()=>reportAdmissionDigest(JSON.parse(item.json)));else assert.equal(await reportAdmissionDigest(JSON.parse(item.json)),item.sha256,item.name);}
const clone=value=>JSON.parse(JSON.stringify(value));
async function fixture({empty=false,scope=null,primary=false}={}){
  const request={filters:{account:[7]},options:{timeZone:'UTC'}};
  const config={result:{defaultMode:'table'},dataSources:[{id:'daily',dataSourceRef:'cube',request:{filters:{status:'ok'},dimensions:{day:true},measures:{spend:true}},...(scope?{scope}:{})}]};
  const author={opaque:{hookMirror:'preserved'},reportDocumentBlocks:[{id:'table',kind:'tableBlock',datasetRef:primary?'primary':'daily'}]};
  const form={state:author,prefill:{account:[7]},__forge:{prefillRevision:2}};
  const snapshot=reportRestoreSnapshot({form,configuration:config,conversationId:'conversation',windowId:'window',builderRef:'builder',stateKey:'state',primaryDataSourceRef:'cube'});
  const state={...clone(author),orderDir:'desc'};
  let expected=primary?clone(request):{filters:{status:'ok',account:[7]},dimensions:{day:true},measures:{spend:true},options:{timeZone:'UTC'}};
  if(scope?.relativeDateRange)expected.filters={...expected.filters,from:'2026-03-06',to:'2026-03-08'};
  const binding={id:primary?'primary':'daily',dataSourceRef:'cube',request:expected};
  const namespace={version:1,calendar:'gregorian',preparedAt:'2026-03-09T06:30:00.000Z',timeZone:'America/Los_Angeles',builderRef:'builder',stateKey:'state',primaryDataSourceRef:'cube',state,datasets:[binding],digests:{profile:'agently-json-binary64-v1'}};
  for(const[key,value]of Object.entries({prefill:snapshot.prefillIdentity,authorState:author,policyState:state,document:snapshot.document,configuration:config}))namespace.digests[key]=await reportAdmissionDigest(value);
  const source={kind:'dashboard.reportBuilder',containerId:'builder',stateKey:'state',dataSourceRef:'cube'};
  const parameters={groupBy:'',orderDir:'desc',orderField:'',pageSize:50,viewMode:'table'};
  const spec={kind:'reportSpec',source,parameters,datasets:[binding],blocks:snapshot.document.blocks};
  const fill={kind:'reportFill',source,parameters,specHash:nativeReportArtifactHash(spec),datasets:[{...binding,rows:empty?[]:[{day:'2026-03-08',spend:12}],provenance:{rowCount:empty?0:1,truncated:false,hasMore:false,diagnostics:[]}}]};
  const print={kind:'reportPrint',source,specHash:fill.specHash,fillHash:nativeReportArtifactHash(fill),pages:[]};
  const run={status:'completed',ownerId:'owner',conversationId:'conversation',builderRef:'builder',reportRunId:'run',revision:2,requestedParams:{...request,_agentlyReportAdmission:namespace},effectiveParams:request,reportSpec:spec,reportFill:fill,reportPrint:print};
  const context={ownerId:'owner',conversationId:'conversation',activeReportRunId:'run',revision:1};
  return {run,context,snapshot,scopeKey:'account-1'};
}
const original=await fixture();
const restored=await verifyFrozenReportRestore(original);
assert.equal(restored.payloads.daily.rows[0].spend,12);
assert.ok(Object.isFrozen(restored.payloads.daily.rows[0]));
assert.throws(()=>{restored.payloads.daily.rows[0].spend=99;});
assert.deepEqual((await verifyFrozenReportRestore(await fixture({empty:true}))).payloads.daily.rows,[],'empty completed dataset is complete');
assert.deepEqual((await verifyFrozenReportRestore(await fixture({primary:true}))).datasets[0].request,original.run.effectiveParams);
await verifyFrozenReportRestore(await fixture({scope:{mode:'override',relativeDateRange:{preset:'last3days',startParamPath:'filters.from',endParamPath:'filters.to'}}}));
for(const mutate of [
 x=>x.context.ownerId='foreign', x=>x.context.activeReportRunId='other',x=>x.run.conversationId='foreign',
 x=>x.snapshot.prefillIdentity.prefill.account=[8],x=>x.snapshot.authorState.opaque.hookMirror='edited',
 x=>x.snapshot.document.blocks[0].datasetRef='other',x=>x.snapshot.configuration.dataSources[0].dataSourceRef='other',
 x=>x.run.requestedParams._agentlyReportAdmission.datasets[0].request.filters.account=[8],
 x=>x.run.reportFill.datasets[0].rows[0].spend=99,
 x=>x.run.reportSpec.datasets[0].request.filters.account=[8],
 x=>x.run.reportPrint.fillHash='changed',
]){const altered=clone(original);mutate(altered);await assert.rejects(()=>verifyFrozenReportRestore(altered));}
let current=reportRestoreSnapshotKey(original.snapshot),scope='account-1';
const handler={getRestoreScope:()=>scope,readCompletedRestore:async()=>({run:original.run,context:original.context,scopeKey:'account-1'})};
const live=()=>current;
assert.ok((await loadFrozenReportRestore({handler,snapshot:original.snapshot,currentSnapshotKey:live})).frozen);
handler.readCompletedRestore=async()=>{current='edited';return {run:original.run,context:original.context,scopeKey:'account-1'};};
await assert.rejects(()=>loadFrozenReportRestore({handler,snapshot:original.snapshot,currentSnapshotKey:live}),/inputs changed/);
current=reportRestoreSnapshotKey(original.snapshot);
handler.readCompletedRestore=async()=>{scope='account-2';return {run:original.run,context:original.context,scopeKey:'account-1'};};
await assert.rejects(()=>loadFrozenReportRestore({handler,snapshot:original.snapshot,currentSnapshotKey:live}),/account changed/);
console.log('frozen report: shared digest vectors, exact scopes/artifacts, original zoned clock, empty/primary rows, edit/account races passed');
