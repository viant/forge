import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import WindowContent, {compileWindowAuthorizationMetadata} from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {registerContainerRenderer} from '../runtime/containerRendererRegistry.js';
import {getCollectionSignal, getMetadataSignal, removeSignalsForKey} from '../core/store/signals.js';
import QuickFilterInputs from './table/basic/QuickFilterInputs.jsx';

let latestRendererContext;
registerContainerRenderer('test.authorized', ({context}) => {
  latestRendererContext=context;
  return <div data-authorized-renderer>{context.identity.windowId}</div>;
});
registerContainerRenderer('test.dataset-denial', ({context}) => (
  <div data-dataset-denial-renderer>
    <QuickFilterInputs context={context}/>
    <div role="alert">{context.signals.control.value.error?.message || ''}</div>
  </div>
));
const windowId = 'mounted-authorized';
const target = {actorRef: 'actor-a', platform: 'web', formFactor: 'desktop'};
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'});
Object.assign(globalThis, {window:dom.window, document:dom.window.document, HTMLElement:dom.window.HTMLElement, Element:dom.window.Element, MutationObserver:dom.window.MutationObserver});
let root, element;
async function flush() { await act(async () => { for (let i=0;i<12;i++) await Promise.resolve(); }); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  element = document.createElement('div'); document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount()); element.remove();
  removeSignalsForKey(windowId); vi.useRealTimers();
});
function mount(services, window = {windowId, windowKey: 'mcp://opaque/window'}) {
  return act(async () => root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:"/window"}}}} services={services} targetContext={target}><WindowContent window={window}/></SettingProvider>));
}
function definition(withRows = false) {
  return {authorization: {scope: 'window'}, authorizationSnapshot: {authorizationVersion:'v1', expiresAt:'2026-10-10T12:00:10Z', principal:{id:'actor-a'}},
    dataSource: withRows ? {rows:{service:{uri:'mcp://opaque/rows'}, selectionMode:'none'}} : {},
    view:{content:{id:'authorized-root',kind:'test.authorized', ...(withRows ? {dataSourceRef:'rows'} : {})}}};
}
describe('mounted protected window absolute lease', () => {
	 it('keeps a successfully opened MCP-managed view mounted after its hint lease', async () => {
	   let metadataRequests=0, permissions=0;
	   const services={authorizationRefresh:{mode:'opening'},applyPermission:async({completeMetadata})=>{permissions++;return completeMetadata;},dataConnectorTransport:async()=>{metadataRequests++;return {data:definition()};}};
	   await mount(services);await flush();
	   const metadata=getMetadataSignal(windowId).peek();
	   expect(latestRendererContext.identity.windowOpenOnly).toBe(true);
	   await act(async()=>vi.advanceTimersByTime(60000));await flush();
	   expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
	   expect(getMetadataSignal(windowId).peek()).toBe(metadata);
	   expect(metadata.authorizationSnapshot.expiresAt).toBe('2026-10-10T12:00:10Z');
	   expect(metadataRequests).toBe(1);expect(permissions).toBe(1);
	 });
	 it('does not mark an unprotected legacy window as opening-admitted', async () => {
	   const publicMetadata={dataSource:{},view:{content:{id:'public-root',kind:'test.authorized'}}};
	   const services={authorizationRefresh:{mode:'opening'},dataConnectorTransport:async()=>({data:publicMetadata})};
	   await mount(services);await flush();
	   expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
	   expect(latestRendererContext.identity.windowOpenOnly).toBe(false);
	 });
  it('admits a fresh view separately while an old request keeps its expired scope', async () => {
    let completeOldRows, grants=0, rowRequests=0;
    const services={applyPermission:async ({completeMetadata}) => completeMetadata,
      dataConnectorTransport:async request => {
        if(request.dataSourceRef==='rows') {
          rowRequests++;
          return rowRequests===1 ? new Promise(resolve => {completeOldRows=resolve;}) : {data:[{id:2,secret:'fresh-authorized-row'}]};
        }
        grants++;
        const metadata=definition(true);
        if(grants>1) metadata.authorizationSnapshot.expiresAt='2026-10-10T12:01:00Z';
        return {data:metadata};
      }};
    await mount(services); await flush();
    expect(completeOldRows).toBeTypeOf('function');
    const oldMetadata=getMetadataSignal(windowId).peek();
    await act(async () => vi.advanceTimersByTime(10000)); await flush();
    await act(async () => root.render(null));
    await mount(services); await flush();
    expect(grants).toBe(2);
    expect(getMetadataSignal(windowId).peek()).not.toBe(oldMetadata);
    expect(oldMetadata.authorizationSnapshot.expiresAt).toBe('2026-10-10T12:00:10Z');
    expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:2,secret:'fresh-authorized-row'}]);
    await act(async () => completeOldRows({data:[{id:1,secret:'old-expired-row'}]})); await flush();
    expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:2,secret:'fresh-authorized-row'}]);
    expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
  });

  for (const scope of ['dataset','window']) {
    it(`keeps only an exactly typed dataset denial local (${scope})`, async () => {
      let denied=false;
      const failure=Object.assign(new Error('denied'),{status:403,code:'datasource_denied',scope});
      const services={applyPermission:async ({completeMetadata})=>completeMetadata,
        dataConnectorTransport:async request => {
          if(request.dataSourceRef!=='rows') return {data:definition(true)};
          if(denied) throw failure;
          return {data:[{id:1,secret:'previous-row'}]};
        }};
      await mount(services); await flush();
      expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:1,secret:'previous-row'}]);
      denied=true;
      await act(async () => {
        await expect(getWindowContext(windowId).Context('rows').handlers.dataSource.fetchRecords()).rejects.toBe(failure);
      }); await flush();
      expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([]);
      if(scope==='dataset') {
        expect(getMetadataSignal(windowId).peek()).not.toBeNull();
        expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
      } else {
        expect(getMetadataSignal(windowId).peek()).toBeNull();
        expect(element.querySelector('[data-authorized-renderer]')).toBeNull();
        expect(element.textContent).toContain('Access denied');
      }
    });
  }

});

