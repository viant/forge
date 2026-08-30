import assert from 'node:assert/strict';
import { compactTableColumnWidth, frozenIdentifierColumn, withFrozenIdentifierColumn } from './tableFrozenIdentifier.js';

const dealColumns = [
    {key: 'deal_id', label: 'Deal ID'},
    {key: 'name', label: 'Deal'},
    {key: 'cost', label: 'Cost'},
    {key: 'reason', label: 'Rationale'},
];

assert.equal(frozenIdentifierColumn(dealColumns)?.key, 'name');
assert.deepEqual(withFrozenIdentifierColumn(dealColumns).map((column) => column.key), ['name', 'deal_id', 'cost', 'reason']);
assert.equal(compactTableColumnWidth(dealColumns[0]), 96);
assert.equal(compactTableColumnWidth(dealColumns[3]), 260);

const explicit = [{key: 'code'}, {key: 'label', frozen: true}, {key: 'reason'}];
assert.equal(frozenIdentifierColumn(explicit)?.key, 'label');

console.log('tableFrozenIdentifier ✓ selects and sizes stable frozen identifiers');
