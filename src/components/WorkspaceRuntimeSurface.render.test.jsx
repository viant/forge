import React,{act,useState,useEffect} from 'react';
import {Simulate} from 'react-dom/test-utils';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import WorkspaceRuntimeSurface,{requestWorkspaceClose,WorkspaceRuntimePanels} from './WorkspaceRuntimeSurface.jsx';
it('shares roving keyboard focus, capability-aware close and retained drafts without reloading',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host),mounted=vi.fn(),closed=vi.fn(),events=vi.fn();
 function Draft({id}){const [draft,setDraft]=useState('');useEffect(()=>{mounted(id);},[]);return <input aria-label={id} value={draft} onChange={e=>setDraft(e.target.value)}/>;}
 function App(){const [selected,setSelected]=useState('a');return <WorkspaceRuntimeSurface tabProps={{entries:[{windowId:'a',label:'A'},{windowId:'blocked',label:'Blocked',disabled:true},{windowId:'b',label:'B',closable:false}],selectedId:selected,onSelect:setSelected,onClose:closed,onRuntimeEvent:events}} panelProps={{entries:[{windowId:'a'},{windowId:'b'}],selectedId:selected,renderContent:entry=><Draft id={entry.windowId}/>}}/>;}
 try{await act(async()=>root.render(<App/>));expect(mounted.mock.calls).toEqual([['a']]);const input=host.querySelector('input[aria-label=a]');await act(async()=>Simulate.change(input,{target:{value:'unsaved draft'}}));expect(input.value).toBe('unsaved draft');const first=host.querySelector('[role=tab]');first.focus();await act(async()=>first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));expect(document.activeElement.textContent).toBe('B');expect(mounted.mock.calls).toEqual([['a'],['b']]);expect(host.querySelector('input[aria-label=a]').closest('[role=tabpanel]').hidden).toBe(true);expect(host.querySelector('input[aria-label=a]').closest('[role=tabpanel]').hasAttribute('inert')).toBe(true);
 const b=document.activeElement;await act(async()=>b.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(closed).not.toHaveBeenCalled();await act(async()=>b.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})));expect(document.activeElement.textContent).toBe('A');expect(mounted).toHaveBeenCalledTimes(2);expect(host.querySelector('input[aria-label=a]')).toBe(input);expect(input.value).toBe('unsaved draft');await act(async()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(closed).toHaveBeenCalledWith('a',expect.anything());expect(host.querySelector('input[aria-label=a]')).not.toBeNull();expect(events).toHaveBeenCalledWith(expect.objectContaining({type:'select_requested',windowId:'b',keyboard:true}));
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('retains loaded report state across repeated chat/workspace switches and isolates new conversations',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const loads=vi.fn(),cleanups=vi.fn();
 function Report({id}){
  const [filter,setFilter]=useState('original');
  useEffect(()=>{loads(id);return()=>cleanups(id);},[id]);
  return <><input aria-label="Report filter" value={filter} onChange={event=>setFilter(event.target.value)}/><table><tbody><tr><td>{id}</td><td>42</td></tr></tbody></table></>;
 }
 const show=(active,id='report-conversation-a')=>act(async()=>root.render(<>
  <section aria-label="Chat" hidden={active}><textarea aria-label="Message" defaultValue="unsent question"/></section>
  <WorkspaceRuntimePanels id="host" entries={[{windowId:id,label:'Report'},{windowId:`${id}-unvisited`,label:'Other report'}]}
   selectedId={id} active={active} renderContent={entry=><Report id={entry.windowId}/>}/>
 </>));
 try {
  await show(false);expect(loads).not.toHaveBeenCalled();
  const composer=host.querySelector('textarea');
  await show(true);const filter=host.querySelector('input');
  await act(async()=>Simulate.change(filter,{target:{value:'retained filter'}}));
  for(let i=0;i<20;i++){
   await show(false);expect(filter.closest('[role=tabpanel]').hidden).toBe(true);expect(filter.closest('[role=tabpanel]').hasAttribute('inert')).toBe(true);
   expect(composer.closest('section').hidden).toBe(false);
   await show(true);expect(host.querySelector('input')).toBe(filter);expect(filter.value).toBe('retained filter');
   expect(filter.closest('[role=tabpanel]').hidden).toBe(false);expect(composer.value).toBe('unsent question');
  }
  expect(loads.mock.calls).toEqual([['report-conversation-a']]);expect(cleanups).not.toHaveBeenCalled();
  await show(false,'report-conversation-b');expect(cleanups.mock.calls).toEqual([['report-conversation-a']]);expect(host.querySelector('input')).toBeNull();
  await show(true,'report-conversation-b');expect(host.querySelector('input').value).toBe('original');
  expect(loads.mock.calls).toEqual([['report-conversation-a'],['report-conversation-b']]);
 } finally {await act(async()=>root.unmount());host.remove();}
});

