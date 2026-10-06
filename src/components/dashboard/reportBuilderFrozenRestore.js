import { buildReportBuilderPublishedDatasetDeclarations } from '../../reporting/reportSpecModel.js';
import { resolveReportDatasetScopePolicy } from '../../reporting/reportDatasetScopeModel.js';
import { buildDashboardReportRuntimeBlock } from '../../reporting/reportRuntimeBlock.js';

export const REPORT_ADMISSION_DIGEST_PROFILE = 'agently-json-binary64-v1';
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const merge = (base,patch) => Object.fromEntries([...new Set([...Object.keys(base||{}),...Object.keys(patch||{})])].map(key=>[key,Object.hasOwn(patch||{},key)?(object(base?.[key])&&object(patch[key])?merge(base[key],patch[key]):clone(patch[key])):clone(base[key])]));
const fail = reason => { throw new Error(`Saved report cannot be restored: ${reason}.`); };
export const reportRestoreValue = (value, path) => String(path || '').split('.').reduce((node,key)=>node?.[key],value);
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
export const reportRestoreEqual = (left,right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

export function selectedReportRestoreDocument(form,stateKey) {
  const state=reportRestoreValue(form,stateKey);
  const definition=form?.reportDefinition;
  const source=state?.reportDocument || state?.documentPatch || definition?.documentPatch || definition?.reportDocument || form?.documentPatch || form?.reportDocument;
  const document=object(source)?clone(source):{};
  if (Array.isArray(state?.reportDocumentBlocks) && state.reportDocumentBlocks.length) document.blocks=clone(state.reportDocumentBlocks);
  return Array.isArray(document.blocks) && document.blocks.length ? document : null;
}
export function reportRestoreSnapshot({form,configuration,conversationId,windowId,builderRef,stateKey,primaryDataSourceRef}) {
  return {conversationId,windowId,builderRef,stateKey,primaryDataSourceRef,configuration:clone(configuration || {}),
    authorState:object(reportRestoreValue(form,stateKey))?clone(reportRestoreValue(form,stateKey)):null,document:selectedReportRestoreDocument(form,stateKey),
    prefillIdentity:{prefill:clone(form?.prefill ?? null),prefillRevision:form?.__forge && Object.hasOwn(form.__forge,"prefillRevision") ? clone(form.__forge.prefillRevision) : 0}};
}
export const reportRestoreSnapshotKey = value => JSON.stringify(stable(value));

export async function reportAdmissionDigest(value) {
  const encoder=new TextEncoder();const chunks=[];
  const ascii=text=>chunks.push(encoder.encode(text));
  const string=text=>{const bytes=encoder.encode(text);ascii(`S${bytes.length}:`);chunks.push(bytes);};
  const compare=(a,b)=>{const x=encoder.encode(a),y=encoder.encode(b);for(let i=0;i<Math.min(x.length,y.length);i++){if(x[i]!==y[i])return x[i]-y[i];}return x.length-y.length;};
  const emit=value=>{
    if(value===null){ascii('N');return;}
    if(typeof value==='boolean'){ascii(value?'T':'F');return;}
    if(typeof value==='string'){string(value);return;}
    if(typeof value==='number'){
      if(!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail('unsupported admission number');
      const bytes=new ArrayBuffer(8);new DataView(bytes).setFloat64(0,value===0?0:value,false);
      ascii('D'+Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join(''));return;
    }
    if(Array.isArray(value)){ascii(`A${value.length}:`);value.forEach(emit);return;}
    if(object(value)){const keys=Object.keys(value).sort(compare);ascii(`O${keys.length}:`);keys.forEach(key=>{string(key);emit(value[key]);});return;}
    fail('unsupported admission value');
  };
  ascii(REPORT_ADMISSION_DIGEST_PROFILE+'\n');emit(value);
  const bytes=new Uint8Array(chunks.reduce((total,chunk)=>total+chunk.length,0));let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function datePolicyConfiguration(configuration,namespace) {
  const config=clone(configuration);
  const clock=new Date(namespace.preparedAt);
  if(typeof namespace.timeZone!=='string' || !namespace.timeZone || !Number.isFinite(clock.getTime()) || clock.toISOString()!==namespace.preparedAt || namespace.calendar!=='gregorian') fail('unsupported admission clock');
  let dateParts;
  try { dateParts=new Intl.DateTimeFormat('en-US',{timeZone:namespace.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(clock); }
  catch { fail('unsupported admission time zone'); }
  const parts=Object.fromEntries(dateParts.map(part=>[part.type,part.value]));
  const calendarDay=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
  const set=(root,path,value)=>{const keys=String(path||'').split('.');if(!path || keys.some(key=>!key || ['__proto__','constructor','prototype'].includes(key)))fail('invalid date path');let node=root;keys.slice(0,-1).forEach(key=>{node[key]=object(node[key])?node[key]:{};node=node[key];});node[keys.at(-1)]=value;};
  config.dataSources=(config.dataSources || []).map(source=>{
    if(!source?.scope?.relativeDateRange)return source;
    const policy=resolveReportDatasetScopePolicy(source.scope),relative=policy.relativeDateRange;
    const ranges={today:[0,0],yesterday:[-1,-1],last3days:[-2,0],'3d':[-2,0],last7days:[-6,0],'7d':[-6,0],last30days:[-29,0],'30d':[-29,0]};
    const range=ranges[String(relative?.preset||'').toLowerCase().replaceAll('_','')];
    if(!range)fail('unsupported relative date policy');
    const patch={};set(patch,relative.startParamPath,new Date(calendarDay+range[0]*86400000).toISOString().slice(0,10));set(patch,relative.endParamPath,new Date(calendarDay+range[1]*86400000).toISOString().slice(0,10));
    return {...source,scope:{mode:policy.mode,exclude:policy.exclude,local:merge(policy.local,patch)}};
  });
  return config;
}

function datasetReferences(value,result=new Set()) {
  if(Array.isArray(value))value.forEach(child=>datasetReferences(child,result));
  else if(object(value)){if(typeof value.datasetRef==='string' && value.datasetRef)result.add(value.datasetRef);Object.values(value).forEach(child=>datasetReferences(child,result));}
  return result;
}
function indexed(items,label) {
  if(!Array.isArray(items))fail(`missing ${label}`);
  const result=new Map();for(const item of items){if(!object(item) || typeof item.id!=='string' || !item.id || result.has(item.id))fail(`invalid ${label} identity`);result.set(item.id,item);}return result;
}
function freeze(value){if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

export async function verifyFrozenReportRestore({context,run,snapshot,scopeKey}) {
  if(!context || !run || !snapshot || !scopeKey || !context.ownerId || context.ownerId!==run.ownerId || context.conversationId!==snapshot.conversationId || run.conversationId!==snapshot.conversationId || context.activeReportRunId!==run.reportRunId || run.status!=='completed' || run.builderRef!==snapshot.builderRef || !(context.revision>0) || !(run.revision>0)) fail('owner, conversation or completed pointer mismatch');
  const requested=clone(run.requestedParams || {}),namespace=requested._agentlyReportAdmission;
  if(!object(namespace) || namespace.version!==1 || namespace.digests?.profile!==REPORT_ADMISSION_DIGEST_PROFILE || namespace.builderRef!==snapshot.builderRef || namespace.stateKey!==snapshot.stateKey || namespace.primaryDataSourceRef!==snapshot.primaryDataSourceRef || !object(namespace.state) || !object(snapshot.authorState) || !snapshot.document) fail('admission source mismatch');
  delete requested._agentlyReportAdmission;
  if(Object.hasOwn(requested,'_agentlyForecastCommand')) {
    const link=requested._agentlyForecastCommand;
    if(!object(link) || Object.keys(link).sort().join(',')!=='ref,requestId,version' || link.version!==1 || typeof link.ref!=='string' || !link.ref || link.requestId!==run.uiRunRequestId)fail('invalid command linkage');
    delete requested._agentlyForecastCommand;
  }
  if(!reportRestoreEqual(requested,run.effectiveParams))fail('primary request differs from admission');
  for(const [key,value] of Object.entries({prefill:snapshot.prefillIdentity,authorState:snapshot.authorState,policyState:namespace.state,document:snapshot.document,configuration:snapshot.configuration})) {
    if(await reportAdmissionDigest(value)!==namespace.digests[key])fail(`${key} digest mismatch`);
  }
  const refs=datasetReferences(snapshot.document.blocks),bindings=indexed(namespace.datasets,'admitted datasets');
  if(refs.size!==bindings.size || [...refs].some(id=>!bindings.has(id)))fail('document dataset coverage mismatch');
  const config=datePolicyConfiguration(snapshot.configuration,namespace);
  const expected=buildReportBuilderPublishedDatasetDeclarations(config,namespace.state,refs,null,{dataSourceRef:snapshot.primaryDataSourceRef,request:run.effectiveParams});
  const requests=new Map(expected.map(dataset=>[dataset.id,dataset]));
  if(refs.has('primary'))requests.set('primary',{id:'primary',dataSourceRef:snapshot.primaryDataSourceRef,request:run.effectiveParams});
  for(const [id,binding] of bindings) {
    const selected=(config.dataSources||[]).filter(source=>source.id===id && source.dataSourceRef===binding.dataSourceRef);
    if((id!=='primary' && selected.length!==1) || !reportRestoreEqual(binding.request,requests.get(id)?.request) || binding.dataSourceRef!==requests.get(id)?.dataSourceRef)fail(`dataset ${id} request mismatch`);
  }
  const source={kind:'dashboard.reportBuilder',containerId:snapshot.builderRef,stateKey:snapshot.stateKey,dataSourceRef:snapshot.primaryDataSourceRef};
  const parameters={groupBy:namespace.state.groupBy ?? '',orderDir:namespace.state.orderDir ?? 'desc',orderField:namespace.state.orderField ?? '',pageSize:namespace.state.pageSize ?? 50,viewMode:namespace.state.viewMode ?? snapshot.configuration?.result?.defaultMode ?? 'table'};
  const {reportSpec:spec,reportFill:fill,reportPrint:print}=run;
  if(!object(spec) || !object(fill) || !object(print) || spec.kind!=='reportSpec' || fill.kind!=='reportFill' || print.kind!=='reportPrint' || !reportRestoreEqual(print.source,source) || print.specHash!==fill.specHash || !reportRestoreEqual(spec.source,source) || !reportRestoreEqual(fill.source,source) || !reportRestoreEqual(spec.parameters,parameters) || !reportRestoreEqual(fill.parameters,parameters))fail('saved artifact source or parameters mismatch');
  if(fill.specHash!==nativeReportArtifactHash(spec) || print.fillHash!==nativeReportArtifactHash(fill))fail('saved artifact hash mismatch');
  const specs=indexed(spec.datasets,'spec datasets'),fills=indexed(fill.datasets,'fill datasets');
  if(specs.size!==bindings.size || fills.size!==bindings.size)fail('saved dataset coverage mismatch');
  const payloads={};
  for(const [id,binding] of bindings){
    const definition=specs.get(id),filled=fills.get(id);
    for(const value of [definition,filled])if(!value || value.dataSourceRef!==binding.dataSourceRef || !reportRestoreEqual(value.request,binding.request))fail(`saved dataset ${id} identity mismatch`);
    if(!Array.isArray(filled.rows) || filled.rows.some(row=>!object(row)))fail(`saved dataset ${id} rows invalid`);
    payloads[id]={rows:clone(filled.rows),hasMore:filled.provenance?.hasMore===true,diagnostics:clone(filled.provenance?.diagnostics||[])};
  }
  const saved=clone(run);
  const artifact={document:clone(snapshot.document),reportSpec:saved.reportSpec,reportFill:saved.reportFill,reportPrint:saved.reportPrint,runtimeBlock:buildDashboardReportRuntimeBlock({id:'restoredReport',title:spec.title||snapshot.document.title||'Report',reportSpec:saved.reportSpec,reportFill:saved.reportFill,reportPrint:saved.reportPrint})};
  return freeze({scopeKey,snapshotKey:reportRestoreSnapshotKey(snapshot),run:saved,context:clone(context),state:clone(namespace.state),authorState:clone(snapshot.authorState),request:clone(run.effectiveParams),datasets:clone(namespace.datasets),payloads,artifact});
}

// The host reader owns authentication; the final checks happen after all async
// digest work and inspect live scope/form again before returning installable data.
export async function loadFrozenReportRestore({handler,snapshot,currentSnapshotKey}) {
  const captured=reportRestoreSnapshotKey(snapshot);
  const result=await handler.readCompletedRestore({conversationId:snapshot.conversationId});
  const modern=!!result?.run?.requestedParams?._agentlyReportAdmission;
  const frozen=modern ? await verifyFrozenReportRestore({...result,snapshot}) : null;
  if(currentSnapshotKey()!==captured)fail('inputs changed during restoration');
  if(result && result.scopeKey!==handler.getRestoreScope())fail('account changed during restoration');
  return {frozen,modern};
}

// Native v1 admissions are compiled by the Go fenced compiler, whose artifact
// hash is FNV-1a over UTF-16 units of encoding/json's sorted serialization.
export function nativeReportArtifactHash(value) {
  const encoder=new TextEncoder();
  const compare=(a,b)=>{const x=encoder.encode(a),y=encoder.encode(b);for(let i=0;i<Math.min(x.length,y.length);i++){if(x[i]!==y[i])return x[i]-y[i];}return x.length-y.length;};
  const quote=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
  const serialize=value=>{
    if(value===null)return 'null';
    if(typeof value==='string')return quote(value);
    if(typeof value==='number'){if(!Number.isFinite(value))fail('nonfinite artifact number');return Object.is(value,-0)?'-0':JSON.stringify(value);}
    if(typeof value==='boolean')return value?'true':'false';
    if(Array.isArray(value))return '['+value.map(serialize).join(',')+']';
    if(object(value))return '{'+Object.keys(value).sort(compare).map(key=>quote(key)+':'+serialize(value[key])).join(',')+'}';
    fail('unsupported artifact value');
  };
  let hash=2166136261;
  const serialized=serialize(value);
  for(let index=0;index<serialized.length;index++)hash=Math.imul(hash^serialized.charCodeAt(index),16777619);
  return 'fnv1a:'+(hash>>>0).toString(16).padStart(8,'0');
}
