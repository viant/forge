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
  nextState: buildPendingReportRuntimePreviewRowsState({
    fingerprint: "runtime::6",
    requestKey: "runtime::6::0",
    currentState: {
      fingerprint: "runtime::old",
      requestKey: "runtime::old::0",
      rows: [{ channelV2: "Display" }],
      hasMore: true,
      loading: false,
      error: null,
    },
  }),
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

console.log("reportRuntimePreviewRowsState ✓ models authored runtime preview fetch state transitions deterministically");
