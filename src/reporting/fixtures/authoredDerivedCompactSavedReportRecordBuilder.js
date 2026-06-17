import {
  buildReportDocumentChartBlock,
  buildReportDocumentTableBlock,
} from "../reportDocumentModel.js";
import { buildSavedReportExportRequest } from "../reportExportRequestModel.js";
import { buildReportDocumentCompileState } from "../reportDocumentStore.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import { AUTHORED_LANDSCAPE_PAGE_GEOMETRY } from "./authoredLandscapeSavedReportRecordBuilder.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export const AUTHORED_DERIVED_COMPACT_ROWS = Object.freeze([
  Object.freeze({ country: "US", channelId: "Display", totalSpend: 82800, hhUniqs: 33800 }),
  Object.freeze({ country: "US", channelId: "CTV", totalSpend: 70300, hhUniqs: 30100 }),
  Object.freeze({ country: "CA", channelId: "Display", totalSpend: 75800, hhUniqs: 31100 }),
  Object.freeze({ country: "CA", channelId: "CTV", totalSpend: 67700, hhUniqs: 28300 }),
]);

function buildAuthoredDerivedCompactConfig(title = "Authored Derived Compact Report") {
  return {
    title,
    measures: [
      { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
      { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
    dimensions: [
      {
        id: "country",
        key: "country",
        label: "Market",
        default: true,
        runtimeFilter: {
          includeParamPath: "filters.includeCountry",
          excludeParamPath: "filters.excludeCountry",
        },
      },
      {
        id: "channelId",
        key: "channelId",
        label: "Channel",
        runtimeFilter: {
          includeParamPath: "filters.includeChannelId",
          excludeParamPath: "filters.excludeChannelId",
        },
      },
    ],
    staticFilters: [
      {
        id: "dateRange",
        type: "dateRange",
        required: true,
        startParamPath: "filters.From",
        endParamPath: "filters.To",
        default: { start: "2026-05-01", end: "2026-05-04" },
      },
    ],
    result: {
      defaultMode: "table",
      pageSize: 50,
    },
  };
}

function buildAuthoredDerivedCompactState() {
  return {
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["country"],
    viewMode: "table",
    orderField: "country",
    orderDir: "asc",
    staticFilters: {
      dateRange: { start: "2026-05-01", end: "2026-05-04" },
    },
    localCalculatedFields: [
      {
        id: "reachRate",
        key: "reachRate",
        kind: "rowCalc",
        label: "Reach Rate",
        dataType: "number",
        format: "percent",
        datasetRef: "primary",
        dependencies: ["hhUniqs", "totalSpend"],
        expr: "if(totalSpend = 0, null, round((hhUniqs / totalSpend) * 100, 2))",
      },
    ],
    reportDocumentLayout: {
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "reachRateTrend" },
        { blockId: "reachRateTable" },
      ],
    },
  };
}

export function buildAuthoredDerivedCompactSavedReportRecord({
  containerId = "authoredDerivedCompactBuilder",
  stateKey = "",
  dataSourceRef = "demoReportSource",
  reportId = "",
  title = "Authored Derived Compact Report",
  payloadId = "rbreport_authored_derived_compact_report",
  sourceArtifactId = "authored_derived_compact_report",
  savedAt = 10050,
  documentVersion = 14,
  refinements = [],
  drillTransitions = [],
  rows = AUTHORED_DERIVED_COMPACT_ROWS,
} = {}) {
  const normalizedContainerId = normalizeString(containerId) || "authoredDerivedCompactBuilder";
  const normalizedStateKey = normalizeString(stateKey || normalizedContainerId);
  const normalizedReportId = normalizeString(reportId || normalizedContainerId);
  const normalizedTitle = normalizeString(title || normalizedReportId || normalizedContainerId) || "Authored Derived Compact Report";
  const config = buildAuthoredDerivedCompactConfig(normalizedTitle);
  const state = {
    ...buildAuthoredDerivedCompactState(),
    reportDocumentBlocks: [
      buildReportDocumentChartBlock({
        id: "reachRateTrend",
        title: "Reach Rate by Market",
        datasetRef: "primary",
        chartSpec: {
          type: "line",
          xField: "country",
          yFields: ["reachRate"],
          seriesField: "channelId",
        },
      }),
      buildReportDocumentTableBlock({
        id: "reachRateTable",
        title: "Reach Rate Table",
        datasetRef: "primary",
        columns: [
          { key: "country", label: "Market" },
          { key: "channelId", label: "Channel" },
          { key: "reachRate", label: "Reach Rate", format: "percent" },
        ],
      }),
    ],
  };
  const model = buildReportBuilderRuntimePreviewModel({
    container: {
      id: normalizedContainerId,
      stateKey: normalizedStateKey,
      title: normalizedTitle,
      dataSourceRef: normalizeString(dataSourceRef),
    },
    config,
    state,
    refinements,
    drillTransitions,
    includeScopeBlock: false,
    includeRefinementBlock: false,
  });
  if (!model?.document || !model?.reportSpec) {
    throw new Error(`Could not build authored derived compact runtime model for ${normalizedReportId}.`);
  }
  const document = cloneValue(model.document);
  document.title = normalizedTitle;
  document.id = normalizedReportId;
  const reportSpec = cloneValue(model.reportSpec);
  reportSpec.title = normalizedTitle;

  const preview = buildReportBuilderRuntimePreview({
    model: { document, reportSpec },
    rows: Array.isArray(rows) ? rows : AUTHORED_DERIVED_COMPACT_ROWS,
    hasMore: false,
    pageGeometry: AUTHORED_LANDSCAPE_PAGE_GEOMETRY,
  });
  if (!preview?.reportFill || !preview?.reportPrint) {
    throw new Error(`Could not build authored derived compact runtime preview for ${normalizedReportId}.`);
  }

  const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: normalizeString(payloadId) || "rbreport_authored_derived_compact_report",
    savedAt: Number(savedAt || 0) || 0,
    title: normalizedTitle,
    sourceArtifactId: normalizeString(sourceArtifactId) || "authored_derived_compact_report",
    sourceSession: {
      sessionId: `rbexplore_${normalizedReportId}`,
      sourceRef: {
        kind: "reportBuilder.result",
        contextLabel: `${normalizedTitle} • Reach Rate by Market`,
      },
    },
    reportDocument: document,
    reportSpec,
    compileState: buildReportDocumentCompileState(reportSpec, {
      diagnostics: [],
    }),
  };

  const exportRequest = buildSavedReportExportRequest({
    savedReportPayload,
    reportFill: preview.reportFill,
    reportPrint: preview.reportPrint,
    documentVersion: Number(documentVersion || 0) || 0,
    format: "pdf",
  });
  if (!exportRequest) {
    throw new Error(`Could not build authored derived compact saved export request for ${normalizedReportId}.`);
  }

  return {
    documentVersion: Number(documentVersion || 0) || 0,
    savedAt: Number(savedAt || 0) || 0,
    savedReportPayload,
    exportRequest,
  };
}
