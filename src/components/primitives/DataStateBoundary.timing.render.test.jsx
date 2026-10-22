import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it} from 'vitest';
import DataStateBoundary from './DataStateBoundary.jsx';

it('exposes rendered data state independently of the already mounted window controls',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);
 const root=createRoot(host);
 const context={signals:{control:signal({loaded:false,loading:true}),collection:signal([])}};
 context.Context=()=>context;
 const container={dataSourceRef:'records',dataStateBoundary:{renderEmptyContent:true}};
 try{
  await act(async()=>root.render(<DataStateBoundary context={context} container={container}><button>Window control</button></DataStateBoundary>));
  const control=host.querySelector('button');
  expect(control).not.toBeNull();
  expect(host.querySelector('[data-forge-data-state="loading"]')).not.toBeNull();
  await act(async()=>{context.signals.collection.value=[{secret:'fixture-only-value'}];context.signals.control.value={loaded:true,loading:false};});
  const ready=host.querySelector('[data-forge-data-state="ready"]');
  expect(ready?.getAttribute('data-forge-data-sources')).toBe('records');
  expect(ready?.attributes.getNamedItem('data-forge-data-state')?.value).not.toContain('fixture-only-value');
  expect(host.querySelector('button')).toBe(control);
  await act(async()=>{context.signals.control.value={loaded:false,loading:false,error:new Error('Unavailable')};});
  expect(host.querySelector('[data-forge-data-state="ready"]')).toBeNull();
  expect(host.querySelector('[data-forge-data-state="error"]')).not.toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
