// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import ReleaseManager from 'forge/release-manager';

const scope = {tenant:'tenant-a', account:'account-a', workspace:'workspace-a', namespace:'sales'};
const rootRef = {uri:'window://sales/overview', kind:'window', version:3, hash:'sha256:window3',title:'Overview'};
const olderRoot = {...rootRef,version:2,hash:'sha256:window2'};
const policy = {resource:{tenant:'tenant-a',kind:'policy',id:'readers',version:2},revision:7,displayName:'Readers'};
const channel = {key:{...scope,name:'poc'},description:'First release',policies:[policy],activeBundleHash:'sha256:old',revision:4};
const main = {key:{...scope,name:'main'},description:'Production',policies:[policy],activeBundleHash:'sha256:main',revision:6};
const history = [{namespace:'sales',hash:'sha256:old',roots:[rootRef],revision:4,description:'First release'},{namespace:'sales',hash:'sha256:older',roots:[olderRoot],revision:2,description:'Earlier release',activatedAt:'2026-10-20T00:00:00Z'}];
const deferred = () => {let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const api = (overrides={}) => ({
  list:vi.fn(async()=>[]),candidates:vi.fn(async()=>[rootRef,olderRoot]),policies:vi.fn(async()=>[policy]),
  history:vi.fn(async()=>history),publish:vi.fn(async()=>({channel:{key:{...scope,name:'poc'},activeBundleHash:'sha256:new',revision:1},status:'active',activated:true})),
  promote:vi.fn(async()=>({channel:{...channel,activeBundleHash:'sha256:older',revision:5},status:'active',activated:true})),...overrides,
});
const render = async (adapter, channelKey=scope, onActivated) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  await act(async()=>{root.render(<ReleaseManager api={adapter} channelKey={channelKey} onActivated={onActivated}/>);});
  return {host,update:async(nextAPI,nextScope,onNextActivated)=>act(async()=>root.render(<ReleaseManager api={nextAPI} channelKey={nextScope} onActivated={onNextActivated}/>)),close:async()=>{await act(async()=>root.unmount());host.remove();}};
};
const text = async(input,value) => act(async()=>{
  const setter=Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set;
  setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
});
const click = async element => act(async()=>element.click());
const select = async(element,value) => act(async()=>{element.value=value;element.dispatchEvent(new Event('change',{bubbles:true}));});
const button = (host,label) => [...host.querySelectorAll('button')].find(item=>item.textContent.trim()===label);
const include = async(host,version=3) => {
  const input=host.querySelector('#release-artifact-0');
  const option=[...input.options].find(item=>item.textContent.includes(`Revision ${version}`));
  await select(input,option.value);
};

it('resets namespace-scoped edits and ignores an old inventory response after switching scope',async()=>{
  const oldList=deferred(),old=api({list:vi.fn(()=>oldList.promise)});
  const nextScope={...scope,namespace:'other'};
  const next=api({list:vi.fn(async()=>[]),candidates:vi.fn(async()=>[]),policies:vi.fn(async()=>[])});
  const view=await render(old);
  try{
    await view.update(next,nextScope);
    expect(view.host.querySelector('#release-name').value).toBe('');
    expect(view.host.querySelector('#release-channel').value).toBe('');
    await act(async()=>oldList.resolve([channel]));
    expect(view.host.querySelector('#release-channel').options.length).toBe(1);
    expect(view.host.textContent).not.toContain('First release');
  }finally{await view.close();}
});

it('cannot announce an old namespace activation after the host switches scope',async()=>{
  const pending=deferred(),onActivated=vi.fn();
  const old=api({publish:vi.fn(()=>pending.promise)});
  const nextScope={...scope,namespace:'other'};
  const next=api({list:vi.fn(async()=>[]),candidates:vi.fn(async()=>[]),policies:vi.fn(async()=>[])});
  const view=await render(old,scope,onActivated);
  try{
    await text(view.host.querySelector('#release-name'),'poc');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host);
    await click(button(view.host,'Publish'));
    expect(old.publish).toHaveBeenCalledOnce();
    await view.update(next,nextScope,onActivated);
    await act(async()=>pending.resolve({channel:{...channel,activeBundleHash:'sha256:new',revision:5},status:'active',activated:true}));
    expect(onActivated).not.toHaveBeenCalled();
    expect(view.host.querySelector('#release-name').value).toBe('');
    expect(view.host.textContent).not.toContain('Release activated.');
  }finally{await view.close();}
});

