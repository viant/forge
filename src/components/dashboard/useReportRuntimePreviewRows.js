import React from "react";

import { isDeferredCacheHitEnvelope } from "../../reporting/dataEnvelopeModel.js";
import {
  buildReportDatasetExtractConfigFingerprint,
  buildReportDatasetResultContractFingerprint,
} from "../../reporting/reportDatasetResultContract.js";
import {
  buildIdleReportRuntimePreviewRowsState,
  buildRejectedReportRuntimePreviewRowsState,
  buildResolvedReportRuntimePreviewRowsState,
  resolveReportRuntimePreviewRowsStateTransition,
} from "./reportRuntimePreviewRowsState.js";
import {
  resolveReportRuntimePreviewRowsDispatchPlan,
  resolveReportRuntimePreviewRowsSettlementPlan,
} from "./reportRuntimePreviewRowsLifecycle.js";
import {
  buildReportRuntimePreviewFreshnessError,
  resolveReportRuntimePreviewFreshnessRecovery,
} from "./reportRuntimePreviewFreshnessRecovery.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function buildReportRuntimePreviewExtractConfigFingerprint(extractConfig = null) {
  return buildReportDatasetExtractConfigFingerprint(extractConfig);
}

export function buildReportRuntimePreviewResultContractFingerprint(resultContract = null) {
  return buildReportDatasetResultContractFingerprint(resultContract);
}

export function buildReportRuntimePreviewRequestKey(
  fingerprint = "",
  runSequence = 0,
  recoveryToken = "",
  extractConfigFingerprint = "",
  resultContractFingerprint = "",
) {
  const normalizedFingerprint = normalizeString(fingerprint);
  if (!normalizedFingerprint) {
    return "";
  }
  const normalizedRunSequence = Number.isFinite(Number(runSequence))
    ? Math.max(0, Number(runSequence))
    : 0;
  const normalizedRecoveryToken = normalizeString(recoveryToken);
  const normalizedExtractConfigFingerprint = normalizeString(extractConfigFingerprint);
  const parts = [
    normalizedFingerprint,
    String(normalizedRunSequence),
  ];
  if (normalizedRecoveryToken) {
    parts.push(normalizedRecoveryToken);
  }
  if (normalizedExtractConfigFingerprint) {
    parts.push(normalizedExtractConfigFingerprint);
  }
  const normalizedResultContractFingerprint = normalizeString(resultContractFingerprint);
  if (normalizedResultContractFingerprint) {
    parts.push(normalizedResultContractFingerprint);
  }
  return parts.join("::");
}

export function resolveReportRuntimePreviewRowsFetchState({
  body = null,
  fingerprint = "",
  requestKey = "",
  previousState = null,
  rows = [],
  hasMore = false,
} = {}) {
  const previousRows = Array.isArray(previousState?.rows) ? previousState.rows : [];
  const deferredCacheHit = isDeferredCacheHitEnvelope(body);
  const shouldPreserveRows = deferredCacheHit && previousRows.length > 0 && rows.length === 0;
  return buildResolvedReportRuntimePreviewRowsState({
    fingerprint,
    requestKey,
    rows: shouldPreserveRows ? previousRows : rows,
    hasMore: shouldPreserveRows ? !!previousState?.hasMore : hasMore,
    fresh: !deferredCacheHit,
  });
}

export async function fetchReportRuntimePreviewRowsFreshResult({
  fetchRecords = null,
  request = null,
  requestKind = "runtimePreview",
  requestKey = "",
  shouldContinue = null,
} = {}) {
  if (typeof fetchRecords !== "function") {
    throw new Error("A runtime preview row fetch function is required.");
  }
  const fetchCurrentRows = () => fetchRecords({ parameters: request, requestKind });
  let body = await fetchCurrentRows();
  let recoveryPlan = resolveReportRuntimePreviewFreshnessRecovery({
    deferred: isDeferredCacheHitEnvelope(body),
    requestKey,
  });
  if (recoveryPlan.action === "retry") {
    if (typeof shouldContinue === "function" && shouldContinue() !== true) {
      return { cancelled: true, body: null };
    }
    body = await fetchCurrentRows();
    recoveryPlan = resolveReportRuntimePreviewFreshnessRecovery({
      deferred: isDeferredCacheHitEnvelope(body),
      requestKey,
      recoveryState: recoveryPlan.recoveryState,
    });
  }
  if (recoveryPlan.action === "fail") {
    throw buildReportRuntimePreviewFreshnessError({
      requestKey,
      scope: "runtime preview rows",
    });
  }
  return { cancelled: false, body };
}

