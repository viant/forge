function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function buildIdleReportRuntimePreviewRowsState() {
  return {
    fingerprint: "",
    requestKey: "",
    rows: [],
    hasMore: false,
    loading: false,
    error: null,
  };
}

export function normalizeReportRuntimePreviewRowsState(state = {}) {
  return {
    fingerprint: normalizeString(state?.fingerprint),
    requestKey: normalizeString(state?.requestKey),
    rows: Array.isArray(state?.rows) ? state.rows.map((row) => cloneValue(row)) : [],
    hasMore: state?.hasMore === true,
    loading: state?.loading === true,
    error: state?.error ?? null,
  };
}

export function hasReportRuntimePreviewRowsStateValue(state = {}) {
  const normalized = normalizeReportRuntimePreviewRowsState(state);
  return !!(
    normalized.fingerprint
    || normalized.rows.length > 0
    || normalized.hasMore
    || normalized.loading
    || normalized.error
  );
}

export function buildPendingReportRuntimePreviewRowsState({
  fingerprint = "",
  requestKey = "",
  currentState = {},
  seedRows = null,
  seedHasMore = false,
} = {}) {
  // Retain the previously fetched rows across a fingerprint change (e.g. a drill)
  // so the UI can render a stale-while-revalidate "updating" state instead of
  // collapsing to empty while the new request is in flight. On the very first
  // transition into fetch mode (e.g. the first drill out of a resolved-collection
  // preview) there is no prior fetched state yet, so fall back to the caller-supplied
  // seed rows (the previously visible resolved-collection rows) instead of losing them.
  const normalizedCurrentState = normalizeReportRuntimePreviewRowsState(currentState);
  const normalizedFingerprint = normalizeString(fingerprint);
  const normalizedRequestKey = normalizeString(requestKey);
  const hasPriorFetchedState = !!normalizedCurrentState.fingerprint || normalizedCurrentState.rows.length > 0;
  const normalizedSeedRows = Array.isArray(seedRows) ? seedRows.map((row) => cloneValue(row)) : [];
  return {
    fingerprint: normalizedFingerprint,
    requestKey: normalizedRequestKey,
    rows: hasPriorFetchedState ? normalizedCurrentState.rows : normalizedSeedRows,
    hasMore: hasPriorFetchedState ? normalizedCurrentState.hasMore : (seedHasMore === true),
    loading: true,
    error: null,
  };
}

export function buildResolvedReportRuntimePreviewRowsState({
  fingerprint = "",
  requestKey = "",
  rows = [],
  hasMore = false,
} = {}) {
  return {
    fingerprint: normalizeString(fingerprint),
    requestKey: normalizeString(requestKey),
    rows: Array.isArray(rows) ? rows.map((row) => cloneValue(row)) : [],
    hasMore: hasMore === true,
    loading: false,
    error: null,
  };
}

export function buildRejectedReportRuntimePreviewRowsState({
  fingerprint = "",
  requestKey = "",
  currentState = {},
  error = null,
} = {}) {
  const normalizedCurrentState = normalizeReportRuntimePreviewRowsState(currentState);
  const normalizedFingerprint = normalizeString(fingerprint);
  const normalizedRequestKey = normalizeString(requestKey);
  return {
    fingerprint: normalizedFingerprint,
    requestKey: normalizedRequestKey,
    rows: normalizedCurrentState.fingerprint === normalizedFingerprint ? normalizedCurrentState.rows : [],
    hasMore: normalizedCurrentState.fingerprint === normalizedFingerprint ? normalizedCurrentState.hasMore : false,
    loading: false,
    error,
  };
}

export function buildUnavailableReportRuntimePreviewRowsState({
  fingerprint = "",
  requestKey = "",
  error = null,
} = {}) {
  return {
    fingerprint: normalizeString(fingerprint),
    requestKey: normalizeString(requestKey),
    rows: [],
    hasMore: false,
    loading: false,
    error,
  };
}

export function resolveReportRuntimePreviewRowsStateTransition({
  enabled = false,
  canRun = false,
  hasModel = false,
  hasRequest = false,
  fingerprint = "",
  requestKey = "",
  fetchAvailable = false,
  currentState = {},
  unavailableError = null,
  seedRows = null,
  seedHasMore = false,
} = {}) {
  const normalizedCurrentState = normalizeReportRuntimePreviewRowsState(currentState);
  const normalizedFingerprint = normalizeString(fingerprint);
  const normalizedRequestKey = normalizeString(requestKey);
  const shouldReset = !enabled || !canRun || !hasModel || !hasRequest || !normalizedFingerprint;
  if (shouldReset) {
    return hasReportRuntimePreviewRowsStateValue(normalizedCurrentState)
      ? {
        type: "reset",
        nextState: buildIdleReportRuntimePreviewRowsState(),
      }
      : {
        type: "noop",
        nextState: buildIdleReportRuntimePreviewRowsState(),
      };
  }
  if (!fetchAvailable) {
    if (
      normalizedCurrentState.requestKey === normalizedRequestKey
      && !normalizedCurrentState.loading
      && normalizedCurrentState.rows.length === 0
      && normalizedCurrentState.hasMore === false
      && normalizedCurrentState.error
    ) {
      return {
        type: "noop",
        nextState: normalizedCurrentState,
      };
    }
    return {
      type: "unavailable",
      nextState: buildUnavailableReportRuntimePreviewRowsState({
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
    normalizedCurrentState.requestKey === normalizedRequestKey
    && normalizedCurrentState.fingerprint === normalizedFingerprint
    && !normalizedCurrentState.loading
  ) {
    return {
      type: "noop",
      nextState: normalizedCurrentState,
    };
  }
  return {
    type: "start",
    nextState: buildPendingReportRuntimePreviewRowsState({
      fingerprint: normalizedFingerprint,
      requestKey: normalizedRequestKey,
      currentState: normalizedCurrentState,
      seedRows,
      seedHasMore,
    }),
  };
}