it('publishes exact roots and policy references within the host-bound namespace',async()=>{
  const adapter=api();const view=await render(adapter);
  try{
    expect(view.host.querySelector('section[aria-label="Releases"]')).toBeTruthy();
    expect(view.host.querySelector('label[for="release-name"]').textContent.trim()).toBe('Name');
    expect(view.host.querySelector('label[for="release-description"]').textContent.trim()).toBe('Description');
    expect(view.host.querySelector('legend').textContent).toBe('Who can use this?');
    expect(view.host.textContent).toContain('Included artifacts');
    await text(view.host.querySelector('#release-name'),'poc');
    await text(view.host.querySelector('#release-description'),'First release');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host);
    expect(view.host.textContent).toContain('window · Overview');
    expect(view.host.querySelector('details').open).toBe(false);
    expect([...view.host.querySelectorAll('details code')].some(code => code.title === rootRef.hash)).toBe(true);
    await click(button(view.host,'Publish'));
    expect(adapter.publish).toHaveBeenCalledOnce();
    expect(adapter.publish).toHaveBeenCalledWith({key:{...scope,name:'poc'},description:'First release',roots:[{uri:rootRef.uri,kind:rootRef.kind,version:rootRef.version,hash:rootRef.hash}],policies:[{resource:policy.resource,revision:7}],expectedRevision:0});
    expect(view.host.textContent).toContain('Release activated.');
  }finally{await view.close();}
});

it('keeps edits after a server error and blocks a duplicate in-flight publication',async()=>{
  const pending=deferred();const adapter=api({publish:vi.fn(()=>pending.promise)});const view=await render(adapter);
  try{
    await text(view.host.querySelector('#release-name'),'main');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host);
    const publish=button(view.host,'Publish');
    await click(publish);
    await click(publish);
    expect(adapter.publish).toHaveBeenCalledOnce();
    await act(async()=>pending.resolve(Promise.reject(new Error('Revision changed. Reload before publishing.'))));
    expect(view.host.querySelector('[role="alert"]').textContent).toContain('Revision changed');
    expect(view.host.querySelector('#release-name').value).toBe('main');
    expect(view.host.querySelector('#release-artifact-0').selectedIndex).toBeGreaterThan(0);
    expect(view.host.textContent).not.toContain('Release activated.');
  }finally{await view.close();}
});

it('keeps edits but blocks publication when one inventory refresh fails',async()=>{
  const original=api(),view=await render(original);
  try{
    await text(view.host.querySelector('#release-name'),'poc');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host);
    expect(button(view.host,'Publish').disabled).toBe(false);
    const failed=api({policies:vi.fn(async()=>{throw new Error('Policy inventory unavailable');})});
    await view.update(failed,scope);
    expect(view.host.querySelector('[role="alert"]').textContent).toContain('Policy inventory unavailable');
    expect(view.host.querySelector('#release-name').value).toBe('poc');
    expect(view.host.querySelector('#release-artifact-0').selectedIndex).toBeGreaterThan(0);
    expect(button(view.host,'Publish').disabled).toBe(true);
    await click(button(view.host,'Publish'));
    expect(failed.publish).not.toHaveBeenCalled();
    await view.update(api(),scope);
    expect(button(view.host,'Publish').disabled).toBe(false);
  }finally{await view.close();}
});

it('chooses only one exact revision for an artifact URI',async()=>{
  const adapter=api();const view=await render(adapter);
  try{
    await text(view.host.querySelector('#release-name'),'main');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host,3);
    await include(view.host,2);
    await click(button(view.host,'Publish'));
    expect(adapter.publish.mock.calls[0][0].roots).toEqual([{uri:olderRoot.uri,kind:olderRoot.kind,version:2,hash:olderRoot.hash}]);
  }finally{await view.close();}
});

