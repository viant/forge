import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import '../../packs/blueprint/index.jsx';
import ArrayFields from './ArrayFields.jsx';
import {invokeRegisteredControlAction} from '../../core/ui/controlActions.js';

it('edits and removes only eligible rows while preserving unbound row fields',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 const rows=[{id:1,name:'Locked',status:'locked',metadata:{keep:true}},{id:2,name:'Editable',status:'open',metadata:{keep:true}}];
 try{
  await act(async()=>root.render(<ArrayFields value={rows} fields={[{field:'name',label:'Name'}]} onChange={change} minRows={1}
   rowReadOnlyWhen={{source:'row',field:'status',in:['locked']}} removeWhen={{source:'row',field:'status',equals:'open'}} newRow={{name:''}}/>));
  expect(host.querySelector('[aria-label="Name 1"]').readOnly).toBe(true);
  expect(host.querySelector('[aria-label="Remove row 1"]')).toBeNull();
  await act(async()=>host.querySelector('[aria-label="Remove row 2"]').click());
  expect(change.mock.lastCall[0]).toEqual([rows[0]]);expect(rows).toHaveLength(2);
  const add=[...host.querySelectorAll('button')].find(e=>e.textContent.includes('Add row'));
  await act(async()=>add.click());expect(change.mock.lastCall[0]).toEqual([...rows,{name:''}]);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('read-only arrays expose values without add/remove controls',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(<ArrayFields readOnly value={[{name:'Read'}]} fields={[{field:'name',label:'Name'}]}/>));
 expect(host.querySelector('input').value).toBe('Read');expect(host.querySelectorAll('button')).toHaveLength(0);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('tracks explicit stored-row removal and discards unsaved rows; reset clears the intent',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const baseline=[{id:1,name:'Original'},{id:2,name:'Sibling'},{id:null,name:'Unsaved'}];
 let pending;
 const render=rows=>act(async()=>root.render(<ArrayFields value={rows} fields={[{field:'name',label:'Name'}]}
  onChange={next=>{pending=next;}} minRows={1} deleteMarker="remove" />));
 const click=ordinal=>act(async()=>host.querySelector(`[aria-label="Remove row ${ordinal}"]`).click());
 try{
  await render(baseline);
  await click(1);
  expect(pending).toEqual([{...baseline[0],remove:true},baseline[1],baseline[2]]);
  await render(pending);
  expect(host.querySelector('[aria-label="Name 1"]').value).toBe('Sibling');
  await click(2);
  expect(pending).toEqual([{...baseline[0],remove:true},baseline[1]]);
  await render(pending);
  expect(host.querySelector('[aria-label="Remove row 1"]')).toBeNull();
  await render(baseline);
  expect(host.querySelector('[aria-label="Name 1"]').value).toBe('Original');
  expect(baseline[0]).not.toHaveProperty('remove');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('limits additions to live rows through both the button and its registered action', async () => {
 const host = document.body.appendChild(document.createElement('div'));
 const root = createRoot(host);
 const change = vi.fn();
 const rows = [{id: 1, name: 'One'}, {id: 2, name: 'Two'}];
 const context = {identity: {windowId: 'bounded-array'}};
 const addAction = {windowId: context.identity.windowId, controlId: 'arrayFields:add'};
 const addButton = () => host.querySelector('.forge-array-fields__add');
 const render = (value, maxRows) => act(async () => root.render(
  <ArrayFields context={context} value={value} fields={[{field: 'name', label: 'Name'}]}
   onChange={change} newRow={{name: ''}} deleteMarker="remove" maxRows={maxRows}/>
 ));
 try {
  await render(rows, 2);
  expect(addButton().disabled).toBe(true);
  await act(async () => addButton().click());
  await expect(invokeRegisteredControlAction(addAction, 'click')).rejects.toThrow(/disabled/);
  expect(change).not.toHaveBeenCalled();
  expect(host.querySelector('[aria-label="Name 1"]').readOnly).toBe(false);
  await act(async () => host.querySelector('[aria-label="Remove row 1"]').click());
  const pending = change.mock.lastCall[0];
  expect(pending[0].remove).toBe(true);
  await render(pending, 2);
  expect(addButton().disabled).toBe(false);
  await act(async () => invokeRegisteredControlAction(addAction, 'click'));
  expect(change.mock.lastCall[0]).toEqual([...pending, {name: ''}]);
  await render(rows, 1);
  expect(addButton().disabled).toBe(true);
  expect(host.querySelectorAll('input')).toHaveLength(2);
  await render([], 0);
  expect(addButton().disabled).toBe(true);
  await render(rows, undefined);
  expect(addButton().disabled).toBe(false);
 } finally {
  await act(async () => root.unmount());
  host.remove();
 }
});
