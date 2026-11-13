import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TableCell from './TableCell.jsx';

function cell(status, badge) {
    const row = {id: 1, status};
    const col = {id: 'status', name: 'Status', type: 'text', badge};
    return renderToStaticMarkup(<table><tbody><tr><TableCell context={{}} cell={{value: status, displayedText: status}} cellSelection={{row, col}}/></tr></tbody></table>);
}

const badge = {appearance: 'status', field: 'status', valueMap: {APPLIED: 'Applied'}, toneMap: {APPLIED: 'success'}, replaceValue: true};
const applied = cell('APPLIED', badge);
assert.match(applied, /class="forge-status-chip forge-table-status-chip"/);
assert.match(applied, /data-forge-status="success"/);
assert.match(applied, />Applied<\/span>/);
assert.doesNotMatch(applied, /forge-table-cell-badge/);
const unknown = cell('OTHER', badge);
assert.doesNotMatch(unknown, /forge-status-chip/);
assert.match(unknown, />OTHER<\/span>/);
const generic = cell('APPLIED', {...badge, appearance: undefined});
assert.match(generic, /forge-table-cell-badge/);
console.log('Table status chips use the shared semantic recipe; existing badges keep their appearance.');
