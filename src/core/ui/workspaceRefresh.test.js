import assert from 'node:assert/strict';
import {activeWindows,getMetadataSignal,getFormSignal,getInputSignal,getSelectionSignal,getViewSignal,getControlSignal,getCollectionSignal,getFormStatusSignal,removeSignalsForKey} from '../store/signals.js';
import {getOperationRevision} from './operationRevision.js';
import {registerControlActions,invalidateControlActionState,getOperationRegistryEpoch} from './controlActions.js';
import {registerWorkspaceRefresh,registerWorkspaceRefreshScopes,listWorkspaceRefreshCapabilities,refreshWorkspace} from './workspaceRefresh.js';
const windowId='neutral-refresh';activeWindows.value=[{windowId,conversationId:'chat'}];getMetadataSignal(windowId).value={dataSource:{record:{}}};
const form=getFormSignal(`${windowId}DSrecord`),input=getInputSignal(`${windowId}DSrecord`),selection=getSelectionSignal(`${windowId}DSrecord`),view=getViewSignal(windowId);
form.value={name:'unsaved'};input.value={filter:{name:'keep'},page:3};selection.value={selected:{id:7}};view.value={tabs:{sections:'second'}};
const state=()=>JSON.stringify([form.peek(),input.peek(),selection.peek(),view.peek()]);const before=state();let reads=0,commits=0;
const cleanup=registerWorkspaceRefresh({windowId,scope:'window'},{admit:async()=>({current:true}),metadata:async()=>{reads++;return {commit:()=>{commits++;}};}});
assert.deepEqual(listWorkspaceRefreshCapabilities(windowId),[{windowId,scope:'window',metadata:true,data:false,preservesLocalState:true}]);
await assert.rejects(refreshWorkspace({windowId}),/data refresh is unsupported/);assert.equal(reads,0);
await assert.rejects(refreshWorkspace({windowId,scope:'form',formId:'invented',reloadMetadata:true}),/unregistered/);
const revision=getOperationRevision(windowId);assert.equal((await refreshWorkspace({windowId,reloadMetadata:true,expectedRevision:revision})).metadataRefreshed,true);assert.equal(reads,1);assert.equal(commits,1);assert.equal(state(),before);cleanup();
let release;const pending=new Promise(resolve=>release=resolve);const c2=registerWorkspaceRefresh({windowId,scope:'window'},{admit:()=>pending,metadata:async()=>({commit:()=>{commits++;}})});
const changed=refreshWorkspace({windowId,reloadMetadata:true});form.value={name:'new human edit'};release(true);await assert.rejects(changed,/stale/);assert.equal(commits,1);c2();
const c3=registerWorkspaceRefresh({windowId,scope:'form',formId:'editor'},{admit:async()=>false,data:async()=>({commit:()=>{commits++;}})});await assert.rejects(refreshWorkspace({windowId,scope:'form',formId:'editor'}),/denied/);assert.equal(commits,1);c3();
// A generic, non-network host may explicitly stage its own normal read result.
let normalReads=0;const c4=registerWorkspaceRefresh({windowId,scope:'tab',containerId:'sections',tabId:'second'},{admit:async()=>true,data:async()=>{const result=++normalReads;return {commit:()=>assert.equal(result,1)};}});await refreshWorkspace({windowId,scope:'tab',containerId:'sections',tabId:'second'});assert.equal(normalReads,1);c4();
activeWindows.value=[];console.log('PASS scoped refresh explicit capabilities, normal host callbacks, state retention, stale/denied/unregistered fail closed');

const adapter={admit:async()=>true,metadata:async()=>({commit:()=>{}})};
const reserved={windowId:'batch-owner',scope:'form',formId:'existing'};
const releaseExisting=registerWorkspaceRefresh(reserved,adapter);
assert.throws(()=>registerWorkspaceRefreshScopes([{windowId:'batch-owner',scope:'window'},reserved],()=>adapter),/already registered/);
assert.deepEqual(listWorkspaceRefreshCapabilities('batch-owner').map(({scope})=>scope),['form']);
releaseExisting();
const releaseBatch=registerWorkspaceRefreshScopes([{windowId:'batch-owner',scope:'window'},reserved],()=>adapter);
assert.equal(listWorkspaceRefreshCapabilities('batch-owner').length,2);
releaseBatch();releaseBatch();
assert.equal(listWorkspaceRefreshCapabilities('batch-owner').length,0);

