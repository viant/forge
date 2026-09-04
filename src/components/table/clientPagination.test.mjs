import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveClientPagination} from './clientPagination.js';

const rows = Array.from({length: 8}, (_, index) => ({id: index + 1}));
assert.deepEqual(resolveClientPagination(rows, 1, 5, true), {
  rows: rows.slice(0, 5), page: 1, pageCount: 2, recordCount: 8,
});
assert.deepEqual(resolveClientPagination(rows, 2, 5, true), {
  rows: rows.slice(5), page: 2, pageCount: 2, recordCount: 8,
});
assert.equal(resolveClientPagination(rows, 99, 5, true).page, 2);
assert.strictEqual(resolveClientPagination(rows, 1, 5, false).rows, rows);
const model = fs.readFileSync(new URL('../../../backend/types/model.go', import.meta.url), 'utf8');
assert.match(model, /PaginationMode\s+string\s+`json:"paginationMode,omitempty"/);
console.log('client pagination ✓ opt-in slicing and page clamping');
