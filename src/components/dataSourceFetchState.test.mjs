import assert from "node:assert/strict";

import {
    beginDataSourceFetch,
    reconcileRestoredPendingFetch,
    recoverInterruptedFetchOnMount,
    resolveFetchPage,
    resolveRestoredPendingFetch,
    shouldReplayPendingFetchOnMount,
    snapshotFilter,
    withFetchedPageInfo,
} from "./dataSourceFetchState.js";

const begunRefresh = beginDataSourceFetch({loading: false, loaded: true, error: new Error('old'), stale: true});
assert.deepEqual(begunRefresh, {loading: true, loaded: false, error: null, stale: false});
assert.deepEqual(
    recoverInterruptedFetchOnMount({}, {fetch: false}, begunRefresh, true),
    {input: {fetch: true, refresh: false}, control: {loading: false, loaded: false, error: null, stale: true}},
    "an interrupted refresh must be replayable after a responsive target remount",
);

assert.equal(shouldReplayPendingFetchOnMount({}, true), true);
assert.equal(shouldReplayPendingFetchOnMount({replayPendingFetchOnRestore: false}, true), false);
assert.equal(shouldReplayPendingFetchOnMount({replayPendingFetchOnRestore: false}, false), true);

assert.deepEqual(
    resolveRestoredPendingFetch(
        {replayPendingFetchOnRestore: false},
        {fetch: true, parameters: {AudienceId: 7396187}, __forgeRestoredPendingFetch: true},
    ),
    {fetch: false, refresh: false, parameters: {AudienceId: 7396187}},
    "a responsive datasource instance must suppress a restored stale request even when it did not remount",
);
assert.deepEqual(
    resolveRestoredPendingFetch(
        {},
        {fetch: true, parameters: {Id: 7396187}, __forgeRestoredPendingFetch: true},
    ),
    {fetch: true, refresh: false, parameters: {Id: 7396187}},
    "ordinary readers must still replay restored requests after the restore marker is consumed",
);
assert.equal(resolveRestoredPendingFetch({}, {fetch: true}), null);

assert.deepEqual(
    reconcileRestoredPendingFetch(
        {replayPendingFetchOnRestore: false},
        {fetch: true, parameters: {AudienceId: 7396187}, __forgeRestoredPendingFetch: true},
        {loading: true, loaded: false},
    ),
    {
        input: {fetch: false, refresh: false, parameters: {AudienceId: 7396187}},
        control: {loading: false, loaded: false, stale: false},
    },
    "suppressing a restored request must also settle its orphaned loading state",
);
assert.deepEqual(
    recoverInterruptedFetchOnMount({}, {fetch: false, page: 1}, {loading: true, loaded: false}, true),
    {input: {fetch: true, page: 1, refresh: false}, control: {loading: false, loaded: false, stale: true}},
    "an interrupted reader clears stale loading and replays after remount",
);
assert.deepEqual(
    recoverInterruptedFetchOnMount(
        {replayPendingFetchOnRestore: false},
        {fetch: true, __forgeRestoredPendingFetch: true},
        {loading: true},
        true,
    ),
    {input: {fetch: false, refresh: false}, control: {loading: false, stale: false}},
    "an interrupted mutation clears stale loading without replaying a write",
);
assert.deepEqual(
    recoverInterruptedFetchOnMount(
        {replayPendingFetchOnRestore: false},
        {fetch: true, parameters: {Id: 7396187}},
        {loading: true},
        true,
    ),
    {
        input: {fetch: true, refresh: false, parameters: {Id: 7396187}},
        control: {loading: false, stale: true},
    },
    "orphaned loading recovery must preserve one fresh required-parameter rebound fetch",
);
assert.equal(recoverInterruptedFetchOnMount({}, {fetch: true}, {loading: false}, true), null);
assert.deepEqual(
    recoverInterruptedFetchOnMount({}, {fetch: false}, {loading: true, loaded: true}, true),
    {input: {fetch: true, refresh: false}, control: {loading: false, loaded: true, stale: true}},
    "a remounted reader with prior rows must clear and replay an orphaned loading state",
);

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

assert.deepEqual(withFetchedPageInfo({}, 1, true, {
    returnedCount: 20,
    pageSize: 20,
}), {
    currentPage: 1,
    page: 1,
    returnedCount: 20,
    pageSize: 20,
    hasPrevious: false,
    hasNext: true,
    hasMore: true,
});

assert.deepEqual(withFetchedPageInfo({pageCount: 1, totalCount: 0}, 1, true, {
    returnedCount: 7,
    pageSize: 20,
}), {
    currentPage: 1,
    page: 1,
    returnedCount: 7,
    pageSize: 20,
    hasPrevious: false,
    hasNext: false,
    hasMore: false,
});

assert.deepEqual(withFetchedPageInfo({pageCount: 1, totalCount: 100}, 1, true, {
    returnedCount: 100,
    pageSize: 100,
    openEnded: true,
}), {
    currentPage: 1,
    page: 1,
    returnedCount: 100,
    pageSize: 100,
    hasPrevious: false,
    hasNext: true,
    hasMore: true,
});

console.log("dataSourceFetchState ✓ stabilizes filter snapshots and paging metadata");
