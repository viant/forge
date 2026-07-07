import React from "react";

import { extractData } from "../dataSourceExtract.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeExtractConfig(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      selectors: {},
      paging: null,
    };
  }
  const selectors = value?.selectors && typeof value.selectors === "object" && !Array.isArray(value.selectors)
    ? value.selectors
    : {};
  const paging = value?.paging && typeof value.paging === "object" && !Array.isArray(value.paging)
    ? value.paging
    : null;
  return {
    selectors,
    paging,
  };
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

function resolveDatasetFetchResult(body = null, extractConfig = null) {
  const normalizedExtractConfig = normalizeExtractConfig(extractConfig);
  const { records } = extractData(
    normalizedExtractConfig.selectors,
    normalizedExtractConfig.paging,
    body,
  );
  const hasMore = body?.dataInfo?.hasMore === true
    || body?.info?.hasMore === true
    || body?.hasMore === true;
  return {
    rows: Array.isArray(records) ? records : [],
    hasMore,
    diagnostics: [],
  };
}

export async function fetchReportRuntimePreviewDatasetPayloads({
  builderContext = null,
  datasets = [],
  requestKind = "runtimePreviewDataset",
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
      label: normalizeString(dataset?.label || dataset?.id || dataset?.dataSourceRef),
    }))
    .filter((dataset) => dataset.id && dataset.dataSourceRef && dataset.request);
  if (!builderContext?.Context || normalizedDatasets.length === 0) {
    return {};
  }
  const entries = await Promise.all(
    normalizedDatasets.map(async (dataset) => {
      try {
        const dataSourceContext = builderContext.Context(dataset.dataSourceRef);
        const handlers = dataSourceContext?.handlers?.dataSource;
        if (!handlers?.fetchRecords) {
          return [dataset.id, buildUnavailableDatasetPayload(dataset)];
        }
        const body = await handlers.fetchRecords({
          parameters: dataset.request,
          requestKind,
        });
        return [dataset.id, resolveDatasetFetchResult(body, dataSourceContext?.dataSource)];
      } catch (error) {
        return [dataset.id, buildFailedDatasetPayload(dataset, error)];
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function useReportRuntimePreviewDatasetPayloads({
  enabled = false,
  builderContext = null,
  datasets = [],
  requestKey = "",
} = {}) {
  const [state, setState] = React.useState(() => ({
    requestKey: "",
    loading: false,
    payloads: {},
  }));
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const mountedRef = React.useRef(true);
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
        })),
    );

  React.useEffect(() => {
    const hasDatasets = Array.isArray(datasets) && datasets.length > 0;
    if (!enabled || !hasDatasets || !builderContext?.Context || !normalizedRequestKey) {
      if (stateRef.current.loading || Object.keys(stateRef.current.payloads || {}).length > 0 || stateRef.current.requestKey) {
        setState({
          requestKey: "",
          loading: false,
          payloads: {},
        });
      }
      return undefined;
    }
    if (stateRef.current.requestKey === normalizedRequestKey && stateRef.current.loading === false) {
      return undefined;
    }
    let cancelled = false;
    setState({
      requestKey: normalizedRequestKey,
      loading: true,
      payloads: {},
    });
    fetchReportRuntimePreviewDatasetPayloads({
      builderContext,
      datasets,
    }).then((payloads) => {
      if (cancelled || !mountedRef.current) {
        return;
      }
      setState({
        requestKey: normalizedRequestKey,
        loading: false,
        payloads: payloads && typeof payloads === "object" && !Array.isArray(payloads)
          ? payloads
          : {},
      });
    });
    return () => {
      cancelled = true;
    };
  }, [builderContext, datasets, enabled, normalizedRequestKey]);

  return state;
}
