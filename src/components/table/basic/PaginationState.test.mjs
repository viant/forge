import assert from "node:assert/strict";

import {canNavigateNext, compactPaginationStatusLabel, paginationStatusLabel, resolvePaginationState} from "./PaginationState.js";

assert.deepEqual(resolvePaginationState({
    info: {
        pageCount: 5,
        totalCount: 120,
    },
    inputPage: 3,
    fallbackPage: 1,
    inactive: false,
}), {
    currentPage: 3,
    totalPages: 5,
    recordCount: 120,
    hasMore: null,
    initialLoading: false,
});

assert.deepEqual(resolvePaginationState({
    info: {page: 2, pageSize: 20, returnedCount: 7, hasMore: false},
    inputPage: 2,
}), {
    currentPage: 2,
    totalPages: null,
    recordCount: null,
    hasMore: false,
    initialLoading: false,
});

assert.deepEqual(resolvePaginationState({
    info: {
        pageCount: 5,
        totalCount: 120,
    },
    inputPage: 99,
    fallbackPage: 1,
    inactive: false,
}), {
    currentPage: 5,
    totalPages: 5,
    recordCount: 120,
    hasMore: null,
    initialLoading: false,
});

assert.deepEqual(resolvePaginationState({
    info: {
        pageCount: 5,
        totalCount: 120,
    },
    inputPage: 4,
    fallbackPage: 2,
    inactive: true,
}), {
    currentPage: 1,
    totalPages: 5,
    recordCount: 120,
    hasMore: null,
    initialLoading: false,
});

assert.deepEqual(resolvePaginationState({
    info: {pageCount: 1, totalCount: 0, recordCount: 0},
    inputPage: 1,
    loading: true,
    loadedRowCount: 0,
}), {
    currentPage: 1,
    totalPages: null,
    recordCount: null,
    hasMore: null,
    initialLoading: true,
}, "initial loading must not expose provisional zero-count metadata");

assert.deepEqual(resolvePaginationState({
    info: {pageCount: 3, totalCount: 52},
    inputPage: 1,
    loading: true,
    loadedRowCount: 20,
}), {
    currentPage: 1,
    totalPages: 3,
    recordCount: 52,
    hasMore: null,
    initialLoading: false,
}, "a loaded-row refresh must retain the last authoritative pager state");

assert.equal(paginationStatusLabel({initialLoading: true, currentPage: 1, totalPages: 1, recordCount: 0}), "Loading records…");
assert.equal(paginationStatusLabel({currentPage: 1, totalPages: 1, recordCount: 0}), "Page 1 of 1 (0 records)");
assert.equal(paginationStatusLabel({currentPage: 2, totalPages: null, recordCount: null}), "Page 2");
assert.equal(compactPaginationStatusLabel({currentPage: 80, totalPages: 80, recordCount: 1595}), "80 / 80 · 1,595");

console.log("PaginationState ✓ derives stable pagination view state from collection info");

assert.equal(canNavigateNext({recordCount: 0, totalPages: null, currentPage: 1}), false);
assert.equal(canNavigateNext({initialLoading: true, hasMore: true, currentPage: 1}), false);
assert.equal(canNavigateNext({recordCount: 25, totalPages: null, currentPage: 1}), false);
assert.equal(canNavigateNext({recordCount: null, totalPages: null, currentPage: 1, hasMore: true}), true);
assert.equal(canNavigateNext({recordCount: null, totalPages: null, currentPage: 2, hasMore: false}), false);
assert.equal(canNavigateNext({recordCount: 25, totalPages: 1, currentPage: 1}), false);
