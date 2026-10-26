// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {it,expect,vi} from 'vitest';
import ChoiceBrowser from './ChoiceBrowser.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const rows=()=>[{key:'folder',name:'Folder',selectable:false},{key:0,name:'Choice',selectable:true,selected:false,path:[{label:'Root',value:'root'},{label:'Middle',value:'middle'},{label:'Parent',value:'parent'}],detailsPath:[{label:'Root',value:'root'},{label:'Choice',current:true}],cost:0,note:null,details:true},{key:2,name:'Second',selectable:true,details:true,cost:2,note:'Description'}];
const spec={scope:'windowForm',field:'rows',identityField:'key',maxPathItems:2,onAction:'Demo.choose',readOnlyWhen:{source:'windowForm',field:'readonly',equals:true},loadingWhen:{source:'windowForm',field:'loading',equals:true},detailEnabledField:'details',detailPathField:'detailsPath',detailFields:[{field:'cost',label:'Cost',format:'currency2',currency:'EUR'},{field:'note',label:'Note'}]};
async function setup(){const calls=[],state=signal({rows:rows(),readonly:false,loading:false}),context={signals:{windowForm:state},lookupHandler:()=>event=>calls.push(event)};const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(<ChoiceBrowser container={{choiceBrowser:spec}} context={context}/>));return {calls,state,host,root,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
const click=async target=>{expect(target).toBeTruthy();await act(async()=>target.click());};
it('emits one checkbox intent, preserves zero identity and leaves selection to the owner',async()=>{const f=await setup();try{
 await click(f.host.querySelector('input[aria-label="Select Choice"]'));
 expect(f.calls).toHaveLength(1);expect(f.calls[0]).toMatchObject({operation:'toggleItem',id:0});
 expect(f.state.value.rows[1].selected).toBe(false);
 await click([...f.host.querySelectorAll('button')].find(button=>button.textContent==='Folder'));expect(f.calls.at(-1)).toMatchObject({operation:'activateItem',id:'folder'});
}finally{await f.close();}});
it('keeps path navigation available at a selection limit and expands omitted ancestors',async()=>{const f=await setup();try{
 await act(async()=>{const records=rows();records[1].selectionDisabled=true;f.state.value={...f.state.value,rows:records};});
 expect(f.host.querySelector('input[aria-label="Select Choice"]').disabled).toBe(true);
 await click([...f.host.querySelectorAll('nav button')].find(button=>button.textContent==='Root'));
 expect(f.calls.at(-1)).toMatchObject({operation:'activatePath',id:0,pathValue:'root',pathIndex:0});
 await click(f.host.querySelector('button[aria-label="Expand path for Choice"]'));expect(f.host.querySelector('nav').textContent).toContain('Middle');
}finally{await f.close();}});
it('readonly prevents selection but permits folder navigation and loading hides stale choices',async()=>{const f=await setup();try{
 await act(async()=>{f.state.value={...f.state.value,readonly:true};});
 await click(f.host.querySelector('input[aria-label="Select Choice"]'));expect(f.calls).toHaveLength(0);
 await click([...f.host.querySelectorAll('button')].find(button=>button.textContent==='Folder'));expect(f.calls).toHaveLength(1);
 await act(async()=>{f.state.value={...f.state.value,loading:true};});
 expect(f.host.querySelector('[role="status"]').textContent).toContain('Loading');expect(f.host.querySelectorAll('input')).toHaveLength(0);
}finally{await f.close();}});
it('details preserve zero/null, navigate by path and share one active popover per window',async()=>{const f=await setup();try{
 await click(f.host.querySelector('button[aria-label="Details for Choice"]'));
 let dialog=document.querySelector('[role="dialog"][aria-hidden="false"]');expect(dialog.textContent).toContain('€0.00');expect(dialog.textContent).toContain('--');
 await click([...dialog.querySelectorAll('nav button')].find(button=>button.textContent==='Root'));
 expect(f.calls.at(-1)).toMatchObject({operation:'activatePath',id:0,pathValue:'root',details:true});
 await click(f.host.querySelector('button[aria-label="Details for Choice"]'));
 await click(f.host.querySelector('button[aria-label="Details for Second"]'));
 const active=document.querySelectorAll('[role="dialog"][aria-hidden="false"]');expect(active).toHaveLength(1);expect(active[0].getAttribute('aria-label')).toBe('Details for Second');
 await act(async()=>active[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(document.querySelectorAll('[role="dialog"][aria-hidden="false"]')).toHaveLength(0);
}finally{await f.close();}});

it('opens details on pointer hover and closes after the documented hover grace period',async()=>{
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});const f=await setup();
 const pointer=async(type,target)=>{const event=new Event(type,{bubbles:true});Object.defineProperty(event,'pointerType',{value:'mouse'});await act(async()=>target.dispatchEvent(event));};
 try{
  const trigger=f.host.querySelector('button[aria-label="Details for Choice"]');
  await pointer('pointerover',trigger);expect(document.querySelectorAll('[role="dialog"][aria-hidden="false"]')).toHaveLength(1);
  await pointer('pointerout',trigger);await act(async()=>vi.advanceTimersByTimeAsync(499));expect(document.querySelectorAll('[role="dialog"][aria-hidden="false"]')).toHaveLength(1);
  await act(async()=>vi.advanceTimersByTimeAsync(1));expect(document.querySelectorAll('[role="dialog"][aria-hidden="false"]')).toHaveLength(0);
 }finally{await f.close();vi.useRealTimers();}
});
