import {requireCalendarTimeZone} from '../packs/blueprint/dateRangePreset.js';
import {useEffect,useRef,useState} from 'react';
import {reportDatePresetInputs,decodeReportDateCalendar,resolveDeclaredDateRangePreset} from './reportDatePresets.js';

const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const identity=value=>({...value});
const calendarParameters=range=>[range.datePresets?.calendar?.input?.parameter,...(range.datePresets?.calendar?.inputs||[]).map(binding=>binding.parameter)].filter(Boolean);

// Shared calendar/default lifecycle. Hosts supply only their ordinary metadata
// loader, parameter initialization and commit callback. Calendar zones and range
// policy come from validated declarations. A missing/invalid zone defaults to UTC; users can override it.
export function useReportDatePresetDraft({ranges=[],parameters={},resetParameters,initialize=identity,contextKey='',loadCalendar,onDefaultsReady,defaultsReadyKey=''}) {
 for(const range of ranges)if((range.datePresets?.calendar?.inputs||[]).some(binding=>binding.parameter===range.start||binding.parameter===range.end))throw Error('Calendar inputs cannot bind to their own date outputs.');
 const reservedParameters=new Set(ranges.flatMap(range=>[range.start,range.end,...calendarParameters(range)]).filter(Boolean));
 const presetParameters=new Set();
 for(const range of ranges){const key=range.datePresets?.valueParameter;if(!key)continue;
  if(reservedParameters.has(key)||presetParameters.has(key))throw Error('Date-preset value parameters must be distinct from all date endpoints, calendar identities and other preset parameters.');
  presetParameters.add(key);
 }
 const bindPresetValues=values=>{
  const next={...values};
  for(const range of ranges){const key=range.datePresets?.valueParameter;if(!key)continue;
   if((own(next,range.start)||own(next,range.end))&&!range.datePresets.options.some(option=>option.value===next[key]))next[key]='custom';
  }return next;
 };
 const initializeDraft=values=>bindPresetValues(initialize(values));
 const presetPatch=(range,value)=>range.datePresets?.valueParameter?{[range.datePresets.valueParameter]:value}:{};
 const initialResetParameters=useRef(structuredClone(resetParameters??parameters));
 const [draft,setDraft]=useState(()=>initializeDraft(parameters));
 const draftRef=useRef(draft);draftRef.current=draft;
 const writeDraft=next=>{draftRef.current=next;setDraft(next);};
 const parametersKey=JSON.stringify(parameters),authoredDatesKey=JSON.stringify(initializeDraft({}));
 const parameterEpoch=useRef({key:parametersKey,changed:false});
 const [dateState,setDateState]=useState({});
 const timeZoneOverrides=useRef({});
 const generation=useRef(0),requests=useRef([]),dirty=useRef(false),initialAttempted=useRef(false),initialCommitted=useRef(false),autoReady=useRef(false),expectedParameters=useRef('');
 const calendarDefinitionKey=JSON.stringify(ranges.map(range=>[range.id,range.start,range.end,range.required,range.datePresets,range.datePresetError]));
 const calendarScope=useRef({key:'',loader:null,version:0});
 const calendarInputsKey=JSON.stringify(ranges.map(range=>{
  try{return reportDatePresetInputs(range.datePresets,draft).inputs;}
  catch{return calendarParameters(range).map(parameter=>[parameter,own(draft,parameter),draft[parameter]]);}
 }));
 const scopeKey=JSON.stringify([contextKey,calendarDefinitionKey,calendarInputsKey]);
 const invalidate=()=>{generation.current++;requests.current.forEach(controller=>controller.abort());requests.current=[];};
 // Loader identity includes the authenticated preview session. Invalidate in
 // render too, so a late reply cannot win before the scope effect runs.
 if(calendarScope.current.key!==scopeKey||calendarScope.current.loader!==loadCalendar){
  invalidate();autoReady.current=false;timeZoneOverrides.current={};
  if(!initialCommitted.current&&!dirty.current)initialAttempted.current=false;
  calendarScope.current={key:scopeKey,loader:loadCalendar,version:calendarScope.current.version+1};
 }
 const scopeVersion=calendarScope.current.version;
 const stateFor=range=>{
  const state=dateState[range.id]||{mode:'manual',value:range.datePresets?.valueParameter&&range.datePresets.options.some(option=>option.value===draft[range.datePresets.valueParameter])?draft[range.datePresets.valueParameter]:'custom'};
  let identity;try{identity=reportDatePresetInputs(range.datePresets,draft).identity;}catch{/* manual dates do not need calendar metadata */}
  return {...state,pending:state.scope===scopeVersion&&state.pending===true,
   stale:state.mode==='relative'&&(state.stale||state.scope!==scopeVersion||state.identity!==identity)};
 };
 const dateBlocked=ranges.some(range=>{const state=stateFor(range);return state.pending||state.stale||((range.datePresets||range.datePresetError||range.required)&&!(range.required===false&&draft[range.start]===''&&draft[range.end]==='')&&(!validDate(draft[range.start])||!validDate(draft[range.end])||draft[range.start]>draft[range.end]));});
 const cancelDraftRequests=()=>{
  invalidate();autoReady.current=false;dirty.current=true;
  setDateState(previous=>Object.fromEntries(Object.entries(previous).map(([id,state])=>[id,{...state,pending:false}])));
 };
 const resolveRanges=async(items,base,{automatic=false,reuseCalendar=false}={})=>{
  invalidate();const ticket=generation.current,version=calendarScope.current.version;
  const valid=()=>ticket===generation.current&&version===calendarScope.current.version;
  setDateState(previous=>({...previous,...Object.fromEntries(items.map(({range,value})=>[range.id,{...previous[range.id],pending:true,scope:version,requestedValue:value,error:''}]))}));
  const patch={},resolvedStates={},contexts=[];
  try{
   for(const {range,value}of items){
    const declaration=range.datePresets,option=declaration.options.find(option=>option.value===value);
    if(!option||value==='custom')throw Error('Choose an available date preset.');
    const {identity,inputs}=reportDatePresetInputs(declaration,base),controller=new AbortController();requests.current.push(controller);
    const saved=dateState[range.id];
    let context;
    if(reuseCalendar&&saved?.scope===version&&saved.identity===identity&&saved.calendarContext){
     context={...saved.calendarContext,timeZone:timeZoneOverrides.current[range.id]||saved.calendarContext.timeZone};
    }else{
     if(typeof loadCalendar!=='function')throw Error('Calendar metadata is unavailable.');
     const response=await loadCalendar(declaration.calendar.dataSourceRef,inputs,controller.signal);
     if(!valid())return false;
     context=decodeReportDateCalendar(declaration,identity,response,timeZoneOverrides.current[range.id]);
    }
    contexts.push({range,value,option,identity,context});
   }
   // One instant follows all metadata for this operation, including an initial
   // default operation with several independently declared date controls.
   const instant=new Date();
   for(const {range,value,option,identity,context}of contexts){
    const pair=resolveDeclaredDateRangePreset(option,instant,context.timeZone,context.anchorDate);
    patch[range.start]=pair.start;patch[range.end]=pair.end;Object.assign(patch,presetPatch(range,value));
    resolvedStates[range.id]={mode:'relative',value,requestedValue:value,scope:version,identity,calendarContext:context,timeZone:context.timeZone,pending:false,stale:false,automatic,error:''};
   }
   if(!valid())return false;
   writeDraft({...draftRef.current,...patch});setDateState(previous=>({...previous,...resolvedStates}));
   if(automatic)autoReady.current=true;
   return true;
  }catch{
   if(valid())setDateState(previous=>({...previous,...Object.fromEntries(items.map(({range,value})=>[range.id,{...previous[range.id],scope:version,pending:false,requestedValue:value,stale:previous[range.id]?.mode==='relative',error:range.datePresets?.calendar.anchorField?'Calendar date context is unavailable.':'Calendar timezone is unavailable.'}]))}));
   return false;
  }
 };
 const requestPreset=(id,value)=>{
  cancelDraftRequests();
  const range=ranges.find(range=>range.id===id&&range.datePresets);
  return range?resolveRanges([{range,value}],draftRef.current):Promise.resolve(false);
 };
 const setTimeZone=(id,value)=>{
  const zone=requireCalendarTimeZone(value),range=ranges.find(range=>range.id===id&&range.datePresets);
  if(!range)return Promise.resolve(false);
  const state=stateFor(range);
  timeZoneOverrides.current[id]=zone;
  setDateState(previous=>({...previous,[id]:{...previous[id],timeZone:zone}}));
  if(state.mode==='relative'||state.error){
   cancelDraftRequests();
   return resolveRanges([{range,value:state.requestedValue||state.value||range.datePresets.default}],draftRef.current,{reuseCalendar:true});
  }
  return Promise.resolve(true);
 };
 const manualRange=(id,pair)=>{
  cancelDraftRequests();const range=ranges.find(range=>range.id===id);if(!range)return;
  writeDraft({...draftRef.current,[range.start]:pair.start,[range.end]:pair.end,...presetPatch(range,'custom')});
  setDateState(previous=>({...previous,[id]:{mode:'manual',value:'custom',scope:calendarScope.current.version}}));
 };
 // Existing absolute defaults and explicit caller edits retain their semantics.
 useEffect(()=>{
  if(parameterEpoch.current.key!==parametersKey){
   const expected=expectedParameters.current===parametersKey;expectedParameters.current='';
   const previousParameters=JSON.parse(parameterEpoch.current.key),nextParameters=JSON.parse(parametersKey);
   const identities=new Set(ranges.flatMap(calendarParameters));
   const changed=Array.from(new Set([...Object.keys(previousParameters),...Object.keys(nextParameters)])).filter(key=>JSON.stringify(previousParameters[key])!==JSON.stringify(nextParameters[key]));
   const identityOnly=changed.length>0&&changed.every(key=>identities.has(key));
   parameterEpoch.current={key:parametersKey,changed:true};
   invalidate();
   if(identityOnly){
    writeDraft({...draftRef.current,...Object.fromEntries(changed.map(key=>[key,nextParameters[key]]))});
    setDateState(previous=>Object.fromEntries(Object.entries(previous).map(([id,state])=>[id,{...state,pending:false,stale:state.mode==='relative'}])));
    return;
   }
   writeDraft(bindPresetValues(nextParameters));
   if(!expected){dirty.current=false;initialAttempted.current=false;initialCommitted.current=false;autoReady.current=false;setDateState({});}
  }else if(!parameterEpoch.current.changed){writeDraft(initializeDraft(draftRef.current));}
 },[parametersKey,authoredDatesKey]);
 useEffect(()=>()=>{
  invalidate();autoReady.current=false;
  if(!initialCommitted.current&&!dirty.current)initialAttempted.current=false;
 },[]);
 // Opt-in defaults are resolved before the first report request. Manual input,
 // Reset and external updates invalidate this operation instead of being lost.
 useEffect(()=>{
  if(initialAttempted.current||initialCommitted.current||dirty.current)return;
  const needed=ranges.filter(range=>range.datePresets&&(!own(draft,range.start)&&!own(draft,range.end)
   ||dateState[range.id]?.automatic&&dateState[range.id]?.scope!==scopeVersion));
  if(!needed.length)return;
  try{needed.forEach(range=>reportDatePresetInputs(range.datePresets,draft));}catch{return;}
  initialAttempted.current=true;
  void resolveRanges(needed.map(range=>({range,value:range.datePresets.default})),draft,{automatic:true});
 },[scopeVersion,calendarDefinitionKey,JSON.stringify(draft)]);
 useEffect(()=>{
  if(!autoReady.current||dirty.current||initialCommitted.current||dateBlocked)return;
  try{
   const next=onDefaultsReady?.(draft);
   if(next===false)return;
   initialCommitted.current=true;autoReady.current=false;
   if(next)expectedParameters.current=JSON.stringify(next);
  }catch{/* Host-owned required inputs or choice domains may still be loading. */}
 },[JSON.stringify(draft),dateState,defaultsReadyKey]);
 const expectParameters=next=>{expectedParameters.current=JSON.stringify(next);};
 const reset=()=>{
  cancelDraftRequests();parameterEpoch.current.changed=true;initialAttempted.current=true;
  const next=initializeDraft(structuredClone(resetParameters??initialResetParameters.current));writeDraft(next);setDateState({});
  const needed=ranges.filter(range=>range.datePresets&&!own(next,range.start)&&!own(next,range.end));
  if(needed.length)void resolveRanges(needed.map(range=>({range,value:range.datePresets.default})),next);
 };
 const editField=(id)=>{
  cancelDraftRequests();
  for(const range of ranges)if(id===range.start||id===range.end)writeDraft({...draftRef.current,...presetPatch(range,'custom')});
  setDateState(previous=>({...previous,...Object.fromEntries(ranges.flatMap(range=>id===range.start||id===range.end?[[range.id,{mode:'manual',value:'custom',scope:scopeVersion}]]
   :calendarParameters(range).includes(id)&&previous[range.id]?.mode==='relative'?[[range.id,{...previous[range.id],pending:false,stale:true}]]:[]))}));
 };
 const controls=ranges.map(range=>{const state=range.datePresets?stateFor(range):{};return {...range,kind:'dateRange',presetValue:state.value,presetRequestedValue:state.requestedValue,presetPending:state.pending,
  timeZone:timeZoneOverrides.current[range.id]||state.timeZone||'UTC',presetError:range.datePresetError||state.error||(state.stale?'The calendar context changed. Choose the preset again or use manual dates.':'')};});
 return {draft,draftRef,writeDraft,controls,dateBlocked,requestPreset,setTimeZone,manualRange,cancelDraftRequests,editField,reset,expectParameters};
}
