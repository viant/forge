import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Icon from './Icon.jsx';

// Independently authored neutral geometry; no application asset dependency.
const geometry = {viewBox: [0, 0, 24, 24], paths: ['M3 4L18 4L10 19Z'], rects: [{x: 4, y: 5, width: 6, height: 7, rx: 1}]};
const render = props => renderToStaticMarkup(<Icon {...props}/>);
const stroke = render({iconSvg: geometry, className: 'example-icon'});
assert.match(stroke, /viewBox="0 0 24 24"/);
assert.match(stroke, /fill="none" stroke="currentColor"/);
assert.match(stroke, /class="forge-icon example-icon"/);
assert.match(stroke, /aria-hidden="true"/);
assert.match(stroke, /<rect[^>]*rx="1"/);
const filled = render({iconSvg: {...geometry, fill: 'currentColor', stroke: 'none'}, label: 'Example shape'});
assert.match(filled, /fill="currentColor" stroke="none"/);
assert.match(filled, /role="img" aria-label="Example shape"/);
assert.doesNotMatch(filled, /aria-hidden/);
const unsafe = render({iconSvg: {...geometry, onload: 'unsafe', rects: [{...geometry.rects[0], onload: 'unsafe'}]}});
assert.doesNotMatch(unsafe, /onload|unsafe/);
for (const iconSvg of [
    {viewBox: [0, 0, 0, 24], paths: ['M1 1']},
    {viewBox: [0, 0, 24, Infinity], paths: ['M1 1']},
    {...geometry, paths: ['<image href="https://example.invalid/a"/>']},
    {...geometry, paths: ['url(https://example.invalid/a)']},
    {...geometry, paths: ['M'.repeat(8193)]},
    {...geometry, paths: Array(33).fill('M1 1')},
    {...geometry, rects: [{x: 0, y: 0, width: -1, height: 1}]},
    {...geometry, fill: 'url(https://example.invalid/a)'},
    {...geometry, stroke: '#123456'},
    {viewBox: [0, 0, 24, 24]},
]) assert.equal(render({iconSvg}), '', 'Invalid drawing metadata must not render an icon');
assert.match(render({name: 'lucide:check', iconSvg: geometry}), /lucide-check/);
assert.match(render({name: 'document', iconSvg: geometry}), /bp6-icon-document/);
assert.throws(() => render({name: 'lucide:not-an-icon'}), /Unsupported icon/);
console.log('shared drawing-only icons, accessibility and named-icon compatibility passed');
