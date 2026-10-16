// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {signal} from '@preact/signals-react';
import '../packs/blueprint/index.jsx';
import WidgetRenderer from './WidgetRenderer.jsx';

let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);HTMLElement.prototype.scrollIntoView ||= function(){};});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
function fixture(overrides={}){
 const form=signal({category:'Existing caption'}),control=signal({loaded:false,loading:false}),input=signal({parameters:{ParentId:[1]},fetch:false}),collection=signal([]);
 const fetchCollection=vi.fn(()=>{input.value={...input.peek(),fetch:true};control.value={loaded:false,loading:true};});
 const target={signals:{control,input,collection},handlers:{dataSource:{fetchCollection}}};
 const context={signals:{form},handlers:{dataSource:{getFormData:()=>form.peek(),peekFormData:()=>form.peek(),setFormField:({value})=>{form.value={category:value};}}},Context:()=>target};
 const item=Object.freeze({id:'category',label:'Category',type:'select',scope:'form',dataField:'category',optionsDataSourceRef:'categories',optionsFetchMode:'onFocus',optionValueField:'caption',optionLabelField:'caption',...overrides});
 const render=async()=>act(async()=>root.render(<WidgetRenderer item={item} context={context}/>));
 const finish=async(rows=[],error=null)=>act(async()=>{collection.value=rows;input.value={...input.peek(),fetch:false};control.value={loading:false,loaded:!error,...(error?{error}:{})};});
 const button=()=>host.querySelector('button[aria-label="Category"]');
 return {form,control,input,collection,target,context,item,fetchCollection,render,finish,button};
}

describe('real Blueprint datasource-backed lazy select',()=>{
 it('starts with no request and preserves selected text; keyboard focus + pointer open issue only one read',async()=>{
  const f=fixture();await f.render();expect(f.fetchCollection).not.toHaveBeenCalled();expect(f.button().textContent).toContain('Existing caption');
  await act(async()=>{f.button().focus();f.button().click();});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
  await act(async()=>{f.button().blur();f.button().focus();f.button().dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
  await f.finish([{caption:'Existing caption'},{caption:'Another option'}]);
  await act(async()=>{f.button().blur();f.button().focus();f.button().click();});expect(f.fetchCollection).toHaveBeenCalledTimes(1);expect(f.button().textContent).toContain('Existing caption');
 });
 it('pointer open without focus fetches once, including when completion is a true empty set',async()=>{
  const f=fixture();await f.render();await act(async()=>f.button().click());expect(f.fetchCollection).toHaveBeenCalledTimes(1);await f.finish([]);
  await act(async()=>{f.button().blur();f.button().focus();f.button().click();});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
 });
 it.each([{readOnly:true},{disabled:true},{readOnlyWhen:{source:'form',field:'locked',equals:true}}])('read-only/disabled controls make no options request: %j',async(overrides)=>{
  const f=fixture(overrides);if(overrides.readOnlyWhen)f.form.value={category:'Existing caption',locked:true};await f.render();expect(f.button().disabled).toBe(true);
  await act(async()=>{f.button().dispatchEvent(new FocusEvent('focusin',{bubbles:true}));f.button().click();});expect(f.fetchCollection).not.toHaveBeenCalled();
 });
 it('an explicitly false read-only state or false guard preserves the editable select',async()=>{
  const f=fixture({readOnly:false,readOnlyWhen:{source:'form',field:'locked',equals:true}});f.form.value={category:'Existing caption',locked:false};await f.render();expect(f.button().disabled).toBe(false);expect(f.button().textContent).toContain('Existing caption');await act(async()=>f.button().focus());expect(f.fetchCollection).toHaveBeenCalledTimes(1);
 });
 it('error does not retry on refocus/typing; explicit keyboard dropdown open retries once',async()=>{
  const f=fixture();await f.render();await act(async()=>f.button().focus());await f.finish([],new Error('Synthetic dictionary read failed'));
  await act(async()=>{f.button().blur();f.button().focus();f.button().dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
  await act(async()=>{f.button().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));f.button().click();});expect(f.fetchCollection).toHaveBeenCalledTimes(2);
 });
 it('deduplicates before the native datasource marks the queued request loading',async()=>{
  const f=fixture();f.fetchCollection.mockImplementation(()=>{});await f.render();await act(async()=>{f.button().focus();f.button().click();f.button().blur();f.button().focus();});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
 });
 it('loaded shared data causes no focus read; changed source parameters require fresh choices on the next intent',async()=>{
  const f=fixture();await f.finish([{caption:'Existing caption'},{caption:'Old parent option'}]);await f.render();await act(async()=>f.button().focus());expect(f.fetchCollection).not.toHaveBeenCalled();
  await act(async()=>{f.input.value={...f.input.peek(),parameters:{ParentId:[2]}};});
  await act(async()=>{f.button().blur();f.button().focus();});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
  await f.finish([{caption:'Existing caption'},{caption:'New parent option'}]);await act(async()=>f.button().click());expect(f.fetchCollection).toHaveBeenCalledTimes(1);
 });
});

describe('real Blueprint datasource-backed lazy multi-select',()=>{
 it('waits for native input focus, deduplicates open, and renders returned options',async()=>{
  const f=fixture({type:'multiSelect'});f.form.value={category:[]};await f.render();
  const input=host.querySelector('input');expect(input).toBeTruthy();expect(f.fetchCollection).not.toHaveBeenCalled();
  await act(async()=>{input.focus();input.click();});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
  await f.finish([{caption:'First category'},{caption:'Second category'}]);
  await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',keyCode:40,which:40,bubbles:true})));
  expect(document.body.textContent).toContain('First category');
  await act(async()=>{input.blur();input.focus();});expect(f.fetchCollection).toHaveBeenCalledTimes(1);
 });
 it.each([{readOnly:true},{disabled:true}])('disabled multi-select does not request options: %j',async(overrides)=>{
  const f=fixture({type:'multiSelect',...overrides});f.form.value={category:[]};await f.render();
  const input=host.querySelector('input');expect(input.disabled).toBe(true);
  await act(async()=>{input.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));input.click();});expect(f.fetchCollection).not.toHaveBeenCalled();
 });
 it.each(['checkboxes','pills'])('lazy %s choices can request through the keyboard-focusable group',async(appearance)=>{
  const f=fixture({type:'multiSelect',properties:{appearance}});f.form.value={category:[]};await f.render();
  const group=host.querySelector('[role="group"]');expect(group).toBeTruthy();expect(f.fetchCollection).not.toHaveBeenCalled();
  await act(async()=>group.focus());expect(f.fetchCollection).toHaveBeenCalledTimes(1);
  await f.finish([{caption:'First category'}]);expect(host.textContent).toContain('First category');
 });

 it('retains selected IDs before loading and replaces them with producer labels',async()=>{
  const f=fixture({type:'multiSelect',optionValueField:'id'});f.form.value={category:['IAB1']};await f.render();
  expect(host.textContent).toContain('IAB1');expect(f.fetchCollection).not.toHaveBeenCalled();
  await act(async()=>host.querySelector('input').focus());await f.finish([{id:'IAB1',caption:'Arts and Entertainment'}]);
  expect(host.textContent).toContain('Arts and Entertainment');expect(f.form.peek().category).toEqual(['IAB1']);
 });

});
