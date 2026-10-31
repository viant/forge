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

for (const key of ['fluid', 'valid', 'grid', 'solid']) {
    const columns = [{key: 'prompt', label: 'Prompt'}, {key, label: key}, {key: 'west', label: 'West'}];
    assert.equal(frozenIdentifierColumn(columns)?.key, 'prompt', `${key} is not an identifier token`);
    assert.deepEqual(withFrozenIdentifierColumn(columns).map(column => column.key), ['prompt', key, 'west']);
    assert.equal(compactTableColumnWidth(columns[1]), 148, `${key} keeps the default width`);
}
for (const column of [{key: 'id'}, {key: 'campaignId'}, {key: 'campaignID'}, {key: 'campaign_id'}, {key: 'reference', label: 'Campaign ID'}]) {
    const columns = [{key: 'prompt'}, column, {key: 'west'}];
    assert.equal(frozenIdentifierColumn(columns), column, `${column.key} remains an inferred identifier`);
    assert.equal(compactTableColumnWidth(column), 96);
}
assert.deepEqual(withFrozenIdentifierColumn(explicit).map(column => column.key), ['label', 'code', 'reason'], 'Explicit frozen metadata wins');
const authored = [{key: 'west'}, {key: 'fluid'}, {key: 'prompt'}];
assert.deepEqual(withFrozenIdentifierColumn(authored).map(column => column.key), ['west', 'fluid', 'prompt'], 'Preserve a user-authored order without identifier metadata');

console.log('tableFrozenIdentifier ✓ selects and sizes stable frozen identifiers');
