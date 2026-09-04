import assert from "node:assert/strict";

import {canNavigateNext, resolvePaginationState} from "./PaginationState.js";

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
});

assert.deepEqual(resolvePaginationState({
    info: {page: 2, pageSize: 20, returnedCount: 7, hasMore: false},
    inputPage: 2,
}), {
    currentPage: 2,
    totalPages: null,
    recordCount: null,
    hasMore: false,
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
});

console.log("PaginationState ✓ derives stable pagination view state from collection info");

assert.equal(canNavigateNext({recordCount: 0, totalPages: null, currentPage: 1}), false);
assert.equal(canNavigateNext({recordCount: 25, totalPages: null, currentPage: 1}), false);
assert.equal(canNavigateNext({recordCount: null, totalPages: null, currentPage: 1, hasMore: true}), true);
assert.equal(canNavigateNext({recordCount: null, totalPages: null, currentPage: 2, hasMore: false}), false);
assert.equal(canNavigateNext({recordCount: 25, totalPages: 1, currentPage: 1}), false);
