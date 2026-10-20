import {expect, it} from 'vitest';
import {resolveRequiredDataSourceRefs, resolveDeferredDataSourceRefs, shouldPrimeDataSourceFetch, resolveWindowDataSourceFetchFlag} from './WindowContent.jsx';

it('queues changed parameters during an in-flight read without re-priming the same request', () => {
    const loading = {loaded: false, loading: true};
    const pending = shouldPrimeDataSourceFetch({}, {fetch: false}, [], true, loading);
    expect(resolveWindowDataSourceFetchFlag({fetchOwnedByContainer: true, paramsChanged: true, shouldFetch: pending})).toBe(true);
    // An unrelated window render while the old request is still running must
    // retain this intent for the datasource to consume after completion.
    expect(shouldPrimeDataSourceFetch({}, {fetch: true}, [], false, loading)).toBe(true);
    expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], false, loading)).toBe(false);
});

it('does not queue automatic requests for deferred or terminal denied data', () => {
    const loading = {loading: true};
    expect(shouldPrimeDataSourceFetch({autoFetch:false}, {}, [], true, loading)).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {}, [], true, loading, {deferAutomatic:true})).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {}, [], true, {loading:true,error:{status:403,code:'datasource_denied',scope:'dataset'}})).toBe(false);
});

it('mounts command-only writers deferred and preserves eager reader consumers', () => {
    const metadata={dataSource:{rows:{},writer:{},summary:{}},view:{content:{dataSourceRef:'rows',editableCollection:{operations:[{mutation:{dataSourceRef:'writer',refresh:[{dataSourceRef:'rows'},{dataSourceRef:'summary'}]}}]}}}};
    expect(new Set(resolveRequiredDataSourceRefs(metadata))).toEqual(new Set(['rows','writer','summary']));
    expect(resolveDeferredDataSourceRefs(metadata)).toEqual(new Set(['writer','summary']));
    expect(shouldPrimeDataSourceFetch({}, {}, [], true, {}, {deferAutomatic:true})).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {fetch:true}, [], false, {}, {deferAutomatic:true})).toBe(true);
});

it('does not mount command writers from inactive lazy panels',()=>{
    const metadata={dataSource:{rows:{},writer:{}},view:{content:{id:'tabs',stableTabs:{renderActiveTabPanelOnly:true,defaultSelectedTabId:'read'},containers:[{id:'read',dataSourceRef:'rows'},{id:'edit',mutationCommand:{dataSourceRef:'writer'}}]}}};
    expect(resolveRequiredDataSourceRefs(metadata)).toEqual(['rows']);
    expect(resolveRequiredDataSourceRefs(metadata,'',{}, {tabs:{tabs:'edit'}})).toEqual(['writer']);
    expect(resolveDeferredDataSourceRefs(metadata,'',{}, {tabs:{tabs:'edit'}})).toEqual(new Set(['writer']));
});

it('executes a primitive-only writer once after clicking, never while mounting the window',async()=>{
    const previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const React=await import('react');const {createRoot}=await import('react-dom/client');
    const {default:WindowContent}=await import('./WindowContent.jsx');
    const {SettingProvider}=await import('../core/context/Setting.jsx');
    const {removeSignalsForKey}=await import('../core/store/signals.js');
    await import('../packs/blueprint/index.jsx');
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    const windowId='primitive-command-only-writer';const requests=[];
    const transport=async request=>{requests.push(request.dataSourceRef);return {data:request.dataSourceRef==='rows'?[{id:1,name:'Example'}]:[{saved:true}]};};
    const metadata={dataSource:{rows:{id:'rows',cardinality:'collection',service:{uri:'mcp://fixture/rows'}},writer:{id:'writer',cardinality:'object',service:{uri:'mcp://fixture/write'}}},view:{content:{id:'root',containers:[
        {id:'records',dataSourceRef:'rows',table:{columns:[{id:'name',name:'Name'}]}},
        {id:'save',mutationCommand:{commandId:'save',label:'Apply',dataSourceRef:'writer',refresh:[{dataSourceRef:'rows',bypassCache:true}]}}
    ]}}};
    const settle=async(action)=>React.act(async()=>{action?.();for(let i=0;i<40;i++)await Promise.resolve();});
    try {
        await settle(()=>root.render(<SettingProvider connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'commands'}} selectedMetadata={metadata}/></SettingProvider>));
        expect(requests.filter(ref=>ref==='writer')).toHaveLength(0);
        expect(requests.filter(ref=>ref==='rows')).toHaveLength(1);
        const button=[...host.querySelectorAll('button')].find(item=>item.textContent.trim()==='Apply');
        expect(button).toBeTruthy();
        await settle(()=>button.click());
        expect(requests.filter(ref=>ref==='writer')).toHaveLength(1);
        expect(requests.filter(ref=>ref==='rows')).toHaveLength(2);
    } finally {
        await React.act(async()=>root.unmount());host.remove();removeSignalsForKey(windowId);globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;
    }
});

