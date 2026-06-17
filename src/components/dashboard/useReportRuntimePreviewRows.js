import React from "react";

import { extractData } from "../dataSourceExtract.js";
import {
  buildIdleReportRuntimePreviewRowsState,
  buildRejectedReportRuntimePreviewRowsState,
  buildResolvedReportRuntimePreviewRowsState,
  resolveReportRuntimePreviewRowsStateTransition,
} from "./reportRuntimePreviewRowsState.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function buildReportRuntimePreviewRequestKey(fingerprint = "", runSequence = 0) {
  const normalizedFingerprint = normalizeString(fingerprint);
  if (!normalizedFingerprint) {
    return "";
  }
  const normalizedRunSequence = Number.isFinite(Number(runSequence))
    ? Math.max(0, Number(runSequence))
    : 0;
  return `${normalizedFingerprint}::${normalizedRunSequence}`;
}

function resolveReportRuntimePreviewFetchResult(body = null) {
  const { records } = extractData({}, null, body);
  const hasMore = body?.dataInfo?.hasMore === true
    || body?.info?.hasMore === true
    || body?.hasMore === true;
  return {
    rows: Array.isArray(records) ? records : [],
    hasMore,
  };
}

export function useReportRuntimePreviewRows({
  enabled = false,
  canRun = false,
  hasModel = false,
  request = null,
  fingerprint = "",
  requestKey = "",
  fetchRecords = null,
  requestKind = "runtimePreview",
  unavailableErrorMessage = "Runtime preview fetch is unavailable for this data source.",
} = {}) {
  const [state, setState] = React.useState(buildIdleReportRuntimePreviewRowsState);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const unavailableError = React.useMemo(
    () => new Error(normalizeString(unavailableErrorMessage) || "Runtime preview fetch is unavailable for this data source."),
    [unavailableErrorMessage],
  );

  React.useEffect(() => {
    const transition = resolveReportRuntimePreviewRowsStateTransition({
      enabled,
      canRun,
      hasModel,
      hasRequest: !!request,
      fingerprint,
      requestKey,
      fetchAvailable: typeof fetchRecords === "function",
      currentState: stateRef.current,
      unavailableError,
    });
    if (transition.type === "reset" || transition.type === "unavailable") {
      setState(transition.nextState);
      return undefined;
    }
    if (transition.type === "noop") {
      return undefined;
    }
    let cancelled = false;
    setState(transition.nextState);
    fetchRecords({ parameters: request, requestKind })
      .then((body) => {
        if (cancelled) {
          return;
        }
        const { rows, hasMore } = resolveReportRuntimePreviewFetchResult(body);
        setState(buildResolvedReportRuntimePreviewRowsState({
          fingerprint,
          requestKey,
          rows,
          hasMore,
        }));
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        setState((current) => buildRejectedReportRuntimePreviewRowsState({
          fingerprint,
          requestKey,
          currentState: current,
          error: fetchError,
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [
    canRun,
    enabled,
    fetchRecords,
    fingerprint,
    hasModel,
    request,
    requestKey,
    requestKind,
    unavailableError,
  ]);

  return state;
}
