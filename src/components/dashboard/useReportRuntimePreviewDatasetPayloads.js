import React from "react";

import { isDeferredCacheHitEnvelope } from "../../reporting/dataEnvelopeModel.js";
import {
  isReportDatasetMCPSource,
  normalizeReportDatasetCapabilities,
  normalizeReportDatasetSource,
} from "../../reporting/reportDatasetSourceModel.js";
import { resolveReportBuilderDatasetPreviewFetcher } from "./reportBuilderDataSourceFetch.js";
import {
  buildReportRuntimePreviewFreshnessError,
  resolveReportRuntimePreviewFreshnessRecovery,
} from "./reportRuntimePreviewFreshnessRecovery.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canContinueDatasetPayloadLifecycle(shouldContinue = null) {
  return typeof shouldContinue !== "function" || shouldContinue() === true;
}

function buildDatasetDiagnostic({
  code = "",
  message = "",
  suggestedFix = "",
} = {}) {
  return {
    code: normalizeString(code) || "runtimePreviewDatasetFetchFailed",
    severity: "error",
    message: normalizeString(message) || "Runtime preview dataset fetch failed.",
    ...(normalizeString(suggestedFix) ? { suggestedFix: normalizeString(suggestedFix) } : {}),
  };
}

function buildUnavailableDatasetPayload(dataset = {}) {
  const label = normalizeString(dataset?.label || dataset?.id || dataset?.dataSourceRef || "Dataset") || "Dataset";
  return {
    rows: [],
    hasMore: false,
    diagnostics: [
      buildDatasetDiagnostic({
        code: "runtimePreviewDatasetUnavailable",
        message: `${label} could not be fetched for runtime preview because its data source handler is unavailable.`,
        suggestedFix: "Configure this data source in the current window or rebind the authored block to an available source.",
      }),
    ],
  };
}

function buildFailedDatasetPayload(dataset = {}, error = null) {
  const label = normalizeString(dataset?.label || dataset?.id || dataset?.dataSourceRef || "Dataset") || "Dataset";
  const errorText = normalizeString(error?.message || error);
  return {
    rows: [],
    hasMore: false,
    diagnostics: [
      buildDatasetDiagnostic({
        code: "runtimePreviewDatasetFetchFailed",
        message: errorText
          ? `${label} could not be fetched for runtime preview. ${errorText}`
          : `${label} could not be fetched for runtime preview.`,
      }),
    ],
  };
}

