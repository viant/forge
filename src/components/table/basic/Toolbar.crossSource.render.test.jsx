import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it} from 'vitest';
import Toolbar from './Toolbar.jsx';
it('reacts when a declared guard changes on a different datasource',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const status=signal({saving:true,show:true});
 const context={identity:{dataSourceRef:'filter'},signals:{control:signal({inactive:false}),formStatus:signal({}),selection:signal({}),windowForm:signal({}),form:signal({})},handlers:{dataSource:{getFormData:()=>({})}},lookupHandler:()=>()=>{},Context:()=>({signals:{form:status},handlers:{dataSource:{peekFormData:()=>status.peek(),getFormData:()=>status.peek()}}})};
 try{
  await act(async()=>root.render(<Toolbar context={context} toolbarItems={[{id:'create',label:'Create',hideLabel:false,icon:'add',disabledWhen:{dataSourceRef:'state',selector:'saving',equals:true},visibleWhen:{dataSourceRef:'state',selector:'show',equals:true}}]}/>));
  expect(host.querySelector('button').disabled).toBe(true);
  await act(async()=>{status.value={saving:false,show:true};});
  expect(host.querySelector('button').disabled).toBe(false);
  await act(async()=>{status.value={saving:false,show:false};});
  expect(host.querySelector('button')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('keeps an unavailable primary action disabled only in the DS2 List Page pattern',async()=>{
 const {ForgeThemeProvider}=await import('../../ThemeBoundary.jsx');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const status=signal({show:false});const execute=()=>{};
 const context={identity:{dataSourceRef:'rows'},signals:{control:signal({inactive:false}),formStatus:signal({}),selection:signal({}),windowForm:signal({}),form:status},handlers:{dataSource:{getFormData:()=>status.value}},lookupHandler:()=>execute,Context:()=>({signals:{form:status},handlers:{dataSource:{peekFormData:()=>status.peek(),getFormData:()=>status.value}}})};
 const item={id:'create',label:'New record',intent:'primary',enabled:true,visibleWhen:{dataSourceRef:'state',selector:'show',equals:true}};
 const view=(theme,className)=><ForgeThemeProvider themeId={theme}><Toolbar context={context} className={className} toolbarItems={[item]}/></ForgeThemeProvider>;
 try{
  await act(async()=>root.render(view('baseline','forge-list-page__actions')));expect(host.querySelector('button')).toBeNull();
  await act(async()=>root.render(view('design-system-2','')));expect(host.querySelector('button')).toBeNull();
  await act(async()=>root.render(view('design-system-2','forge-list-page__actions')));expect(host.querySelector('button').disabled).toBe(true);expect(host.textContent).toContain('New record');
  await act(async()=>{status.value={show:true};});expect(host.querySelector('button').disabled).toBe(false);
 }finally{await act(async()=>root.unmount());host.remove();}
});
