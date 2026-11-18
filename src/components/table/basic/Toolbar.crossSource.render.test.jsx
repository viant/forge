import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it,vi} from 'vitest';
import Toolbar from './Toolbar.jsx';
import TableHeader from './TableHeader.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../../ThemeBoundary.jsx';
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

it.each(['light','dark'])('reuses owned DS2 hints without losing menu, sort or selection actions (%s)',async mode=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const onSort=vi.fn(),selectAll=vi.fn();
 const context={identity:{dataSourceRef:'rows'},dataSource:{selectionMode:'multi'},signals:{control:signal({inactive:false}),formStatus:signal({}),selection:signal({selection:[]}),windowForm:signal({}),form:signal({})},handlers:{dataSource:{getFormData:()=>({}),getSelection:()=>({selection:[]}),peekCollection:()=>[{id:1}],setAllSelection:selectAll}},lookupHandler:()=>()=>{}};
 const view=theme=><ForgeThemeProvider themeId={theme} mode={mode}><ForgeThemeBoundary>
  <Toolbar context={context} toolbarItems={[{id:'filter',type:'menu',label:'Filter',tooltip:'Filter rows',icon:'filter',hideLabel:true,menuItems:[{id:'filterOne',label:'One option'}]}]}/>
  <table><TableHeader context={context} columns={[{id:'selection',multiSelect:true},{id:'name',name:'Name',tooltip:'Record name',sortable:true}]} sortConfig={{onSort,sortColumnId:'name',sortDirection:'asc'}}/></table>
 </ForgeThemeBoundary></ForgeThemeProvider>;
 try {
  await act(async()=>root.render(view('design-system-2')));
  const filter=host.querySelector('[aria-label="Filter"]');
  expect(filter.title).toBe('');expect(host.querySelector('th[title]')).toBeNull();
  await act(async()=>{filter.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,200));});
  expect(document.querySelector('.bp6-tooltip')?.textContent).toContain('Filter rows');
  expect(document.querySelector('.bp6-tooltip')?.closest('[data-forge-theme]')?.dataset.forgeTheme).toBe('design-system-2');
  await act(async()=>filter.click());
  expect([...document.querySelectorAll('.bp6-menu-item')].some(node=>node.textContent==='One option')).toBe(true);
  await act(async()=>host.querySelector('[aria-label="Sort by Name"]').click());expect(onSort).toHaveBeenCalledWith('name');
  await act(async()=>host.querySelector('[aria-label="Select all rows"]').click());expect(selectAll).toHaveBeenCalledOnce();
  await act(async()=>root.render(view('baseline')));
  expect(host.querySelector('[aria-label="Filter"]').title).toBe('Filter rows');
  expect([...host.querySelectorAll('th')].find(node=>node.textContent==='Name').title).toBe('Name — Record name');
 } finally {await act(async()=>root.unmount());host.remove();}
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
