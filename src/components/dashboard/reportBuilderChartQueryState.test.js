import assert from "node:assert/strict";

import {
  buildIdleReportBuilderChartQueryState,
  buildPendingReportBuilderChartQueryState,
  buildRejectedReportBuilderChartQueryState,
  buildResolvedReportBuilderChartQueryState,
  buildUnavailableReportBuilderChartQueryState,
  hasReportBuilderChartQueryStateValue,
  resolveReportBuilderChartQueryStateTransition,
} from "./reportBuilderChartQueryState.js";

assert.deepEqual(buildIdleReportBuilderChartQueryState(), {
  fingerprint: "",
  requestKey: "",
  rows: [],
  loading: false,
  error: null,
});

assert.equal(hasReportBuilderChartQueryStateValue({}), false);
assert.equal(hasReportBuilderChartQueryStateValue({
  fingerprint: "chart::1",
}), true);

assert.deepEqual(buildPendingReportBuilderChartQueryState({
  fingerprint: "chart::1",
  requestKey: "chart::1::0",
  currentState: {
    fingerprint: "chart::1",
    requestKey: "chart::1::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
  },
}), {
  fingerprint: "chart::1",
  requestKey: "chart::1::0",
  rows: [{ eventDate: "2026-05-01", avails: 12000 }],
  loading: true,
  error: null,
});

assert.deepEqual(buildResolvedReportBuilderChartQueryState({
  fingerprint: "chart::1",
  requestKey: "chart::1::0",
  rows: [{ eventDate: "2026-05-01", avails: 12000 }],
}), {
  fingerprint: "chart::1",
  requestKey: "chart::1::0",
  rows: [{ eventDate: "2026-05-01", avails: 12000 }],
  loading: false,
  error: null,
});

assert.deepEqual(buildRejectedReportBuilderChartQueryState({
  fingerprint: "chart::1",
  requestKey: "chart::1::0",
  currentState: {
    fingerprint: "chart::1",
    requestKey: "chart::1::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
  },
  error: new Error("chart fetch failed"),
}), {
  fingerprint: "chart::1",
  requestKey: "chart::1::0",
  rows: [{ eventDate: "2026-05-01", avails: 12000 }],
  loading: false,
  error: new Error("chart fetch failed"),
});

assert.deepEqual(buildUnavailableReportBuilderChartQueryState({
  fingerprint: "chart::2",
  requestKey: "chart::2::0",
  error: new Error("Chart data fetch is unavailable for full-query mode."),
}), {
  fingerprint: "chart::2",
  requestKey: "chart::2::0",
  rows: [],
  loading: false,
  error: new Error("Chart data fetch is unavailable for full-query mode."),
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "currentPage",
  deferForPrefill: false,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::1",
  requestKey: "chart::1::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::1",
    requestKey: "chart::1::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: false,
    error: null,
  },
}), {
  type: "reset",
  nextState: buildIdleReportBuilderChartQueryState(),
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: false,
  hasRequest: true,
  fingerprint: "chart::hidden",
  requestKey: "chart::hidden::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::hidden",
    requestKey: "chart::hidden::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: false,
    error: null,
  },
}), {
  type: "noop",
  nextState: {
    fingerprint: "chart::hidden",
    requestKey: "chart::hidden::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: false,
    error: null,
  },
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: false,
  hasRequest: true,
  fingerprint: "chart::hidden-empty",
  requestKey: "chart::hidden-empty::0",
  fetchAvailable: true,
  currentState: {},
}), {
  type: "noop",
  nextState: buildIdleReportBuilderChartQueryState(),
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: false,
  hasRequest: true,
  fingerprint: "chart::hidden-loading",
  requestKey: "chart::hidden-loading::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::hidden-loading",
    requestKey: "chart::hidden-loading::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: true,
    error: null,
  },
}), {
  type: "noop",
  nextState: {
    fingerprint: "chart::hidden-loading",
    requestKey: "chart::hidden-loading::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: true,
    error: null,
  },
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: true,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::2",
  requestKey: "chart::2::0",
  fetchAvailable: true,
  currentState: {},
}), {
  type: "noop",
  nextState: buildIdleReportBuilderChartQueryState(),
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::3",
  requestKey: "chart::3::0",
  fetchAvailable: false,
  currentState: {},
  unavailableError: new Error("Chart data fetch is unavailable for full-query mode."),
}), {
  type: "unavailable",
  nextState: buildUnavailableReportBuilderChartQueryState({
    fingerprint: "chart::3",
    requestKey: "chart::3::0",
    error: new Error("Chart data fetch is unavailable for full-query mode."),
  }),
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::8",
  requestKey: "chart::8::1",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::8",
    requestKey: "chart::8::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: true,
    error: null,
  },
}), {
  type: "start",
  nextState: buildPendingReportBuilderChartQueryState({
    fingerprint: "chart::8",
    requestKey: "chart::8::1",
    currentState: {
      fingerprint: "chart::8",
      requestKey: "chart::8::0",
      rows: [{ eventDate: "2026-05-01", avails: 12000 }],
      loading: true,
      error: null,
    },
  }),
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::4",
  requestKey: "chart::4::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::4",
    requestKey: "chart::4::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: true,
    error: null,
  },
}), {
  type: "noop",
  nextState: {
    fingerprint: "chart::4",
    requestKey: "chart::4::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: true,
    error: null,
  },
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::5",
  requestKey: "chart::5::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::5",
    requestKey: "chart::5::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: false,
    error: null,
  },
}), {
  type: "noop",
  nextState: {
    fingerprint: "chart::5",
    requestKey: "chart::5::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: false,
    error: null,
  },
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::6",
  requestKey: "chart::6::0",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::old",
    requestKey: "chart::old::0",
    rows: [{ eventDate: "2026-05-01", avails: 12000 }],
    loading: false,
    error: null,
  },
}), {
  type: "start",
  nextState: buildPendingReportBuilderChartQueryState({
    fingerprint: "chart::6",
    requestKey: "chart::6::0",
    currentState: {
      fingerprint: "chart::old",
      requestKey: "chart::old::0",
      rows: [{ eventDate: "2026-05-01", avails: 12000 }],
      loading: false,
      error: null,
    },
  }),
});

assert.deepEqual(resolveReportBuilderChartQueryStateTransition({
  mode: "fullQuery",
  deferForPrefill: false,
  showingChartView: true,
  hasRequest: true,
  fingerprint: "chart::7",
  requestKey: "chart::7::1",
  fetchAvailable: true,
  currentState: {
    fingerprint: "chart::7",
    requestKey: "chart::7::0",
    rows: [],
    loading: false,
    error: new Error("chart fetch failed"),
  },
}), {
  type: "start",
  nextState: buildPendingReportBuilderChartQueryState({
    fingerprint: "chart::7",
    requestKey: "chart::7::1",
    currentState: {
      fingerprint: "chart::7",
      requestKey: "chart::7::0",
      rows: [],
      loading: false,
      error: new Error("chart fetch failed"),
    },
  }),
});

console.log("reportBuilderChartQueryState ✓ models full-query chart fetch state transitions deterministically");