export async function fetchReportRuntimePreviewDatasetPayloadResult({
  builderContext = null,
  datasets = [],
  requestKind = "runtimePreviewDataset",
  fetcherOptions = null,
  shouldContinue = null,
} = {}) {
  const normalizedDatasets = (Array.isArray(datasets) ? datasets : [])
    .map((dataset) => (
      dataset && typeof dataset === "object" && !Array.isArray(dataset)
        ? dataset
        : null
    ))
    .filter(Boolean)
    .map((dataset) => ({
      id: normalizeString(dataset?.id),
      dataSourceRef: normalizeString(dataset?.dataSourceRef),
      request: dataset?.request && typeof dataset.request === "object" && !Array.isArray(dataset.request)
        ? cloneValue(dataset.request)
        : null,
      resultContract: dataset?.resultContract && typeof dataset.resultContract === "object" && !Array.isArray(dataset.resultContract)
        ? cloneValue(dataset.resultContract)
        : null,
      source: normalizeReportDatasetSource(dataset?.source),
      capabilities: normalizeReportDatasetCapabilities(dataset?.capabilities),
      label: normalizeString(dataset?.label || dataset?.id || dataset?.dataSourceRef),
    }))
    .filter((dataset) => dataset.id && dataset.request && (dataset.dataSourceRef || isReportDatasetMCPSource(dataset.source)));
  if (normalizedDatasets.length === 0) {
    return {
      cancelled: false,
      payloads: {},
      freshDatasetIds: [],
      freshnessFailedDatasetIds: [],
      error: null,
    };
  }
  const entries = await Promise.all(
    normalizedDatasets.map(async (dataset) => {
      try {
        const resolvedFetcher = resolveReportBuilderDatasetPreviewFetcher(
          builderContext,
          dataset,
          fetcherOptions && typeof fetcherOptions === "object" && !Array.isArray(fetcherOptions)
            ? fetcherOptions
            : {},
        );
        if (!resolvedFetcher?.fetcher || typeof resolvedFetcher?.resolveResult !== "function") {
          return [dataset.id, buildUnavailableDatasetPayload(dataset), true];
        }
        const fetchDatasetBody = () => resolvedFetcher.fetcher({
          parameters: dataset.request,
          requestKind,
        });
        let body = await fetchDatasetBody();
        let recoveryPlan = resolveReportRuntimePreviewFreshnessRecovery({
          deferred: isDeferredCacheHitEnvelope(body),
          requestKey: dataset.id,
        });
        if (recoveryPlan.action === "retry") {
          if (!canContinueDatasetPayloadLifecycle(shouldContinue)) {
            return [dataset.id, null, false, null, true];
          }
          body = await fetchDatasetBody();
          recoveryPlan = resolveReportRuntimePreviewFreshnessRecovery({
            deferred: isDeferredCacheHitEnvelope(body),
            requestKey: dataset.id,
            recoveryState: recoveryPlan.recoveryState,
          });
        }
        if (recoveryPlan.action === "fail") {
          throw buildReportRuntimePreviewFreshnessError({
            requestKey: dataset.id,
            scope: `runtime preview dataset ${dataset.label || dataset.id}`,
          });
        }
        const resolvedPayload = resolvedFetcher.resolveResult(body);
        return [dataset.id, {
          rows: Array.isArray(resolvedPayload?.rows) ? resolvedPayload.rows : [],
          hasMore: resolvedPayload?.hasMore === true,
          diagnostics: [],
        }, !isDeferredCacheHitEnvelope(body)];
      } catch (error) {
        const freshnessError = error?.code === "runtimePreviewFreshnessUnavailable" ? error : null;
        return [
          dataset.id,
          buildFailedDatasetPayload(dataset, error),
          !freshnessError,
          freshnessError,
          false,
        ];
      }
    }),
  );
  const cancelled = entries.some(([, , , , entryCancelled]) => entryCancelled === true);
  if (cancelled) {
    return {
      cancelled: true,
      payloads: {},
      freshDatasetIds: [],
      freshnessFailedDatasetIds: [],
      error: null,
    };
  }
  return {
    cancelled: false,
    payloads: Object.fromEntries(entries.map(([datasetId, payload]) => [datasetId, payload])),
    freshDatasetIds: entries
      .filter(([, , fresh]) => fresh === true)
      .map(([datasetId]) => datasetId),
    freshnessFailedDatasetIds: entries
      .filter(([, , , freshnessError]) => !!freshnessError)
      .map(([datasetId]) => datasetId),
    error: entries.map(([, , , error]) => error).find(Boolean) || null,
  };
}

export async function fetchReportRuntimePreviewDatasetPayloads(options = {}) {
  const result = await fetchReportRuntimePreviewDatasetPayloadResult(options);
  return result.payloads;
}

export function buildIdleReportRuntimePreviewDatasetPayloadState() {
  return {
    requestKey: "",
    freshResultRequestKey: "",
    freshDatasetIds: [],
    loading: false,
    payloads: {},
    error: null,
  };
}

export function buildPendingReportRuntimePreviewDatasetPayloadState({
  requestKey = "",
  currentState = null,
} = {}) {
  const currentPayloads = currentState?.payloads
    && typeof currentState.payloads === "object"
    && !Array.isArray(currentState.payloads)
    ? cloneValue(currentState.payloads)
    : {};
  return {
    requestKey: normalizeString(requestKey),
    freshResultRequestKey: "",
    freshDatasetIds: [],
    loading: true,
    payloads: currentPayloads,
    error: null,
  };
}