it('promotes the source channel bundle to a target channel using the target revision and policies',async()=>{
  const adapter=api({list:vi.fn(async()=>[channel,main]),promote:vi.fn(async()=>({channel:{...main,activeBundleHash:channel.activeBundleHash,revision:7},status:'active',activated:true}))});const view=await render(adapter);
  try{
    await select(view.host.querySelector('#release-channel'),'poc');
    expect(view.host.querySelector('#release-name').value).toBe('poc');
    expect(view.host.textContent).toContain('Current release revision 4');
    expect(view.host.querySelector('input[type="checkbox"]').checked).toBe(true);
    await select(view.host.querySelector('#release-promotion-target'),'main');
    await click(button(view.host,'Promote to main'));
    expect(adapter.promote).toHaveBeenCalledWith({key:main.key,expectedRevision:6,bundleHash:'sha256:old'});
    expect(adapter.promote.mock.calls[0][0]).not.toHaveProperty('policies');
  }finally{await view.close();}
});

it('rolls back to a readable retained release on the same channel',async()=>{
  const adapter=api({list:vi.fn(async()=>[channel])});const view=await render(adapter);
  try{
    await select(view.host.querySelector('#release-channel'),'poc');
    const options=[...view.host.querySelector('#release-rollback-target').options];
    expect(options[1].textContent).toContain('Earlier release · Revision 2');
    expect(options[1].textContent).not.toContain('sha256:older');
    await select(view.host.querySelector('#release-rollback-target'),'sha256:older');
    await click(button(view.host,'Roll back poc'));
    expect(adapter.promote).toHaveBeenCalledWith({key:channel.key,expectedRevision:4,bundleHash:'sha256:older'});
  }finally{await view.close();}
});

it('publishes edits to an existing channel with its current revision and retained exact roots',async()=>{
  const adapter=api({list:vi.fn(async()=>[channel]),publish:vi.fn(async()=>({channel:{...channel,activeBundleHash:'sha256:new',revision:5},status:'active',activated:true}))});
  const view=await render(adapter);
  try{
    await select(view.host.querySelector('#release-channel'),'poc');
    await text(view.host.querySelector('#release-description'),'Updated description');
    await click(button(view.host,'Publish'));
    expect(adapter.publish).toHaveBeenCalledWith({key:channel.key,description:'Updated description',roots:[{uri:rootRef.uri,kind:rootRef.kind,version:rootRef.version,hash:rootRef.hash}],policies:[{resource:policy.resource,revision:7}],expectedRevision:4});
  }finally{await view.close();}
});

it('does not replace an existing bundle when the server omits its active artifact closure',async()=>{
  const adapter=api({list:vi.fn(async()=>[channel]),history:vi.fn(async()=>[{hash:'sha256:old',revision:4}])});
  const view=await render(adapter);
  try{
    await select(view.host.querySelector('#release-channel'),'poc');
    await include(view.host);
    expect(view.host.textContent).toContain('has not supplied the active release’s included artifacts');
    expect(button(view.host,'Publish').disabled).toBe(true);
    expect(adapter.publish).not.toHaveBeenCalled();
  }finally{await view.close();}
});

it('does not report success when the adapter returns an unactivated proposal',async()=>{
  const adapter=api({publish:vi.fn(async()=>({channel:{key:{...scope,name:'poc'},revision:0,activeBundleHash:''},status:'pending',activated:false}))});const view=await render(adapter);
  try{
    await text(view.host.querySelector('#release-name'),'poc');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host);
    await click(button(view.host,'Publish'));
    expect(view.host.querySelector('[role="status"]').textContent).toContain('Publishing is in progress');
    expect(view.host.textContent).not.toContain('Release activated.');
    expect(view.host.querySelector('#release-name').value).toBe('poc');
  }finally{await view.close();}
});

