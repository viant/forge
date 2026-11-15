// Independently authored synthetic component; native mode uses an isolated test server.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import {ReaderBuilder} from './ReaderBuilder.jsx';

const native = new URLSearchParams(location.search).has('native');
const proof = window.__readerVersionsProof = {calls:[],failVersion:null,delayPreview:false,finishPreview:null};
const inspection = (no,state='draft') => ({version:{reportId:'version-proof',versionNo:no,sourceRevision:7,state,compileStatus:'valid'},dql:`SELECT ${no} AS id`,previewInput:{schema:{type:'object',properties:{}}},capabilities:{canEdit:true,canRun:true,canPublish:true,canUseDql:true},structure:{component:{rootView:{name:`Records${no}`,namespace:'r',source:{sql:`SELECT ${no} AS id`},columns:[{name:'id'}]}}}});
const records = new Map([[1,inspection(1)],[2,inspection(2)]]);
const invoke = async (operation,parameters) => {
  proof.calls.push({operation,parameters:structuredClone(parameters)});
  const response=await fetch(`/v1/studio/sdk/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parameters)});
  const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.message||'Native operation failed'),value);return value;
};
const api = {
  listVersions: async (id,input) => {if(native)return invoke('versions.list',{reportId:id,input});proof.calls.push({operation:'versions.list',parameters:{reportId:id,input}});return {items:[...records.values()].map(item=>item.version),limit:100,offset:0};},
  inspectVersion: async (id,no) => {
    if(proof.failVersion===no)throw new Error('Requested version unavailable');
    if(native)return invoke('versions.inspect',{reportId:id,versionNo:no});
    proof.calls.push({operation:'versions.inspect',parameters:{reportId:id,versionNo:no}});
    if(!records.has(no))throw new Error('Version not found');return records.get(no);
  },
  getPublication: async id => native ? invoke('publications.get',{reportId:id}) : {activeVersionNo:1,status:'active'},
  getResources: async (id,no) => {proof.calls.push({operation:'resources',parameters:{reportId:id,versionNo:no}});return {files:[]};},
  previewReader: async (id,no,input) => {
    proof.calls.push({operation:'preview',parameters:{reportId:id,versionNo:no,input}});
    if(proof.delayPreview)return new Promise(resolve=>{proof.finishPreview=()=>resolve({data:[{id:'LATE_PREVIEW'}]});});
    return {data:[{id:`version-${no}`}],evidence:{versionNo:no,sourceRevision:7}};
  },
  validateVersion: async (id,no,revision) => {proof.calls.push({operation:'validate',parameters:{reportId:id,versionNo:no,expectedSourceRevision:revision}});return {valid:true,version:records.get(no).version};},
  listWarmupRuns: async()=>({items:[]}),
  warmupReader: async(id,no)=>{proof.calls.push({operation:'warmup',parameters:{reportId:id,versionNo:no}});return {runId:`run-${no}`,versionNo:no,sourceRevision:7,status:'completed'};},
  listPublicationEvents:async()=>({items:[]}),getRuntimeStatus:async()=>({status:'active'}),
  publishReader:async(id,no,revision)=>{proof.calls.push({operation:'publish',parameters:{reportId:id,versionNo:no,expectedSourceRevision:revision}});return {activeVersionNo:no};},
  deleteVersion:async(id,no,revision)=>{
    if(native)return invoke('versions.delete',{reportId:id,versionNo:no,expectedSourceRevision:revision});
    proof.calls.push({operation:'versions.delete',parameters:{reportId:id,versionNo:no,expectedSourceRevision:revision}});records.delete(no);return {deletedVersions:1};
  },
};
const report=native?await fetch('/proof/component').then(response=>response.json()):{id:'version-proof',title:'Version proof',ownerId:'alice',currentDraftVersion:2};
function Proof(){const [back,setBack]=useState(false);return back?<p>Returned to components</p>:<ReaderBuilder api={api} report={{...report,versionNo:2}} subject="alice" onBack={()=>setBack(true)}/>;}
proof.publishOlder=()=>records.set(1,inspection(1,'published'));
createRoot(document.getElementById('root')).render(<Proof/>);
