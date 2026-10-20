import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';

const Checkbox = getWidget('checkbox');
for (const disabled of [false, true]) for (const readOnly of [false, true]) {
    const node = Checkbox({id: 'checked-field', 'aria-label': 'Apply field', value: true, disabled, readOnly, className: 'custom-skin'});
    assert.equal(node.props.disabled, disabled || readOnly);
    assert.equal(node.props.checked, true);
    assert.equal(node.props['aria-label'], 'Apply field');
    assert.match(node.props.className, /custom-skin/);
    const markup = renderToStaticMarkup(node);
    assert.equal(/<input[^>]*disabled/.test(markup), disabled || readOnly, markup);
}
let changed;
const enabled = Checkbox({value: false, onChange: value => { changed = value; }});
enabled.props.onChange({target: {checked: true}});
assert.equal(changed, true);
console.log('PASS: checkbox preserves disabled/readOnly independently, checked value, accessibility, class and change behavior');
