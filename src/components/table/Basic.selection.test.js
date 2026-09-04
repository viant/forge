import assert from 'node:assert/strict';

import { reconcileConfiguredColumns, resolveTableColumnsForSelection } from './Basic.jsx';

const baseColumns = [
  { id: 'recordId', name: 'Record ID' },
  { id: 'recordName', name: 'Record' },
];

const single = resolveTableColumnsForSelection(baseColumns, { dataSource: { selectionMode: 'single' } });
assert.deepEqual(single, baseColumns);

const multi = resolveTableColumnsForSelection(baseColumns, { dataSource: { selectionMode: 'multi' } });
assert.equal(multi[0].id, '__select__');
assert.equal(multi[0].type, 'checkbox');
assert.equal(multi[0].multiSelect, true);
assert.equal(multi.length, 3);

const alreadyExplicit = resolveTableColumnsForSelection([
  { id: '__pick__', type: 'checkbox', multiSelect: true },
  ...baseColumns,
], { dataSource: { selectionMode: 'multi' } });
assert.equal(alreadyExplicit.length, 3);
assert.equal(alreadyExplicit[0].id, '__pick__');

const permissionHidden = resolveTableColumnsForSelection([
  { id: '__pick__', type: 'checkbox', multiSelect: true },
  ...baseColumns,
], { dataSource: { selectionMode: 'multi' } }, false);
assert.deepEqual(permissionHidden, baseColumns);

const reconciled = reconcileConfiguredColumns(
  [
    { id: 'recordId', width: 123, visible: true },
    { id: 'recordName', width: 321, visible: true },
  ],
  multi,
);
assert.equal(reconciled[0].id, '__select__');
assert.equal(reconciled[0].multiSelect, true);
assert.equal(reconciled[1].width, 123);
assert.equal(reconciled[2].width, 321);
assert.equal(reconciled[1].type, baseColumns[0].type);


console.log('Basic selection columns ✓ multi-select checkbox column injection');
