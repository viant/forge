import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveClientPagination, usesClientPaginationInfo} from './clientPagination.js';
import {resolvePaginationState, canNavigateNext} from './basic/PaginationState.js';

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

// Filtering two visible rows on page 1 must not replace the server's four pages.
const serverInfo = {pageCount: 4, recordCount: 100};
const filteredRows = rows.slice(0, 2);
const clientCounts = usesClientPaginationInfo({filterMode: 'client', pagingEnabled: true, clientPagination: false});
assert.equal(clientCounts, false);
const info = clientCounts ? resolveClientPagination(filteredRows, 1, 25, true) : serverInfo;
const state = resolvePaginationState({info, inputPage: 1, loadedRowCount: filteredRows.length});
assert.equal(state.totalPages, 4);
assert.equal(canNavigateNext(state), true);
assert.equal(usesClientPaginationInfo({filterMode: 'client', pagingEnabled: true, clientPagination: true}), true);
assert.equal(resolveClientPagination(filteredRows, 1, 25, true).recordCount, 2);
assert.equal(resolveClientPagination(filteredRows, 1, 25, true).pageCount, 1);
assert.equal(usesClientPaginationInfo({filterMode: 'client', pagingEnabled: false}), true);
