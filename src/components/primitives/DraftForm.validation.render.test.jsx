// Independently authored metadata and records for a generic draft editor.
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import DraftForm from './DraftForm.jsx';
let root,host;
const settle=async action=>act(async()=>{action?.();for(let i=0;i<30;i++)await Promise.resolve()});
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host)});
afterEach(async()=>{await settle(()=>root.unmount());host.remove()});
const schema={type:'object',required:['title','count','enabled'],properties:{title:{type:'string',minLength:1,maxLength:2},count:{type:'integer',minimum:0,maximum:4},enabled:{type:'boolean'}}};
function fixture(id='first',initial={title:'',count:0,enabled:false,uiState:{expanded:true}}){
 const writes=[],form=signal(initial),control=signal({loading:false});
 const writer={signals:{control,collection:signal([])},handlers:{dataSource:{setInputParameters:params=>writes.push(params),fetchCollection:()=>Promise.resolve()}}};
 const lookupHandler=vi.fn();
 const context={identity:{windowId:id,dataSourceRef:'draft'},metadata:{schemas:{draft:schema}},signals:{form,formStatus:signal({dirty:true}),control:signal({}),windowForm:signal({})},lookupHandler,handlers:{dataSource:{getFormData:()=>form.peek(),setFormData:({values})=>{form.value=values},resetFormDirty(){}}},Context:ref=>ref==='writer'?writer:context};
 return {context,form,writes,lookupHandler};
}
const editor=(f,extra={})=><DraftForm context={f.context} container={{id:f.context.identity.windowId,draftForm:{submit:{dataSourceRef:'writer'},validation:{schemaRef:'draft'},...extra}}}><input aria-label="Draft content"/></DraftForm>;
const saves=()=>[...host.querySelectorAll('button')].filter(button=>button.textContent==='Save');
it('gates Save and shows errors from metadata alone, accepting Unicode code points, zero, false and UI-only state',async()=>{
 const f=fixture();await settle(()=>root.render(editor(f)));expect(saves()[0].disabled).toBe(true);expect(host.querySelector('[data-forge-part="validation-message"]').textContent).toMatch(/title/);expect(f.lookupHandler).not.toHaveBeenCalled();expect(f.writes).toHaveLength(0);
 await settle(()=>{f.form.value={...f.form.peek(),title:'😀😀'}});expect(saves()[0].disabled).toBe(false);
 await settle(()=>{f.form.value={...f.form.peek(),count:5}});expect(saves()[0].disabled).toBe(true);expect(host.textContent).toContain('no more than 4');
 await settle(()=>{f.form.value={...f.form.peek(),count:0,title:'😀😀a'}});expect(saves()[0].disabled).toBe(true);expect(host.textContent).toContain('too long');
 await settle(()=>{f.form.value={...f.form.peek(),title:'😀😀'}});expect(saves()[0].disabled).toBe(false);
 await settle(()=>saves()[0].click());expect(f.writes).toHaveLength(1);expect(f.writes[0].data.enabled).toBe(false);expect(f.writes[0].data.count).toBe(0);expect(f.writes[0].data.uiState).toEqual({expanded:true});expect(f.lookupHandler).not.toHaveBeenCalled();
});
it('runs the caller cross-field hook only after basic validation passes',async()=>{
 const f=fixture(),hook=vi.fn(()=> 'Synthetic cross-field condition');f.lookupHandler.mockReturnValue(hook);
 await settle(()=>root.render(editor(f,{validate:'Fixture.crossField'})));expect(hook).not.toHaveBeenCalled();
 await settle(()=>{f.form.value={title:'ok',count:0,enabled:false}});expect(hook).toHaveBeenCalled();expect(hook.mock.calls[0][0].form).toEqual(f.form.peek());expect(saves()[0].disabled).toBe(true);expect(host.textContent).toContain('Synthetic cross-field condition');
 hook.mockReturnValue('');await settle(()=>{f.form.value={...f.form.peek()}});expect(saves()[0].disabled).toBe(false);
});
it('fails closed for missing references, isolates other forms and preserves legacy behavior when binding is absent',async()=>{
 const f=fixture('first',{title:'ok',count:0,enabled:false}),g=fixture('second',{title:'ok',count:0,enabled:false});
 await settle(()=>root.render(<>{editor(f,{validation:{schemaRef:'missing'}})}{editor(g)}</>));expect(saves()[0].disabled).toBe(true);expect(host.textContent).toContain('Draft validation schema is unavailable: missing');expect(saves()[1].disabled).toBe(false);
 await settle(()=>{f.form.value={title:'a',count:99,enabled:false}});expect(saves()[1].disabled).toBe(false);expect(g.form.peek().count).toBe(0);
 await settle(()=>root.render(editor(f,{validation:undefined})));expect(saves()[0].disabled).toBe(false);expect(f.writes).toHaveLength(0);
});
