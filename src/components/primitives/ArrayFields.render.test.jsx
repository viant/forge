import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import '../../packs/blueprint/index.jsx';
import ArrayFields from './ArrayFields.jsx';

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
