import assert from 'node:assert/strict';
import {useControlEvents} from '../../hooks/event.js';
function fixture(windowId) {
 let value='',fail;
 const calls=[];
 const context={identity:{windowId},signals:{message:{value:[]}},lookupHandler:name=>{
  if(name==='dataSource.setFormField')return args=>{value=args.value;calls.push(['set',args.value]);};
  if(name==='changed')return args=>{calls.push(['changed',args.value]);return args.value==='fail'?new Promise((_,reject)=>{fail=reject;}):true;};
  if(name==='finished')return args=>calls.push(['done',!!args.error]);
  throw new Error('unknown handler '+name);
 }};
 const item={id:'name',type:'text',on:[{event:'onChange',handler:'changed',onDone:'finished'}]};
 const callback=useControlEvents(context,[item]).name.events.onChange;
 return {callback,calls,get value(){return value;},reject:()=>fail(new Error('asynchronous validation failed'))};
}
const a=fixture('A'),b=fixture('B');
const pending=a.callback.operate('fail');await Promise.resolve();await Promise.resolve();
a.callback('human');b.callback('other-window');
assert.equal(a.value,'human');assert.equal(b.value,'other-window');
a.reject();await assert.rejects(pending,/asynchronous validation failed/);
assert.equal(a.value,'human','failed operation must not overwrite overlapping human input');
assert.ok(a.calls.some(([kind,error])=>kind==='done'&&error===true));
await a.callback.operate('later');assert.equal(a.value,'later','failed invocation leaves no global strict state');
const invalid={identity:{windowId:'C'},signals:{message:{value:[]}},lookupHandler:name=>{if(name==='dataSource.setFormField')return ()=>{};return ()=>{throw new Error('synchronous action error');};}};
const event=useControlEvents(invalid,[{id:'name',type:'text',on:[{event:'onChange',handler:'broken'}]}]).name.events.onChange;
await assert.rejects(event.operate('value'),/synchronous action error/);
console.log('PASS: strict async/sync error propagation with ordinary overlapping and cross-window callbacks, lifecycle cleanup and no global invocation flag');
