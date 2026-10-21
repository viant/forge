import assert from 'node:assert/strict';
import {registerControlActions,invokeRegisteredControlAction,listRegisteredControlActions,readRegisteredControlActions,validateWidgetControlValue,widgetControlActions} from './controlActions.js';
import {activeWindows,getMetadataSignal,getFormSignal,getSelectionSignal,getCollectionSignal} from '../store/signals.js';
import {getOperationRevision,assertOperationTarget} from './operationRevision.js';
const meta={windowId:'operate-unit',dataSourceRef:'record',controlId:'name',scope:'form',dataField:'name'};
let called=[],state={visible:true,disabled:false,readOnly:false,actions:{setValue:({value})=>called.push(value)},validate:value=>value.length>5?'too long':null};
const off=registerControlActions(meta,()=>state);
await invokeRegisteredControlAction({...meta,value:'Good'},'setValue');assert.deepEqual(called,['Good']);
for(const [patch,pattern] of [[{disabled:true},/disabled/],[{readOnly:true},/read-only/],[{visible:false},/hidden/],[{sensitive:true},/sensitive/]]) {
 const old=state;state={...state,...patch};await assert.rejects(invokeRegisteredControlAction({...meta,value:'Other'},'setValue'),pattern);state=old;
}
await assert.rejects(invokeRegisteredControlAction({...meta,value:'invalid'},'setValue'),/validation/);
await assert.rejects(invokeRegisteredControlAction({...meta,dataField:'other',value:'Fine'},'setValue'),/registered binding/);
assert.deepEqual(called,['Good']);
const second=registerControlActions(meta,()=>state);await assert.rejects(invokeRegisteredControlAction({...meta,value:'Fine'},'setValue'),/ambiguous/);second();
assert.deepEqual(listRegisteredControlActions({windowId:meta.windowId})[0].supportedActions,['setValue']);off();await assert.rejects(invokeRegisteredControlAction({...meta,value:'Fine'},'setValue'),/unsupported/);
let clicked=0;const actions=widgetControlActions({item:{type:'button'},props:{onClick:()=>{clicked++;}}});await actions.click();assert.equal(clicked,1);
assert.deepEqual(widgetControlActions({item:{type:'file'},props:{onChange:()=>{throw Error('file must not run');}}}),{});
assert.equal(validateWidgetControlValue(20,{item:{type:'number'},props:{max:10}}),'number is outside allowed bounds');
assert.equal(validateWidgetControlValue('two',{item:{type:'select'},props:{options:[{value:'one'},{value:'two',disabled:true}]}}),'option is unavailable or disabled');
assert.equal(validateWidgetControlValue('bad',{item:{type:'text'},props:{maxLength:2}}),'maximum length exceeded');
activeWindows.value=[{windowId:meta.windowId,conversationId:'chat-current',resourceTarget:{uri:'window://unit',candidate:'1'}}];
getMetadataSignal(meta.windowId).value={dataSource:{record:{}},view:{content:{items:[{id:'privateCode',sensitive:true,dataField:'privateCode'}]}}};
getFormSignal(`${meta.windowId}DSrecord`).value={name:'A',privateCode:'secret-a'};
getCollectionSignal(`${meta.windowId}DSrecord`).value=[{id:7,name:'A'}];getSelectionSignal(`${meta.windowId}DSrecord`).value={selected:{id:7}};
const first=getOperationRevision(meta.windowId);assert.equal(getOperationRevision(meta.windowId),first);
getFormSignal(`${meta.windowId}DSrecord`).peek().name='B';const next=getOperationRevision(meta.windowId);assert.notEqual(next,first,'in-place draft edits must invalidate the operation revision');
getFormSignal(`${meta.windowId}DSrecord`).peek().privateCode='secret-b';assert.equal(getOperationRevision(meta.windowId),next,'explicitly sensitive values are excluded');
assert.throws(()=>assertOperationTarget({windowId:meta.windowId,expectedRevision:first}),/stale/);
assert.throws(()=>assertOperationTarget({windowId:meta.windowId,conversationId:'foreign-chat'}),/outside/);
assert.throws(()=>assertOperationTarget({windowId:meta.windowId,resourceTarget:{uri:'window://other'}}),/pinned/);
assert.equal(assertOperationTarget({windowId:meta.windowId,conversationId:'chat-current',expectedRevision:next}),next);
getCollectionSignal(`${meta.windowId}DSrecord`).peek().unshift({id:8,name:'new row'});const afterInsert=getOperationRevision(meta.windowId);assert.notEqual(afterInsert,next,'in-place row insertion/order change must invalidate CAS');
getCollectionSignal(`${meta.windowId}DSrecord`).peek()[0].name='updated in place';assert.notEqual(getOperationRevision(meta.windowId),afterInsert,'in-place visible scalar changes must invalidate CAS');
console.log('PASS: live handler dispatch, guard/validation rejection, ambiguous/unmounted failure, typed widgets, stable revisions and in-place draft CAS');

