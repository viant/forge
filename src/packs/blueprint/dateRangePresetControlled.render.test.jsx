// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DateRangePresetInput} from './index.jsx';
let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const options=[{value:'yesterday',label:'Yesterday'},{value:'custom',label:'Custom'}];
const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent===text);
async function date(label,value){await act(async()=>{const node=document.querySelector(`input[aria-label="${label}"]`);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});}
it('controlled mode never seeds legacy signals or resolves a default timezone',async()=>{
 const form=signal({from:'old',to:'old'}),request=vi.fn().mockResolvedValue(true),range=vi.fn();
 await act(async()=>root.render(<DateRangePresetInput context={{signals:{windowForm:form}}} value="yesterday" range={{start:'2026-01-02',end:'2026-01-03'}} options={options} onRangeChange={range} onPresetRequest={request} customApplyEnabled/>));
 expect(form.peek()).toEqual({from:'old',to:'old'});expect(range).not.toHaveBeenCalled();expect(request).not.toHaveBeenCalled();
 await act(async()=>host.querySelector('button').click());
 expect(document.body.textContent).not.toContain("Include today's partial data");
 await act(async()=>button('Yesterday').click());expect(request).toHaveBeenCalledExactlyOnceWith(options[0]);expect(range).not.toHaveBeenCalled();expect(form.peek()).toEqual({from:'old',to:'old'});
});
it('controlled custom dates stay local until one pair is committed and manual edits invalidate pending work',async()=>{
 const range=vi.fn(),edited=vi.fn();
 await act(async()=>root.render(<DateRangePresetInput value="custom" range={{start:'2026-01-02',end:'2026-01-03'}} options={options} onRangeChange={range} onDraftChange={edited} customApplyEnabled/>));
 await act(async()=>host.querySelector('button').click());await date('Custom start date','2026-01-04');await date('Custom end date','2026-01-05');
 expect(range).not.toHaveBeenCalled();expect(edited).toHaveBeenCalledTimes(2);
 await act(async()=>button('Apply dates').click());expect(range).toHaveBeenCalledExactlyOnceWith({start:'2026-01-04',end:'2026-01-05'});
});
it('a rejected context operation leaves manual entry available without an unhandled rejection',async()=>{
 await act(async()=>root.render(<DateRangePresetInput value="custom" range={{}} options={options} onRangeChange={()=>{}} onPresetRequest={()=>Promise.reject(new Error('unavailable'))} customApplyEnabled/>));
 await act(async()=>host.querySelector('button').click());await act(async()=>button('Yesterday').click());
 expect(document.querySelector('[role=alert]').textContent).toContain('Enter dates manually');expect(document.querySelector('input[aria-label="Custom start date"]')).toBeTruthy();
});