// Metadata refresh fences user intent, while ordinary UI/data operations keep
// their full state CAS. No caller flag selects the internal fence purpose.
const refreshId='metadata-refresh-fence',sourceId=`${refreshId}DSrows`;
activeWindows.value=[{windowId:refreshId,conversationId:'chat',parameters:{entityId:7}}];
const refreshMetadata={dataSource:{rows:{}}};getMetadataSignal(refreshId).value=refreshMetadata;
const refreshForm=getFormSignal(sourceId),refreshInput=getInputSignal(sourceId),refreshSelection=getSelectionSignal(sourceId),refreshControl=getControlSignal(sourceId),refreshRows=getCollectionSignal(sourceId),refreshStatus=getFormStatusSignal(sourceId);
const reset=()=>{refreshForm.value={name:'retained'};refreshInput.value={parameters:{entityId:7},filter:{name:'kept'},page:2,fetch:true};refreshSelection.value={selected:{id:7}};refreshControl.value={loading:true,error:null};refreshRows.value=[];refreshStatus.value={dirty:false,version:0};};
async function transition(mutate,metadata,allowed){
 reset();let release;const ready=new Promise(resolve=>{release=resolve;});let writes=0;
 const off=registerWorkspaceRefresh({windowId:refreshId},{admit:()=>ready,metadata:async()=>({commit:()=>{writes++;}}),data:async()=>({commit:()=>{writes++;}})});
 try{
  const pending=refreshWorkspace({windowId:refreshId,reloadMetadata:metadata});
  const observed=pending.then(value=>({value}),error=>({error}));mutate();release(true);const result=await observed;
  if(allowed){assert.equal(result.error,undefined);assert.equal(result.value.ok,true);assert.equal(writes,1);}
  else{assert.match(result.error?.message||'',/stale UI operation revision/);assert.equal(writes,0);}
 }finally{off();}
}
for(const mutate of [()=>{refreshControl.value={loading:false,error:'background failure'};},()=>{refreshRows.value=[{id:8}];}]){
 reset();const ordinary=getOperationRevision(refreshId);mutate();assert.notEqual(getOperationRevision(refreshId),ordinary,'ordinary UI revision must retain lifecycle and collection changes');
 await transition(mutate,false,false);
 await transition(mutate,true,true);
}
await transition(()=>{refreshInput.value={...refreshInput.peek(),fetch:false,refresh:false,invocationId:null,formSynchronization:null};refreshStatus.value={dirty:false,version:1};invalidateControlActionState(refreshId);},true,true);
for(const mutate of [()=>{refreshForm.peek().name='human edit';},()=>{refreshInput.peek().parameters.entityId=8;},()=>{refreshSelection.value={selected:{id:8}};},()=>{refreshStatus.value={dirty:true,version:1};}])await transition(mutate,true,false);
// Explicit caller CAS is still checked against full state before admission.
reset();const staleRevision=getOperationRevision(refreshId);refreshControl.value={loading:false};let admitted=0;
const offExplicit=registerWorkspaceRefresh({windowId:refreshId},{admit:async()=>{admitted++;return true;},metadata:async()=>({commit(){}})});
await assert.rejects(refreshWorkspace({windowId:refreshId,reloadMetadata:true,expectedRevision:staleRevision}),/stale/);assert.equal(admitted,0);offExplicit();
// Replacing a registered capability must not become an ABA when the last old
// registration is removed while its window remains mounted.
const capability={windowId:refreshId,controlId:'save'},provider=()=>({visible:true,actions:{click(){}}});
let offCapability=registerControlActions(capability,provider);
await transition(()=>{offCapability();offCapability=registerControlActions(capability,provider);},true,false);
offCapability();activeWindows.value=[];assert.equal(getOperationRegistryEpoch(refreshId,'metadata-refresh'),0);removeSignalsForKey(refreshId);
console.log('PASS metadata refresh tolerates derived completion; full UI/data CAS and user-edit/capability fences remain strict');
