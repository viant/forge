// Host-neutral, opt-in operation spans. Observers receive timing and safe labels
// only: no request inputs, user identity, response data, or error messages.
const noopSpan=Object.freeze({id:null,end:()=>{}});
const validName=name=>typeof name==='string'&&/^[a-z][a-z0-9_.-]{0,95}$/i.test(name);
export function createOperationTelemetry({observers=[],clock=()=>globalThis.performance?.now?.()??Date.now()}={}) {
 const sinks=new Set(observers.filter(observer=>typeof observer==='function'));let sequence=0;
 const readClock=()=>{try{const value=clock();return Number.isFinite(value)?value:null;}catch{return null;}};
 const subscribe=observer=>{if(typeof observer!=='function')throw new TypeError('Timing observer must be a function');sinks.add(observer);return()=>sinks.delete(observer);};
 const start=(name,{parentId=null}={})=>{
  if(!sinks.size||!validName(name))return noopSpan;
  const startedAt=readClock();if(startedAt===null)return noopSpan;
  const id=++sequence;let finished=false;
  return {id,end(outcome='ok'){
   if(finished)return;finished=true;const endedAt=readClock();if(endedAt===null)return;
   const record=Object.freeze({id,parentId:Number.isSafeInteger(parentId)&&parentId>0?parentId:null,name,startedAt,endedAt:Math.max(startedAt,endedAt),durationMs:Math.max(0,endedAt-startedAt),outcome:outcome==='ok'?'ok':outcome==='cancelled'?'cancelled':'error'});
   for(const observer of sinks){try{const result=observer(record);if(result&&typeof result.catch==='function')result.catch(()=>{});}catch{/* Diagnostics must not change operation behavior. */}}
  }};
 };
 const measure=(name,operation,options)=>{
  const span=start(name,options);
  try{const result=operation(span);if(result&&typeof result.then==='function')return Promise.resolve(result).then(value=>{span.end();return value;},error=>{span.end('error');throw error;});span.end();return result;}
  catch(error){span.end('error');throw error;}
 };
 return {subscribe,start,measure};
}
