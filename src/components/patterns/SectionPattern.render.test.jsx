import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SectionPattern} from './index.js';

const primary = renderToStaticMarkup(
    <SectionPattern title="Plan essentials" appearance="primary" contentInset="flush" collapsible={false}>
        <p>Campaign details</p>
    </SectionPattern>,
);
assert.match(primary, /data-forge-component="section"/);
assert.match(primary, /data-forge-section-appearance="primary"/);
assert.match(primary, /data-forge-section-content-inset="flush"/);
assert.match(primary, /Plan essentials/);
assert.match(primary, /Campaign details/);
assert.doesNotMatch(primary, /\sappearance=|\scontentInset=/);

const quiet = renderToStaticMarkup(
    <SectionPattern title="Context" appearance="quiet" collapsible={false}>Supporting copy</SectionPattern>,
);
assert.match(quiet, /data-forge-section-appearance="quiet"/);
assert.doesNotMatch(quiet, /data-forge-section-content-inset=/);

assert.throws(() => renderToStaticMarkup(<SectionPattern appearance="loud" />), /Unsupported section appearance/);
assert.throws(() => renderToStaticMarkup(<SectionPattern contentInset="wide" />), /Unsupported section content inset/);

console.log('SectionPattern public API renders semantic appearance and inset attributes.');
