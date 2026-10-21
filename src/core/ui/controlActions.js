import {activeWindows,getMetadataSignal,getDialogSignal} from '../store/signals.js';
import {defaultDateInputMinDate,defaultDateInputMaxDate} from '../../packs/blueprint/dateInputBounds.js';
// Live handlers only. Declared metadata and focus targets cannot authorize an
// operation; renderers register the same callbacks used by normal UI events.
const registrations = new Map();
const epochs = new Map();
let nextToken = 0;
const pendingOperations = new Set();
const operationStates=new Map();
const operationKey=meta=>JSON.stringify([meta.windowId,meta.dataSourceRef || '',meta.controlId]);
function observeInteraction(windowId) {
  const cleanups=[];
  let resolve;
  const promise=new Promise(done=>{resolve=done;});
  for(const dialog of getMetadataSignal(windowId).peek()?.dialogs || [])if(dialog?.id) {
    const signal=getDialogSignal(`${windowId}Dialog${dialog.id}`),wasOpen=signal.peek()?.open===true;
    cleanups.push(signal.subscribe(value=>{if(!wasOpen&&value?.open===true)resolve({kind:'dialog',targetId:dialog.id});}));
  }
  const before=new Set((activeWindows.peek() || []).map(window=>window.windowId));
  cleanups.push(activeWindows.subscribe(windows=>{
    const child=(windows || []).find(window=>!before.has(window.windowId)&&window.isModal===true&&window.parentKey===windowId);
    if(child)resolve({kind:'window',targetId:child.windowId});
  }));
  return {promise,close:()=>cleanups.forEach(cleanup=>cleanup())};
}
const bump = windowId => epochs.set(windowId, (epochs.get(windowId) || 0) + 1);
export const invalidateControlActionState = bump;
export const getOperationRegistryEpoch = windowId => epochs.get(windowId) || 0;
export function registerControlActions(meta, provider, readProvider=provider) {
  if (!meta?.windowId || !meta?.controlId || typeof provider !== 'function') throw new Error('A live control identity and state provider are required');
  const token = ++nextToken;
  registrations.set(token, {meta: {...meta}, provider, readProvider});bump(meta.windowId);
  return () => {if (registrations.delete(token)) {bump(meta.windowId);if(![...registrations.values()].some(entry=>operationKey(entry.meta)===operationKey(meta)))operationStates.delete(operationKey(meta));if(![...registrations.values()].some(entry=>entry.meta.windowId===meta.windowId))epochs.delete(meta.windowId);}};
}
export function listRegisteredControlActions({windowId, dataSourceRef} = {}) {
  const result=[];
  for(const {meta,readProvider} of registrations.values()) {
    if(windowId && meta.windowId!==windowId || dataSourceRef && meta.dataSourceRef!==dataSourceRef) continue;
    let state;try{state=readProvider();}catch{result.push({...meta,visible:false,disabled:true,readOnly:true,supportedActions:[],unavailableReason:'guard_evaluation_failed'});continue;}
    result.push({...meta, sensitive:state.sensitive===true, visible:state.visible===true,disabled:state.disabled===true,readOnly:state.readOnly===true,
      supportedActions:Object.entries(state.actions || {}).filter(([,fn])=>typeof fn==='function').map(([action])=>action)});
  }
  return result;
}
export async function invokeRegisteredControlAction(params, action) {
  const candidates=[...registrations.values()].filter(({meta})=>meta.windowId===params.windowId && (!params.controlId || meta.controlId===params.controlId)
    && (!params.dataSourceRef || meta.dataSourceRef===params.dataSourceRef)).map(entry=>({...entry,passive:entry.readProvider()})).filter(entry=>typeof entry.passive.actions?.[action]==='function');
  const visible=candidates.filter(entry=>entry.passive.visible===true);
  const matches=visible.length?visible:candidates;
  if(matches.length!==1) throw new Error(matches.length ? `ambiguous live control: ${params.controlId}` : `unsupported or unmounted live control: ${params.controlId}`);
  const {meta,provider}=matches[0],state=provider();
  if(state.visible!==true)throw new Error('control is hidden or disconnected');
  if(state.disabled===true || state.readOnly===true)throw new Error('control is disabled or read-only');
  if(state.sensitive===true || /password|token|secret|credential/i.test(`${meta.controlId} ${meta.dataField || ''}`))throw new Error('sensitive control is unavailable to automated operation');
  for(const field of ['scope','bindingPath','dataField'])if(params[field] && params[field]!==meta[field])throw new Error(`control ${field} does not match its registered binding`);
  const handler=state.actions?.[action];
  if(typeof handler!=='function')throw new Error(`unsupported control action: ${action}`);
  if(action==='setValue' && typeof state.validate==='function') {
    const error=state.validate(params.value);if(error)throw new Error(`control validation rejected: ${String(error)}`);
  }
  const key=operationKey(meta);
  if(operationStates.get(key)?.status==='awaiting_interaction')throw new Error('this action is awaiting its normal UI interaction');
  if(pendingOperations.has(meta.windowId))throw new Error('another UI operation is pending for this window');
  pendingOperations.add(meta.windowId);
  const interaction=observeInteraction(meta.windowId);
  try {
    const invoked=handler(params);
    let result;
    if(invoked && typeof invoked.then==='function') {
      const completion=Promise.resolve(invoked).then(value=>({complete:true,value}),error=>({complete:true,error}));
      const observed=await Promise.race([completion,interaction.promise]);
      if(!observed.complete) {
        const state={status:'awaiting_interaction',kind:observed.kind,targetId:observed.targetId};operationStates.set(key,state);bump(meta.windowId);
        void completion.then(outcome=>{if(operationStates.get(key)!==state)return;operationStates.set(key,{...state,status:outcome.error?'failed':outcome.value?.status || 'handler_completed'});bump(meta.windowId);});
        return {ok:true,controlId:meta.controlId,dataSourceRef:meta.dataSourceRef || null,action,status:'awaiting_interaction',pendingInteraction:{status:'awaiting_interaction',...observed}};
      }
      if(observed.error)throw observed.error;result=observed.value;
    } else result=invoked;
    if(result===false)throw new Error('normal UI handler rejected the action');
    if(result && ['failed','invalid','indeterminate','confirmation_unavailable','blocked','busy','guarded'].includes(result.status))throw Object.assign(new Error(result.error?.message || `normal UI action ${result.status}; inspect current state before retrying`),{code:result.error?.code || result.status,accepted:result.accepted});
    return {ok:true,controlId:meta.controlId,dataSourceRef:meta.dataSourceRef || null,action,status:result?.status || 'handler_completed',...(typeof result?.accepted==='boolean'?{accepted:result.accepted}:{}),...(result?.pendingConfirmation===true?{pendingConfirmation:true}:{})};
  } finally {interaction.close();pendingOperations.delete(meta.windowId);}
}
export function isLiveControlVisible(element) {
  if(!element || element.isConnected!==true)return false;
  for(let current=element;current;current=current.parentElement) {
    if(current.hidden || current.getAttribute?.('aria-hidden')==='true' || current.inert)return false;
    const style=typeof getComputedStyle==='function'?getComputedStyle(current):current.style;
    if(style?.display==='none' || style?.visibility==='hidden' || style?.visibility==='collapse')return false;
  }
  return true;
}
const invokeCallback=(callback,...args)=>(callback.operate || callback)(...args);
const stringKinds=new Set(['text','textarea','radio','math']);
const boolKinds=new Set(['checkbox','toggle','switch','booleanPill']);
const arrayKinds=new Set(['multiSelect','chipList','filterChips','treeMultiSelect']);
const numericKinds=new Set(['number','currency','percentFraction2Input']);
const dateKinds=new Set(['date','datetime']);
export function widgetControlActions({item={},props={}}) {
  const kind=item.widget || item.type;
  const actions={};
  if(stringKinds.has(kind) || boolKinds.has(kind) || arrayKinds.has(kind) || kind==='select' || dateKinds.has(kind) || kind==='dateRange') {
    if(typeof props.onChange==='function')actions.setValue=({value})=>invokeCallback(props.onChange,kind==='dateRange'?{...(props.value || {}),...value}:value);
  }
  if(numericKinds.has(kind) && typeof props.onValueChange==='function')actions.setValue=({value})=>invokeCallback(props.onValueChange,value);
  if(['button','link'].includes(kind) && typeof props.onClick==='function')actions.click=()=>invokeCallback(props.onClick,{type:'click',preventDefault(){},stopPropagation(){}});
  return actions;
}
export function validateWidgetControlValue(value,{item={},props={}}={}) {
  const kind=item.widget || item.type;
  if(stringKinds.has(kind) && typeof value!=='string')return 'string value required';
  if(boolKinds.has(kind) && typeof value!=='boolean')return 'boolean value required';
  if(arrayKinds.has(kind) && !Array.isArray(value))return 'array value required';
  if(Array.isArray(value) && (props.minItems!=null && value.length<props.minItems || props.maxItems!=null && value.length>props.maxItems))return 'array length is outside allowed bounds';
  if(arrayKinds.has(kind) && Array.isArray(value) && new Set(value.map(item=>JSON.stringify(item))).size!==value.length)return 'duplicate values are unavailable';
  if(numericKinds.has(kind) && !(value===null && props.nullable===true) && (typeof value!=='number' || !Number.isFinite(value)))return 'finite number required';
  const validDay=day=>{if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const date=new Date(`${day}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;};
  if(dateKinds.has(kind) && value!=='' && value!==null) {
    if(typeof value!=='string' || !validDay(value.slice(0,10)) || !Number.isFinite(Date.parse(value)))return 'valid ISO date required';
    if(props.valueMode==='civil' && !validDay(value))return 'civil date must use YYYY-MM-DD';
    if(kind==='datetime' && !/T\d{2}:\d{2}/.test(value))return 'date-time with time required';
    const date=new Date(value),min=props.minDate?new Date(props.minDate):defaultDateInputMinDate(),max=props.maxDate?new Date(props.maxDate):defaultDateInputMaxDate();
    if(date<min||date>max)return 'date is outside allowed bounds';
  }
  if(kind==='dateRange') {
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!['start','end'].includes(key)))return 'date range requires start/end fields';
    const range={...(props.value || {}),...value};
    if([range.start,range.end].some(day=>day && !validDay(day)))return 'valid civil dates required';
    if(range.start && range.end && range.start>range.end)return 'range start must precede end';
    if((item.required||props.required)&&(!range.start||!range.end))return 'complete date range required';
  }
  if(kind==='percentFraction2Input' && (value<0 || value>1))return 'fraction must be between zero and one';
  if((item.required || props.required) && (value==null || value==='' || Array.isArray(value)&&!value.length))return 'value is required';
  if(typeof value==='string') {
    if(Number.isInteger(props.maxLength) && value.length>props.maxLength)return 'maximum length exceeded';
    if(Number.isInteger(props.minLength) && value.length<props.minLength)return 'minimum length not met';
    if(props.pattern && !new RegExp(`^(?:${props.pattern})$`).test(value))return 'pattern does not match';
  }
  if(typeof value==='number' && (props.min!=null && value<props.min || props.max!=null && value>props.max))return 'number is outside allowed bounds';
  if(['select','multiSelect','filterChips','treeMultiSelect'].includes(kind)) {
    if(!Array.isArray(props.options))return 'options are not loaded';
    const values=Array.isArray(value)?value:[value];
    if(values.some(v=>!props.options.some(option=>Object.is(option?.value??option,v)&&option?.disabled!==true)))return 'option is unavailable or disabled';
  }
  return null;
}

// Lazy observational reads use passive renderer snapshots, never action/guard
// handlers. Values are bounded and redacted before crossing the UI bridge.
export function readRegisteredControlActions({windowId,dataSourceRef,controlId,offset=0,limit=20}={}) {
  if(typeof windowId!=='string' || !windowId)throw new Error('windowId is required');
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>50)throw new Error('invalid control read bounds');
  let entries=[...registrations.values()].filter(({meta})=>meta.windowId===windowId&&(!dataSourceRef||meta.dataSourceRef===dataSourceRef)&&(!controlId||meta.controlId===controlId));
  if(controlId){const visible=entries.filter(entry=>{try{return entry.readProvider().visible===true;}catch{return false;}});if(visible.length)entries=visible;}
  let redacted=false,truncated=false,nodes=0,characters=0;
  const secret=/password|passwd|secret|token|credential|authorization|cookie|apikey|privatekey|authorityBinding|executionProof|localStateOwner/i;
  const clean=(value,depth=0,seen=new WeakSet())=>{
    if(++nodes>1000 || characters>16000){truncated=true;return '[truncated]';}
    if(typeof value==='string') {characters+=Math.min(value.length,512);if(/^(?:Bearer\s|Basic\s|eyJ[A-Za-z0-9_-]+\.)/i.test(value)){redacted=true;return '[redacted]';}if(value.length>512){truncated=true;return value.slice(0,512);}return value;}
    if(value==null || typeof value==='boolean' || typeof value==='number'&&Number.isFinite(value))return value;
    if(typeof value!=='object')return undefined;
    if(depth>=4 || seen.has(value)){truncated=true;return '[truncated]';}seen.add(value);
    if(Array.isArray(value)){if(value.length>20)truncated=true;return value.slice(0,20).map(item=>clean(item,depth+1,seen));}
    const keys=Object.keys(value);if(keys.length>25)truncated=true;
    return Object.fromEntries(keys.slice(0,25).map(key=>{if(secret.test(key)){redacted=true;return [key,'[redacted]'];}return [key,clean(value[key],depth+1,seen)];}));
  };
  const controls=entries.slice(offset,offset+limit).map(({meta,readProvider})=>{
    let state;try{state=readProvider();}catch{return {...meta,visible:false,disabled:true,readOnly:true,supportedActions:[],unavailableReason:'read_state_unavailable'};}
    const sensitive=state.sensitive===true || secret.test(`${meta.controlId} ${meta.dataField || ''}`);
    const result={...meta,...(operationStates.has(operationKey(meta))?{operationState:{...operationStates.get(operationKey(meta))}}:{}),visible:state.visible===true,disabled:state.disabled===true,readOnly:state.readOnly===true,
      supportedActions:Object.entries(state.actions || {}).filter(([,fn])=>typeof fn==='function').map(([key])=>key)};
    if(sensitive){redacted=true;result.value='[redacted]';result.sensitive=true;}else if(Object.hasOwn(state,'value'))result.value=clean(state.value);
    if(state.constraints)result.constraints=clean(state.constraints);
    if(Array.isArray(state.options))result.options=clean(state.options);
    return result;
  });
  while(controls.length && new TextEncoder().encode(JSON.stringify(controls)).length>60000){controls.pop();truncated=true;}
  if(!controls.length && offset<entries.length)throw new Error('control metadata exceeds the bounded read budget; no empty continuation is returned');
  return {controls,total:entries.length,offset,limit,hasMore:offset+controls.length<entries.length,redacted,truncated};
}