it('keeps confirmed activation visible when the subsequent list refresh fails',async()=>{
  const adapter=api({list:vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('List unavailable'))});
  const view=await render(adapter);
  try{
    await text(view.host.querySelector('#release-name'),'poc');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host);
    await click(button(view.host,'Publish'));
    expect(view.host.querySelector('[role="status"]').textContent).toContain('Release activated.');
    expect(view.host.querySelector('[role="alert"]').textContent).toContain('current list could not refresh');
  }finally{await view.close();}
});

it('reports a pending publication as active only after an authoritative refreshed list confirms it',async()=>{
  const published={key:{...scope,name:'poc'},description:'Review',policies:[policy],activeBundleHash:'sha256:published',revision:1,releaseStatus:'active',activated:true,bundle:{roots:[rootRef]}};
  const adapter=api({list:vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([published]),publish:vi.fn(async()=>({status:'pending',activated:false,channel:{...published,activeBundleHash:''}}))});
  const view=await render(adapter);
  try{
    await text(view.host.querySelector('#release-name'),'poc');
    await click(view.host.querySelector('input[type="checkbox"]'));
    await include(view.host);
    await click(button(view.host,'Publish'));
    expect(view.host.textContent).toContain('Publishing is in progress');
    expect(view.host.textContent).not.toContain('Release activated.');
    await click(button(view.host,'Refresh releases'));
    expect(view.host.textContent).toContain('Release activated.');
    expect(view.host.textContent).not.toContain('Publishing is in progress');
  }finally{await view.close();}
});

it('explains an empty assignable policy list without offering publication',async()=>{
  const view=await render(api({policies:vi.fn(async()=>[])}));
  try{
    expect(view.host.textContent).toContain('No policies are available for this release');
    expect(view.host.textContent).toContain('Create an account policy in Security');
    expect(button(view.host,'Publish').disabled).toBe(true);
  }finally{await view.close();}
});

it('surfaces policy candidate errors without pretending the inventory is empty',async()=>{
  const view=await render(api({policies:vi.fn(async()=>{throw new Error('Release policy choices could not load.');})}));
  try{
    expect(view.host.querySelector('[role="alert"]').textContent).toContain('Release policy choices could not load.');
    expect(view.host.textContent).not.toContain('No policies are available for this release');
    expect(button(view.host,'Publish').disabled).toBe(true);
  }finally{await view.close();}
});

it('shows a previously selected policy removed from candidates but will not republish it',async()=>{
  const view=await render(api({list:vi.fn(async()=>[channel]),policies:vi.fn(async()=>[])}));
  try{
    await select(view.host.querySelector('#release-channel'),'poc');
    expect(view.host.textContent).toContain('Unavailable for new releases');
    expect(view.host.textContent).toContain('Remove unavailable policies before publishing');
    expect(button(view.host,'Publish').disabled).toBe(true);
  }finally{await view.close();}
});

it('offers an optional validation slot with the current exact selection without gating publish',async()=>{
  const adapter=api();
  const host=document.createElement('div');document.body.append(host);const view=createRoot(host);
  const validation=vi.fn(({roots,disabled})=><div aria-label="Validation extension">{roots.map(root=>root.uri).join(',')}:{String(disabled)}</div>);
  try {
    await act(async()=>view.render(<ReleaseManager api={adapter} channelKey={scope} renderValidation={validation}/>));
    expect(host.querySelector('[aria-label="Validation extension"]')).not.toBeNull();
    expect(validation.mock.calls.at(-1)[0]).toMatchObject({roots:[],disabled:false});
    await include(host);
    expect(validation.mock.calls.at(-1)[0].roots).toEqual([rootRef]);
    await text(host.querySelector('#release-name'),'review');
    await click(host.querySelector('input[type="checkbox"]'));
    expect(button(host,'Publish').disabled).toBe(false);
    await click(button(host,'Publish'));
    expect(adapter.publish).toHaveBeenCalledOnce();
  } finally {await act(async()=>view.unmount());host.remove();}
});
