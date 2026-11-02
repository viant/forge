// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import ReleaseAssignments from './ReleaseAssignments.jsx';
const root={uri:'window://demo/records',kind:'window',version:2,hash:'two',title:'Records'};
const connection={uri:'mcp://demo/producer',kind:'mcp',version:9,hash:'nine'};
const policies=[{resource:{id:'readers'},revision:4}];
const channel=name=>({key:{namespace:'demo',name},revision:3,policies,bundle:{roots:[connection]},releaseStatus:'active',activated:true});
const click=async element=>act(async()=>element.click());
const button=(host,label)=>[...host.querySelectorAll('button')].find(item=>item.textContent.trim()===label);
async function mount(api,props={}){globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const view=createRoot(host);await act(async()=>view.render(<ReleaseAssignments api={api} roots={[root]} {...props}/>));const select=host.querySelector('#assignment-root');await act(async()=>{select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));});return {host,close:async()=>{await act(async()=>view.unmount());host.remove();}};}
it('requires explicit review then publishes membership without dropping connection or policy pins',async()=>{
 const api={list:vi.fn(async()=>[channel('preview'),channel('main')]),publish:vi.fn(async input=>({status:'active',activated:true,channel:{key:input.key,revision:4}}))};
 const v=await mount(api);await click(v.host.querySelector('[aria-label="Include in main"]'));expect(api.publish).not.toHaveBeenCalled();await click(button(v.host,'Review assignments'));expect(api.publish).not.toHaveBeenCalled();await click(button(v.host,'Apply and publish release assignments'));
 expect(api.publish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({key:{namespace:'demo',name:'main'},expectedRevision:3,roots:[connection,root],policies}));expect(v.host.textContent).toContain('Assignments published to main');await v.close();
});
it('retains selections and requires reload after unauthorized or stale CAS failure',async()=>{
 for(const message of ['Release revision conflict','Release management access denied']){
 const api={list:vi.fn(async()=>[channel('preview')]),publish:vi.fn(async()=>{throw new Error(message);})};const v=await mount(api);
 await click(v.host.querySelector('[aria-label="Include in preview"]'));await click(button(v.host,'Review assignments'));await click(button(v.host,'Apply and publish release assignments'));
 expect(v.host.textContent).toContain(message);expect(v.host.querySelector('[aria-label="Include in preview"]').checked).toBe(true);expect(button(v.host,'Review assignments').disabled).toBe(true);await v.close();
 }
});
it('reports partial success across releases and never retries a stale review',async()=>{
 const api={list:vi.fn(async()=>[channel('preview'),channel('main')]),publish:vi.fn().mockResolvedValueOnce({status:'active',activated:true,channel:{key:{name:'preview'},revision:4}}).mockRejectedValueOnce(new Error('revision conflict'))};const v=await mount(api);
 await click(v.host.querySelector('[aria-label="Include in preview"]'));await click(v.host.querySelector('[aria-label="Include in main"]'));await click(button(v.host,'Review assignments'));await click(button(v.host,'Apply and publish release assignments'));expect(v.host.textContent).toContain('Published to preview. Remaining changes were not confirmed.');expect(button(v.host,'Review assignments').disabled).toBe(true);await v.close();
});

it('clears the host dirty guard when membership edits are reverted',async()=>{
 const onDirtyChange=vi.fn();const api={list:vi.fn(async()=>[channel('main')]),publish:vi.fn()};const v=await mount(api,{onDirtyChange});
 await click(v.host.querySelector('[aria-label="Include in main"]'));expect(onDirtyChange).toHaveBeenLastCalledWith(true);
 await click(v.host.querySelector('[aria-label="Include in main"]'));expect(onDirtyChange).toHaveBeenLastCalledWith(false);expect(api.publish).not.toHaveBeenCalled();await v.close();
});

it('shows another artifact revision without selecting or silently upgrading its release',async()=>{
 const older={...root,version:1,hash:'one'};
 const preview={...channel('preview'),bundle:{roots:[connection,older]}};
 const api={list:vi.fn(async()=>[preview,channel('main')]),publish:vi.fn(async input=>({status:'active',activated:true,channel:{key:input.key,revision:4}}))};
 const v=await mount(api);
 expect(v.host.querySelector('[aria-label="Include in preview"]').checked).toBe(false);
 expect(v.host.textContent).toContain('contains another artifact revision 1');
 await click(v.host.querySelector('[aria-label="Include in main"]'));await click(button(v.host,'Review assignments'));await click(button(v.host,'Apply and publish release assignments'));
 expect(api.publish).toHaveBeenCalledOnce();expect(api.publish.mock.calls[0][0].key.name).toBe('main');await v.close();
});
