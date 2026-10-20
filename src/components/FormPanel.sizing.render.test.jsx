import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
vi.mock('./Container',()=>({default:({sizingMode,container})=><div data-sizing={sizingMode}>{container.id}</div>}));
import FormPanel from './FormPanel.jsx';
it('passes content allocation through nested Blueprint tabs instead of collapsing their children',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const container={id:'editor',tabs:{mountPolicy:'visited'},containers:[{id:'document',title:'Document'},{id:'files',title:'Files'}]};
 try{
  await act(async()=>root.render(<FormPanel context={{}} container={container} sizingMode="content"/>));
  expect(host.querySelector('[data-sizing]').dataset.sizing).toBe('content');
  await act(async()=>root.render(<FormPanel context={{}} container={container} sizingMode="fill"/>));
  expect(host.querySelector('[data-sizing]').dataset.sizing).toBe('fill');
 }finally{await act(async()=>root.unmount());host.remove();}
});
