import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import TableBackfill from './TableBackfill.jsx';

const context = {
    signals: {
        control: {value: {loading: false, error: {message: 'This data is temporarily unavailable. Retry in a moment.'}}},
    },
};
const html = renderToStaticMarkup(
    <table><tbody><TableBackfill context={context} rowCount={1} colSpan={4} collection={[]}/></tbody></table>,
);

assert.match(html, /colSpan="4"/);
assert.match(html, /table-state-message/);
assert.match(html, /role="alert"/);
assert.match(html, /temporarily unavailable/);
assert.doesNotMatch(html, /No data\./);
assert.doesNotMatch(html, /<td><\/td>/);

console.log('table backfill responsive status row passed');