export function buildResolvedReportRuntimePreviewDatasetPayloadState({
  requestKey = "",
  payloads = {},
  freshDatasetIds = [],
  freshnessFailedDatasetIds = [],
  currentState = null,
  error = null,
} = {}) {
  const normalizedRequestKey = normalizeString(requestKey);
  const incomingPayloads = payloads && typeof payloads === "object" && !Array.isArray(payloads)
    ? payloads
    : {};
  const currentPayloads = currentState?.payloads
    && typeof currentState.payloads === "object"
    && !Array.isArray(currentState.payloads)
    ? currentState.payloads
    : {};
  const freshnessFailedDatasetIdSet = new Set(
    (Array.isArray(freshnessFailedDatasetIds) ? freshnessFailedDatasetIds : [])
      .map(normalizeString)
      .filter(Boolean),
  );
  const normalizedPayloads = Object.fromEntries(
    Object.entries(incomingPayloads).map(([datasetId, payload]) => {
      const normalizedDatasetId = normalizeString(datasetId);
      const currentPayload = currentPayloads?.[normalizedDatasetId];
      if (freshnessFailedDatasetIdSet.has(normalizedDatasetId)
        && currentPayload
        && typeof currentPayload === "object"
        && !Array.isArray(currentPayload)) {
        return [normalizedDatasetId, {
          ...cloneValue(currentPayload),
          diagnostics: Array.isArray(payload?.diagnostics)
            ? cloneValue(payload.diagnostics)
            : [],
        }];
      }
      return [normalizedDatasetId, cloneValue(payload)];
    }),
  );
  const datasetIds = Object.keys(normalizedPayloads).map(normalizeString).filter(Boolean);
  const freshDatasetIdSet = new Set(
    (Array.isArray(freshDatasetIds) ? freshDatasetIds : [])
      .map(normalizeString)
      .filter((datasetId) => datasetIds.includes(datasetId)),
  );
  const allDatasetResultsFresh = datasetIds.length > 0
    && datasetIds.every((datasetId) => freshDatasetIdSet.has(datasetId));
  return {
    requestKey: normalizedRequestKey,
    freshResultRequestKey: allDatasetResultsFresh ? normalizedRequestKey : "",
    freshDatasetIds: datasetIds.filter((datasetId) => freshDatasetIdSet.has(datasetId)),
    loading: false,
    payloads: normalizedPayloads,
    error,
  };
}

export async function executeReportRuntimePreviewDatasetPayloadFetchLifecycle({
  builderContext = null,
  datasets = [],
  requestKind = "runtimePreviewDataset",
  requestKey = "",
  fetcherOptions = null,
  getCurrentState = null,
  shouldContinue = null,
  applyState = null,
} = {}) {
  const result = await fetchReportRuntimePreviewDatasetPayloadResult({
    builderContext,
    datasets,
    requestKind,
    fetcherOptions,
    shouldContinue,
  });
  if (result.cancelled || !canContinueDatasetPayloadLifecycle(shouldContinue)) {
    return { cancelled: true, nextState: null };
  }
  const currentState = typeof getCurrentState === "function" ? getCurrentState() : null;
  const nextState = buildResolvedReportRuntimePreviewDatasetPayloadState({
    requestKey,
    payloads: result.payloads,
    freshDatasetIds: result.freshDatasetIds,
    freshnessFailedDatasetIds: result.freshnessFailedDatasetIds,
    currentState,
    error: result.error || null,
  });
  if (!canContinueDatasetPayloadLifecycle(shouldContinue)) {
    return { cancelled: true, nextState: null };
  }
  if (typeof applyState === "function") {
    applyState(nextState);
  }
  return { cancelled: false, nextState };
}

export function resolveFreshReportRuntimePreviewPrimaryDatasetPayload({
  state = null,
  expectedRequestKey = "",
  primaryDatasetId = "",
} = {}) {
  const normalizedExpectedRequestKey = normalizeString(expectedRequestKey);
  const normalizedPrimaryDatasetId = normalizeString(primaryDatasetId);
  if (!normalizedExpectedRequestKey
    || !normalizedPrimaryDatasetId
    || normalizeString(state?.requestKey) !== normalizedExpectedRequestKey
    || !(Array.isArray(state?.freshDatasetIds)
      && state.freshDatasetIds.map(normalizeString).includes(normalizedPrimaryDatasetId))) {
    return null;
  }
  const payload = state?.payloads?.[normalizedPrimaryDatasetId];
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : null;
}