it('generic host close admission may await confirmation, decline or reject without discarding retained content',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let admit,pending;const close=vi.fn(()=>{pending=new Promise(resolve=>{admit=resolve;});return pending;});const entry={windowId:'neutral-document',label:'Document',kind:'document'};
 const adapter={onClose:close};
 try{await act(async()=>root.render(<WorkspaceRuntimeSurface tabProps={{entries:[entry],selectedId:entry.windowId,...adapter,tabIdFor:(_id,key)=>`host-tab-${key}`,panelIdFor:(_id,key)=>`host-panel-${key}`}} panelProps={{entries:[entry],selectedId:entry.windowId,tabIdFor:(_id,key)=>`host-tab-${key}`,panelIdFor:(_id,key)=>`host-panel-${key}`,renderContent:()=> <textarea defaultValue="local draft"/>}}/>));
 const draft=host.querySelector('textarea');draft.value='edited draft';await act(async()=>{host.querySelector('[aria-label="Close Document"]').click();});expect(close).toHaveBeenCalledTimes(1);expect(host.querySelector('textarea')).toBe(draft);admit(false);await expect(pending).resolves.toBe(false);expect(draft.value).toBe('edited draft');expect(host.querySelector('[role=tab]').getAttribute('aria-controls')).toBe('host-panel-neutral-document');
 const failure=new Error('host close admission unavailable');await expect(requestWorkspaceClose(entry,{onClose:async()=>{throw failure;}})).rejects.toBe(failure);expect(host.querySelector('textarea')).toBe(draft);expect(draft.value).toBe('edited draft');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('mounts only explicitly admitted hidden content for readiness without selecting or focusing it',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const ready=vi.fn(),cleanup=vi.fn();
 function Renderer({id}){useEffect(()=>{ready(id);return()=>cleanup(id);},[id]);return <input aria-label={id} defaultValue="initial"/>;}
 const entries=[{windowId:'fresh-opening',preload:true},{windowId:'inactive-restored'}];
 const show=(active=false,preload=true)=>act(async()=>root.render(<>
  <textarea aria-label="Conversation"/>
  <WorkspaceRuntimePanels entries={entries} selectedId="fresh-opening" active={active}
   preloadContent={entry=>preload&&entry.preload===true} renderContent={entry=><Renderer id={entry.windowId}/>}/>
 </>));
 try{
  await show();
  const composer=host.querySelector('textarea');composer.focus();
  const fresh=host.querySelector('input[aria-label="fresh-opening"]');
  expect(ready.mock.calls).toEqual([['fresh-opening']]);
  expect(fresh.closest('[role=tabpanel]').hidden).toBe(true);
  expect(fresh.closest('[role=tabpanel]').hasAttribute('inert')).toBe(true);
  expect(host.querySelector('input[aria-label="inactive-restored"]')).toBeNull();
  expect(document.activeElement).toBe(composer);
  await show(false,false);expect(host.querySelector('input')).toBe(fresh);
  await show(true,false);expect(fresh.closest('[role=tabpanel]').hidden).toBe(false);
  expect(ready).toHaveBeenCalledTimes(1);expect(cleanup).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
 expect(cleanup.mock.calls).toEqual([['fresh-opening']]);
});
