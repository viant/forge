import assert from "node:assert/strict";

import {
    resolveFetchPage,
    snapshotFilter,
    withFetchedPageInfo,
} from "./dataSourceFetchState.js";

assert.deepEqual(snapshotFilter({
    b: 2,
    a: {
        d: 4,
        c: 3,
    },
}), {
    a: {
        c: 3,
        d: 4,
    },
    b: 2,
});

assert.equal(resolveFetchPage({
    page: 4,
    filter: { market: "north" },
    previousFilter: snapshotFilter({ market: "north" }),
    pagingEnabled: true,
}), 4);

assert.equal(resolveFetchPage({
    page: 4,
    filter: { market: "south" },
    previousFilter: snapshotFilter({ market: "north" }),
    pagingEnabled: true,
}), 1);

assert.deepEqual(withFetchedPageInfo({
    pageCount: 7,
    totalCount: 132,
}, 3, true), {
    pageCount: 7,
    totalPages: 7,
    totalCount: 132,
    recordCount: 132,
    currentPage: 3,
    page: 3,
    hasPrevious: true,
    hasNext: true,
    hasMore: true,
});

assert.deepEqual(withFetchedPageInfo({}, 2, false), {});

console.log("dataSourceFetchState ✓ stabilizes filter snapshots and paging metadata");
