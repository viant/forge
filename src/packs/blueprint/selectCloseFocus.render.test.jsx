import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';
import {preserveSelectExternalFocus} from './selectCloseFocus.js';
import {inheritFieldTrackSelectTokens} from './selectPortalTokens.js';
it('preserves another field focused before Blueprint restores its trigger',()=>{
 const host=document.createElement('div');host.innerHTML='<button>Choose</button><div tabindex="0"></div><input/>';document.body.append(host);const [trigger,popup,input]=host.children;popup.focus();const frames=[()=>trigger.focus()];preserveSelectExternalFocus(popup,trigger,fn=>frames.push(fn));input.focus();frames.forEach(fn=>fn());expect(document.activeElement).toBe(input);host.remove();
});
it('keeps ordinary keyboard return to the selector when no other field was focused',()=>{
 const host=document.createElement('div');host.innerHTML='<button>Choose</button><div tabindex="0"></div>';document.body.append(host);const [trigger,popup]=host.children;popup.focus();const frames=[()=>trigger.focus()];preserveSelectExternalFocus(popup,trigger,fn=>frames.push(fn));frames.forEach(fn=>fn());expect(document.activeElement).toBe(trigger);host.remove();
});

it('inherits semantic field tokens onto only its detached dropdown portal',()=>{
 const portal=document.createElement('div');portal.className='forge-field-track-select-portal';
 const otherPortal=document.createElement('div');otherPortal.className='forge-field-track-select-portal';
 const popup=document.createElement('div');portal.append(popup);
 const trigger=document.createElement('button');
 trigger.style.setProperty('--forge-font-family','IBM Plex Sans Variable');
 trigger.style.setProperty('--forge-text','#1a1d24');
 trigger.style.setProperty('--forge-selected-background','#eef2ff');
 trigger.style.setProperty('--forge-interaction-color','#2d5bff');
 trigger.style.fontFamily='IBM Plex Sans Variable';
 trigger.style.fontSize='14px';
 inheritFieldTrackSelectTokens(popup,trigger);
 expect(portal.style.getPropertyValue('--forge-font-family')).toBe('IBM Plex Sans Variable');
 expect(portal.style.getPropertyValue('--forge-text')).toBe('#1a1d24');
 expect(portal.style.getPropertyValue('--forge-selected-background')).toBe('#eef2ff');
 expect(portal.style.getPropertyValue('--forge-interaction-color')).toBe('#2d5bff');
 expect(portal.style.fontFamily).toBe(trigger.style.fontFamily);
 expect(portal.style.fontSize).toBe('14px');
 expect(portal.style.getPropertyValue('--forge-surface-raised')).toBe('');
 expect(otherPortal.style.getPropertyValue('--forge-selected-background')).toBe('');
});

it('keeps authored open and lazy-options callbacks when a field-track dropdown opens',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const onOpening=vi.fn(node=>expect(node.closest('.forge-field-track-select-portal').style.getPropertyValue('--forge-selected-background')).toBe('#eef2ff'));
 const onOptionsRequest=vi.fn();
 const SelectWidget=getWidget('select');
 try {
  await act(async()=>root.render(<SelectWidget
   options={[{value:'awareness',label:'Awareness'}]}
   data-forge-field-track-control="true"
   onOptionsRequest={onOptionsRequest}
   popoverProps={{onOpening,transitionDuration:0}}
  />));
  const button=host.querySelector('button');
  button.style.setProperty('--forge-selected-background','#eef2ff');
  await act(async()=>button.click());
  expect(onOpening).toHaveBeenCalledTimes(1);
  expect(onOptionsRequest).toHaveBeenCalledWith('open');
  expect(document.body.querySelector('.forge-field-track-select-portal')).not.toBeNull();
 } finally {await act(async()=>root.unmount());host.remove();}
});
