import {
  buildReportBuilderDefaultChartSpecs,
  buildReportBuilderDefaultTablePresets,
  prepareReportBuilderChartApplication,
  prepareReportBuilderTablePresetApplication,
} from "../../components/dashboard/reportBuilderUtils.js";
import { instantiateReportBuilderDocumentTemplate } from "../../components/dashboard/reportBuilderDocumentTemplates.js";
import { buildSavedReportExportRequest } from "../../reporting/reportExportRequestModel.js";
import { buildReportDocumentCompileState } from "../../reporting/reportDocumentStore.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import {
  buildReportBuilderDocumentCompileDiagnostics,
} from "../../components/dashboard/reportBuilderDocumentBlocks.js";
import {
  buildReportBuilderSemanticRuntimeDiagnosticsFromState,
  buildReportBuilderSemanticRuntimeDiagnostics,
} from "../../components/dashboard/reportBuilderSemantic.js";
import { resolveReportBuilderSemanticRuntimeState } from "../../components/dashboard/useReportBuilderSemanticRuntimeState.js";
import { buildPreviewAuthoredReport } from "./previewAuthoredReport.js";
import { buildPreviewReportDocumentTemplates } from "./previewReportDocumentTemplates.js";
import { runPreviewRuntimeRequest } from "./previewRuntimeQuery.js";

function normalizeString(value = "") {
  return value == null ? "" : String(value).trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export const PREVIEW_LANDSCAPE_PAGE_GEOMETRY = Object.freeze({
  width: 792,
  height: 612,
  marginTop: 36,
  marginRight: 36,
  marginBottom: 36,
  marginLeft: 36,
  headerHeight: 36,
  footerHeight: 24,
});

function buildPreviewSavedReportPayloadArtifacts({
  container = {},
  config = {},
  state = {},
  reportDocument = null,
  reportSpec = null,
  rows = [],
  compileDiagnostics = [],
  semanticSummary = null,
  pageGeometry = null,
} = {}) {
  if (
    !reportDocument
    || typeof reportDocument !== "object"
    || Array.isArray(reportDocument)
    || !reportSpec
    || typeof reportSpec !== "object"
    || Array.isArray(reportSpec)
  ) {
    return null;
  }
  const primaryRequest = Array.isArray(reportSpec?.datasets) && reportSpec.datasets[0]?.request
    ? reportSpec.datasets[0].request
    : {};
  const runtimeRows = Array.isArray(rows) ? rows : [];
  const { rows: refinedRows, hasMore } = runPreviewRuntimeRequest(runtimeRows, primaryRequest, config);
  const preview = buildReportBuilderRuntimePreview({
    model: {
      document: cloneValue(reportDocument),
      reportSpec: cloneValue(reportSpec),
    },
    rows: refinedRows,
    hasMore,
    additionalDiagnostics: Array.isArray(compileDiagnostics) ? compileDiagnostics : [],
    runtimeTitle: normalizeString(reportDocument?.title || reportSpec?.title || "Report") || "Report",
    runtimeSubtitle: normalizeString(
      reportDocument?.subtitle
      || reportDocument?.description
      || "Saved report payload preview compiled into ReportFill and ReportPrint.",
    ) || "Saved report payload preview compiled into ReportFill and ReportPrint.",
    ...(pageGeometry && typeof pageGeometry === "object" && !Array.isArray(pageGeometry)
      ? { pageGeometry }
      : {}),
  });
  if (!preview) {
    return null;
  }
  return {
    reportFill: cloneValue(preview.reportFill || null),
    reportPrint: cloneValue(preview.reportPrint || null),
    runtimeBlock: cloneValue(preview.runtimeBlock || null),
  };
}

function buildPreviewSavedReportPayloadCompileState({
  reportDocument = null,
  reportSpec = null,
  config = {},
  state = {},
  binding = null,
  semanticModel = null,
} = {}) {
  if (
    !reportDocument
    || typeof reportDocument !== "object"
    || Array.isArray(reportDocument)
    || !reportSpec
    || typeof reportSpec !== "object"
    || Array.isArray(reportSpec)
  ) {
    return null;
  }
  const runtimeDiagnostics = buildReportBuilderSemanticRuntimeDiagnosticsFromState({
    config,
    state,
    binding,
    model: semanticModel,
    providerAvailable: !!semanticModel,
    modelLoading: false,
    modelError: "",
  });
  const diagnostics = [
    ...buildReportBuilderDocumentCompileDiagnostics({
      document: reportDocument,
    }),
    ...runtimeDiagnostics,
  ];
  const seen = new Set();
  return buildReportDocumentCompileState(reportSpec, {
    diagnostics: diagnostics.filter((diagnostic) => {
      const key = [
        normalizeString(diagnostic?.code),
        normalizeString(diagnostic?.severity),
        normalizeString(diagnostic?.path),
        normalizeString(diagnostic?.message),
      ].join("::");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }),
  });
}

function buildDefaultPreviewSavedPayloadBaseState(reportBuilderConfig = {}) {
  return {
    selectedMeasures: ["avails", "hhUniqs"],
    primaryMeasure: "avails",
    selectedDimensions: ["eventDate", "channelV2"],
    viewMode: "table",
    chartSpec: null,
    orderField: "eventDate",
    orderDir: "asc",
    pageSize: 50,
    staticFilters: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-04",
      },
    },
    binding: cloneValue(reportBuilderConfig.binding || null),
  };
}

