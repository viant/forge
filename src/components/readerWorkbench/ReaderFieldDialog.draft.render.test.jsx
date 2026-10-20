import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ReaderFieldDialog} from './ReaderFieldDialog.jsx';

const node={name:'record',label:'Records',view:{columns:[{name:'region',source:'region',groupable:true},{name:'channel',source:'channel',groupable:false}]}};
const change=(element,value)=>{Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('change',{bubbles:true}));};
const choose=name=>Array.from(document.querySelectorAll('.studio-column-dialog button')).find(button=>button.querySelector('strong')?.textContent===name).click();

it('keeps a changed column role when inspection refreshes its contract before saving',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host),apply=vi.fn(async()=>{}),close=vi.fn();let contracts=[];
 const render=()=>root.render(<ReaderFieldDialog isOpen node={node} columnContracts={contracts} onApply={apply} onClose={close}/>);
 try{
  await act(async()=>render());await act(async()=>choose('channel'));await act(async()=>change(document.querySelector('#column-role'),'dimension'));
  contracts=[{view:'record',column:'channel',castType:'string',tags:{groupable:'false'}}];await act(async()=>render());
  expect(document.querySelector('#column-role').value).toBe('dimension');
  await act(async()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Save column contract').click());
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({type:'setColumnContract',column:expect.objectContaining({column:'channel',tags:expect.objectContaining({groupable:'true'})})}));
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('loads the newly selected column instead of carrying the previous column draft',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<ReaderFieldDialog isOpen node={node} columnContracts={[{view:'record',column:'channel',castType:'string',tags:{groupable:'false'}}]} onApply={async()=>{}} onClose={()=>{}}/>));
  await act(async()=>change(document.querySelector('#column-visibility'),'hidden'));
  await act(async()=>choose('channel'));
  expect(document.querySelector('#column-role').value).toBe('measure');expect(document.querySelector('#column-visibility').value).toBe('public');expect(document.querySelector('#column-cast').value).toBe('string');
 }finally{await act(async()=>root.unmount());host.remove();}
});
