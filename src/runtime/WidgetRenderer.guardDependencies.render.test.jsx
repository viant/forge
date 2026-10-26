import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {signal} from '@preact/signals-react';
import WidgetRenderer from './WidgetRenderer.jsx';
import {registerWidget} from './widgetRegistry.jsx';
import {classify} from './widgetClassifier.js';
import {setSelector} from '../utils/selector.js';

const require = createRequire(import.meta.url);
const {parse} = require('yaml');
const propertiesURL = new URL('./testdata/guard-dependencies.yaml', import.meta.url);
const definition = parse(fs.readFileSync(process.env.PROPERTIES_SOURCE || propertiesURL, 'utf8'));
const items = new Map();
function collect(value) {
 if (!value || typeof value !== 'object') return;
 if (value.id) items.set(value.id, value);
 Object.values(value).forEach(child => Array.isArray(child) ? child.forEach(collect) : collect(child));
}
collect(definition);
const ids = ['featureEnabled','featureLimit','featureDuration','featureUnit','contactName','referenceCode'];
// Use the authored controls/guards, with lightweight widgets to count native
// WidgetRenderer subscriptions independently of third-party widget internals.
const counts = {};
function Probe(props) { const key=props.item.id;counts[key]=(counts[key]||0)+1; return <input data-probe-id={key} {...{id:props.id,disabled:props.disabled,readOnly:props.readOnly,value:props.value,adapter:props.adapter}}/>; }
for (const id of ids) { assert.ok(items.has(id), `authored item ${id} exists`); registerWidget(items.get(id).widget || classify(items.get(id)), Probe); }
const form=signal({settings:{enabled:false,limit:5,interval:{value:1,unit:'DAY'}},contactName:'Contact',reference:'ACC'});
const authorization=signal({resource:{capabilities:{write:true}}});
const context={identity:{dataSourceRef:'sample_form'},signals:{form,authorization},handlers:{dataSource:{getFormData:()=>form.peek(),peekFormData:()=>form.peek(),setFormField:({item,value})=>{const next=structuredClone(form.peek());form.value=setSelector(next,item.dataField,value);}}}};
context.Context=()=>context;
let renderer;
await act(async()=>{renderer=TestRenderer.create(<>{ids.map(id=><WidgetRenderer key={id} item={items.get(id)} context={context}/>)}</>);});
const host=id=>renderer.root.findAllByType('input').find(node=>node.props['data-probe-id']===id);
const caps=ids.slice(1,4);
caps.forEach(id=>assert.equal(host(id).props.disabled,true));
const before={...counts};
await act(async()=>host('featureEnabled').props.adapter.set(true));
assert.equal(form.peek().settings.enabled,true);
caps.forEach(id=>{assert.notEqual(host(id).props.disabled,true,`${id} enables from its declared guard`);assert.ok(counts[id]>before[id]);});
for(const id of ids.slice(4))assert.equal(counts[id],before[id],`${id} must not render for feature toggle`);
const enabled={...counts};
await act(async()=>host('contactName').props.adapter.set('Updated'));
for(const id of caps)assert.equal(counts[id],enabled[id],`${id} ignores unrelated Contact edit`);
assert.equal(counts.referenceCode,enabled.referenceCode);
await act(async()=>host('featureEnabled').props.adapter.set(false));
caps.forEach(id=>assert.equal(host(id).props.disabled,true,`${id} disables again`));
await act(async()=>host('featureEnabled').props.adapter.set(true));
await act(async()=>{authorization.value={resource:{capabilities:{write:false}}};});
caps.forEach(id=>assert.equal(host(id).props.disabled,true,`${id} still responds to write display hints`));
await act(async()=>renderer.unmount());
console.log('authored feature guard guard dependencies render test passed');
