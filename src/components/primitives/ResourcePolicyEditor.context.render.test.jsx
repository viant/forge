import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it,vi} from 'vitest';
import ResourcePolicyEditorPanel,{ResourceAccessEditor} from './ResourcePolicyEditor.jsx';
import GateRequirementsEditorPanel from './GateRequirementsEditor.jsx';
it('keeps unsaved rules when a parent refreshes the scoped context',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const resource={kind:'component',id:'one',tenant:'tenant',version:'1'},form=signal({resource});
 const fetch=vi.fn(async ref=>({rows:[ref==='get'?{document:{resource,revision:4,policies:{execute:{mode:'protected',rule:{kind:'role',value:'reader'}}}}}:{context:{canManage:true,choices:{role:[{id:'reader',label:'Reader'},{id:'analyst',label:'Analyst'}]}}}]}));
 const context={Context:ref=>ref==='selection'?{signals:{form}}:{handlers:{dataSource:{fetchRecords:()=>fetch(ref)}}}};
 const container={resourcePolicyEditor:{dataSourceRef:'selection',actions:['execute'],operations:{get:'get',context:'context',replace:'replace'}}};
 try{
  await act(async()=>root.render(<ResourcePolicyEditorPanel context={context} container={container}/>));
  const input=host.querySelector('[aria-label="rule value"]');expect(input).toBeTruthy();
  await act(async()=>{input.value='analyst';input.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(input.value).toBe('analyst');
  await act(async()=>root.render(<ResourcePolicyEditorPanel context={{...context}} container={container}/>));
  expect(host.querySelector('[aria-label="rule value"]').value).toBe('analyst');
  expect(fetch.mock.calls.filter(([ref])=>ref==='get')).toHaveLength(1);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('keeps unsaved gate choices when a parent refreshes the scoped context',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const resource={kind:'component',id:'one',tenant:'tenant',version:'1'},form=signal({resource,action:'execute'});
 const fetch=vi.fn(async ref=>({rows:[ref==='get'?{document:{resource,action:'execute',revision:4,requirements:{schemaVersion:1,allowedRoles:[],requiredExposures:[]}}}:{context:{canManage:true,choices:{roles:[{id:'analyst',label:'Analyst'}]}}}]}));
 const context={Context:ref=>ref==='selection'?{signals:{form}}:{handlers:{dataSource:{fetchRecords:()=>fetch(ref)}}}};
 const container={gateRequirementsEditor:{dataSourceRef:'selection',operations:{get:'get',context:'context',replace:'replace'}}};
 try{
  await act(async()=>root.render(<GateRequirementsEditorPanel context={context} container={container}/>));
  const input=host.querySelector('input[type="checkbox"]');expect(input).toBeTruthy();
  await act(async()=>input.click());expect(input.checked).toBe(true);
  await act(async()=>root.render(<GateRequirementsEditorPanel context={{...context}} container={container}/>));
  expect(host.querySelector('input[type="checkbox"]').checked).toBe(true);
  expect(fetch.mock.calls.filter(([ref])=>ref==='get')).toHaveLength(1);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('accepts exact custom role and exposure names outside provider choices',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const resource={kind:'component',id:'one',tenant:'tenant',version:'1'};
 const api={getResourceAccess:vi.fn(async()=>({resource,revision:4,policies:{execute:{mode:'protected',rule:{kind:'role',value:'reader'}}}})),getResourceAccessContext:vi.fn(async()=>({canManage:true,choices:{role:[{id:'reader',label:'Reader'}],exposure:[]}}))};
 const setValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
 const type=async(input,value)=>act(async()=>{setValue.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 try{
  await act(async()=>root.render(<ResourceAccessEditor api={api} resource={resource} actions={['execute']}/>));
  const role=host.querySelector('[aria-label="Custom role"]');expect(role).toBeTruthy();
  await type(role,'ROLE_CUSTOM');
  expect(host.querySelector('[aria-label="rule value"]').value).toBe('ROLE_CUSTOM');
  await act(async()=>{const kind=host.querySelector('[aria-label="rule condition"]');kind.value='exposure';kind.dispatchEvent(new Event('change',{bubbles:true}));});
  const exposure=host.querySelector('[aria-label="Custom feature exposure"]');expect(exposure).toBeTruthy();
  await type(exposure,'EXPOSE_CUSTOM');
  expect(host.querySelector('[aria-label="rule value"]').value).toBe('EXPOSE_CUSTOM');
 }finally{await act(async()=>root.unmount());host.remove();}
});
