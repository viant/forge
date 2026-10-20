import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it} from 'vitest';
import ResultPreviewPanel from './ResultPreview.jsx';

it('binds nested results from metadata and retains expand and JSON inspection',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const form=signal({payload:{customers:[{id:1,name:'Ada',orders:[{id:11,total:35}]}]}}),scoped={signals:{form}},context={Context:()=>scoped};
 try{
  await act(async()=>root.render(<ResultPreviewPanel context={context} container={{resultPreview:{dataSourceRef:'result',dataField:'payload',label:'Query result'}}}/>));
  expect(host.textContent).toContain('Query result');expect(host.textContent).toContain('Ada');expect(host.textContent).not.toContain('total');
  await act(async()=>host.querySelector('button[aria-label="Expand row 1"]').click());expect(host.textContent).toContain('orders');expect(host.textContent).toContain('35');
  await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='JSON').click());
  expect(JSON.parse(host.querySelector('pre').textContent).customers[0].orders[0].id).toBe(11);
  await act(async()=>{form.value={payload:{rows:[]}};});expect(JSON.parse(host.querySelector('pre').textContent)).toEqual({rows:[]});
 }finally{await act(async()=>root.unmount());host.remove();}
});
