// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {it,expect} from 'vitest';
import GroupedSelection from './GroupedSelection.jsx';
import Container from '../Container.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const model=()=>({left:[{id:0,label:'First',items:[{id:0,name:'Zero',path:['Folder','Zero']},{id:'a',name:'Alpha'}]}],right:[{id:'other',label:'Second',items:[]}],activeGroup:{section:'left',id:0}});
const spec={scope:'windowForm',field:'draft',sections:[{id:'left',label:'Left'},{id:'right',label:'Right'}],itemDescriptionField:'path',readOnlyWhen:{source:'windowForm',field:'locked',equals:true},onAction:'Demo.edit'};
async function setup(overrides={}){
 const calls=[],windowForm=signal({draft:model(),locked:false});
 const context={signals:{windowForm},lookupHandler:()=>event=>{calls.push(event);return true;},...overrides};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 await act(async()=>root.render(<GroupedSelection container={{groupedSelection:spec}} context={context}/>));
 return {host,root,context,windowForm,calls,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
const button=(host,label)=>host.querySelector(`button[aria-label="${label}"]`);
const click=async element=>{expect(element).toBeTruthy();await act(async()=>element.click());};
function transfer(){const data=new Map();return {types:[],setData(type,value){data.set(type,value);this.types=[...data.keys()];},getData:type=>data.get(type)||'',effectAllowed:''};}
async function dragEvent(node,type,dataTransfer){const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:dataTransfer});await act(async()=>node.dispatchEvent(event));}

it('renders mapped data and emits typed zero identities for keyboard group operations',async()=>{
 const f=await setup();try{
  expect(f.host.textContent).toContain('Folder / Zero');
  await click(button(f.host,'Add group to Right'));
  expect(f.calls.at(-1)).toMatchObject({operation:'addGroup',sectionId:'right',context:f.context});
  const select=f.host.querySelector('select[aria-label="Move Zero to group"]');
  await act(async()=>{select.value=JSON.stringify(['right','other']);select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(f.calls.at(-1)).toMatchObject({operation:'moveItem',sectionId:'left',groupId:0,itemId:0,toSectionId:'right',toGroupId:'other',index:0});
  await click(button(f.host,'Move Zero down'));
  expect(f.calls.at(-1)).toMatchObject({operation:'moveItem',itemId:0,toGroupId:0,index:1});
  await click(button(f.host,'Remove Zero'));expect(f.calls.at(-1)).toMatchObject({operation:'removeItem',itemId:0,groupId:0});
  await click(button(f.host,'Remove First'));expect(f.calls.at(-1)).toMatchObject({operation:'removeGroup',groupId:0});
  expect(f.windowForm.value.draft.left[0].items).toHaveLength(2);
 }finally{await f.close();}
});

it('responds to readonly and collapse state without disabling inspection',async()=>{
 const f=await setup();try{
  await act(async()=>{f.windowForm.value={...f.windowForm.value,locked:true};});
  expect(button(f.host,'Remove Zero').disabled).toBe(true);expect(button(f.host,'Add group to Right').disabled).toBe(true);
  await click(button(f.host,'Remove Zero'));expect(f.calls).toHaveLength(0);
  await click(button(f.host,'Collapse First'));expect(f.calls.at(-1)).toMatchObject({operation:'collapseGroup',groupId:0,collapsed:true});
  await act(async()=>{const draft=model();draft.left[0].collapsed=true;f.windowForm.value={draft,locked:true};});
  expect(button(f.host,'Expand First').getAttribute('aria-expanded')).toBe('false');
  expect(f.host.querySelector('.forge-grouped-selection__items').hidden).toBe(true);
  await click(f.host.querySelector('.forge-grouped-selection__activate'));expect(f.calls.at(-1).operation).toBe('activateGroup');
 }finally{await f.close();}
});

it('moves by drag once and rejects payloads from another component or readonly state',async()=>{
 const f=await setup(),other=await setup();try{
  const transferData=transfer();await dragEvent(f.host.querySelector('[data-item-id="0"]'),'dragstart',transferData);
  await dragEvent(f.host.querySelector('[data-item-id="a"]'),'drop',transferData);
  expect(f.calls).toHaveLength(1);expect(f.calls[0]).toMatchObject({operation:'moveItem',itemId:0,toGroupId:0,index:1});
  await dragEvent(other.host.querySelector('article[aria-label="Right Second"]'),'drop',transferData);expect(other.calls).toHaveLength(0);
  await act(async()=>{const draft=model();draft.left[0].items=draft.left[0].items.filter(item=>item.id!==0);f.windowForm.value={draft,locked:false};});
  await dragEvent(f.host.querySelector('article[aria-label="Right Second"]'),'drop',transferData);expect(f.calls).toHaveLength(1);
  await act(async()=>{f.windowForm.value={draft:model(),locked:true};});
  await dragEvent(f.host.querySelector('article[aria-label="Right Second"]'),'drop',transferData);expect(f.calls).toHaveLength(1);
 }finally{await f.close();await other.close();}
});

it('does not fall back to another form when an explicit datasource is absent',async()=>{
 const calls=[],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const context={identity:{dataSourceRef:'outer'},signals:{form:signal({draft:model()})},Context:()=>null,lookupHandler:()=>event=>calls.push(event)};
 try{
  await act(async()=>root.render(<GroupedSelection container={{groupedSelection:{...spec,scope:'form',dataSourceRef:'missing'}}} context={context}/>));
  expect(host.querySelectorAll('article')).toHaveLength(0);
  expect(button(host,'Add group to Left').disabled).toBe(true);
  await click(button(host,'Add group to Left'));expect(calls).toHaveLength(0);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('maps an explicit form datasource and preserves configured control visibility',async()=>{
 const calls=[],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const child={identity:{dataSourceRef:'child'},signals:{form:signal({selection:{buckets:[{key:'first',caption:'Mapped',entries:[{value:42,text:'Mapped item',detail:'Read description'}]}]}})},lookupHandler:()=>event=>calls.push(event)};
 const context={identity:{dataSourceRef:'outer'},Context:ref=>ref==='child'?child:null};
 const configured={dataSourceRef:'child',field:'selection',sections:[{id:'primary',label:'Primary',groupsField:'buckets'}],groupIdentityField:'key',groupLabelField:'caption',itemsField:'entries',itemIdentityField:'value',itemLabelField:'text',itemDescriptionField:'detail',allowRemoveGroups:false,onAction:'Demo.edit'};
 try{
  await act(async()=>root.render(<GroupedSelection container={{groupedSelection:configured}} context={context}/>));
  expect(host.textContent).toContain('Read description');expect(button(host,'Remove Mapped')).toBeNull();
  await click(button(host,'Remove Mapped item'));
  expect(calls[0]).toMatchObject({operation:'removeItem',sectionId:'primary',groupId:'first',itemId:42,context:child});
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('renders through the native container without requiring a datasource',async()=>{
 const calls=[],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const context={identity:{windowId:'grouped-window'},signals:{windowForm:signal({draft:model(),locked:false}),form:signal({}),control:signal({}),message:signal([]),formStatus:signal({dirty:false}),selection:signal({})},handlers:{dataSource:{}},lookupHandler:()=>event=>calls.push(event)};
 try{
  await act(async()=>root.render(<Container container={{id:'groups',groupedSelection:spec}} context={context}/>));
  expect(host.querySelector('[data-forge-primitive="groupedSelection"]')).not.toBeNull();
  await click(button(host,'Add group to Right'));expect(calls[0]).toMatchObject({operation:'addGroup',sectionId:'right'});
 }finally{await act(async()=>root.unmount());host.remove();}
});