describe('rendered dataset denial retry behavior', () => {
  it('keeps the filter and dataset error visible, stops automatic retries, and allows an explicit filter retry', async () => {
    let rowReads = 0;
    const denial = Object.assign(new Error('Datasource access denied. Adjust the filter or retry.'), {
      status: 403, code: 'datasource_denied', scope: 'dataset',
    });
    const metadata = {
      ...definition(true),
      dataSource: {rows: {
        service: {uri: 'mcp://opaque/rows'}, selectionMode: 'none', autoFetch: true,
        quickFilterSet: 'creativeId',
        filterSet: [{name: 'creativeId', filters: [{field: 'Id', placeholder: 'Creative ID'}]}],
      }},
      view: {content: {id: 'denied-root', kind: 'test.dataset-denial', dataSourceRef: 'rows'}},
    };
    const services = {
      applyPermission: async ({completeMetadata}) => completeMetadata,
      dataConnectorTransport: async request => {
        if (request.dataSourceRef !== 'rows') return {data: metadata};
        rowReads += 1;
        throw denial;
      },
    };
    const testWindow = {windowId, windowKey: 'mcp://opaque/creativeList'};
    await mount(services, testWindow); await flush();
    const rowsContext = getWindowContext(windowId).Context('rows');
    expect(rowReads).toBe(1);
    expect(element.querySelector('[data-dataset-denial-renderer]')).not.toBeNull();
    expect(element.querySelector('[placeholder="Creative ID"]')).not.toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Datasource access denied');

    // A deliberate filter change remains a supported retry action.
    await act(async () => rowsContext.handlers.dataSource.setFilter({filter: {Id: 999999999}}));
    await flush();
    expect(rowReads).toBe(2);
    expect(element.querySelector('[placeholder="Creative ID"]')).not.toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Datasource access denied');
  });
});

