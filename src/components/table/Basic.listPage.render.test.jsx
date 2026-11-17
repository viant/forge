import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it} from 'vitest';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../ThemeBoundary.jsx';
import BasicTable from './Basic.jsx';
import {Context} from '../../core/context/Context.jsx';
import '../../packs/blueprint/index.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(async () => {if (root) await act(async () => root.unmount()); host?.remove(); root = null; host = null;});

// Independently authored synthetic records exercise the native datasource path.
it('applies the native list-page presentation only in DS2 and retains its existing select binding',async()=>{
 const metadata={actions:{import:()=>({})},dataSource:{records:{autoFetch:false,cardinality:'collection',selectionMode:'multi',uniqueKey:[{field:'id'}]}}};
 const windowContext=Context('native-list-pattern-test',metadata,'records',{});
 windowContext.init();
 const context=windowContext.Context('records');
 context.handlers.dataSource.setCollection([{id:1,name:'Example record'}]);
 context.signals.control.value={loaded:true};
 const container={id:'records',title:'Records',fetchData:false,table:{presentation:'list-page',toolbar:{items:[
  {id:'period',type:'dateRangePreset',placement:'header',align:'right',value:'current_month',options:[{value:'current_month',label:'Month'}]},
  {id:'view',label:'View',type:'select',scope:'windowForm',appearance:'starred-toggle',value:'all',options:[{value:'all',label:'All records'},{value:'starred',label:'Starred only'}]},
  {id:'search',type:'quickSearch',appearance:'field',properties:{field:'name',placeholder:'Search records'}},
  {id:'settings',icon:'settings',label:'Customize',hideLabel:true,align:'right'},
 ]}}};
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const render=theme=><ForgeThemeProvider themeId={theme} mode="light"><ForgeThemeBoundary><BasicTable container={container} context={context} columns={[{id:'name',name:'Name'}]}/></ForgeThemeBoundary></ForgeThemeProvider>;
 try {
  await act(async()=>root.render(render('baseline')));
  expect(host.querySelector('.forge-list-page')).toBeNull();
  expect(host.querySelector('.forge-toolbar-select-trigger')).not.toBeNull();
  await act(async()=>root.render(render('design-system-2')));
  expect(host.querySelector('.forge-list-page h1').textContent).toBe('Records');
  expect(host.querySelector('.forge-list-page__period').textContent).toContain('Month:');
  expect(host.querySelector('input[placeholder="Search records"]')).not.toBeNull();
  await act(async()=>host.querySelector('[aria-label="Starred view"]').click());
  expect(context.signals.windowForm.peek().view).toBe('starred');
  expect(host.querySelector('[aria-label="Starred view"]').getAttribute('aria-pressed')).toBe('true');
  await act(async()=>host.querySelector('[data-testid="toolbar-btn-settings"]').click());
  expect(document.querySelector('.bp6-drawer.forge-table-settings')).not.toBeNull();
 } finally {
  await act(async()=>root.unmount());root=null;windowContext.dispose();
 }
});

