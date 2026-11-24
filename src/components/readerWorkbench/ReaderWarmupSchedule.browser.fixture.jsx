// Independently authored synthetic reader versions. Native mode obtains the real
// Studio-authored operation bindings from an isolated test gateway, not a host catalog.
import React,{useCallback,useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import {ReaderBuilder} from './ReaderBuilder.jsx';
import {createWorkbenchAPI} from './apiBindings.js';
import {WorkbenchMutationContext} from './WorkbenchMutationContext.jsx';

const native=new URLSearchParams(location.search).has('native');
const first='2026-12-01T06:00:00.123456Z';
const proof=window.__scheduleProof={calls:[],deny:false,holdMutation:false,held:null,release:null,pending:0,failGet:false};
const report={id:'reader',title:'Records',ownerId:'owner',namespace:'general',currentDraftVersion:2};
const definitions={
 inspectVersion:['versions.inspect',{reportId:{arg:0},versionNo:{arg:1}}],listVersions:['versions.list',{reportId:{arg:0},input:{arg:1}}],getPublication:['publications.get',{reportId:{arg:0}}],getResources:['resources.get',{reportId:{arg:0},versionNo:{arg:1}}],
 listWarmupRuns:['versions.warmup_list',{reportId:{arg:0},versionNo:{arg:1},input:{arg:2}}],getWarmupRun:['versions.warmup_get',{reportId:{arg:0},runId:{arg:1}}],warmupReader:['versions.warmup',{reportId:{arg:0},versionNo:{arg:1}}],
 getWarmupSchedule:['versions.warmup_schedule_get',{reportId:{arg:0},versionNo:{arg:1}}],saveWarmupSchedule:['versions.warmup_schedule_save',{reportId:{arg:0},versionNo:{arg:1},input:{arg:2}}],deleteWarmupSchedule:['versions.warmup_schedule_delete',{reportId:{arg:0},versionNo:{arg:1},input:{arg:2}}],
};
let bootstrap,spec,datasources;
if(native){
 bootstrap=await fetch('/proof/bootstrap').then(response=>response.json());
 const variant=Object.values(bootstrap.window.variants)[0];spec=variant.window.view.content.readerWorkbench;
 datasources=Object.fromEntries(Object.entries(bootstrap.datasources).map(([id,value])=>[id,value.dataSource]));
}else{
 bootstrap={report};spec={operations:Object.fromEntries(Object.entries(definitions).map(([name,[,parameters]])=>[name,{dataSourceRef:name,parameters,mutation:['saveWarmupSchedule','deleteWarmupSchedule','warmupReader'].includes(name)}]))};
 datasources=Object.fromEntries(Object.entries(definitions).map(([name,[operation]])=>[name,{backend:{method:`studio.sdk.${operation}`}}]));
}
const schedules=new Map();
proof.admitFake=()=>{const current=schedules.get(2);schedules.set(2,{...current,revision:current.revision+1,lastRunId:'fixture-admitted',nextDueAt:'2026-12-01T07:06:41.123456Z'});};
const inspect=no=>({version:{reportId:'reader',versionNo:no,sourceRevision:7,state:'draft'},dql:`SELECT ${no} AS ID`,structure:{component:{rootView:{name:'records',namespace:'r',source:{sql:`SELECT ${no} AS ID`}}}},capabilities:{canEdit:true,canPublish:true,canRun:true,canUseDql:true}});
async function fake(operation,parameters){
 const no=parameters.versionNo;
 if(operation==='versions.inspect')return inspect(no);
 if(operation==='versions.list')return {items:[1,2].map(no=>inspect(no).version)};
 if(operation==='publications.get')return {};
 if(operation==='resources.get')return {files:[]};
 if(operation==='versions.warmup_list')return {items:[]};
 if(operation==='versions.warmup_schedule_get')return schedules.has(no)?{schedule:schedules.get(no)}:{};
 if(operation==='versions.warmup_schedule_save'){
  const current=schedules.get(no),input=parameters.input;
  if(input.expectedRevision!==(current?.revision??0))throw Object.assign(new Error('schedule changed; reload before saving'),{code:'conflict',field:'revision'});
  const value={...input,scheduleId:`schedule-${no}`,reportId:'reader',versionNo:no,revision:(current?.revision??0)+1,nextDueAt:input.firstRunAt};delete value.expectedRevision;schedules.set(no,value);return {schedule:value};
 }
 if(operation==='versions.warmup_schedule_delete'){schedules.delete(no);return {};}
 if(operation==='versions.warmup_get')return {runId:parameters.runId,reportId:'reader',versionNo:2,sourceRevision:7,status:'completed'};
 throw new Error(`Unconfigured fixture operation ${operation}`);
}
const context={Context:id=>({handlers:{dataSource:{fetchRecords:async({parameters})=>{
 const operation=datasources[id].backend.method.replace(/^studio\.sdk\./,'');proof.calls.push({operation,parameters:structuredClone(parameters)});
 if(proof.failGet&&operation==='versions.warmup_schedule_get'){proof.failGet=false;throw new Error('Schedule request failed');}
 if(proof.deny&&operation.includes('warmup_schedule')){if(!native)throw new Error('Schedule permission denied');}
 let value;
 if(native){const response=await fetch(`/v1/studio/sdk/${operation}`,{method:'POST',headers:{'Content-Type':'application/json',...(proof.deny?{'X-Proof-Deny':'true'}:{})},body:JSON.stringify(parameters)});value=await response.json();if(!response.ok)throw Object.assign(new Error(value.message||'Native operation failed'),value);}
 else value=await fake(operation,parameters);
 if(proof.holdMutation&&['versions.warmup_schedule_save','versions.warmup_schedule_delete'].includes(operation)){
  proof.held={operation,value};await new Promise(resolve=>{proof.release=resolve;});proof.holdMutation=false;proof.held=null;
 }
 return {rows:[value]};
}}}})};
const api=createWorkbenchAPI(context,spec,{onPendingChange:value=>{proof.pending=value;proof.setPending?.(value);}});
function Proof(){
 const [identity,setIdentity]=useState({no:2,epoch:0});const [pending,setPending]=useState(0);const [external,setExternal]=useState({});proof.setPending=setPending;
 const setExternalBusy=useCallback((key,value)=>setExternal(current=>current[key]===value?current:{...current,[key]:value}),[]);
 proof.switchVersion=no=>setIdentity(current=>({no,epoch:current.epoch+1}));
 return <WorkbenchMutationContext.Provider value={{busy:pending>0||Object.values(external).some(Boolean),setExternalBusy}}><ReaderBuilder key={identity.epoch} api={api} report={{...bootstrap.report,versionNo:identity.no}} subject="owner" onBack={()=>{}}/></WorkbenchMutationContext.Provider>;
}
proof.first=first;
createRoot(document.getElementById('root')).render(<Proof/>);
