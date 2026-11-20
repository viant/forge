// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {Context} from '../../core/context/Context.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {ForgeThemeBoundary,ForgeThemeProvider} from '../ThemeBoundary.jsx';
import {resolveMetadataForTarget} from '../../runtime/metadataResolver.js';
import Basic from './Basic.jsx';
import '../../packs/blueprint/index.jsx';

it.each(['light','dark'])('restores theme-only column policies without altering producer constraints (%s)',async mode=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 const columns=[{id:'name',name:'Name',width:180,sortable:false},{id:'note',name:'Note',type:'editableText',cellProperties:{maxLength:8,'aria-label':'Note'},width:200}];
 const table={presentation:'list-page',toolbar:{items:[]},columns,targetOverrides:{'theme:design-system-2':{columns:[{id:'name',sortable:true},{id:'note',readOnlyWhen:{source:'row',field:'locked',equals:true},cellProperties:{type:'email'}}]}}};
 const container=resolveMetadataForTarget({id:'records',fetchData:false,table},{platform:'web',formFactor:'desktop'});
 const owner=Context(`theme-table-${mode}`,{dataSource:{rows:{autoFetch:false,selectionMode:'none',uniqueKey:[{field:'id'}]}},actions:{import:()=>({})}},'rows');
 owner.init();const context=owner.Context('rows');context.handlers.dataSource.setCollection([{id:1,name:'One',note:'a@b',locked:true}]);context.signals.control.value={loaded:true};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=theme=>root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={{tablePreferences:{get:async()=>null}}}><ForgeThemeProvider themeId={theme} mode={mode}><ForgeThemeBoundary><Basic container={container} columns={container.table.columns} context={context}/></ForgeThemeBoundary></ForgeThemeProvider></SettingProvider>);
 try{
  await act(async()=>render('baseline'));
  expect(host.querySelector('button[aria-label="Sort by Name"]')).toBeNull();
  expect(host.querySelector('input[aria-label="Note"]').readOnly).toBe(false);
  await act(async()=>render('design-system-2'));
  expect(host.querySelector('button[aria-label="Sort by Name"]')).not.toBeNull();
  expect(host.querySelector('button[aria-label^="Edit Note"]')).toBeNull();
  await act(async()=>render('baseline'));
  expect(host.querySelector('button[aria-label="Sort by Name"]')).toBeNull();
  expect(host.querySelector('input[aria-label="Note"]').readOnly).toBe(false);
  expect(columns[1].cellProperties).toEqual({maxLength:8,'aria-label':'Note'});
 }finally{await act(async()=>root.unmount());owner.dispose();host.remove();}
});
