import React from 'react';
import {createRoot} from 'react-dom/client';
import WindowContent from '../../src/components/WindowContent.jsx';
import {SettingProvider} from '../../src/core/context/Setting.jsx';
import {getCollectionSignal, getInputSignal, protectedWindowDenials} from '../../src/core/store/signals.js';

const windowId = 'authz-denial-preview';
const dataSourceId = `${windowId}DSrows`;
let denyRows = 0;
const metadata = {
  authorizationSnapshot: {authorizationVersion: 'fixture', expiresAt: new Date(Date.now() + 60_000).toISOString()},
  window: {title: 'Protected window'},
  view: {content: {id: 'root', dataSourceRef: 'rows', items: [{id: 'description', type: 'text', value: 'Protected data is visible'}]}},
  dataSource: {rows: {service: {URL: '/fixture/rows'}, selectors: {data: 'data'}}},
};

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (url, options) => {
  if (String(url).includes('/fixture/window/')) {
    return Promise.resolve(new Response(JSON.stringify({data: metadata}), {status: 200, headers: {'content-type': 'application/json'}}));
  }
  if (String(url).includes('/fixture/rows')) {
    if (denyRows) return Promise.resolve(new Response(denyRows === 401 ? 'Unauthorized' : 'Forbidden', {status: denyRows}));
    return Promise.resolve(new Response(JSON.stringify({data: [{id: 'prior-result'}]}), {status: 200, headers: {'content-type': 'application/json'}}));
  }
  return nativeFetch(url, options);
};

window.authzDenialFixture = {
  state() { return {denial: protectedWindowDenials.value[windowId], rows: getCollectionSignal(dataSourceId).value}; },
};

getCollectionSignal(dataSourceId).value = [{id: 'prior-result'}];
createRoot(document.getElementById('root')).render(
  <SettingProvider
    endpoints={{fixture: {baseURL: location.origin}}}
    connectorConfig={{window: {service: {endpoint: 'fixture', uri: '/fixture/window'}}}}
  >
    {[401, 403].map((status) => (
      <button key={status} type="button" onClick={() => { denyRows = status; const input = getInputSignal(dataSourceId); input.value = {...input.peek(), refresh: true}; }}>
        Return upstream {status}
      </button>
    ))}
    <WindowContent window={{windowId, windowKey: 'orders', parameters: {}}}/>
  </SettingProvider>,
);
