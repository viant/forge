import {
  buildReportDocumentChartBlock,
} from "../reportDocumentModel.js";
import { buildSavedReportExportRequest } from "../reportExportRequestModel.js";
import { buildReportDocumentCompileState } from "../reportDocumentStore.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const AUTHORED_LANDSCAPE_ROWS = Object.freeze([
  Object.freeze({ eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500 }),
  Object.freeze({ eventDate: "2026-05-02", channelId: "CTV", totalSpend: 34300, impressions: 14700 }),
  Object.freeze({ eventDate: "2026-05-03", channelId: "Display", totalSpend: 55200, impressions: 23100 }),
  Object.freeze({ eventDate: "2026-05-04", channelId: "CTV", totalSpend: 48800, impressions: 20800 }),
]);

export const AUTHORED_LANDSCAPE_PAGE_GEOMETRY = Object.freeze({
  width: 792,
  height: 612,
  marginTop: 36,
  marginRight: 36,
  marginBottom: 36,
  marginLeft: 36,
  headerHeight: 36,
  footerHeight: 24,
});

function buildAuthoredLandscapeConfig(title = "Authored Landscape Report") {
  return {
    title,
    measures: [
      { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
      { id: "impressions", key: "impressions", label: "Impressions", format: "compactNumber" },
    ],
    dimensions: [
      { id: "eventDate", key: "eventDate", label: "Date", default: true, chartAxis: true, format: "date" },
      { id: "channelId", key: "channelId", label: "Channel", default: true },
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

function buildAuthoredLandscapeState() {
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
      ],
    },
  };
}

export function buildAuthoredLandscapeSavedReportRecord({
  containerId = "authoredLandscapeBuilder",
  stateKey = "",
  dataSourceRef = "demoReportSource",
  reportId = "",
  title = "Authored Landscape Report",
  payloadId = "rbreport_authored_landscape_report",
  sourceArtifactId = "authored_landscape_report",
  savedAt = 9700,
  documentVersion = 12,
} = {}) {
  const normalizedContainerId = normalizeString(containerId) || "authoredLandscapeBuilder";
  const normalizedStateKey = normalizeString(stateKey || normalizedContainerId);
  const normalizedReportId = normalizeString(reportId || normalizedContainerId);
  const normalizedTitle = normalizeString(title || normalizedReportId || normalizedContainerId) || "Authored Landscape Report";
  const config = buildAuthoredLandscapeConfig(normalizedTitle);
  const state = {
    ...buildAuthoredLandscapeState(),
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
    throw new Error(`Could not build authored landscape runtime model for ${normalizedReportId}.`);
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
    rows: AUTHORED_LANDSCAPE_ROWS,
    hasMore: false,
    pageGeometry: AUTHORED_LANDSCAPE_PAGE_GEOMETRY,
  });
  if (!preview?.reportFill || !preview?.reportPrint) {
    throw new Error(`Could not build authored landscape runtime preview for ${normalizedReportId}.`);
  }

  const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: normalizeString(payloadId) || "rbreport_authored_landscape_report",
    savedAt: Number(savedAt || 0) || 0,
    title: normalizedTitle,
    sourceArtifactId: normalizeString(sourceArtifactId) || "authored_landscape_report",
    sourceSession: {
      sessionId: `rbexplore_${normalizedReportId}`,
      sourceRef: {
        kind: "reportBuilder.chartResult",
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
    throw new Error(`Could not build authored landscape saved export request for ${normalizedReportId}.`);
  }

  return {
    documentVersion: Number(documentVersion || 0) || 0,
    savedAt: Number(savedAt || 0) || 0,
    savedReportPayload,
    exportRequest,
  };
}
