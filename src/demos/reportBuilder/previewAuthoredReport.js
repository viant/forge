import {
  buildReportDocumentKpiBlock,
  buildReportDocumentTableBlock,
} from "../../reporting/reportDocumentModel.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import { runPreviewRuntimeRequest } from "./previewRuntimeQuery.js";

function buildPreviewAuthoredAdditionalBlocks() {
  return [
    buildReportDocumentKpiBlock({
      id: "headlineKpi",
      title: "Headline KPI",
      datasetRef: "primary",
      valueField: "avails",
      valueLabel: "Available Impressions",
      secondaryField: "channelV2",
      secondaryLabel: "Channel",
      description: "Generic KPI block resolved from the first authored runtime row.",
      emptyLabel: "No headline KPI value available.",
    }),
    buildReportDocumentTableBlock({
      id: "comparisonTable",
      title: "Delivery Comparison",
      datasetRef: "primary",
      columns: [
        {
          key: "eventDate",
          label: "Date",
          format: "date",
        },
        {
          key: "channelV2",
          label: "Channel",
          cellVisual: {
            kind: "badge",
            rules: [
              { value: "Display", tone: "info", label: "Display" },
              { value: "CTV", tone: "success", label: "CTV" },
            ],
          },
        },
        {
          key: "avails",
          label: "Avails",
          format: "compactNumber",
          cellVisual: {
            kind: "dataBar",
            valueField: "avails",
            range: { mode: "columnMax" },
            palette: ["#dbeafe", "#2563eb"],
          },
        },
        {
          key: "hhUniqs",
          label: "HH Uniques",
          format: "compactNumber",
          cellVisual: {
            kind: "dataBar",
            valueField: "hhUniqs",
            range: { mode: "columnMax" },
            palette: ["#dcfce7", "#16a34a"],
          },
        },
      ],
    }),
  ];
}

export function buildPreviewAuthoredReportModel({
  container = {},
  config = {},
  state = null,
  refinements = [],
  drillTransitions = [],
  semanticSummary = null,
  binding = null,
  semanticModel = null,
} = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  return buildReportBuilderRuntimePreviewModel({
    container,
    config,
    state,
    refinements,
    drillTransitions,
    trailingBlocks: buildPreviewAuthoredAdditionalBlocks(),
    semanticSummary,
    binding,
    semanticModel,
  });
}

export function buildPreviewAuthoredReport({
  container = {},
  config = {},
  state = null,
  rows = [],
  rowsResolved = false,
  hasMore = false,
  error = null,
  refinements = [],
  drillTransitions = [],
  hostIntent = null,
  additionalDiagnostics = [],
  semanticSummary = null,
  binding = null,
  semanticModel = null,
  model = null,
  pageGeometry = null,
} = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  const resolvedModel = model || buildPreviewAuthoredReportModel({
    container,
    config,
    state,
    refinements,
    drillTransitions,
    semanticSummary,
    binding,
    semanticModel,
  });
  if (!resolvedModel) {
    return null;
  }
  const reportSpec = resolvedModel?.reportSpec || {};
  const primaryRequest = Array.isArray(reportSpec?.datasets) && reportSpec.datasets[0]?.request
    ? reportSpec.datasets[0].request
    : {};
  const runtimeRows = Array.isArray(rows) ? rows : [];
  const { rows: refinedRows, hasMore: runtimeHasMore } = rowsResolved
    ? {
      rows: runtimeRows,
      hasMore: hasMore === true,
    }
    : runPreviewRuntimeRequest(
      runtimeRows,
      primaryRequest,
      config,
    );
  return buildReportBuilderRuntimePreview({
    model: resolvedModel,
    rows: refinedRows,
    hasMore: hasMore === true || runtimeHasMore === true,
    error,
    additionalDiagnostics,
    hostIntent,
    runtimeBlockId: "authoredRuntimePreview",
    runtimeTitle: "Authored Semantic Report",
    runtimeSubtitle: "Live builder state compiled into the current authored report runtime contract.",
    ...(pageGeometry && typeof pageGeometry === "object" && !Array.isArray(pageGeometry)
      ? { pageGeometry }
      : {}),
  });
}
