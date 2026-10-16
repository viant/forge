import test from "node:test";
import assert from "node:assert/strict";
import {createCursorPagingSession, cursorPagingAssociation, markCompletedCursorAssociation} from "../../hooks/paging.js";
import {dispatchReportBuilderDatasourceRequest, applyReportBuilderResolvedCursorPage,
    reportBuilderDispatchFingerprint, resolveReportBuilderCompletedCursorPage} from "./reportBuilderDatasourceDispatch.js";
import {buildReportBuilderRequest,buildReportBuilderDefaultState} from "./reportBuilderUtils.js";
import {captureReportRunDispatchSnapshot, bindReportRunInvocation, matchesReportRunSettlementCurrency, settleReportRunInvocation} from "./reportBuilderRunPersistence.js";
const paging={enabled:true,mode:"cursor",size:1,parameters:{page:"resumeToken",size:"batchSize"}};
const config={dimensions:[{id:"channel",field:"channel",default:true}],measures:[{id:"spend",field:"spend",default:true}],request:{autoFetch:false}};
function fixture(){let input={};return {dataSource:{paging},identity:{windowId:"owned",dataSourceId:"rows"},metadata:{resource:{uri:"window://owned/one",contentFingerprint:"original"},resourceTarget:{formFactor:"phone"}},signals:{input:{peek:()=>input,get value(){return input;},set value(next){input=next;}}}};}
function completed(context,session,page){const input=context.signals.input.peek();const req=session.begin(page,cursorPagingAssociation(context,input));const result=session.finish(req,{hasMore:req.page<3,nextCursor:req.page===1?"after-alpha":req.page===2?"after-beta":undefined});input.page=req.page;return markCompletedCursorAssociation(result,req.signature);}
test("fresh restored page two starts at one without restoring continuation tokens",()=>{
 const context=fixture();let state={...buildReportBuilderDefaultState(config),page:2},fingerprint="";
 const oldRequest=buildReportBuilderRequest(config,state);
 const page=applyReportBuilderResolvedCursorPage({context,state,request:oldRequest,info:{},initial:true,shouldFetch:false,
  buildRequest:next=>buildReportBuilderRequest(config,next),markDispatch:value=>{fingerprint=value;},persist:next=>{state=next;}});
 assert.equal(page,1);assert.equal(state.page,1);assert.deepEqual(context.signals.input.peek(),{});
 assert.equal(fingerprint,reportBuilderDispatchFingerprint(JSON.stringify(buildReportBuilderRequest(config,state)),false,paging,1));
});
test("Run at unknown page two settles its captured identity before view sync, then Next and Back use admitted pages",async()=>{
 const context=fixture(),session=createCursorPagingSession();let state={...buildReportBuilderDefaultState(config),page:2};
 const request=buildReportBuilderRequest(config,state),snapshot=captureReportRunDispatchSnapshot({request,metadata:{datasourcePage:2}});
 const activeRun=bindReportRunInvocation({runId:"owned-run",status:"running",durable:false},snapshot);
 dispatchReportBuilderDatasourceRequest(context,request,true,2);const info=completed(context,session,2);
 assert.equal(info.currentPage,1);
 let fingerprint=reportBuilderDispatchFingerprint(snapshot.requestFingerprint,true,paging,2),changes=0;
 const reconcile=pendingRun=>applyReportBuilderResolvedCursorPage({context,state,request,info,pendingRun,shouldFetch:true,
  buildRequest:next=>buildReportBuilderRequest(config,next),markDispatch:value=>{fingerprint=value;},persist:next=>{state=next;changes++;}});
 assert.equal(reconcile(true),null);assert.equal(state.page,2);
 const event={runId:activeRun.invocation.runId,requestFingerprint:snapshot.requestFingerprint,fingerprint:snapshot.requestFingerprint,status:"succeeded"};
 assert.equal(matchesReportRunSettlementCurrency(activeRun,event,{currentRun:activeRun,currentFingerprint:snapshot.requestFingerprint,dispatchFingerprint:fingerprint}),true);
 const settled=await settleReportRunInvocation(activeRun,event,{complete:run=>({...run,status:"completed"})});
 assert.equal(settled.accepted,true);assert.equal(settled.run.status,"completed");
 assert.equal(reconcile(false),1);assert.equal(state.page,1);assert.equal(changes,1);
 const nextFingerprint=reportBuilderDispatchFingerprint(JSON.stringify(buildReportBuilderRequest(config,state)),true,paging,1);
 assert.equal(fingerprint,nextFingerprint,"view sync premarks dispatch, so no duplicate fetch");
 for(const page of [2,3,2]){dispatchReportBuilderDatasourceRequest(context,buildReportBuilderRequest(config,{...state,page}),true,page);const result=completed(context,session,page);assert.equal(result.currentPage,page);}
});
test("late query/filter/parent/target completion and wire-forged page metadata cannot reconcile current view",()=>{
 for(const changed of ["query","filter","parent","target"]){const context=fixture(),session=createCursorPagingSession(),state=buildReportBuilderDefaultState(config),request=buildReportBuilderRequest(config,state);
  dispatchReportBuilderDatasourceRequest(context,request,true,1);const info=completed(context,session,1);
  if(changed==="query")context.signals.input.value={...context.signals.input.peek(),parameters:{different:"query"}};
  if(changed==="filter")context.signals.input.value={...context.signals.input.peek(),filter:{different:"filter"}};
  if(changed==="parent")context.metadata.resource.contentFingerprint="new";
  if(changed==="target")context.metadata.resourceTarget.formFactor="tablet";
  assert.equal(resolveReportBuilderCompletedCursorPage({context,info,request}),null,changed);
 }
 const context=fixture();context.signals.input.value={page:1,parameters:{}};
 assert.equal(resolveReportBuilderCompletedCursorPage({context,info:{currentPage:1},request:{}}),null);
 assert.equal(resolveReportBuilderCompletedCursorPage({context,info:{currentPage:1},request:{},loading:true}),null);
});

test("completion marker is local-only and loading/error/frozen/offset frames remain untouched",()=>{
 const context=fixture(),session=createCursorPagingSession(),state=buildReportBuilderDefaultState(config),request=buildReportBuilderRequest(config,state);
 dispatchReportBuilderDatasourceRequest(context,request,true,1);const info=completed(context,session,1);
 assert.equal(Object.getOwnPropertySymbols(info).length,1);
 assert.equal(Object.getOwnPropertySymbols(JSON.parse(JSON.stringify(info))).length,0);
 for(const guard of [{loading:true},{error:new Error("failed")},{frozen:true},{pendingRun:true}])
  assert.equal(resolveReportBuilderCompletedCursorPage({context,info,request,...guard}),null);
 context.dataSource={paging:{enabled:true,mode:"offset"}};
 assert.equal(resolveReportBuilderCompletedCursorPage({context,info,request}),null);
});
