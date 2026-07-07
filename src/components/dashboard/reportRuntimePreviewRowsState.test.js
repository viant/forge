import assert from "node:assert/strict";

import {
  buildIdleReportRuntimePreviewRowsState,
  buildPendingReportRuntimePreviewRowsState,
  buildRejectedReportRuntimePreviewRowsState,
  buildResolvedReportRuntimePreviewRowsState,
  buildUnavailableReportRuntimePreviewRowsState,
  hasReportRuntimePreviewRowsStateValue,
  resolveReportRuntimePreviewRowsStateTransition,
} from "./reportRuntimePreviewRowsState.js";

assert.deepEqual(buildIdleReportRuntimePreviewRowsState(), {
  fingerprint: "",
  requestKey: "",
  rows: [],
  hasMore: false,
  loading: false,
  error: null,
});

assert.equal(hasReportRuntimePreviewRowsStateValue({}), false);
assert.equal(hasReportRuntimePreviewRowsStateValue({
  fingerprint: "runtime::1",
}), true);

assert.deepEqual(buildPendingReportRuntimePreviewRowsState({
  fingerprint: "runtime::1",
  requestKey: "runtime::1::0",
  currentState: {
    fingerprint: "runtime::1",
    requestKey: "runtime::1::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
  },
}), {
  fingerprint: "runtime::1",
  requestKey: "runtime::1::0",
  rows: [{ channelV2: "Display" }],
  hasMore: true,
  loading: true,
  error: null,
});

assert.deepEqual(buildPendingReportRuntimePreviewRowsState({
  fingerprint: "runtime::2",
  requestKey: "runtime::2::0",
  currentState: {
    fingerprint: "runtime::1",
    requestKey: "runtime::1::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
  },
}), {
  fingerprint: "runtime::2",
  requestKey: "runtime::2::0",
  rows: [{ channelV2: "Display" }],
  hasMore: true,
  loading: true,
  error: null,
});

assert.deepEqual(buildResolvedReportRuntimePreviewRowsState({
  fingerprint: "runtime::1",
  requestKey: "runtime::1::0",
  rows: [{ channelV2: "Display" }],
  hasMore: true,
}), {
  fingerprint: "runtime::1",
  requestKey: "runtime::1::0",
  rows: [{ channelV2: "Display" }],
  hasMore: true,
  loading: false,
  error: null,
});

assert.deepEqual(buildRejectedReportRuntimePreviewRowsState({
  fingerprint: "runtime::1",
  requestKey: "runtime::1::0",
  currentState: {
    fingerprint: "runtime::1",
    requestKey: "runtime::1::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
  },
  error: new Error("preview fetch failed"),
}), {
  fingerprint: "runtime::1",
  requestKey: "runtime::1::0",
  rows: [{ channelV2: "Display" }],
  hasMore: true,
  loading: false,
  error: new Error("preview fetch failed"),
});

assert.deepEqual(buildUnavailableReportRuntimePreviewRowsState({
  fingerprint: "runtime::2",
  requestKey: "runtime::2::0",
  error: new Error("Runtime preview fetch is unavailable for this data source."),
}), {
  fingerprint: "runtime::2",
  requestKey: "runtime::2::0",
  rows: [],
  hasMore: false,
  loading: false,
  error: new Error("Runtime preview fetch is unavailable for this data source."),
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: false,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::1",
  requestKey: "runtime::1::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "runtime::1",
    requestKey: "runtime::1::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
    loading: false,
    error: null,
  },
}), {
  type: "reset",
  nextState: buildIdleReportRuntimePreviewRowsState(),
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::2",
  requestKey: "runtime::2::0",
  fetchAvailable: false,
  currentState: {},
  unavailableError: new Error("Runtime preview fetch is unavailable for this data source."),
}), {
  type: "unavailable",
  nextState: buildUnavailableReportRuntimePreviewRowsState({
    fingerprint: "runtime::2",
    requestKey: "runtime::2::0",
    error: new Error("Runtime preview fetch is unavailable for this data source."),
  }),
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::3",
  requestKey: "runtime::3::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "runtime::3",
    requestKey: "runtime::3::0",
    rows: [{ channelV2: "Display" }],
    hasMore: false,
    loading: true,
    error: null,
  },
}), {
  type: "noop",
  nextState: {
    fingerprint: "runtime::3",
    requestKey: "runtime::3::0",
    rows: [{ channelV2: "Display" }],
    hasMore: false,
    loading: true,
    error: null,
  },
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::4",
  requestKey: "runtime::4::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "runtime::4",
    requestKey: "runtime::4::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
    loading: false,
    error: null,
  },
}), {
  type: "noop",
  nextState: {
    fingerprint: "runtime::4",
    requestKey: "runtime::4::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
    loading: false,
    error: null,
  },
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::4-empty",
  requestKey: "runtime::4-empty::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "runtime::4-empty",
    requestKey: "runtime::4-empty::0",
    rows: [],
    hasMore: false,
    loading: false,
    error: null,
  },
}), {
  type: "noop",
  nextState: {
    fingerprint: "runtime::4-empty",
    requestKey: "runtime::4-empty::0",
    rows: [],
    hasMore: false,
    loading: false,
    error: null,
  },
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::5",
  requestKey: "runtime::5::0",
  fetchAvailable: false,
  currentState: {
    fingerprint: "runtime::5",
    requestKey: "runtime::5::0",
    rows: [],
    hasMore: false,
    loading: false,
    error: new Error("Runtime preview fetch is unavailable for this data source."),
  },
  unavailableError: new Error("Runtime preview fetch is unavailable for this data source."),
}), {
  type: "noop",
  nextState: {
    fingerprint: "runtime::5",
    requestKey: "runtime::5::0",
    rows: [],
    hasMore: false,
    loading: false,
    error: new Error("Runtime preview fetch is unavailable for this data source."),
  },
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::6",
  requestKey: "runtime::6::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "runtime::old",
    requestKey: "runtime::old::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
    loading: false,
    error: null,
  },
}), {
  type: "start",
  nextState: {
    fingerprint: "runtime::6",
    requestKey: "runtime::6::0",
    rows: [{ channelV2: "Display" }],
    hasMore: true,
    loading: true,
    error: null,
  },
});

assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::7",
  requestKey: "runtime::7::1",
  fetchAvailable: true,
  currentState: {
    fingerprint: "runtime::7",
    requestKey: "runtime::7::0",
    rows: [],
    hasMore: false,
    loading: false,
    error: new Error("preview fetch failed"),
  },
}), {
  type: "start",
  nextState: buildPendingReportRuntimePreviewRowsState({
    fingerprint: "runtime::7",
    requestKey: "runtime::7::1",
    currentState: {
      fingerprint: "runtime::7",
      requestKey: "runtime::7::0",
      rows: [],
      hasMore: false,
      loading: false,
      error: new Error("preview fetch failed"),
    },
  }),
});

// First-drill transition: the hook was disabled (resolved-collection preview mode)
// and has never fetched, so currentState is idle. The caller-supplied seed rows
// (the previously visible resolved-collection rows) must be retained instead of
// collapsing to empty while the first drill request is in flight.
assert.deepEqual(buildPendingReportRuntimePreviewRowsState({
  fingerprint: "runtime::first-drill",
  requestKey: "runtime::first-drill::0",
  currentState: buildIdleReportRuntimePreviewRowsState(),
  seedRows: [{ channelV2: "Display" }, { channelV2: "CTV" }],
  seedHasMore: true,
}), {
  fingerprint: "runtime::first-drill",
  requestKey: "runtime::first-drill::0",
  rows: [{ channelV2: "Display" }, { channelV2: "CTV" }],
  hasMore: true,
  loading: true,
  error: null,
});

// Once the hook has already fetched at least once, prior fetched rows win over the
// seed even if a seed is still supplied (e.g. a second drill after the first).
assert.deepEqual(buildPendingReportRuntimePreviewRowsState({
  fingerprint: "runtime::second-drill",
  requestKey: "runtime::second-drill::0",
  currentState: {
    fingerprint: "runtime::first-drill",
    requestKey: "runtime::first-drill::0",
    rows: [{ channelV2: "Drilled Display" }],
    hasMore: false,
  },
  seedRows: [{ channelV2: "Should Not Be Used" }],
  seedHasMore: true,
}), {
  fingerprint: "runtime::second-drill",
  requestKey: "runtime::second-drill::0",
  rows: [{ channelV2: "Drilled Display" }],
  hasMore: false,
  loading: true,
  error: null,
});

// With no seed supplied, the first-drill transition falls back to empty rows
// (unchanged default behavior when no resolved-collection rows exist yet).
assert.deepEqual(buildPendingReportRuntimePreviewRowsState({
  fingerprint: "runtime::first-drill-no-seed",
  requestKey: "runtime::first-drill-no-seed::0",
  currentState: buildIdleReportRuntimePreviewRowsState(),
}), {
  fingerprint: "runtime::first-drill-no-seed",
  requestKey: "runtime::first-drill-no-seed::0",
  rows: [],
  hasMore: false,
  loading: true,
  error: null,
});

// End-to-end transition: disabling the hook (resolved-collection mode) resets to
// idle, then the first drill flips enabled=true and must seed the pending state
// from the previously visible resolved-collection rows.
assert.deepEqual(resolveReportRuntimePreviewRowsStateTransition({
  enabled: true,
  canRun: true,
  hasModel: true,
  hasRequest: true,
  fingerprint: "runtime::first-drill",
  requestKey: "runtime::first-drill::0",
  fetchAvailable: true,
  currentState: buildIdleReportRuntimePreviewRowsState(),
  seedRows: [{ channelV2: "Display" }],
  seedHasMore: false,
}), {
  type: "start",
  nextState: {
    fingerprint: "runtime::first-drill",
    requestKey: "runtime::first-drill::0",
    rows: [{ channelV2: "Display" }],
    hasMore: false,
    loading: true,
    error: null,
  },
});

console.log("reportRuntimePreviewRowsState ✓ models authored runtime preview fetch state transitions deterministically");
console.log("reportRuntimePreviewRowsState ✓ seeds the first-drill pending state from resolved-collection rows instead of collapsing to empty");
