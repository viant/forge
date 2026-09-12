import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';

for (const key of ['text', 'password', 'number', 'textarea', 'button']) {
    const Widget = getWidget(key);
    const part = key === 'button' ? 'button' : 'input';
    const html = renderToStaticMarkup(<Widget value={key === 'number' ? 1 : ''}
        onChange={() => {}} onValueChange={() => {}} className="ws-example"
        data-forge-widget={key} data-forge-control-id="customer"
        data-forge-part={part} aria-label="Customer" />);
    const nativeTag = html.match(new RegExp(`<${key === 'button' ? 'button' : key === 'textarea' ? 'textarea' : 'input'}\\b[^>]*>`))?.[0];
    assert.ok(nativeTag, `${key}: missing native target`);
    assert.ok(nativeTag.includes(`data-forge-part="${part}"`), `${key}: part must reach native node: ${html}`);
    assert.ok(nativeTag.includes(`data-forge-widget="${key}"`), `${key}: missing logical widget identity`);
    assert.ok(nativeTag.includes('data-forge-control-id="customer"'), `${key}: missing unwrapped control identity`);
    assert.ok(html.includes('ws-example'), `${key}: authored class lost`);
}
const Button = getWidget('button');
const authored = renderToStaticMarkup(<Button style={{borderRadius: 17, background: '#abcdef'}} />);
assert.ok(authored.includes('border-radius:17px'));
assert.ok(authored.includes('background:#abcdef'));
console.log('theme native-part forwarding and inline override contracts passed');

const {default: ControlWrapper} = await import('../../runtime/ControlWrapper.jsx');
const Input = getWidget('text');
for (const wrapper of [undefined, 'none']) {
    const html = renderToStaticMarkup(<ControlWrapper framework="blueprint"
        item={{id: 'customer', label: 'Customer', wrapper, validationError: 'Name required'}} container={{}} context={{}}>
        <Input id="custom-id" data-forge-part="input" aria-describedby="existing-description" />
    </ControlWrapper>);
    const input = html.match(/<input\b[^>]*>/)?.[0];
    const helperID = html.match(/id="([^"]+-help)"/)?.[1];
    assert.ok(helperID, html);
    assert.ok(input.includes(`aria-describedby="existing-description ${helperID}"`), html);
    assert.ok(html.includes('data-forge-part="validation-message"'), html);
    if (!wrapper) {
        assert.ok(html.includes('<label'), html);
        assert.ok(html.includes('for="custom-id"'), html);
        assert.ok(html.includes('data-forge-part="label"'), html);
    }
}
console.log('theme labels, validation targets, and wrapper bypass associations passed');

for (const state of [{disabled: true}, {readOnly: true}]) {
    const html = renderToStaticMarkup(<ControlWrapper framework="blueprint" item={{id: 'resolved-state', label: 'Resolved state', required: true}} container={{}} context={{}} {...state}>
        <Input {...state}/>
    </ControlWrapper>);
    assert.ok(!html.includes('forge-required-input'), 'resolved unavailable controls must not be styled as editable required inputs');
}
console.log('resolved wrapper availability contract passed');

const iconActionHTML = renderToStaticMarkup(<Button className="forge-action-icon" icon="undo" hideLabel aria-label="Reset changes"/>);
assert.match(iconActionHTML,/class="forge-action-icon"/);
assert.match(iconActionHTML,/aria-label="Reset changes"/);
assert.ok(!/style="[^"]*(?:min-height|min-width|padding):/.test(iconActionHTML),'Icon class geometry must not be shadowed by field button inline defaults');

const lookupHTML = renderToStaticMarkup(<Input value="sample" item={{lookup: {dataSource: 'sample'}}}
    adapter={{set() {}}} data-forge-part="input" className="workspace-lookup" />);
assert.match(lookupHTML, /forge-text-lookup/);
assert.match(lookupHTML, /workspace-lookup/);
assert.ok(!lookupHTML.includes('background-color:'), 'Lookup defaults must remain CSS overrideable');
assert.match(lookupHTML, /aria-label="Open lookup"/);
console.log('lookup class and accessible action contract passed');
