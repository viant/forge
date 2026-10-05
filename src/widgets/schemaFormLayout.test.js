import assert from 'node:assert/strict';

import {
    SCHEMA_FORM_FIELD_TRACKS_APPEARANCE,
    resolveSchemaFormAppearance,
    resolveSchemaFormFieldTracksLayout,
    schemaFormAttributes,
} from './schemaFormLayout.js';

assert.equal(SCHEMA_FORM_FIELD_TRACKS_APPEARANCE, 'field-tracks');
assert.equal(resolveSchemaFormAppearance(), '');
assert.equal(resolveSchemaFormAppearance({appearance: ' FIELD-TRACKS '}), 'field-tracks');
assert.equal(resolveSchemaFormAppearance({appearance: 'cards'}), '');

assert.equal(resolveSchemaFormFieldTracksLayout(), null);
assert.equal(resolveSchemaFormFieldTracksLayout({kind: 'grid'}), null);
assert.equal(resolveSchemaFormFieldTracksLayout({kind: 'flow', appearance: 'field-tracks'}), null);

assert.deepEqual(
    resolveSchemaFormFieldTracksLayout({kind: ' GRID ', appearance: ' FIELD-TRACKS ', columns: 5}),
    {
        kind: 'grid',
        appearance: 'field-tracks',
        columns: 5,
        dense: false,
        collapseAt: undefined,
        labels: {mode: 'top'},
    },
);

const authored = resolveSchemaFormFieldTracksLayout({
    kind: 'grid',
    appearance: 'field-tracks',
    columns: 99,
    collapseAt: ' PHONE ',
    rowGap: 'var(--space-row)',
    labels: {mode: ' LEFT ', align: 'center', width: '8rem'},
});
assert.equal(authored.columns, 12);
assert.equal(authored.collapseAt, 'phone');
assert.equal(authored.dense, false);
assert.equal(authored.rowGap, 'var(--space-row)');
assert.deepEqual(authored.labels, {mode: 'left', align: 'center', width: '8rem'});

const invalidOptions = resolveSchemaFormFieldTracksLayout({
    kind: 'grid',
    appearance: 'field-tracks',
    columns: 0,
    collapseAt: 'tablet',
    labels: {mode: 'beside'},
});
assert.equal(invalidOptions.columns, 1);
assert.equal(invalidOptions.collapseAt, undefined);
assert.equal(invalidOptions.labels.mode, 'top');

assert.deepEqual(schemaFormAttributes(), {'data-forge-part': 'form'});
assert.deepEqual(
    schemaFormAttributes({appearance: ' field-tracks '}),
    {'data-forge-part': 'form', 'data-forge-form-appearance': 'field-tracks'},
);

console.log('schema form field-tracks layout contract passed');
