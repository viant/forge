import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {ReaderBuilder} from './ReaderBuilder.jsx';

async function mount({owner='owner',subject='owner',supported=true,remove=async()=>({deletedVersions:1}),back=vi.fn()}={}) {
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const report={id:'component-a',title:'Synthetic reader',ownerId:owner,versionNo:2};
 const version={versionNo:2,sourceRevision:14,state:'draft'};
 const api={inspectVersion:vi.fn(async()=>({version,dql:'SELECT 1',structure:{component:{views:[]}},capabilities:{}})),...(supported?{deleteVersion:vi.fn(remove)}:{})};
 const render=async(next={})=>act(async()=>root.render(<ReaderBuilder api={api} report={report} subject={subject} onBack={back} {...next}/>));
 await render();
 return {api,back,host,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
const button=(text)=>[...document.querySelectorAll('button')].find(el=>el.textContent===text);
const click=async el=>act(async()=>el.click());

it('omits deletion for older bindings, non-owners, and unknown subjects',async()=>{
 for(const options of [{supported:false},{subject:'delegate'},{subject:''}]){const f=await mount(options);expect(button('Delete version v2')).toBeUndefined();await f.close();}
});
it('confirms an exact snapshot, cancels without writing, prevents duplicates, and returns without selecting another version',async()=>{
 let finish;const f=await mount({remove:()=>new Promise(resolve=>{finish=resolve;})});
 try{
  await click(button('Delete version v2'));
  expect(document.body.textContent).toContain('Synthetic reader (component-a) · version 2');
  expect(document.body.textContent).toContain('Retained publication and audit history survives');
  await click(button('Cancel'));expect(f.api.deleteVersion).not.toHaveBeenCalled();
  await click(button('Delete version v2'));
  await f.render({report:{id:'component-b',title:'Other reader',ownerId:'owner',versionNo:2}});
  const confirm=button('Permanently delete version');
  await act(async()=>{confirm.click();confirm.click();});
  expect(f.api.deleteVersion).toHaveBeenCalledExactlyOnceWith('component-a',2,14);
  expect(button('Permanently delete version').disabled).toBe(true);
  await act(async()=>finish({deletedVersions:1}));
  expect(f.back).toHaveBeenCalledOnce();expect(f.api.inspectVersion).toHaveBeenCalledTimes(2);
 }finally{await f.close();}
});
it.each(['Publication reference prevents deletion','Retained release binding prevents deletion','Active warmup prevents deletion','Source revision is stale','Owner authorization required'])('preserves backend error: %s',async message=>{
 const f=await mount({remove:async()=>{throw Object.assign(new Error(message),{code:'conflict'});}});
 try{await click(button('Delete version v2'));await click(button('Permanently delete version'));expect(f.host.textContent).toContain(message);expect(document.body.textContent).not.toContain('Reader changed elsewhere');expect(f.back).not.toHaveBeenCalled();expect(f.api.deleteVersion).toHaveBeenCalledOnce();}finally{await f.close();}
});
it('reports failed navigation after success without exposing a second deletion',async()=>{
 const f=await mount({back:vi.fn(async()=>{throw new Error('catalog unavailable');})});
 try{await click(button('Delete version v2'));await click(button('Permanently delete version'));expect(f.host.textContent).toContain('Version deleted. Could not return');expect(button('Delete version v2')).toBeUndefined();await click(button('Components'));expect(f.host.textContent).toContain('Version deleted. Could not return');expect(f.back).toHaveBeenCalledTimes(2);expect(f.api.deleteVersion).toHaveBeenCalledOnce();}finally{await f.close();}
});