const binding = (instanceId = 'delivery-a') => ({actor:{issuer:'issuer',subject:'actor-a',tenantId:'tenant',accountId:'account'},instanceId,parametersDigest:'digest',token:'signed-server-token'});
const boundWindow = (selectionBinding = binding()) => ({windowId,windowKey:'mcp://opaque/window',parameters:{entityId:'9007199254740993'},selectionBinding});
describe('canonical delivered window uses display hints only', () => {
  it('consumes complete signed direct OPEN metadata without a second metadata lookup',async()=>{
    let metadataRequests=0,permissions=0;
    const services={applyPermission:async()=>{permissions++;throw new Error('repeat permission');},dataConnectorTransport:async request=>{
      if(request.dataSourceRef==='rows') return {data:[{id:1,secret:'direct-admitted'}]};
      metadataRequests++;throw new Error('dynamic metadata lookup unavailable');
    }};
    const inlineMetadata={...definition(true),selectionBinding:binding()};
    const opened={windowId,windowKey:'dynamic-canonical-variant',parameters:{entityId:'9007199254740993'},inlineMetadata};
    await mount(services,opened);await flush();
    expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
    expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:1,secret:'direct-admitted'}]);
    expect(metadataRequests).toBe(0);expect(permissions).toBe(0);
    expect(getMetadataSignal(windowId).peek().selectionBinding).toBe(inlineMetadata.selectionBinding);
  });
  it('uses normalized trusted hints only for widget display and preserves independently authorized sources',()=>{
    const metadata={authorization:{schemaVersion:2,scope:'resource',resource:{type:'entity',id:{selector:'entityId'}}},
      authorizationSnapshot:{schemaVersion:2,expiresAt:'2000-01-01T00:00:00Z',resources:{'9007199254740993':{id:'9007199254740993',capabilities:{read:false,write:false}}}},
      dataSource:{visible:{id:'visible'},hidden:{id:'hidden'}},
      view:{content:{id:'root',items:[{id:'hidden',dataSourceRef:'hidden',visibleWhen:{source:'authorization',field:'resource.capabilities.read',equals:true}},{id:'visible',dataSourceRef:'visible'}]}}};
    const result=compileWindowAuthorizationMetadata(metadata,{entityId:'9007199254740993'},binding());
    expect(result.view.content.items.map(item=>item.id)).toEqual(['visible']);
    expect(result.dataSource).toBe(metadata.dataSource);
    expect(result.authorizationSnapshot.resource).toBeNull();
    expect(metadata.view.content.items).toHaveLength(2);
  });
  it('keeps mounted real datasources across hint expiry without permission preflight or renewal', async () => {
    let completeRows, metadataRequests=0, permissions=0;
    const services={applyPermission:async () => {permissions++;throw new Error('Unexpected UI data preflight');},
      dataConnectorTransport:async request => {
        if(request.dataSourceRef==='rows') return new Promise(resolve=>{completeRows=resolve;});
        metadataRequests++;
        const metadata=definition(true);
        metadata.authorization.scope='resource';
        metadata.authorizationSnapshot.resource={capabilities:{read:false,write:false}};
        return {data:metadata};
      }};
    const opened=boundWindow();
    await mount(services,opened);await flush();
    expect(completeRows).toBeTypeOf('function');
    const held=getMetadataSignal(windowId).peek();
    expect(held.selectionBinding).toBe(opened.selectionBinding);
    expect(latestRendererContext.identity.canonicalDelivery).toBe(true);
    const expiry=held.authorizationSnapshot.expiresAt;
    await act(async()=>vi.advanceTimersByTime(11000));await flush();
    await act(async()=>completeRows({data:[{id:1,secret:'after-hint-expiry'}]}));await flush();
    expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:1,secret:'after-hint-expiry'}]);
    expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
    expect(held.authorizationSnapshot.expiresAt).toBe(expiry);
    expect(metadataRequests).toBe(1);expect(permissions).toBe(0);
  });
  for(const change of ['selection','actor']) {
  it(`rejects stale data completion after ${change} changes, including authnil windows`, async()=>{
    let completeOldRows, requests=0;
    const services={dataConnectorTransport:async request=>{
      if(request.dataSourceRef==='rows') {
        requests++;
        return requests===1 ? new Promise(resolve=>{completeOldRows=resolve;}) : {data:[{id:2,secret:'new-delivery'}]};
      }
      const metadata=definition(true);delete metadata.authorization;delete metadata.authorizationSnapshot;
      return {data:metadata};
    }};
    await mount(services,boundWindow());await flush();
    expect(completeOldRows).toBeTypeOf('function');
    const nextBinding=binding(change==='selection' ? 'delivery-b' : 'delivery-a');
    if(change==='actor') nextBinding.actor.subject='actor-b';
    await mount(services,boundWindow(nextBinding));await flush();
    expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:2,secret:'new-delivery'}]);
    await act(async()=>completeOldRows({data:[{id:1,secret:'stale-delivery'}]}));await flush();
    expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:2,secret:'new-delivery'}]);
  });
  }
});

describe('canonical managing MCP denials on authnil window',()=>{
  for(const failure of [
    {status:403,code:'datasource_denied',scope:'dataset'},
    {status:403,message:'resource revision denied'},
    {status:403,code:'resource_denied',scope:'window'},
    {status:401,authRequired:true},
  ]) {
    it(`clears the correct scope for ${failure.code || failure.status}`,async()=>{
      let denied=false;
      const error=Object.assign(new Error('authoritative MCP denial'),failure);
      const services={dataConnectorTransport:async request=>{
        if(request.dataSourceRef!=='rows') {const metadata=definition(true);delete metadata.authorization;delete metadata.authorizationSnapshot;return {data:metadata};}
        if(denied) throw error;
        return {data:[{id:1,secret:'previous-result'}]};
      }};
      await mount(services,boundWindow());await flush();
      expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([{id:1,secret:'previous-result'}]);
      denied=true;
      await act(async()=>{await expect(getWindowContext(windowId).Context('rows').handlers.dataSource.fetchRecords()).rejects.toBe(error);});await flush();
      expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([]);
      if(failure.scope==='dataset' || (failure.status===403 && !failure.scope)) expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
      else {expect(element.querySelector('[data-authorized-renderer]')).toBeNull();expect(getMetadataSignal(windowId).peek()).toBeNull();}
    });
  }
});
