import {
  buildReportDocumentChartBlock,
  buildReportDocumentGeoMapBlock,
  buildReportDocumentKpiBlock,
  buildReportDocumentMarkdownBlock,
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

export const AUTHORED_LANDSCAPE_MIXED_ROWS = Object.freeze([
  Object.freeze({ eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500, stateCode: "CA", stateName: "California", spend: 1200000, status: "critical" }),
  Object.freeze({ eventDate: "2026-05-02", channelId: "CTV", totalSpend: 34300, impressions: 14700, stateCode: "WA", stateName: "Washington", spend: 980000, status: "healthy" }),
  Object.freeze({ eventDate: "2026-05-03", channelId: "Display", totalSpend: 55200, impressions: 23100, stateCode: "CA", stateName: "California", spend: 1200000, status: "critical" }),
  Object.freeze({ eventDate: "2026-05-04", channelId: "CTV", totalSpend: 48800, impressions: 20800, stateCode: "WA", stateName: "Washington", spend: 980000, status: "healthy" }),
]);

function buildAuthoredLandscapeMixedConfig(title = "Authored Landscape Mixed Report") {
  return {
    title,
    measures: [
      { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
      { id: "impressions", key: "impressions", label: "Impressions", format: "compactNumber" },
      { id: "spend", key: "spend", label: "State Spend", format: "currency" },
    ],
    computedMeasures: [
      {
        id: "spendPerImpression",
        key: "spendPerImpression",
        label: "Spend / Impression",
        format: "number",
        compute: {
          type: "ratio",
          numerator: "totalSpend",
          denominator: "impressions",
          decimals: 2,
        },
      },
    ],
    dimensions: [
      { id: "eventDate", key: "eventDate", label: "Date", default: true, chartAxis: true, format: "date" },
      { id: "channelId", key: "channelId", label: "Channel", default: true },
      { id: "stateCode", key: "stateCode", label: "State" },
      { id: "stateName", key: "stateName", label: "State Name" },
      { id: "status", key: "status", label: "Status" },
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

function buildAuthoredLandscapeMixedState() {
  return {
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["eventDate", "channelId"],
    viewMode: "table",
    orderField: "eventDate",
    orderDir: "asc",
    staticFilters: {
      dateRange: { start: "2026-05-01", end: "2026-05-04" },
    },
    reportDocumentLayout: {
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "channelTrend" },
        { blockId: "stateGeo" },
        { blockId: "narrativeIntro", size: "half" },
        { blockId: "headlineKpi", size: "half" },
      ],
    },
  };
}

export function buildAuthoredLandscapeMixedSavedReportRecord({
  containerId = "authoredLandscapeMixedBuilder",
  stateKey = "",
  dataSourceRef = "demoReportSource",
  reportId = "",
  title = "Authored Landscape Mixed Report",
  payloadId = "rbreport_authored_landscape_mixed_report",
  sourceArtifactId = "authored_landscape_mixed_report",
  savedAt = 9900,
  documentVersion = 13,
} = {}) {
  const normalizedContainerId = normalizeString(containerId) || "authoredLandscapeMixedBuilder";
  const normalizedStateKey = normalizeString(stateKey || normalizedContainerId);
  const normalizedReportId = normalizeString(reportId || normalizedContainerId);
  const normalizedTitle = normalizeString(title || normalizedReportId || normalizedContainerId) || "Authored Landscape Mixed Report";
  const config = buildAuthoredLandscapeMixedConfig(normalizedTitle);
  const state = {
    ...buildAuthoredLandscapeMixedState(),
    reportDocumentBlocks: [
      buildReportDocumentChartBlock({
        id: "channelTrend",
        title: "Channel Trend",
        datasetRef: "primary",
        chartSpec: {
          type: "line",
          xField: "eventDate",
          yFields: ["totalSpend"],
          seriesField: "channelId",
        },
      }),
      buildReportDocumentGeoMapBlock({
        id: "stateGeo",
        title: "State Performance",
        datasetRef: "primary",
        geo: {
          shape: "us-states",
          key: "stateCode",
          labelKey: "stateName",
          metric: {
          key: "spend",
          label: "State Spend",
          format: "currency",
        },
        aggregate: "sum",
        color: {
          field: "status",
          rules: [
            { value: "critical", label: "Critical", color: "#db3737" },
            { value: "healthy", label: "Healthy", color: "#d9f0ea" },
          ],
        },
      },
      }),
      buildReportDocumentMarkdownBlock({
        id: "narrativeIntro",
        title: "Executive Summary",
        markdown: "## Executive Summary\nThe report opens with a short narrative block.",
      }),
      buildReportDocumentKpiBlock({
        id: "headlineKpi",
        title: "Headline KPI",
        datasetRef: "primary",
        valueField: "spendPerImpression",
        valueLabel: "Spend / Impression",
        secondaryField: "channelId",
        secondaryLabel: "Channel",
        description: "Summarizes the first authored runtime row with a non-selected derived measure.",
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
    includeScopeBlock: false,
    includeRefinementBlock: false,
  });
  if (!model?.document || !model?.reportSpec) {
    throw new Error(`Could not build authored mixed landscape runtime model for ${normalizedReportId}.`);
  }
  const document = cloneValue(model.document);
  document.title = normalizedTitle;
  document.id = normalizedReportId;
  const primaryBuilderBlock = Array.isArray(document.blocks)
    ? document.blocks.find((block) => normalizeString(block?.id) === "primaryBuilder" && normalizeString(block?.kind) === "reportBuilderBlock")
    : null;
  if (primaryBuilderBlock?.state?.groupBy === "") {
    delete primaryBuilderBlock.state.groupBy;
  }
  const reportSpec = cloneValue(model.reportSpec);
  reportSpec.title = normalizedTitle;

  const preview = buildReportBuilderRuntimePreview({
    model: { document, reportSpec },
    rows: AUTHORED_LANDSCAPE_MIXED_ROWS,
    hasMore: false,
    pageGeometry: AUTHORED_LANDSCAPE_PAGE_GEOMETRY,
  });
  if (!preview?.reportFill || !preview?.reportPrint) {
    throw new Error(`Could not build authored mixed landscape runtime preview for ${normalizedReportId}.`);
  }

  const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: normalizeString(payloadId) || "rbreport_authored_landscape_mixed_report",
    savedAt: Number(savedAt || 0) || 0,
    title: normalizedTitle,
    sourceArtifactId: normalizeString(sourceArtifactId) || "authored_landscape_mixed_report",
    sourceSession: {
      sessionId: `rbexplore_${normalizedReportId}`,
      sourceRef: {
        kind: "reportBuilder.result",
        contextLabel: `${normalizedTitle} • Channel Trend`,
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
    throw new Error(`Could not build authored mixed landscape saved export request for ${normalizedReportId}.`);
  }

  return {
    documentVersion: Number(documentVersion || 0) || 0,
    savedAt: Number(savedAt || 0) || 0,
    savedReportPayload,
    exportRequest,
  };
}
