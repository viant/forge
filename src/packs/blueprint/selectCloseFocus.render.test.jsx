import {expect,it} from 'vitest';
import {preserveSelectExternalFocus} from './selectCloseFocus.js';
it('preserves another field focused before Blueprint restores its trigger',()=>{
 const host=document.createElement('div');host.innerHTML='<button>Choose</button><div tabindex="0"></div><input/>';document.body.append(host);const [trigger,popup,input]=host.children;popup.focus();const frames=[()=>trigger.focus()];preserveSelectExternalFocus(popup,trigger,fn=>frames.push(fn));input.focus();frames.forEach(fn=>fn());expect(document.activeElement).toBe(input);host.remove();
});
it('keeps ordinary keyboard return to the selector when no other field was focused',()=>{
 const host=document.createElement('div');host.innerHTML='<button>Choose</button><div tabindex="0"></div>';document.body.append(host);const [trigger,popup]=host.children;popup.focus();const frames=[()=>trigger.focus()];preserveSelectExternalFocus(popup,trigger,fn=>frames.push(fn));frames.forEach(fn=>fn());expect(document.activeElement).toBe(trigger);host.remove();
});
