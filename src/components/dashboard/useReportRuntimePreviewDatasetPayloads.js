import React from "react";

import {
  isReportDatasetMCPSource,
  normalizeReportDatasetCapabilities,
  normalizeReportDatasetSource,
} from "../../reporting/reportDatasetSourceModel.js";
import { resolveReportBuilderDatasetPreviewFetcher } from "./reportBuilderDataSourceFetch.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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

export async function fetchReportRuntimePreviewDatasetPayloads({
  builderContext = null,
  datasets = [],
  requestKind = "runtimePreviewDataset",
  fetcherOptions = null,
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
    return {};
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
          return [dataset.id, buildUnavailableDatasetPayload(dataset)];
        }
        const body = await resolvedFetcher.fetcher({
          parameters: dataset.request,
          requestKind,
        });
        const resolvedPayload = resolvedFetcher.resolveResult(body);
        return [dataset.id, {
          rows: Array.isArray(resolvedPayload?.rows) ? resolvedPayload.rows : [],
          hasMore: resolvedPayload?.hasMore === true,
          diagnostics: [],
        }];
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
  fetcherOptions = null,
} = {}) {
  const [state, setState] = React.useState(() => ({
    requestKey: "",
    loading: false,
    payloads: {},
  }));
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

  React.useEffect(() => {
    const hasDatasets = Array.isArray(datasetsRef.current) && datasetsRef.current.length > 0;
    if (!enabled || !hasDatasets || !builderContextRef.current || !normalizedRequestKey) {
      if (stateRef.current.loading || Object.keys(stateRef.current.payloads || {}).length > 0 || stateRef.current.requestKey) {
        setState({
          requestKey: "",
          loading: false,
          payloads: {},
        });
      }
      return undefined;
    }
    if (stateRef.current.requestKey === normalizedRequestKey) {
      return undefined;
    }
    let cancelled = false;
    setState({
      requestKey: normalizedRequestKey,
      loading: true,
      payloads: {},
    });
    fetchReportRuntimePreviewDatasetPayloads({
      builderContext: builderContextRef.current,
      datasets: datasetsRef.current,
      fetcherOptions: fetcherOptionsRef.current,
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
  }, [enabled, normalizedRequestKey]);

  return state;
}