export async function executeReportRuntimePreviewRowsFetchLifecycle({
  fetchRecords = null,
  request = null,
  requestKind = "runtimePreview",
  requestKey = "",
  fingerprint = "",
  resolveFetchResult = null,
  hydrateRows = null,
  getCurrentState = null,
  shouldContinue = null,
} = {}) {
  const currentState = () => (
    typeof getCurrentState === "function" ? getCurrentState() : {}
  );
  try {
    const fetched = await fetchReportRuntimePreviewRowsFreshResult({
      fetchRecords,
      request,
      requestKind,
      requestKey,
      shouldContinue,
    });
    if (fetched.cancelled) {
      return { cancelled: true, nextState: null };
    }
    if (typeof resolveFetchResult !== "function") {
      throw new Error("A runtime preview row result resolver is required.");
    }
    const resolvedPayload = resolveFetchResult(fetched.body);
    let { rows, hasMore } = resolvedPayload;
    if (typeof hydrateRows === "function" && Array.isArray(rows) && rows.length > 0) {
      try {
        const hydratedRows = await hydrateRows({
          rows,
          request,
          requestKey,
          requestKind,
        });
        if (Array.isArray(hydratedRows)) {
          rows = hydratedRows;
        }
      } catch (hydrationError) {
        console.warn("reportRuntime preview row hydration failed", hydrationError);
      }
    }
    return {
      cancelled: false,
      nextState: resolveReportRuntimePreviewRowsFetchState({
        body: fetched.body,
        fingerprint,
        requestKey,
        previousState: currentState(),
        rows,
        hasMore,
      }),
    };
  } catch (fetchError) {
    return {
      cancelled: false,
      nextState: buildRejectedReportRuntimePreviewRowsState({
        fingerprint,
        requestKey,
        currentState: currentState(),
        error: fetchError,
      }),
    };
  }
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
  seedRows = null,
  seedHasMore = false,
  hydrateRows = null,
  resolveFetchResult = null,
} = {}) {
  const [state, setState] = React.useState(buildIdleReportRuntimePreviewRowsState);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const seedRowsRef = React.useRef(seedRows);
  seedRowsRef.current = seedRows;
  const seedHasMoreRef = React.useRef(seedHasMore);
  seedHasMoreRef.current = seedHasMore;
  const mountedRef = React.useRef(true);
  const currentRequestKeyRef = React.useRef(requestKey);
  currentRequestKeyRef.current = requestKey;
  const generationRef = React.useRef(0);
  const inFlightRequestKeyRef = React.useRef("");
  const unavailableError = React.useMemo(
    () => new Error(normalizeString(unavailableErrorMessage) || "Runtime preview fetch is unavailable for this data source."),
    [unavailableErrorMessage],
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const transition = resolveReportRuntimePreviewRowsStateTransition({
      enabled,
      canRun,
      hasModel,
      hasRequest: !!request,
      fingerprint,
      requestKey,
      fetchAvailable: typeof fetchRecords === "function" && typeof resolveFetchResult === "function",
      currentState: stateRef.current,
      unavailableError,
      seedRows: seedRowsRef.current,
      seedHasMore: seedHasMoreRef.current,
    });
    const dispatchPlan = resolveReportRuntimePreviewRowsDispatchPlan({
      transitionType: transition.type,
      inFlightRequestKey: inFlightRequestKeyRef.current,
      requestKey,
      currentGeneration: generationRef.current,
    });
    if (!dispatchPlan.applyState) {
      return undefined;
    }
    generationRef.current = dispatchPlan.nextGeneration;
    inFlightRequestKeyRef.current = dispatchPlan.nextInFlightRequestKey;
    setState(transition.nextState);
    if (!dispatchPlan.issueFetch) {
      return undefined;
    }
    const requestedRequestKey = requestKey;
    const requestGeneration = dispatchPlan.requestGeneration;
    executeReportRuntimePreviewRowsFetchLifecycle({
      fetchRecords,
      request,
      requestKind,
      requestKey: requestedRequestKey,
      fingerprint,
      resolveFetchResult,
      hydrateRows,
      getCurrentState: () => stateRef.current,
      shouldContinue: () => resolveReportRuntimePreviewRowsSettlementPlan({
        mounted: mountedRef.current,
        currentRequestKey: currentRequestKeyRef.current,
        requestedRequestKey,
        currentGeneration: generationRef.current,
        requestGeneration,
        inFlightRequestKey: inFlightRequestKeyRef.current,
      }).shouldApply,
    })
      .then(({ cancelled, nextState }) => {
        if (cancelled) {
          return;
        }
        const settlementPlan = resolveReportRuntimePreviewRowsSettlementPlan({
          mounted: mountedRef.current,
          currentRequestKey: currentRequestKeyRef.current,
          requestedRequestKey,
          currentGeneration: generationRef.current,
          requestGeneration,
          inFlightRequestKey: inFlightRequestKeyRef.current,
        });
        if (!settlementPlan.shouldApply) {
          return;
        }
        setState(nextState);
        if (settlementPlan.shouldReleaseInFlight) {
          inFlightRequestKeyRef.current = "";
        }
      });
    return undefined;
  }, [
    canRun,
    enabled,
    fetchRecords,
    fingerprint,
    hasModel,
    request,
    requestKey,
    requestKind,
    hydrateRows,
    resolveFetchResult,
    unavailableError,
  ]);

  return state;
}