it('waits for a declared archive then renders a nonfatal missing-resource warning',async()=>{
 const previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react');const {createRoot}=await import('react-dom/client');
 const {default:WindowContent}=await import('./WindowContent.jsx');const {SettingProvider}=await import('../core/context/Setting.jsx');
 const {ResourceFS}=await import('../resources/ResourceFS.js');const {removeSignalsForKey}=await import('../core/store/signals.js');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const windowId='archive-missing-warning';let releaseDialog;
 const resourceFS=new ResourceFS({namespace:'example',scopeKey:'test-user',loadArchive:({kind})=>kind==='dialog'?new Promise(resolve=>releaseDialog=resolve):Promise.resolve({schemaVersion:1,namespace:'example',kind,catalogRevision:'1',complete:true,entries:[]})});
 const metadata={resources:{dialogs:['missing']},dataSource:{},view:{content:{id:'root',title:'Available controls',items:[]}}};
 const settle=async(action)=>React.act(async()=>{action?.();for(let i=0;i<40;i++)await Promise.resolve();});
 try {
  await settle(()=>root.render(<SettingProvider connectorConfig={{window:{service:{uri:'/window'}}}} services={{resourceFS}}><WindowContent window={{windowId,windowKey:'archive-test'}} selectedMetadata={metadata}/></SettingProvider>));
  expect(releaseDialog).toBeTypeOf('function');expect(host.querySelector('[data-window-id]')).toBeNull();
  await settle(()=>releaseDialog({schemaVersion:1,namespace:'example',kind:'dialog',catalogRevision:'1',complete:true,entries:[]}));
  expect(host.querySelector('[data-window-id]')).toBeTruthy();expect(host.querySelector('[role="status"]')?.textContent).toContain('dialog://example/missing');
 } finally {await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId);globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;}
});

it('keeps authored styling keys when navigation uses a full resource URI',async()=>{
 const previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react');const {createRoot}=await import('react-dom/client');const {default:WindowContent}=await import('./WindowContent.jsx');
 const {SettingProvider}=await import('../core/context/Setting.jsx');const {ForgeThemeProvider}=await import('./ThemeBoundary.jsx');const {removeSignalsForKey}=await import('../core/store/signals.js');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),windowId='canonical-styling-key';
 const metadata={windowKey:'advertiser',resource:{uri:'window://example/advertiser',providerIdentity:'publisher'},dataSource:{},view:{content:{id:'root',items:[]}}};
 try {
  await React.act(async()=>{root.render(<ForgeThemeProvider><SettingProvider connectorConfig={{window:{service:{uri:'/window'}}}}><WindowContent window={{windowId,windowKey:'window://example/advertiser'}} selectedMetadata={metadata}/></SettingProvider></ForgeThemeProvider>);for(let i=0;i<40;i++)await Promise.resolve();});
  expect(host.querySelector('[data-forge-window-key="advertiser"][data-forge-resource-provider="publisher"]')).not.toBeNull();
  expect(document.body.querySelector('[data-forge-theme-portal][data-forge-window-key="advertiser"][data-forge-resource-namespace="example"]')).not.toBeNull();
 }finally{await React.act(async()=>root.unmount());host.remove();removeSignalsForKey(windowId);globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;}
});