let releaseOperation;
let pending=true;
const pendingOff=registerControlActions({windowId:'pending-window',controlId:'action'},()=>({visible:true,disabled:false,readOnly:false,actions:{click:()=>pending?new Promise((_,reject)=>{releaseOperation=reject;}):true}}));
const crossOff=registerControlActions({windowId:'different-window',controlId:'action'},()=>({visible:true,disabled:false,readOnly:false,actions:{click:()=>true}}));
const pendingCall=invokeRegisteredControlAction({windowId:'pending-window',controlId:'action'},'click');
await assert.rejects(invokeRegisteredControlAction({windowId:'pending-window',controlId:'action'},'click'),/pending/);
assert.equal((await invokeRegisteredControlAction({windowId:'different-window',controlId:'action'},'click')).ok,true);
releaseOperation(new Error('operation rejected asynchronously'));await assert.rejects(pendingCall,/asynchronously/);pending=false;
assert.equal((await invokeRegisteredControlAction({windowId:'pending-window',controlId:'action'},'click')).ok,true);pendingOff();crossOff();
console.log('PASS: per-window asynchronous operation guard rejects duplicate actions, permits other windows and cleans up after failure');

let actionProviderCalls=0;
const readOff=registerControlActions({windowId:'read-unit',controlId:'safe'},()=>{actionProviderCalls++;throw Error('Read must not invoke this guard');},()=>({visible:true,disabled:false,readOnly:false,value:{name:'Public',apiToken:'private',localStateOwner:{binding:'private-owner'}},actions:{click:()=>{throw Error('Read must not click');}}}));
const secretOff=registerControlActions({windowId:'read-unit',controlId:'opaque'},()=>{throw Error('Read must not invoke');},()=>({visible:true,disabled:false,readOnly:false,sensitive:true,value:'sensitive',actions:{}}));
const observed=readRegisteredControlActions({windowId:'read-unit',offset:0,limit:1});assert.equal(observed.total,2);assert.equal(observed.hasMore,true);assert.equal(observed.controls[0].value.name,'Public');assert.equal(observed.controls[0].value.apiToken,'[redacted]');assert.equal(observed.controls[0].value.localStateOwner,'[redacted]');assert.equal(actionProviderCalls,0);assert.equal(observed.redacted,true);
assert.equal(readRegisteredControlActions({windowId:'read-unit',controlId:'opaque'}).controls[0].value,'[redacted]');assert.throws(()=>readRegisteredControlActions({windowId:'read-unit',limit:51}),/bounds/);readOff();secretOff();
console.log('PASS: lazy bounded live-control reads use passive snapshots, redact secret values and never execute guards or callbacks');

const hiddenOff=registerControlActions({windowId:'duplicate-read',controlId:'name'},()=>({visible:false,actions:{setValue(){}}}));
const visibleOff=registerControlActions({windowId:'duplicate-read',controlId:'name'},()=>({visible:true,value:'visible',actions:{setValue(){}}}));
const visibleRead=readRegisteredControlActions({windowId:'duplicate-read',controlId:'name'});assert.equal(visibleRead.total,1);assert.equal(visibleRead.controls[0].value,'visible');hiddenOff();visibleOff();

const nestedRow={id:1,access:{editable:true},options:{allowed:['one']}};
getCollectionSignal(`${meta.windowId}DSrecord`).value=[nestedRow];getSelectionSignal(`${meta.windowId}DSrecord`).value={selected:nestedRow,rowIndex:0};
const nestedBefore=getOperationRevision(meta.windowId);nestedRow.access.editable=false;nestedRow.options.allowed.push('two');
assert.notEqual(getOperationRevision(meta.windowId),nestedBefore,'in-place nested selected-record guard/options changes invalidate CAS without rehashing unrelated large collections');
const hugeMetaOff=registerControlActions({windowId:'oversized-read',controlId:'huge',label:'x'.repeat(70000)},()=>({visible:true,value:'safe',actions:{}}));
assert.throws(()=>readRegisteredControlActions({windowId:'oversized-read'}),/bounded read budget/);hugeMetaOff();
// A native awaited dialog must yield a continuation instead of deadlocking
// subsequent normal selection/commit actions in the same window.
activeWindows.value=[{windowId:'lookup-flow',conversationId:'chat'}];getMetadataSignal('lookup-flow').value={dialogs:[{id:'picker'}]};
const picker=(await import('../store/signals.js')).getDialogSignal('lookup-flowDialogpicker');picker.value={open:false};
let resolveLookup,originCalls=0,chosen;
const originOff=registerControlActions({windowId:'lookup-flow',controlId:'lookup'},()=>({visible:true,disabled:false,readOnly:false,actions:{click:async()=>{originCalls++;picker.value={open:true};chosen=await new Promise(resolve=>{resolveLookup=resolve;});}}}));
const continueOff=registerControlActions({windowId:'lookup-flow',controlId:'picker:select'},()=>({visible:picker.peek().open===true,disabled:false,readOnly:false,actions:{click:()=>{picker.value={open:false};resolveLookup({id:7});}}}));
const pendingLookup=await invokeRegisteredControlAction({windowId:'lookup-flow',controlId:'lookup'},'click');assert.equal(pendingLookup.status,'awaiting_interaction');assert.equal(pendingLookup.pendingInteraction.targetId,'picker');
await assert.rejects(invokeRegisteredControlAction({windowId:'lookup-flow',controlId:'lookup'},'click'),/awaiting/);
await invokeRegisteredControlAction({windowId:'lookup-flow',controlId:'picker:select'},'click');for(let i=0;i<5;i++)await Promise.resolve();
assert.equal(chosen.id,7);assert.equal(originCalls,1);assert.equal(readRegisteredControlActions({windowId:'lookup-flow',controlId:'lookup'}).controls[0].operationState.status,'handler_completed');originOff();continueOff();
console.log('PASS: awaited native-dialog continuation yields pending state, accepts normal same-window selection and records completion without duplicate origin invocation');
