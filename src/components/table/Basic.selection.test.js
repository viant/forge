import assert from 'node:assert/strict';

import { reconcileConfiguredColumns, resolveTableColumnsForSelection } from './Basic.jsx';

const baseColumns = [
  { id: 'adOrderId', name: 'Order ID' },
  { id: 'adOrderName', name: 'Ad Order' },
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

const reconciled = reconcileConfiguredColumns(
  [
    { id: 'adOrderId', width: 123, visible: true },
    { id: 'adOrderName', width: 321, visible: true },
  ],
  multi,
);
assert.equal(reconciled[0].id, '__select__');
assert.equal(reconciled[0].multiSelect, true);
assert.equal(reconciled[1].width, 123);
assert.equal(reconciled[2].width, 321);

console.log('Basic selection columns ✓ multi-select checkbox column injection');
