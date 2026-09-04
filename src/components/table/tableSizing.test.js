import assert from 'node:assert/strict';

import {preserveDeclaredColumnWidths, scrollableTableWidth, tableBackfillCount, withStickyColumnOffsets} from './tableSizing.js';

const columns = preserveDeclaredColumnWidths([{id: 'id', width: 90}, {id: 'name', width: 320}, {id: 'type', width: 150}]);
assert.deepEqual(columns.map((column) => column.minWidth), ['90px', '320px', '150px']);
assert.equal(scrollableTableWidth(columns, 500), 560);
assert.equal(scrollableTableWidth(columns, 800), 800);
assert.equal(tableBackfillCount(25, 4, false), 0);
assert.equal(tableBackfillCount(25, 4, true), 21);
assert.equal(tableBackfillCount(25, 0, false), 1);
const sticky = withStickyColumnOffsets(preserveDeclaredColumnWidths([
  {id: 'select', width: 42, sticky: 'left'},
  {id: 'id', width: 88, sticky: 'left'},
  {id: 'name', width: 280, sticky: 'left'},
  {id: 'spend', width: 120},
]));
assert.deepEqual(sticky.map((column) => column.stickyOffset), [0, 42, 130, undefined]);
assert.deepEqual(sticky.map((column) => column.stickyEdge), [false, false, true, false]);

console.log('tableSizing ✓');
