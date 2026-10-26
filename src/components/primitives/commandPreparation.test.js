import test from 'node:test';
import assert from 'node:assert/strict';
import {executeCommand,getCommandState} from './commandExecutor.js';
import {primeWindowSignals,clearProtectedWindowState} from '../../core/store/signals.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function fixture(prepare){
 const calls=[];let parameters;
 const target={handlers:{dataSource:{setInputParameters:p=>{parameters=p;},fetchCollection:()=>{calls.push(parameters);return Promise.resolve();}}}};
 return {calls,context:{Context:()=>target,lookupHandler:name=>name==='Host.prepare'?prepare:undefined},command:{commandId:'save',dataSourceRef:'writer',prepare:'Host.prepare'}};
}
test('async preparation holds the guard and preserves the submitted parameter and extra snapshots',async()=>{
 const entered=deferred(),release=deferred();
 const {context,command,calls}=fixture(async({parameters,extras,signal})=>{assert.equal(signal.aborted,false);entered.resolve();await release.promise;parameters.Data[0].url=extras.data.uploadedURL;return parameters;});
 const input={Data:[{id:7,enabled:false,amount:0,optional:null}],data:{uploadedURL:'https://cdn.test/new.png'}};
 const saving=executeCommand(context,command,input);await entered.promise;
 assert.equal(getCommandState(context,command).phase,'preparing');assert.equal(getCommandState(context,command).guarded,true);
 assert.equal(calls.length,0);assert.equal((await executeCommand(context,command,input)).status,'suppressed');
 input.Data[0].id=8;input.data.uploadedURL='https://cdn.test/changed.png';release.resolve();
 assert.equal((await saving).status,'succeeded');assert.equal(calls.length,1);
 assert.deepEqual(calls[0].Data,[{id:7,enabled:false,amount:0,optional:null,url:'https://cdn.test/new.png'}]);
 assert.equal(getCommandState(context,command).guarded,false);
});
test('confirmation cancellation causes neither preparation nor a writer request',async()=>{
 let prepared=0;const {context,command,calls}=fixture(()=>{prepared++;return {};});
 const outcome=await executeCommand(context,{...command,confirm:'Save?'},{},{confirm:async()=>false});
 assert.equal(outcome.status,'cancelled');assert.equal(prepared,0);assert.equal(calls.length,0);
});
test('failed or missing preparation cannot write; a corrected draft can retry',async()=>{
 let fail=true;const {context,command,calls}=fixture(({parameters})=>{if(fail)throw Error('staging failed');return parameters;});
 const failed=await executeCommand(context,command,{value:0});assert.equal(failed.accepted,false);assert.equal(failed.status,'failed');assert.equal(calls.length,0);
 assert.equal(getCommandState(context,command).writerStatus,'not_invoked');assert.equal(getCommandState(context,command).retryAllowed,true);
 fail=false;assert.equal((await executeCommand(context,command,{value:0})).status,'succeeded');assert.equal(calls.length,1);
 assert.equal((await executeCommand(context,{...command,prepare:'Host.missing'})).status,'failed');assert.equal(calls.length,1);
});
test('preparation timeout aborts its signal and never invokes the writer',async()=>{
 let signal;const {context,command,calls}=fixture(input=>{signal=input.signal;return new Promise(()=>{});});
 const outcome=await executeCommand(context,{...command,timeoutMs:1});
 assert.equal(outcome.status,'failed');assert.equal(outcome.accepted,false);assert.equal(signal.aborted,true);assert.equal(calls.length,0);
 assert.equal(getCommandState(context,command).guarded,false);assert.equal(getCommandState(context,command).retryAllowed,true);
});
test('a revoked protected window cannot write after preparation resolves',async()=>{
 const entered=deferred(),release=deferred();const {context,command,calls}=fixture(async({parameters})=>{entered.resolve();await release.promise;return parameters;});
 const windowId='command-preparation-revocation';primeWindowSignals(windowId,{dataSource:{writer:{}}});context.identity={windowId,protectedWindow:true};
 const saving=executeCommand(context,command,{value:1});await entered.promise;clearProtectedWindowState(windowId);release.resolve();
 const outcome=await saving;assert.equal(outcome.status,'failed');assert.equal(outcome.error.code,'request_superseded');assert.equal(calls.length,0);
});
