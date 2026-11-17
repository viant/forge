// Independent synthetic authoring metadata. Native mode uses an isolated Studio
// test gateway; it never connects to a developer's configured component catalog.
import React from 'react';
import {createRoot} from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import {ReaderBuilder} from './ReaderBuilder.jsx';
const native=new URLSearchParams(location.search).has('native');
const proof=window.__targetedWarmupProof={calls:[],delayApply:false,finishApply:null,failApply:'',unavailable:false,denied:new URLSearchParams(location.search).has('denied')};
const call=(occurrence,args)=>({name:'cache_warmup',occurrence,args,sourceSpan:{start:occurrence*100,end:occurrence*100+50}});
const contributors=[call(2,['c',"'parent_id'","'Name=by_parent'","'Limit=0'","'CaseRefs=recent'","'Period=older'","'ExcludeDefault=Period'"]),call(3,['c',"'parent_id'","'Name=by_parent'","'Limit=0'","'Period=oldest'"])];
const version={reportId:'records',versionNo:1,sourceRevision:7,state:'draft'};
const structure={component:{rootView:{name:'records',namespace:'r',columns:[{name:'ID'}],source:{sql:'SELECT ID FROM records',bindings:{cacheName:'storage',cacheWarmup:'host'}},relations:[{name:'c',holder:'C',view:{name:'children',namespace:'c',columns:[{name:'ID'},{name:'parent_id'}],source:{sql:'SELECT ID,parent_id FROM children',bindings:{cacheName:'storage',cacheWarmup:'host'}}}}]},settings:{cache:{warmup:{indexColumn:'ID',limit:77}}}},targetedWarmups:[{view:'c',editable:true,settings:{name:'by_parent',indexColumn:'parent_id',limit:0,caseRefs:['recent'],cases:[{set:[{name:'Period',values:['older'],excludeDefault:true}]},{set:[{name:'Period',values:['oldest']}]}]},contributors}]};
const inspection=()=>({version:{...version},dql:'SELECT r.*,c.* FROM records r LEFT JOIN children c ON c.parent_id=r.ID',capabilities:{canEdit:!proof.denied,canUseDql:true,canRun:true,canPublish:true},structure:structuredClone(structure),effectiveWarmup:{reportId:'records',versionNo:1,sourceRevision:version.sourceRevision,status:proof.unavailable?'unavailable':'resolved',...(proof.unavailable?{}:{targets:[{view:'',policyName:'component-plan',origin:'inline',indexColumn:'ID',rowLimit:77},{view:'c',policyName:'by_parent',origin:'inline',indexColumn:'parent_id',rowLimit:0}]})},diagnostics:proof.unavailable?[{code:'warmup_inspection_unavailable',message:'Synthetic producer resolution unavailable.'}]:[]});
async function invoke(operation,parameters){
 proof.calls.push({operation,parameters:structuredClone(parameters)});
 const response=await fetch(`/v1/studio/sdk/${operation}`,{method:'POST',headers:{'Content-Type':'application/json',...(proof.denyApply&&operation==='versions.builder'?{'X-Proof-Deny':'true'}:{})},body:JSON.stringify(parameters)});
 const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.message||'Native operation failed'),result);return result;
}
const api={
 listVersions:async(reportId,input)=>native?invoke('versions.list',{reportId,input}):{items:[version],limit:100,offset:0},
 inspectVersion:async(reportId,versionNo,options)=>native?invoke('versions.inspect',{reportId,versionNo,...options}):inspection(),
 getPublication:async(reportId)=>native?invoke('publications.get',{reportId}):{},
 getResources:async()=>({files:[]}),
 applyReaderCommand:async(reportId,versionNo,input)=>{
  if(proof.delayApply)await new Promise(resolve=>{proof.finishApply=resolve;});
  if(proof.failApply)throw new Error(proof.failApply);
  if(native)return invoke('versions.builder',{reportId,versionNo,command:input});
  proof.calls.push({operation:'versions.builder',parameters:{reportId,versionNo,command:structuredClone(input)}});
  version.sourceRevision++;return {applied:true,inspection:inspection()};
 },
 listWarmupRuns:async(reportId,versionNo,input)=>native?invoke('versions.warmup_list',{reportId,versionNo,input}):{items:[]},
 getWarmupRun:async(reportId,runId)=>invoke('versions.warmup_get',{reportId,runId}),
 warmupReader:async(reportId,versionNo)=>native?invoke('versions.warmup',{reportId,versionNo}):{runId:'synthetic-run',versionNo:1,sourceRevision:version.sourceRevision,status:'completed'},
};
const report=native?await fetch('/proof/component').then(response=>response.json()):{id:'records',title:'Records',ownerId:'owner',currentDraftVersion:1};
createRoot(document.getElementById('root')).render(<ReaderBuilder api={api} report={{...report,versionNo:1}} subject="owner" onBack={()=>{}}/>);
