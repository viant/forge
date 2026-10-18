// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it} from 'vitest';
import StatusWorkflow from './StatusWorkflow.jsx';
import DraftForm from './DraftForm.jsx';

it('uses the shared writer lifecycle and authoritative readback for a status switch',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let inputs,finishWriter,finishReadback,calls=0;
 const selected=signal({selected:{id:7,status:'ENABLED'}}),control=signal({loading:false});
 const writer={signals:{control},handlers:{dataSource:{setInputParameters(value){inputs=value},fetchCollection(){calls++;control.value={loading:true};return new Promise(resolve=>{finishWriter=()=>{control.value={loading:false};resolve()}})}}}};
 const record={handlers:{dataSource:{fetchCollection(){selected.value={selected:{id:7,status:'DISABLED'}};return new Promise(resolve=>{finishReadback=resolve})}}}};
 const context={identity:{windowId:'status-switch-proof'},authorization:{resource:{capabilities:{write:true}}},signals:{selection:selected,form:signal({}),windowForm:signal({})},Context:ref=>ref==='patch'?writer:record};
 const command={commandId:'status-change',dataSourceRef:'patch',refresh:[{dataSourceRef:'record'}]};
 const spec={appearance:'switch',label:'User Status',stateField:'status',activeState:'ENABLED',stateLabels:{ENABLED:'Active',DISABLED:'Inactive'},transitions:[
  {id:'disable',from:['ENABLED'],to:0,label:'Deactivate',command},
  {id:'enable',from:['DISABLED'],to:1,label:'Activate',command},
 ]};
 const settle=async action=>act(async()=>{action?.();for(let n=0;n<15;n++)await Promise.resolve()});
 try{
  await settle(()=>root.render(<><StatusWorkflow context={context} container={{id:'status',statusWorkflow:spec}}/><DraftForm context={context} container={{id:'properties',draftForm:{submit:command}}}><input aria-label="Name" defaultValue="Unchanged"/></DraftForm></>));
  const input=()=>host.querySelector('button[role="switch"]');
  expect(input().getAttribute('aria-checked')).toBe('true');expect(host.textContent).toContain('Active');
  await settle(()=>input().click());expect(calls).toBe(1);expect(inputs.to).toBe(0);expect(input().disabled).toBe(true);expect(host.querySelector('fieldset').disabled).toBe(true);
  await settle(()=>input().click());expect(calls).toBe(1);
  await settle(()=>finishWriter());expect(input().getAttribute('aria-checked')).toBe('false');expect(input().disabled).toBe(true);expect(host.querySelector('fieldset').disabled).toBe(true);
  await settle(()=>finishReadback());expect(input().disabled).toBe(false);expect(host.textContent).toContain('Inactive');expect(host.querySelector('fieldset').disabled).toBe(false);
  await settle(()=>{selected.value={selected:{id:7,status:'ARCHIVED'}}});
  expect(input().disabled).toBe(true);expect(input().getAttribute('aria-checked')).toBe('false');
 }finally{await settle(()=>root.unmount());host.remove()}
});
