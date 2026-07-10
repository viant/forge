import assert from "node:assert/strict";

import {
    matchesReportBuilderRuntimePreviewDispatch,
    resolveReportBuilderRuntimePreviewRowsSource,
} from "./reportBuilderRuntimePreviewSource.js";

assert.equal(matchesReportBuilderRuntimePreviewDispatch('{"dimensions":{"country":true}}::fetch', '{"dimensions":{"country":true}}'), true);
assert.equal(matchesReportBuilderRuntimePreviewDispatch('{"dimensions":{"country":true}}::hold', '{"dimensions":{"country":true}}'), true);
assert.equal(matchesReportBuilderRuntimePreviewDispatch('{"dimensions":{"country":true}}::fetch', '{"dimensions":{"region":true}}'), false);

const collectionSource = resolveReportBuilderRuntimePreviewRowsSource({
    currentRequestFingerprint: '{"dimensions":{"country":true}}',
    requestDispatchFingerprint: '{"dimensions":{"country":true}}::fetch',
    currentRequestShouldFetch: true,
    runtimePreviewFingerprint: '{"dimensions":{"country":true}}',
    collection: [
        { country: "CA", avails: 1200000 },
        { country: "WA", avails: 980000 },
    ],
    collectionInfo: { hasMore: false },
    loading: false,
    error: null,
    fetchedRows: [{ country: "US", avails: 153100 }],
    fetchedHasMore: true,
    fetchedError: new Error("stale runtime preview"),
    fetchedLoading: true,
});
assert.deepEqual(collectionSource, {
    source: "collection",
    rows: [
        { country: "CA", avails: 1200000 },
        { country: "WA", avails: 980000 },
    ],
    hasMore: false,
    error: null,
    loading: false,
});

const loadingFallbackSource = resolveReportBuilderRuntimePreviewRowsSource({
    currentRequestFingerprint: '{"dimensions":{"country":true}}',
    requestDispatchFingerprint: '{"dimensions":{"country":true}}::fetch',
    currentRequestShouldFetch: true,
    runtimePreviewFingerprint: '{"dimensions":{"country":true}}',
    collection: [{ country: "CA", avails: 1200000 }],
    loading: true,
    fetchedRows: [{ country: "US", avails: 153100 }],
    fetchedHasMore: false,
    fetchedError: null,
    fetchedLoading: true,
});
assert.deepEqual(loadingFallbackSource, {
    source: "runtimePreview",
    rows: [{ country: "US", avails: 153100 }],
    hasMore: false,
    error: null,
    loading: true,
});

const manualRunCollectionSource = resolveReportBuilderRuntimePreviewRowsSource({
    currentRequestFingerprint: '{"dimensions":{"country":true}}',
    requestDispatchFingerprint: '{"dimensions":{"country":true}}::fetch',
    currentRequestShouldFetch: false,
    runtimePreviewFingerprint: '{"dimensions":{"country":true}}',
    hasCompletedCurrentRun: true,
    collection: [{ country: "CA", avails: 1200000 }],
    collectionInfo: { hasMore: true },
    loading: false,
    error: null,
    fetchedRows: [{ country: "US", avails: 153100 }],
    fetchedHasMore: false,
    fetchedError: null,
    fetchedLoading: false,
});
assert.deepEqual(manualRunCollectionSource, {
    source: "collection",
    rows: [{ country: "CA", avails: 1200000 }],
    hasMore: true,
    error: null,
    loading: false,
});

const mismatchedRequestSource = resolveReportBuilderRuntimePreviewRowsSource({
    currentRequestFingerprint: '{"dimensions":{"country":true}}',
    requestDispatchFingerprint: '{"dimensions":{"country":true}}::fetch',
    currentRequestShouldFetch: true,
    runtimePreviewFingerprint: '{"dimensions":{"region":true}}',
    collection: [{ country: "CA", avails: 1200000 }],
    loading: false,
    error: null,
    fetchedRows: [{ region: "West", avails: 2180000 }],
    fetchedHasMore: false,
    fetchedError: null,
    fetchedLoading: false,
});
assert.deepEqual(mismatchedRequestSource, {
    source: "runtimePreview",
    rows: [{ region: "West", avails: 2180000 }],
    hasMore: false,
    error: null,
    loading: false,
});

const fetchedRowsPreferredOverEmptyCollectionSource = resolveReportBuilderRuntimePreviewRowsSource({
    currentRequestFingerprint: '{"dimensions":{"country":true}}',
    requestDispatchFingerprint: '{"dimensions":{"country":true}}::fetch',
    currentRequestShouldFetch: true,
    runtimePreviewFingerprint: '{"dimensions":{"country":true}}',
    collection: [],
    collectionInfo: { hasMore: false },
    loading: false,
    error: null,
    fetchedRows: [{ country: "US", avails: 153100 }],
    fetchedHasMore: false,
    fetchedError: null,
    fetchedLoading: false,
});
assert.deepEqual(fetchedRowsPreferredOverEmptyCollectionSource, {
    source: "runtimePreview",
    rows: [{ country: "US", avails: 153100 }],
    hasMore: false,
    error: null,
    loading: false,
});

const authoredRuntimeFetchedRowsPreferredOverVisibleCollectionSource = resolveReportBuilderRuntimePreviewRowsSource({
    currentRequestFingerprint: '{"dimensions":{"channelV2":true}}',
    requestDispatchFingerprint: '{"dimensions":{"channelV2":true}}::fetch',
    currentRequestShouldFetch: true,
    runtimePreviewFingerprint: '{"dimensions":{"channelV2":true}}',
    preferFetchedRows: true,
    collection: [
        { record: { avails: 1200000, channelV2: 6 } },
    ],
    collectionInfo: { hasMore: false },
    loading: false,
    error: null,
    fetchedRows: [{ avails: 115912068055, channelV2: 6 }],
    fetchedHasMore: false,
    fetchedError: null,
    fetchedLoading: false,
});
assert.deepEqual(authoredRuntimeFetchedRowsPreferredOverVisibleCollectionSource, {
    source: "runtimePreview",
    rows: [{ avails: 115912068055, channelV2: 6 }],
    hasMore: false,
    error: null,
    loading: false,
});

console.log("reportBuilderRuntimePreviewSource ✓ reuses visible result rows only when the compiled runtime request matches the current builder request");
