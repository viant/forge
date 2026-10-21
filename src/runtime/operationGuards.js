import {resolveParameters} from '../hooks/parameters.js';
// Re-evaluate authored synchronous UI guards only for an explicit operation.
// Passive Read uses already-rendered flags and never calls this function.
export function evaluateOperationGuard(name,item={},context={},value,extra={}) {
  let result;
  for(const execution of item.on || [])if(execution.event===name) {
    const handler=context.lookupHandler?.(execution.handler);
    if(typeof handler!=='function')throw new Error('control guard handler is unavailable');
    if(handler.constructor?.name==='AsyncFunction')throw new Error('asynchronous control guard is unsupported');
    result=handler({item,context,value,...extra,execution,parameters:resolveParameters(execution.parameters || [],context)});
    if(result && typeof result.then==='function'){void Promise.resolve(result).catch(()=>{});throw new Error('asynchronous control guard is unsupported');}
  }
  return result;
}