export function buildPreviewSavedReportPayloadRecordFromSeed({
  container = {},
  reportBuilderConfig = {},
  rows = [],
  semanticModel = null,
  seed = null,
} = {}) {
  const normalizedSeed = seed && typeof seed === "object" && !Array.isArray(seed)
    ? seed
    : {};
  const {
    container: _ignoredContainer,
    reportBuilderConfig: _ignoredReportBuilderConfig,
    rows: _ignoredRows,
    semanticModel: seededSemanticModel,
    ...recordSeed
  } = normalizedSeed;
  return buildPreviewSavedReportPayloadRecord({
    container,
    reportBuilderConfig,
    rows,
    semanticModel: seededSemanticModel || semanticModel || null,
    ...recordSeed,
  });
}

export function buildPreviewSavedReportPayloadRecord({
  container = {},
  reportBuilderConfig = {},
  rows = [],
  semanticModel = null,
  baseState = null,
  reportId = "",
  title = "",
  presetKind = "table",
  presetTitle = "",
  templateId = "",
  documentVersion = 0,
  artifactId = "",
  savedAt = 0,
  pageGeometry = null,
} = {}) {
  const resolvedBaseState = baseState && typeof baseState === "object" && !Array.isArray(baseState)
    ? cloneValue(baseState)
    : buildDefaultPreviewSavedPayloadBaseState(reportBuilderConfig);
  const normalizedPresetKind = normalizeString(presetKind || "table").toLowerCase() || "table";
  const normalizedTemplateId = normalizeString(templateId);
  if (normalizedTemplateId) {
    const availableTemplates = Array.isArray(reportBuilderConfig?.reportDocumentTemplates) && reportBuilderConfig.reportDocumentTemplates.length > 0
      ? reportBuilderConfig.reportDocumentTemplates
      : buildPreviewReportDocumentTemplates();
    const resolvedTemplate = availableTemplates.find((entry) => normalizeString(entry?.id) === normalizedTemplateId) || null;
    if (!resolvedTemplate) {
      throw new Error(`Unknown report builder template '${normalizedTemplateId}'.`);
    }
    const instantiated = instantiateReportBuilderDocumentTemplate(reportBuilderConfig, resolvedTemplate);
    if (!instantiated.valid || !instantiated.nextState) {
      throw new Error(instantiated.diagnostics?.[0]?.message || `Could not instantiate template '${normalizedTemplateId}'.`);
    }
    const nextState = cloneValue(instantiated.nextState);
    if (normalizedPresetKind === "table" && normalizeString(presetTitle)) {
      const resolvedPreset = buildReportBuilderDefaultTablePresets(reportBuilderConfig, nextState)
        .find((entry) => normalizeString(entry?.title) === normalizeString(presetTitle));
      if (!resolvedPreset) {
        throw new Error(`Unknown report builder table preset '${presetTitle}'.`);
      }
      const preparedPreset = prepareReportBuilderTablePresetApplication(reportBuilderConfig, nextState, resolvedPreset, {
        selectionPolicy: "replace",
        forceAutoFetch: false,
      });
      if (!preparedPreset.canApply) {
        throw new Error(preparedPreset.message || `Could not align template '${normalizedTemplateId}' with table preset '${presetTitle}'.`);
      }
      const templateAlignedPreset = preparedPreset.nextState?.activeTablePreset && typeof preparedPreset.nextState.activeTablePreset === "object"
        ? {
          ...cloneValue(preparedPreset.nextState.activeTablePreset),
          dimensions: cloneValue(nextState.selectedDimensions || []),
          measures: cloneValue(nextState.selectedMeasures || []),
          primaryMeasure: normalizeString(nextState.primaryMeasure || preparedPreset.nextState.activeTablePreset.primaryMeasure),
          orderField: normalizeString(nextState.orderField || preparedPreset.nextState.activeTablePreset.orderField),
          orderDir: normalizeString(nextState.orderDir || preparedPreset.nextState.activeTablePreset.orderDir || "desc"),
          ...(normalizeString(nextState.groupBy) ? { groupBy: normalizeString(nextState.groupBy) } : {}),
          ...(Number(nextState.pageSize || 0) > 0 ? { pageSize: Number(nextState.pageSize) } : {}),
        }
        : null;
      nextState.activeTablePreset = cloneValue(templateAlignedPreset);
      nextState.lastTablePreset = cloneValue(templateAlignedPreset);
    }
    if (normalizedPresetKind === "chart" && normalizeString(presetTitle)) {
      const resolvedPreset = buildReportBuilderDefaultChartSpecs(reportBuilderConfig, nextState)
        .find((entry) => normalizeString(entry?.title) === normalizeString(presetTitle));
      if (!resolvedPreset) {
        throw new Error(`Unknown report builder chart preset '${presetTitle}'.`);
      }
      const preparedChart = prepareReportBuilderChartApplication(reportBuilderConfig, nextState, resolvedPreset, {
        autoProvisionMissingDimensions: true,
        forceAutoFetch: false,
        selectionPolicy: "replace",
      });
      if (!preparedChart.canApply) {
        throw new Error(preparedChart.message || `Could not align template '${normalizedTemplateId}' with chart preset '${presetTitle}'.`);
      }
      Object.assign(nextState, cloneValue(preparedChart.nextState || {}));
    }
    const semanticRuntimeState = resolveReportBuilderSemanticRuntimeState({
      config: reportBuilderConfig,
      state: nextState,
      binding: nextState?.binding || reportBuilderConfig.binding || null,
      model: semanticModel,
    });
    const model = buildReportBuilderRuntimePreviewModel({
      container,
      config: semanticRuntimeState.semanticDisplayConfig,
      state: nextState,
      semanticSummary: semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
      binding: nextState?.binding || reportBuilderConfig.binding || null,
      semanticModel,
    });
    if (!model?.document || !model?.reportSpec) {
      throw new Error(`Could not build template-authored report payload for '${normalizedTemplateId}'.`);
    }
    const reportDocument = cloneValue(model.document);
    const reportSpec = cloneValue(model.reportSpec);
    reportDocument.id = normalizeString(reportId);
    reportDocument.title = normalizeString(title || reportId || reportDocument.title || "Report") || "Report";
    if (Array.isArray(reportDocument.blocks)) {
      reportDocument.blocks = reportDocument.blocks.map((block) => (
        normalizeString(block?.kind) === "reportBuilderBlock"
          ? {
            ...block,
            title: reportDocument.title,
            state: {
              ...(block?.state && typeof block.state === "object" && !Array.isArray(block.state) ? cloneValue(block.state) : {}),
              reportDocumentTitle: reportDocument.title,
            },
          }
          : block
      ));
    }
    reportSpec.title = reportDocument.title;
    const compileState = buildPreviewSavedReportPayloadCompileState({
      reportDocument,
      reportSpec,
      config: semanticRuntimeState.semanticDisplayConfig,
      state: nextState,
      binding: nextState?.binding || reportBuilderConfig.binding || null,
      semanticModel,
    });
    const savedReportPayload = {
      version: 1,
      kind: "reportBuilder.savedReportPayload",
      payloadId: `rbreport_${normalizeString(artifactId || reportId || normalizedTemplateId || "report")}`,
      savedAt: Number(savedAt || 0) || 0,
      title: reportDocument.title,
      sourceArtifactId: normalizeString(artifactId || reportId || normalizedTemplateId || "report"),
      sourceSession: {
        sessionId: `rbexplore_${normalizeString(reportId || normalizedTemplateId || "report")}`,
        sourceRef: {
          kind: "reportBuilder.reportTemplate",
          templateId: normalizedTemplateId,
          templateLabel: normalizeString(resolvedTemplate?.label || normalizedTemplateId),
          contextLabel: `${reportDocument.title} • ${normalizeString(presetTitle || resolvedTemplate?.label || normalizedTemplateId)}`,
        },
      },
      reportDocument,
      reportSpec,
      ...(compileState ? { compileState } : {}),
    };
    const previewArtifacts = buildPreviewSavedReportPayloadArtifacts({
      container,
      config: semanticRuntimeState.semanticDisplayConfig,
      state: nextState,
      reportDocument,
      reportSpec,
      rows,
      compileDiagnostics: compileState?.diagnostics || [],
      semanticSummary: semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
      pageGeometry,
    });
    const exportRequest = buildSavedReportExportRequest({
      savedReportPayload,
      reportFill: previewArtifacts?.reportFill || null,
      reportPrint: previewArtifacts?.reportPrint || null,
      documentVersion: Number(documentVersion || 0) || 0,
      format: "pdf",
    });
    return {
      documentVersion: Number(documentVersion || 0) || 0,
      savedAt: Number(savedAt || 0) || 0,
      ...(previewArtifacts || {}),
      ...(exportRequest ? { exportRequest } : {}),
      savedReportPayload,
    };
  }
  if (!normalizeString(presetTitle)) {
    const semanticRuntimeState = resolveReportBuilderSemanticRuntimeState({
      config: reportBuilderConfig,
      state: resolvedBaseState,
      binding: resolvedBaseState?.binding || reportBuilderConfig.binding || null,
      model: semanticModel,
    });
    const authored = buildPreviewAuthoredReport({
      container,
      config: semanticRuntimeState.semanticDisplayConfig,
      state: resolvedBaseState,
      rows,
      semanticSummary: semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
      pageGeometry,
    });
    if (!authored?.document || !authored?.reportSpec) {
      throw new Error(`Could not build authored report payload for '${normalizeString(reportId || title || artifactId || "report")}'.`);
    }
    const reportDocument = cloneValue(authored.document);
    const reportSpec = cloneValue(authored.reportSpec);
    reportDocument.id = normalizeString(reportId);
    reportDocument.title = normalizeString(title || reportId || "Report") || "Report";
    if (Array.isArray(reportDocument.blocks)) {
      reportDocument.blocks = reportDocument.blocks.map((block) => (
        normalizeString(block?.kind) === "reportBuilderBlock"
          ? {
            ...block,
            title: reportDocument.title,
            state: {
              ...(block?.state && typeof block.state === "object" && !Array.isArray(block.state) ? cloneValue(block.state) : {}),
              reportDocumentTitle: reportDocument.title,
            },
          }
          : block
      ));
    }
    reportSpec.title = reportDocument.title;
    const compileState = buildPreviewSavedReportPayloadCompileState({
      reportDocument,
      reportSpec,
      config: semanticRuntimeState.semanticDisplayConfig,
      state: resolvedBaseState,
      binding: resolvedBaseState?.binding || reportBuilderConfig.binding || null,
      semanticModel,
    });
    const savedReportPayload = {
      version: 1,
      kind: "reportBuilder.savedReportPayload",
      payloadId: `rbreport_${normalizeString(artifactId || reportId || "report")}`,
      savedAt: Number(savedAt || 0) || 0,
      title: reportDocument.title,
      sourceArtifactId: normalizeString(artifactId || reportId || "report"),
      sourceSession: {
        sessionId: `rbexplore_${normalizeString(reportId || "report")}`,
        sourceRef: {
          kind: normalizeString(resolvedBaseState?.viewMode) === "chart" && resolvedBaseState?.chartSpec ? "reportBuilder.chartResult" : "reportBuilder.result",
          contextLabel: `${reportDocument.title} • ${normalizeString(resolvedBaseState?.chartSpec?.title || "Current Builder State")}`,
        },
      },
      reportDocument,
      reportSpec,
      ...(compileState ? { compileState } : {}),
    };
    const previewArtifacts = buildPreviewSavedReportPayloadArtifacts({
      container,
      config: semanticRuntimeState.semanticDisplayConfig,
      state: resolvedBaseState,
      reportDocument,
      reportSpec,
      rows,
      compileDiagnostics: compileState?.diagnostics || [],
      semanticSummary: semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
      pageGeometry,
    });
    const exportRequest = buildSavedReportExportRequest({
      savedReportPayload,
      reportFill: previewArtifacts?.reportFill || null,
      reportPrint: previewArtifacts?.reportPrint || null,
      documentVersion: Number(documentVersion || 0) || 0,
      format: "pdf",
    });
    return {
      documentVersion: Number(documentVersion || 0) || 0,
      savedAt: Number(savedAt || 0) || 0,
      ...(previewArtifacts || {}),
      ...(exportRequest ? { exportRequest } : {}),
      savedReportPayload,
    };
  }
  const availablePresets = normalizedPresetKind === "chart"
    ? buildReportBuilderDefaultChartSpecs(reportBuilderConfig, resolvedBaseState)
    : buildReportBuilderDefaultTablePresets(reportBuilderConfig, resolvedBaseState);
  const resolvedPreset = (Array.isArray(availablePresets) ? availablePresets : [])
    .find((entry) => normalizeString(entry?.title) === normalizeString(presetTitle));
  if (!resolvedPreset) {
    throw new Error(`Unknown report builder ${normalizedPresetKind} preset '${presetTitle}'.`);
  }
  const prepared = normalizedPresetKind === "chart"
    ? prepareReportBuilderChartApplication(reportBuilderConfig, resolvedBaseState, resolvedPreset, {
      autoProvisionMissingDimensions: true,
      forceAutoFetch: false,
      selectionPolicy: "replace",
    })
    : prepareReportBuilderTablePresetApplication(reportBuilderConfig, resolvedBaseState, resolvedPreset, {
      selectionPolicy: "replace",
      forceAutoFetch: false,
    });
  if (!prepared || typeof prepared !== "object") {
    throw new Error(`Could not prepare ${normalizedPresetKind} preset '${presetTitle}'.`);
  }
  if (!prepared.canApply) {
    throw new Error(prepared.message || `Could not prepare ${normalizedPresetKind} preset '${presetTitle}'.`);
  }
  const semanticRuntimeState = resolveReportBuilderSemanticRuntimeState({
    config: reportBuilderConfig,
    state: prepared.nextState,
    binding: prepared.nextState?.binding || reportBuilderConfig.binding || null,
    model: semanticModel,
  });
  const authored = buildPreviewAuthoredReport({
    container,
    config: semanticRuntimeState.semanticDisplayConfig,
    state: prepared.nextState,
    rows,
    semanticSummary: semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
    pageGeometry,
  });
  if (!authored?.document || !authored?.reportSpec) {
    throw new Error(`Could not build authored report payload for '${presetTitle}'.`);
  }
  const reportDocument = cloneValue(authored.document);
  const reportSpec = cloneValue(authored.reportSpec);
  reportDocument.id = normalizeString(reportId);
  reportDocument.title = normalizeString(title || reportId || "Report") || "Report";
  if (Array.isArray(reportDocument.blocks)) {
    reportDocument.blocks = reportDocument.blocks.map((block) => (
      normalizeString(block?.kind) === "reportBuilderBlock"
        ? {
          ...block,
          title: reportDocument.title,
          state: {
            ...(block?.state && typeof block.state === "object" && !Array.isArray(block.state) ? cloneValue(block.state) : {}),
            reportDocumentTitle: reportDocument.title,
          },
        }
        : block
    ));
  }
  reportSpec.title = reportDocument.title;
  const compileState = buildPreviewSavedReportPayloadCompileState({
    reportDocument,
    reportSpec,
    config: semanticRuntimeState.semanticDisplayConfig,
    state: prepared.nextState,
    binding: prepared.nextState?.binding || reportBuilderConfig.binding || null,
    semanticModel,
  });
  const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: `rbreport_${normalizeString(artifactId || reportId || "report")}`,
    savedAt: Number(savedAt || 0) || 0,
    title: reportDocument.title,
    sourceArtifactId: normalizeString(artifactId || reportId || "report"),
    sourceSession: {
      sessionId: `rbexplore_${normalizeString(reportId || "report")}`,
      sourceRef: {
        kind: normalizedPresetKind === "chart" ? "reportBuilder.chartResult" : "reportBuilder.tablePreset",
        contextLabel: `${reportDocument.title} • ${resolvedPreset.title}`,
      },
    },
    reportDocument,
    reportSpec,
    ...(compileState ? { compileState } : {}),
  };
  const previewArtifacts = buildPreviewSavedReportPayloadArtifacts({
    container,
    config: semanticRuntimeState.semanticDisplayConfig,
    state: prepared.nextState,
    reportDocument,
    reportSpec,
    rows,
    compileDiagnostics: compileState?.diagnostics || [],
    semanticSummary: semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
    pageGeometry,
  });
  const exportRequest = buildSavedReportExportRequest({
    savedReportPayload,
    reportFill: previewArtifacts?.reportFill || null,
    reportPrint: previewArtifacts?.reportPrint || null,
    documentVersion: Number(documentVersion || 0) || 0,
    format: "pdf",
  });
  return {
    documentVersion: Number(documentVersion || 0) || 0,
    savedAt: Number(savedAt || 0) || 0,
    ...(previewArtifacts || {}),
    ...(exportRequest ? { exportRequest } : {}),
    savedReportPayload,
  };
}
