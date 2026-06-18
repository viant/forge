function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function buildIdleReportBuilderChartQueryState() {
  return {
    fingerprint: "",
    requestKey: "",
    rows: [],
    loading: false,
    error: null,
  };
}

export function normalizeReportBuilderChartQueryState(state = {}) {
  return {
    fingerprint: normalizeString(state?.fingerprint),
    requestKey: normalizeString(state?.requestKey),
    rows: Array.isArray(state?.rows) ? state.rows.map((row) => cloneValue(row)) : [],
    loading: state?.loading === true,
    error: state?.error ?? null,
  };
}

export function hasReportBuilderChartQueryStateValue(state = {}) {
  const normalized = normalizeReportBuilderChartQueryState(state);
  return !!(
    normalized.fingerprint
    || normalized.rows.length > 0
    || normalized.loading
    || normalized.error
  );
}

export function buildPendingReportBuilderChartQueryState({
  fingerprint = "",
  requestKey = "",
  currentState = {},
} = {}) {
  const normalizedCurrentState = normalizeReportBuilderChartQueryState(currentState);
  const normalizedFingerprint = normalizeString(fingerprint);
  const normalizedRequestKey = normalizeString(requestKey);
  return {
    fingerprint: normalizedFingerprint,
    requestKey: normalizedRequestKey,
    rows: normalizedCurrentState.fingerprint === normalizedFingerprint ? normalizedCurrentState.rows : [],
    loading: true,
    error: null,
  };
}

export function buildResolvedReportBuilderChartQueryState({
  fingerprint = "",
  requestKey = "",
  rows = [],
} = {}) {
  return {
    fingerprint: normalizeString(fingerprint),
    requestKey: normalizeString(requestKey),
    rows: Array.isArray(rows) ? rows.map((row) => cloneValue(row)) : [],
    loading: false,
    error: null,
  };
}

export function buildRejectedReportBuilderChartQueryState({
  fingerprint = "",
  requestKey = "",
  currentState = {},
  error = null,
} = {}) {
  const normalizedCurrentState = normalizeReportBuilderChartQueryState(currentState);
  const normalizedFingerprint = normalizeString(fingerprint);
  const normalizedRequestKey = normalizeString(requestKey);
  return {
    fingerprint: normalizedFingerprint,
    requestKey: normalizedRequestKey,
    rows: normalizedCurrentState.fingerprint === normalizedFingerprint ? normalizedCurrentState.rows : [],
    loading: false,
    error,
  };
}

export function buildUnavailableReportBuilderChartQueryState({
  fingerprint = "",
  requestKey = "",
  error = null,
} = {}) {
  return {
    fingerprint: normalizeString(fingerprint),
    requestKey: normalizeString(requestKey),
    rows: [],
    loading: false,
    error,
  };
}

export function resolveReportBuilderChartQueryStateTransition({
  mode = "",
  deferForPrefill = false,
  showingChartView = false,
  hasRequest = false,
  fingerprint = "",
  requestKey = "",
  fetchAvailable = false,
  currentState = {},
  unavailableError = null,
} = {}) {
  const normalizedCurrentState = normalizeReportBuilderChartQueryState(currentState);
  const normalizedFingerprint = normalizeString(fingerprint);
  const normalizedRequestKey = normalizeString(requestKey);
  const shouldReset = normalizeString(mode) !== "fullQuery"
    || deferForPrefill
    || !hasRequest
    || !normalizedFingerprint;
  if (shouldReset) {
    return hasReportBuilderChartQueryStateValue(normalizedCurrentState)
      ? {
        type: "reset",
        nextState: buildIdleReportBuilderChartQueryState(),
      }
      : {
        type: "noop",
        nextState: buildIdleReportBuilderChartQueryState(),
      };
  }
  if (!showingChartView) {
    return {
      type: "noop",
      nextState: normalizedCurrentState,
    };
  }
  if (!fetchAvailable) {
    if (
      normalizedCurrentState.fingerprint === normalizedFingerprint
      && normalizedCurrentState.requestKey === normalizedRequestKey
      && !normalizedCurrentState.loading
      && normalizedCurrentState.rows.length === 0
      && normalizedCurrentState.error
    ) {
      return {
        type: "noop",
        nextState: normalizedCurrentState,
      };
    }
    return {
      type: "unavailable",
      nextState: buildUnavailableReportBuilderChartQueryState({
        fingerprint: normalizedFingerprint,
        requestKey: normalizedRequestKey,
        error: unavailableError,
      }),
    };
  }
  if (normalizedCurrentState.loading && normalizedCurrentState.requestKey === normalizedRequestKey) {
    return {
      type: "noop",
      nextState: normalizedCurrentState,
    };
  }
  if (
    normalizedCurrentState.fingerprint === normalizedFingerprint
    && normalizedCurrentState.requestKey === normalizedRequestKey
    && !normalizedCurrentState.loading
  ) {
    return {
      type: "noop",
      nextState: normalizedCurrentState,
    };
  }
  return {
    type: "start",
    nextState: buildPendingReportBuilderChartQueryState({
      fingerprint: normalizedFingerprint,
      requestKey: normalizedRequestKey,
      currentState: normalizedCurrentState,
    }),
  };
}
