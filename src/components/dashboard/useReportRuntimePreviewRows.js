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
    fetchRecords({ parameters: request, requestKind })
      .then(async (body) => {
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
        const resolvedPayload = resolveFetchResult(body);
        let { rows, hasMore } = resolvedPayload;
        if (typeof hydrateRows === "function" && Array.isArray(rows) && rows.length > 0) {
          try {
            const hydratedRows = await hydrateRows({
              rows,
              request,
              requestKey: requestedRequestKey,
              requestKind,
            });
            if (Array.isArray(hydratedRows)) {
              rows = hydratedRows;
            }
          } catch (hydrationError) {
            console.warn("reportRuntime preview row hydration failed", hydrationError);
          }
        }
        const previousRows = Array.isArray(stateRef.current?.rows) ? stateRef.current.rows : [];
        const shouldPreserveRows = isDeferredCacheHitEnvelope(body) && previousRows.length > 0 && rows.length === 0;
        setState(buildResolvedReportRuntimePreviewRowsState({
          fingerprint,
          requestKey: requestedRequestKey,
          rows: shouldPreserveRows ? previousRows : rows,
          hasMore: shouldPreserveRows ? !!stateRef.current?.hasMore : hasMore,
        }));
        if (settlementPlan.shouldReleaseInFlight) {
          inFlightRequestKeyRef.current = "";
        }
      })
      .catch((fetchError) => {
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
        setState((current) => buildRejectedReportRuntimePreviewRowsState({
          fingerprint,
          requestKey: requestedRequestKey,
          currentState: current,
          error: fetchError,
        }));
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
