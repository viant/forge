import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {registerContainerRenderer} from '../runtime/containerRendererRegistry.js';
import {getCollectionSignal, getMetadataSignal, removeSignalsForKey} from '../core/store/signals.js';

let latestRendererContext;
registerContainerRenderer('test.authorized', ({context}) => {
  latestRendererContext=context;
  return <div data-authorized-renderer>{context.identity.windowId}</div>;
});
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
    view:{content:{id:'authorized-root',kind:'test.authorized', ...(withRows ? {dataSourceRef:'rows',fetchData:true} : {})}}};
}
describe('mounted protected window absolute lease', () => {
  it('expires the mounted renderer without renewing or modifying its old metadata', async () => {
    let metadataRequests=0, permissions=0;
    const services={authorizationRefresh:{mode:'seamless'}, applyPermission:async ({completeMetadata}) => {permissions++;return completeMetadata;},
      dataConnectorTransport:async () => {metadataRequests++;return {data:definition()};}};
    await mount(services); await flush();
    expect(element.querySelector('[data-authorized-renderer]')).not.toBeNull();
    const oldMetadata=getMetadataSignal(windowId).peek();
    expect(latestRendererContext.metadata).toBe(oldMetadata);
    expect(latestRendererContext.identity.protectedWindow).toBe(true);
    const oldExpiry=oldMetadata.authorizationSnapshot.expiresAt;
    await act(async () => vi.advanceTimersByTime(10000)); await flush();
    expect(element.querySelector('[data-authorized-renderer]')).toBeNull();
    expect(element.textContent).toContain('Permissions expired');
    expect(getMetadataSignal(windowId).peek()).toBeNull();
    expect(oldMetadata.authorizationSnapshot.expiresAt).toBe(oldExpiry);
    expect(metadataRequests).toBe(1); expect(permissions).toBe(1);
  });
  it('cannot restore expired datasource rows after a slow response', async () => {
    let completeRows;
    const services={applyPermission:async ({completeMetadata}) => completeMetadata,
      dataConnectorTransport:async request => request.dataSourceRef==='rows' ? new Promise(resolve => {completeRows=resolve;}) : {data:definition(true)}};
    await mount(services); await flush();
    expect(completeRows).toBeTypeOf('function');
    await act(async () => vi.advanceTimersByTime(10000)); await flush();
    await act(async () => completeRows({data:[{secret:'late-expired-row'}]})); await flush();
    expect(getCollectionSignal(`${windowId}DSrows`).peek()).toEqual([]);
    expect(element.querySelector('[data-authorized-renderer]')).toBeNull();
    expect(element.textContent).toContain('Permissions expired');
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
