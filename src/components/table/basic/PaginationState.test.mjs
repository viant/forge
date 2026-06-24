import assert from "node:assert/strict";

import { resolvePaginationState } from "./PaginationState.js";

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
});

console.log("PaginationState ✓ derives stable pagination view state from collection info");
