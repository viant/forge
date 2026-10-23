import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it,vi} from 'vitest';
import ResourcePolicyEditorPanel,{ResourceAccessEditor,NamedPolicyManager} from './ResourcePolicyEditor.jsx';
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

it('offers server-provided named policies for report and skill resources',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const named={resource:{kind:'namedPolicy',id:'shared',tenant:'tenant',version:'1'},revision:3,displayName:'Shared readers'};
 for(const kind of ['report','skill']){
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const resource={kind,id:`${kind}-one`,tenant:'tenant',version:'1'};
  const api={getResourceAccess:vi.fn(async()=>({resource,revision:4,policies:{execute:{mode:'deny'}}})),getResourceAccessContext:vi.fn(async()=>({canManage:true,namedPolicies:[named],choices:{}}))};
  try{
   await act(async()=>root.render(<ResourceAccessEditor api={api} resource={resource} actions={['execute']}/>));
   const mode=host.querySelector('#resource-access-mode');
   expect([...mode.options].map(option=>option.value)).toContain('named');
   await act(async()=>{mode.value='named';mode.dispatchEvent(new Event('change',{bubbles:true}));});
   const policy=host.querySelector('#resource-access-named');
   expect(policy).toBeTruthy();
   expect(policy.textContent).toContain('Shared readers');
   expect(host.textContent).toContain('every assigned resource');
  }finally{await act(async()=>root.unmount());host.remove();}
 }
});

it('shows affected assignment kinds across one reusable policy',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const policy={resource:{kind:'namedPolicy',id:'shared',tenant:'tenant',version:'1'},revision:3,displayName:'Shared readers',policies:{'*':{mode:'protected',rule:{kind:'group',value:'readers'}}}};
 const api={listNamedPolicies:vi.fn(async()=>[policy]),namedPolicyImpact:vi.fn(async()=>[
  {resource:{kind:'window',id:'overview',version:2},actions:['read']},
  {resource:{kind:'report',id:'summary',version:4},actions:['execute']},
  {resource:{kind:'skill',id:'analyst',version:1},actions:['use']},
 ])};
 try{
  await act(async()=>root.render(<NamedPolicyManager api={api}/>));
  expect(host.textContent).toContain('assign it to resources');
  const select=host.querySelector('#named-policy-select');
  await act(async()=>{select.value='shared';select.dispatchEvent(new Event('change',{bubbles:true}));});
  const impact=host.querySelector('[aria-label="Affected resources"]');
  expect(impact.textContent).toContain('window · overview · version 2 · read');
  expect(impact.textContent).toContain('report · summary · version 4 · execute');
  expect(impact.textContent).toContain('skill · analyst · version 1 · use');
 }finally{await act(async()=>root.unmount());host.remove();}
});
