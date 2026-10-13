import React from 'react';
import {act, create} from 'react-test-renderer';
import assert from 'node:assert/strict';
const roots=[new URL('../..',import.meta.url).pathname.replace(/\/$/,'')];
for(const root of roots) {
 const {ViewDialogFooterAction}=await import(`${root}/src/components/ViewDialog.jsx`);
 function mount(props) {let view;act(()=>{view=create(<ViewDialogFooterAction context={{}} action={{id:'confirm',label:'Confirm',close:true}} {...props}/>);});return {view,button:()=>view.root.findByType('button'),close:()=>act(()=>view.unmount())};}
 let calls=[];
 let mounted=mount({onClose:()=>calls.push('close'),onInvoke:()=>calls.push('unexpected invoke')});act(()=>{mounted.button().props.onClick({});});assert.deepEqual(calls,['close']);mounted.close();
 calls=[];mounted=mount({invokeBeforeClose:true,onInvoke:()=>{calls.push('invoke');return true;},onClose:()=>calls.push('close')});act(()=>{mounted.button().props.onClick({});});assert.deepEqual(calls,['invoke','close']);mounted.close();
 for(const outcome of [false,null]) {calls=[];mounted=mount({invokeBeforeClose:true,onInvoke:()=>{calls.push('invoke');return outcome;},onClose:()=>calls.push('close')});act(()=>{mounted.button().props.onClick({});});assert.deepEqual(calls,['invoke']);mounted.close();}
 calls=[];mounted=mount({invokeBeforeClose:true,onInvoke:()=>{calls.push('invoke');throw new Error('rejected');},onClose:()=>calls.push('close')});act(()=>{assert.equal(mounted.button().props.onClick({}),false);});assert.deepEqual(calls,['invoke']);mounted.close();
 let resolve,request;calls=[];const ready=new Promise(r=>{resolve=r;});mounted=mount({invokeBeforeClose:true,onInvoke:()=>{calls.push('invoke');return ready;},onClose:()=>calls.push('close')});const click=mounted.button().props.onClick;act(()=>{request=click({});});assert.deepEqual(calls,['invoke']);assert.equal(mounted.button().props.disabled,true);act(()=>{assert.equal(click({}),false);});await act(async()=>{resolve(true);await request;});assert.deepEqual(calls,['invoke','close']);assert.equal(mounted.button().props.disabled,false);mounted.close();
 for(const callback of [()=>Promise.resolve(false),()=>Promise.reject(new Error('async failure'))]) {calls=[];mounted=mount({invokeBeforeClose:true,onInvoke:callback,onClose:()=>calls.push('close')});await act(async()=>{assert.equal(await mounted.button().props.onClick({}),false);});assert.deepEqual(calls,[]);assert.equal(mounted.button().props.disabled,false);mounted.close();}
 calls=[];mounted=mount({action:{id:'ordinary',label:'Run'},onInvoke:()=>calls.push('invoke'),onClose:()=>calls.push('unexpected close')});act(()=>{mounted.button().props.onClick({});});assert.deepEqual(calls,['invoke']);mounted.close();
 calls=[];mounted=mount({disabled:true,invokeBeforeClose:true,onInvoke:()=>calls.push('invoke'),onClose:()=>calls.push('close')});assert.equal(mounted.button().props.disabled,true);assert.equal(mounted.button().props.onClick,undefined);assert.deepEqual(calls,[]);mounted.close();
 console.log(`${root}: footer close-only, combined sync/async, false/null/throw/reject, busy duplicate guard and ordinary action interactions pass.`);
}