export function resolveReportRuntimePreviewDatasetResultFreshness({
  state = null,
  expectedRequestKey = "",
  datasetIds = [],
  fallbackFreshDatasetIds = [],
} = {}) {
  const normalizedExpectedRequestKey = normalizeString(expectedRequestKey);
  const requiredDatasetIds = (Array.isArray(datasetIds) ? datasetIds : [])
    .map(normalizeString)
    .filter(Boolean);
  if (!normalizedExpectedRequestKey
    || normalizeString(state?.requestKey) !== normalizedExpectedRequestKey
    || requiredDatasetIds.length === 0) {
    return false;
  }
  const freshDatasetIds = new Set([
    ...(Array.isArray(state?.freshDatasetIds) ? state.freshDatasetIds : []),
    ...(Array.isArray(fallbackFreshDatasetIds) ? fallbackFreshDatasetIds : []),
  ].map(normalizeString).filter(Boolean));
  return requiredDatasetIds.every((datasetId) => freshDatasetIds.has(datasetId));
}

export function useReportRuntimePreviewDatasetPayloads({
  enabled = false,
  builderContext = null,
  datasets = [],
  requestKey = "",
  fetcherOptions = null,
} = {}) {
  const [state, setState] = React.useState(buildIdleReportRuntimePreviewDatasetPayloadState);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const mountedRef = React.useRef(true);
  const builderContextRef = React.useRef(builderContext);
  builderContextRef.current = builderContext;
  const datasetsRef = React.useRef(datasets);
  datasetsRef.current = datasets;
  const fetcherOptionsRef = React.useRef(fetcherOptions);
  fetcherOptionsRef.current = fetcherOptions;
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const normalizedRequestKey = normalizeString(requestKey)
    || JSON.stringify(
      (Array.isArray(datasets) ? datasets : [])
        .map((dataset) => ({
          id: normalizeString(dataset?.id),
          dataSourceRef: normalizeString(dataset?.dataSourceRef),
          request: dataset?.request || null,
          resultContract: dataset?.resultContract || null,
          source: dataset?.source || null,
          capabilities: dataset?.capabilities || null,
        })),
    );
  const lifecycleGenerationRef = React.useRef(0);
  const currentRequestKeyRef = React.useRef(normalizedRequestKey);
  currentRequestKeyRef.current = normalizedRequestKey;

  React.useEffect(() => {
    const hasDatasets = Array.isArray(datasetsRef.current) && datasetsRef.current.length > 0;
    if (!enabled || !hasDatasets || !builderContextRef.current || !normalizedRequestKey) {
      lifecycleGenerationRef.current += 1;
      if (stateRef.current.loading || Object.keys(stateRef.current.payloads || {}).length > 0 || stateRef.current.requestKey) {
        setState(buildIdleReportRuntimePreviewDatasetPayloadState());
      }
      return undefined;
    }
    if (stateRef.current.requestKey === normalizedRequestKey) {
      return undefined;
    }
    const requestGeneration = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = requestGeneration;
    let cancelled = false;
    setState(buildPendingReportRuntimePreviewDatasetPayloadState({
      requestKey: normalizedRequestKey,
      currentState: stateRef.current,
    }));
    const shouldContinue = () => !cancelled
      && mountedRef.current
      && currentRequestKeyRef.current === normalizedRequestKey
      && lifecycleGenerationRef.current === requestGeneration;
    void executeReportRuntimePreviewDatasetPayloadFetchLifecycle({
      builderContext: builderContextRef.current,
      datasets: datasetsRef.current,
      fetcherOptions: fetcherOptionsRef.current,
      requestKey: normalizedRequestKey,
      getCurrentState: () => stateRef.current,
      shouldContinue,
      applyState: (nextState) => {
        if (shouldContinue()) {
          setState(nextState);
        }
      },
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, normalizedRequestKey]);

  return state;
}
