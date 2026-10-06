import assert from "node:assert/strict";
import {
  resolveReportRunCommandIdentity, isLinkedReportRunReplay, captureReportRunDispatchSnapshot,
  createPendingReportRunExecution, resolvePendingReportRunExecutionAction,
  bindDurableReportRunBeginResult, normalizeReportRunBeginResult,
  buildLinkedReportRunCompileInput, completeAndActivateReportRun, beginAndDispatchReportRun
} from "./reportBuilderRunPersistence.js";
const id="12345678-1234-1234-1234-123456789ABC", ref=" opaque/ref ";
const command=resolveReportRunCommandIdentity({requestId:id,reportAdmissionRef:ref});
assert.deepEqual(command,{requestId:id,reportAdmissionRef:ref});
assert.equal(resolveReportRunCommandIdentity({}),null);
for(const input of [{requestId:id},{reportAdmissionRef:ref},{requestId:"bad",reportAdmissionRef:ref},{requestId:id,reportAdmissionRef:null}]) assert.throws(()=>resolveReportRunCommandIdentity(input));
const pending=createPendingReportRunExecution({origin:"prompt",commandIdentity:command});
assert.equal(resolvePendingReportRunExecutionAction(pending,{origin:"prompt",commandIdentity:command}),"reuse");
assert.equal(resolvePendingReportRunExecutionAction(pending,{origin:"prompt",commandIdentity:{requestId:id,reportAdmissionRef:"changed"}}),"reject");
assert.equal(resolvePendingReportRunExecutionAction(pending,{origin:"prompt"}),"supersede");
const request={filters:{orderId:[7]},limit:10,offset:0};
const bindings={planId:"plan",profile:"forecast-daily-v1",columns:[{key:"value",calls:[{opId:"op",requestHash:"hash",responsePointer:"/data/0/value"}]}]};
const doc={kind:"reportDocument",datasets:[{id:"daily",sourceBindings:bindings}],blocks:[],opaque:{keep:true}};
const spec={source:{kind:"dashboard.reportBuilder",containerId:"builder",stateKey:"state",dataSourceRef:"cube"},parameters:{viewMode:"table",pageSize:50,groupBy:"",orderField:"",orderDir:"desc"},datasets:[{id:"daily",dataSourceRef:"cube",request}]};
const snapshot=captureReportRunDispatchSnapshot({request,materialization:{reportDocument:doc,reportSpec:spec},metadata:{origin:"prompt",commandIdentity:command,event:{context:{conversationId:"conversation"}}}});
doc.datasets[0].sourceBindings.planId="edited";
const result=normalizeReportRunBeginResult({enabled:true,reportAdmissionRef:ref,run:{reportRunId:"run",revision:1,status:"running",requestedParams:{...request,_agentlyForecastCommand:{version:1,ref,requestId:id}}}});
const handle=bindDurableReportRunBeginResult(result,snapshot,{uiRunRequestId:id});
assert.equal(handle.reportAdmissionRef,ref);
assert.equal(isLinkedReportRunReplay(handle,snapshot),true);
assert.throws(()=>isLinkedReportRunReplay(handle,{...snapshot,metadata:{...snapshot.metadata,commandIdentity:{requestId:id,reportAdmissionRef:"changed"}}}),/conflict/);
assert.throws(()=>isLinkedReportRunReplay(handle,{...snapshot,requestFingerprint:"changed"}),/conflict/);
assert.equal(isLinkedReportRunReplay(handle,{...snapshot,metadata:{...snapshot.metadata,commandIdentity:null}}),false);
assert.throws(()=>bindDurableReportRunBeginResult({...result,reportAdmissionRef:"changed"},snapshot,{uiRunRequestId:id}));
const fill={datasets:[{id:"daily",dataSourceRef:"cube",request,rows:[{value:0,date:"2026-10-01"}]}]};
const local={reportSpec:spec,reportFill:fill,reportPrint:{local:true}};
const input=buildLinkedReportRunCompileInput(handle,local);
assert.equal(input.reportId,id);assert.equal(input.reportAdmissionRef,ref);
assert.equal(input.fences[1].payload.sourceBindings.planId,"plan");
assert.deepEqual(input.fences[1].payload.data,fill.datasets[0].rows);
assert.deepEqual(input.invocation.datasets,spec.datasets);
assert.equal(input.fences.at(-1).payload.mode,"commit");
const noBinding={...handle,invocation:{...handle.invocation,materialization:{...handle.invocation.materialization,reportDocument:{...doc,datasets:[{id:"daily"}]}}}};
assert.throws(()=>buildLinkedReportRunCompileInput(noBinding,local),/missing trusted source bindings/);
assert.throws(()=>buildLinkedReportRunCompileInput(handle,{...local,reportFill:{datasets:[{...fill.datasets[0],request:{filters:{orderId:[8]}}}]}}),/scope/);
let compilerCalls=0,completeCalls=0;
const server={reportSpec:{server:"spec"},reportFill:{server:"fill"},reportPrint:{server:"print"}};
await completeAndActivateReportRun({
  compile:async args=>{compilerCalls++;assert.deepEqual(args,input);return server;},
  complete:async args=>{completeCalls++;assert.deepEqual(args.reportPrint,server.reportPrint);assert.deepEqual(args.reportSpec,server.reportSpec);return {reportRunId:"run",revision:2,status:"completed"};}
},handle,local,{shouldActivate:()=>false});
assert.equal(compilerCalls,1);assert.equal(completeCalls,1);
await assert.rejects(()=>completeAndActivateReportRun({complete:()=>{throw Error("must not complete");}},handle,local,{shouldActivate:()=>false}),/host compiler/);
let dispatches=0;
await beginAndDispatchReportRun(snapshot,{begin:async()=>({ok:true,started:false}),dispatch:()=>dispatches++});
assert.equal(dispatches,0);
await completeAndActivateReportRun({complete:async args=>{assert.deepEqual(args.reportPrint,local.reportPrint);return {reportRunId:"run",revision:2,status:"completed"};}},{...handle,reportAdmissionRef:undefined},local,{shouldActivate:()=>false});
console.log("reportRunCommandReceipt: exact pair, pending conflict, immutable bindings, server compiler-only completion and manual path passed");
