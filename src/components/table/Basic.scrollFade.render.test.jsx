// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {signal} from '@preact/signals-react';
import Basic from './Basic.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../ThemeBoundary.jsx';

it.each(['baseline','design-system-2'])('uses existing scroll activity only in DS2 (%s)',async theme=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const signals={collection:signal([{id:1}]),input:signal({fetch:false,page:1}),control:signal({loaded:true}),selection:signal({selection:[]}),message:signal([]),form:signal({}),formStatus:signal({}),windowForm:signal({}),metrics:signal({})};
 const context={identity:{windowId:`scroll-fade-${theme}`,dataSourceRef:'rows'},dataSource:{autoFetch:false,selectionMode:'none'},signals,handlers:{dataSource:{fetchCollection(){},getCollection:()=>signals.collection.value,peekCollection:()=>signals.collection.peek(),getCollectionInfo:()=>({}),isInactive:()=>false,getSelection:()=>signals.selection.peek(),isSelected:()=>false,getPage:()=>1,getFilterSets:()=>[],getFilterSet:()=>[],peekFilter:()=>({}),getUniqueKeyValue:row=>row.id}},tableSettingKey:()=>`scroll-fade-${theme}`};
 try{
  await act(async()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={{tablePreferences:{get:async()=>null}}}><ForgeThemeProvider themeId={theme}><ForgeThemeBoundary><Basic context={context} container={{id:'records',fetchData:false,table:{toolbar:{items:[]}}}} columns={[{id:'id',name:'ID',width:100}]}/></ForgeThemeBoundary></ForgeThemeProvider></SettingProvider>));
  const scroller=host.querySelector('.basic-table-scroll');
  Object.defineProperties(scroller,{clientWidth:{value:500},scrollWidth:{value:1000},clientHeight:{value:100},scrollHeight:{value:100},getClientRects:{value:()=>[{}]}});
  const activityTarget=theme==='design-system-2'?scroller.parentElement.querySelector('[data-forge-scrollbar=horizontal]>.forge-scroll-area__thumb'):scroller;
  const animations=[];
  const animate=vi.fn(()=>{const animation={id:'',currentTime:700,cancelled:false,effect:{setKeyframes:vi.fn()},play:vi.fn()};animation.cancel=vi.fn(()=>{animation.cancelled=true;});animations.push(animation);return animation;});
  activityTarget.animate=animate;activityTarget.getAnimations=()=>animations.filter(animation=>!animation.cancelled);
  await act(async()=>scroller.dispatchEvent(new Event('scroll')));
  await act(async()=>scroller.dispatchEvent(new Event('scroll')));
  await act(async()=>scroller.dispatchEvent(new Event('scroll')));
  expect(animate.mock.calls.length).toBe(theme==='design-system-2'?1:0);
  if(theme==='design-system-2'){
   expect(animations[0].cancel).not.toHaveBeenCalled();
   expect(animations[0].currentTime).toBe(0);
   expect(animations[0].play).toHaveBeenCalledTimes(2);
   expect(animations[0].id).toBe('forge-scrollbar-activity');
   expect(animate.mock.calls[0][0].at(-1)).toEqual({opacity:0,visibility:'hidden'});
   expect(host.querySelector('.forge-scroll-area')).not.toBeNull();
  }
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('covers future scroll regions and owned portals once, and removes activity on theme change',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const animations=[];
 const original=document.getAnimations;document.getAnimations=()=>animations.filter(x=>!x.cancelled);
 const decorate=element=>{element.getAnimations=()=>animations.filter(x=>x.target===element&&!x.cancelled);element.animate=vi.fn(()=>{const a={target:element,id:'',cancelled:false,effect:{setKeyframes:vi.fn()},play:vi.fn()};a.cancel=vi.fn(()=>{a.cancelled=true;});animations.push(a);return a;});return element;};
 const view=theme=><ForgeThemeProvider themeId={theme}><ForgeThemeProvider><ForgeThemeBoundary windowKey="scroll-pattern"><div data-scroll-example="future"/></ForgeThemeBoundary></ForgeThemeProvider></ForgeThemeProvider>;
 try{
  await act(async()=>root.render(view('design-system-2')));
  const future=decorate(host.querySelector('[data-scroll-example]'));
  const owner=document.querySelector('[data-forge-theme-portal][data-forge-window-key="scroll-pattern"]');
  const portal=decorate(document.createElement('div'));owner.append(portal);
  future.dispatchEvent(new Event('scroll'));portal.dispatchEvent(new Event('scroll'));
  expect(future.animate).toHaveBeenCalledOnce();expect(portal.animate).toHaveBeenCalledOnce();
  await act(async()=>root.render(view('baseline')));
  expect(animations.every(a=>a.cancelled)).toBe(true);
  future.dispatchEvent(new Event('scroll'));portal.dispatchEvent(new Event('scroll'));
  expect(future.animate).toHaveBeenCalledOnce();expect(portal.animate).toHaveBeenCalledOnce();
 }finally{await act(async()=>root.unmount());host.remove();if(original)document.getAnimations=original;else delete document.getAnimations;}
});
