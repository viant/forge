import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DashboardBlock} from './DashboardBlocks.jsx';
import {applyParameterCodec, resolveParameters} from '../../hooks/parameters.js';

// Core owns provider-window assembly. Exercise its canonical wire fixture
// here using an independently authored synthetic wire contract.
const window = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./testdata/synthetic-native-report-window.json', import.meta.url)), 'utf8'));
const block = window.view.content.containers.find(container => container.kind === 'dashboard.reportRuntime');
assert.ok(block, 'native report must create a visible Forge runtime container');
const sourceRef = block.dashboard.reportRuntime.datasetBindings.primary.dataSourceRef;
const source = window.dataSource[sourceRef];
assert.equal(source.service.uri, window.dataSource.records.service.uri, 'dataset must retain the authorized revision-bound provider route');
assert.deepEqual(resolveParameters(source.parameters, {}).request, {limit:50, offset:0}, 'full authored request must reach provider inputs as an object');
assert.deepEqual(applyParameterCodec('{"filters":{"ids":[1,2]},"options":{"limit":50}}', {name:'json'}), {filters:{ids:[1,2]},options:{limit:50}});
assert.throws(() => applyParameterCodec('invalid-json', {name:'json'}), 'malformed request must fail rather than silently execute');

const state = {signals:{collection:{value:[{count:7}]},control:{value:{loaded:true}}}};
const context = {handlers:{},locale:'en-US',Context:ref => ref === sourceRef ? state : null};
const render = () => renderToStaticMarkup(React.createElement(DashboardBlock,{container:block,context}));
let html=render();
assert.ok(html.includes('Count'), 'native report table column must be visible');
assert.ok(/>7</.test(html), 'provider datasource rows must fill the native report table');
state.signals.control.value={loading:true};
html=render();
assert.ok(html.includes('Loading overview'));
assert.ok(!/>7</.test(html), 'old report rows must disappear during protected refresh');
state.signals.control.value={error:'denied'};
html=render();
assert.ok(html.includes('could not be loaded'));
assert.ok(!/>7</.test(html), 'revoked provider rows must not remain visible');
console.log('Portable native Forge report renders provider rows and preserves authored request/revocation state.');
