import {
  buildReportBuilderReportDocument,
  buildReportDocumentFilterBarBlock,
  buildReportDocumentRefinementBarBlock,
  lowerReportDocumentToReportSpec,
  normalizeReportBuilderDocumentBlocks,
} from "../../reporting/reportDocumentModel.js";
import { buildDraftReportExportRequest } from "../../reporting/reportExportRequestModel.js";
import { buildReportFillFromReportSpec } from "../../reporting/reportFillModel.js";
import { buildReportPrintFromReportFill } from "../../reporting/reportPrintModel.js";
import { buildDashboardReportRuntimeBlock } from "../../reporting/reportRuntimeBlock.js";
import { applyReportRuntimeRequestRefinements } from "../../reporting/reportRuntimeRefinementFilter.js";
import {
  applyRuntimeRequestRefinementFilters,
  hasRuntimeRequestRefinementFilter,
} from "../../reporting/reportRuntimeRequestRefinementModel.js";
import {
  applyReportBuilderSemanticConfig,
  buildReportBuilderSemanticSummary,
  normalizeReportBuilderSemanticSummary,
} from "./reportBuilderSemantic.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { resolveReportBuilderScopeParamFilters } from "./reportBuilderPredicates.js";
import { resolveScopeParamId } from "../../reporting/scopeStateModel.js";
import { buildReportBuilderCalculatedFieldConfig } from "./reportBuilderCalculatedFieldAuthoring.js";
import { applyReportRuntimeDrillTransitions } from "./reportRuntimeDrillState.js";
import {
  buildReportBuilderDocumentBlockDraft,
  buildReportBuilderDocumentBlockFieldOptionsFromPreparedConfig,
  validateReportBuilderDocumentBlockDraft,
} from "./reportBuilderDocumentBlocks.js";
import {
  resolveReportBuilderDimensionByField,
} from "./reportBuilderUtils.js";
import {
  buildReportBuilderStaticDatasetPayloadMap,
  normalizeReportBuilderStaticDatasets,
} from "./reportBuilderStaticDatasets.js";
import { resolvePreferredReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewPreference.js";
import {
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimeRefinementFields,
} from "./reportRuntimeModel.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import { normalizeReportBuilderErrorText } from "./reportBuilderErrorText.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeRuntimePreviewDiagnostics(error = null, additionalDiagnostics = []) {
  const diagnostics = [];
  const errorDiagnostics = Array.isArray(error?.diagnostics)
    ? error.diagnostics
    : [];
  if (error && errorDiagnostics.length === 0) {
    const message = normalizeReportBuilderErrorText(error)
      || (typeof error?.message === "string" && error.message.trim()
        ? error.message.trim()
        : String(error));
    diagnostics.push({
      code: "runtimePreviewError",
      severity: "error",
      message,
    });
  }
  if (errorDiagnostics.length > 0) {
    errorDiagnostics.forEach((diagnostic) => {
      if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return;
      }
      diagnostics.push(cloneValue(diagnostic));
    });
  }
  if (Array.isArray(additionalDiagnostics)) {
    additionalDiagnostics.forEach((diagnostic) => {
      if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return;
      }
      diagnostics.push(cloneValue(diagnostic));
    });
  }
  const seen = new Set();
  return diagnostics.filter((diagnostic) => {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
      return false;
    }
    const key = [
      normalizeString(diagnostic?.code),
      normalizeString(diagnostic?.severity),
      normalizeString(diagnostic?.path),
      normalizeString(diagnostic?.message),
      normalizeString(diagnostic?.suggestedFix),
    ].join("::");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolveRuntimePreviewSemanticSummary({
  config = {},
  state = {},
  semanticSummary = null,
  binding = null,
  semanticModel = null,
} = {}) {
  const explicitSummary = normalizeReportBuilderSemanticSummary(semanticSummary);
  if (explicitSummary) {
    return explicitSummary;
  }
  const semanticDisplayConfig = applyReportBuilderSemanticConfig(config, binding, semanticModel);
  return buildReportBuilderSemanticSummary({
    config: semanticDisplayConfig,
    state,
    binding,
    model: semanticModel,
  });
}

function buildOrderedRuntimePreviewDocument({
  container = {},
  config = {},
  state = {},
  refinements = [],
  leadingBlocks = [],
  trailingBlocks = [],
  semanticSummary = null,
  binding = null,
  semanticModel = null,
  runtimeDatasetScopeParams = null,
} = {}) {
  const resolvedSemanticSummary = resolveRuntimePreviewSemanticSummary({
    config,
    state,
    semanticSummary,
    binding,
    semanticModel,
  });
  const document = buildReportBuilderReportDocument({
    container,
    config,
    state,
    additionalBlocks: [...leadingBlocks, ...trailingBlocks],
    refinements,
    semanticSummary: resolvedSemanticSummary,
    runtimeDatasetScopeParams,
  });
  const availableBlockIds = new Set(
    (Array.isArray(document?.blocks) ? document.blocks : [])
      .map((block) => normalizeString(block?.id))
      .filter(Boolean),
  );
  const leadingIds = leadingBlocks
    .map((block) => normalizeString(block?.id))
    .filter((blockId) => !!blockId && availableBlockIds.has(blockId));
  const baseLayoutItems = Array.isArray(document?.layout?.items) ? document.layout.items : [];
  const layoutItemIndex = new Map(
    baseLayoutItems
      .map((item) => [normalizeString(item?.blockId), cloneValue(item)])
      .filter(([blockId]) => !!blockId),
  );
  const baseIds = baseLayoutItems
    .map((item) => normalizeString(item?.blockId))
    .filter((blockId) => !!blockId && availableBlockIds.has(blockId));
  const leadingIdSet = new Set(leadingIds);
  const orderedItems = [
    ...leadingIds.map((blockId) => ({ blockId })),
    ...baseIds
      .filter((blockId) => !leadingIdSet.has(blockId))
      .map((blockId) => cloneValue(layoutItemIndex.get(blockId) || { blockId })),
  ];
  return {
    ...document,
    layout: {
      ...(document?.layout || {}),
      items: orderedItems,
    },
  };
}

function resolveRuntimePreviewDrilledFieldKey(fieldKey = "", drillTransitions = []) {
  const normalizedFieldKey = normalizeString(fieldKey);
  if (!normalizedFieldKey) {
    return "";
  }
  const drilledState = applyReportRuntimeDrillTransitions({
    selectedDimensions: [normalizedFieldKey],
  }, drillTransitions);
  const drilledFieldKey = Array.isArray(drilledState?.selectedDimensions)
    ? drilledState.selectedDimensions.map((entry) => normalizeString(entry)).filter(Boolean)[0]
    : "";
  return drilledFieldKey || normalizedFieldKey;
}

function applyRuntimePreviewDrillColumnsToBlock(block = {}, config = {}, drillTransitions = []) {
  const normalizedBlock = block && typeof block === "object" && !Array.isArray(block)
    ? cloneValue(block)
    : null;
  if (!normalizedBlock || normalizeString(normalizedBlock?.kind) !== "tableBlock") {
    return normalizedBlock;
  }
  const columns = Array.isArray(normalizedBlock?.columns) ? normalizedBlock.columns : [];
  normalizedBlock.columns = columns.map((column) => {
    const normalizedColumn = column && typeof column === "object" && !Array.isArray(column)
      ? cloneValue(column)
      : null;
    if (!normalizedColumn) {
      return column;
    }
    const originalFieldKey = normalizeString(normalizedColumn?.key || normalizedColumn?.sourceKey || normalizedColumn?.displayKey);
    if (!originalFieldKey) {
      return normalizedColumn;
    }
    const currentDimension = resolveReportBuilderDimensionByField(config, originalFieldKey);
    if (!currentDimension) {
      return normalizedColumn;
    }
    const drilledFieldKey = resolveRuntimePreviewDrilledFieldKey(originalFieldKey, drillTransitions);
    const drilledDimension = resolveReportBuilderDimensionByField(config, drilledFieldKey);
    const drilledDimensionId = normalizeString(drilledDimension?.id || drilledDimension?.key || drilledFieldKey);
    const currentDimensionId = normalizeString(currentDimension?.id || currentDimension?.key || originalFieldKey);
    if (!drilledDimension || !drilledDimensionId || drilledDimensionId === currentDimensionId) {
      return normalizedColumn;
    }
    const nextColumn = {
      ...normalizedColumn,
      key: drilledDimensionId,
      sourceKey: normalizeString(drilledDimension?.key || drilledDimensionId) || drilledDimensionId,
      displayKey: normalizeString(drilledDimension?.displayKey || drilledDimension?.key || drilledDimensionId) || drilledDimensionId,
      label: normalizeString(drilledDimension?.label || drilledDimensionId) || drilledDimensionId,
      runtimeFilterable: !!drilledDimension?.runtimeFilter,
    };
    const nextFormat = normalizeString(drilledDimension?.format || "");
    if (nextFormat) {
      nextColumn.format = nextFormat;
    } else {
      delete nextColumn.format;
    }
    if (drilledDimension?.displayValueMap && typeof drilledDimension.displayValueMap === "object" && !Array.isArray(drilledDimension.displayValueMap)) {
      nextColumn.displayValueMap = cloneValue(drilledDimension.displayValueMap);
    } else {
      delete nextColumn.displayValueMap;
    }
    return nextColumn;
  });
  return normalizedBlock;
}

function buildRuntimePreviewDocumentState(state = {}, config = {}, drillTransitions = []) {
  const normalizedBlocks = normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks);
  if (normalizedBlocks.length === 0 || !Array.isArray(drillTransitions) || drillTransitions.length === 0) {
    return state;
  }
  return {
    ...(state && typeof state === "object" && !Array.isArray(state) ? cloneValue(state) : {}),
    reportDocumentBlocks: normalizedBlocks.map((block) => applyRuntimePreviewDrillColumnsToBlock(block, config, drillTransitions)),
  };
}

function augmentRuntimePreviewPrimaryRequest(reportSpec = {}, config = {}, state = {}, drillTransitions = [], requestTransform = null) {
  const nextSpec = cloneValue(reportSpec || {});
  const refinements = Array.isArray(nextSpec?.refinements) ? nextSpec.refinements : [];
  const primaryDataset = Array.isArray(nextSpec?.datasets)
    ? nextSpec.datasets.find((dataset) => normalizeString(dataset?.id) === "primary")
    : null;
  const request = primaryDataset?.request && typeof primaryDataset.request === "object"
    ? primaryDataset.request
    : null;
  if (!request) {
    return nextSpec;
  }
  const hiddenRefinementFields = refinements
    .filter((refinement) => ["keep", "exclude", "drill"].includes(normalizeString(refinement?.op).toLowerCase()))
    .map((refinement) => normalizeString(refinement?.field))
    .filter((field) => hasRuntimeRequestRefinementFilter(config, field))
    .filter(Boolean);
  const drillFields = (Array.isArray(drillTransitions) ? drillTransitions : [])
    .flatMap((transition) => [normalizeString(transition?.sourceField), normalizeString(transition?.nextFieldRef)])
    .filter(Boolean);
  if (hiddenRefinementFields.length > 0 || drillFields.length > 0) {
    const nextDimensions = {
      ...(request.dimensions && typeof request.dimensions === "object" ? request.dimensions : {}),
    };
    hiddenRefinementFields.forEach((field) => {
      nextDimensions[field] = true;
    });
    drillFields.forEach((field) => {
      nextDimensions[field] = true;
    });
    request.dimensions = nextDimensions;
  }
  const refinedRequest = applyRuntimeRequestRefinementFilters(request, config);
  primaryDataset.request = typeof requestTransform === "function"
    ? (requestTransform({
      request: cloneValue(refinedRequest),
      state: cloneValue(state),
      config: cloneValue(config),
      reportSpec: cloneValue(nextSpec),
      datasetId: normalizeString(primaryDataset?.id),
    }) || refinedRequest)
    : refinedRequest;
  return nextSpec;
}

function hasRuntimeRefinementSupport(reportSpec = {}) {
  const blocks = Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : [];
  return blocks.some((block) => {
    const normalizedKind = normalizeString(block?.kind);
    if (normalizedKind === "tableBlock") {
      return resolveReportRuntimeRefinementFields(reportSpec, block)
        .some((field) => field?.runtimeFilterable === true);
    }
    if (normalizedKind === "chartBlock") {
      return resolveReportRuntimeChartActionFields(reportSpec, block)
        .some((field) => field?.runtimeFilterable === true);
    }
    return false;
  });
}

export function resolveReportBuilderRuntimeRefinementCapability({
  reportSpec = null,
  refinements = [],
  drillTransitions = [],
} = {}) {
  const hasActiveRuntimeRefinements = Array.isArray(refinements) && refinements.length > 0;
  const hasActiveDrillTransitions = Array.isArray(drillTransitions) && drillTransitions.length > 0;
  const hasFieldSupport = hasRuntimeRefinementSupport(reportSpec || {});
  return {
    supported: hasActiveRuntimeRefinements || hasActiveDrillTransitions || hasFieldSupport,
    hasFieldSupport,
    hasActiveRuntimeRefinements,
    hasActiveDrillTransitions,
  };
}

export function resolveReportBuilderRuntimeScopeCapability({
  reportSpec = null,
  reportDocument = null,
  title = "",
} = {}) {
  const context = resolveNormalizedReportSpecDocumentContext({
    reportSpec,
    document: reportDocument,
    title,
  });
  const paramIds = (Array.isArray(context?.scopeParams) ? context.scopeParams : [])
    .map((param) => normalizeString(param?.id))
    .filter(Boolean);
  return {
    supported: paramIds.length > 0,
    paramIds,
  };
}

export function resolveReportBuilderRuntimeGeoCapability({
  config = null,
  state = null,
} = {}) {
  const fieldOptions = buildReportBuilderDocumentBlockFieldOptionsFromPreparedConfig({
    config,
    state,
  });
  const draft = buildReportBuilderDocumentBlockDraft("geoMapBlock", null, {
    tableColumnOptions: fieldOptions.tableColumnOptions,
  });
  const geoKey = normalizeString(draft?.geo?.key);
  const metricKey = normalizeString(draft?.geo?.metric?.key);
  return {
    supported: !!geoKey && !!metricKey,
    geoKey,
    metricKey,
  };
}

export function resolveReportBuilderRuntimeChartCapability({
  config = null,
  state = null,
} = {}) {
  const fieldOptions = buildReportBuilderDocumentBlockFieldOptionsFromPreparedConfig({
    config,
    state,
  });
  const draft = buildReportBuilderDocumentBlockDraft("chartBlock", null, {
    chartConfig: fieldOptions.chartConfig,
    chartState: fieldOptions.chartState,
  });
  const validation = validateReportBuilderDocumentBlockDraft(draft, {
    chartConfig: fieldOptions.chartConfig,
    chartFieldOptions: fieldOptions.chartFieldOptions,
  });
  const chartSpec = draft?.chartSpec && typeof draft.chartSpec === "object" && !Array.isArray(draft.chartSpec)
    ? cloneValue(draft.chartSpec)
    : null;
  return {
    supported: !!chartSpec && validation.valid,
    chartSpec: validation.valid ? chartSpec : null,
  };
}

export function resolveReportBuilderRuntimeTableCapability({
  config = null,
  state = null,
} = {}) {
  const fieldOptions = buildReportBuilderDocumentBlockFieldOptionsFromPreparedConfig({
    config,
    state,
  });
  const draft = buildReportBuilderDocumentBlockDraft("tableBlock", null, {
    tableColumnOptions: fieldOptions.tableColumnOptions,
  });
  const validation = validateReportBuilderDocumentBlockDraft(draft, {
    tableColumnOptions: fieldOptions.tableColumnOptions,
  });
  const columnKeys = Array.isArray(draft?.columnKeys)
    ? draft.columnKeys.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
  return {
    supported: validation.valid,
    columnKeys: validation.valid ? columnKeys : [],
  };
}

function buildRuntimePreviewDocumentAndSpec({
  container = {},
  config = {},
  state = {},
  refinements = [],
  leadingBlocks = [],
  trailingBlocks = [],
  drillTransitions = [],
  requestTransform = null,
  semanticSummary = null,
  binding = null,
  semanticModel = null,
  includePrimaryBlocks = true,
  runtimeDatasetScopeParams = null,
} = {}) {
  const runtimeDocumentState = buildRuntimePreviewDocumentState(state, config, drillTransitions);
  const document = buildOrderedRuntimePreviewDocument({
    container,
    config,
    state: runtimeDocumentState,
    refinements,
    leadingBlocks,
    trailingBlocks,
    semanticSummary,
    binding,
    semanticModel,
    runtimeDatasetScopeParams,
  });
  const normalizedPreviewDocument = includePrimaryBlocks
    ? document
    : {
        ...document,
        layout: {
          ...(document?.layout || {}),
          items: (Array.isArray(document?.layout?.items) ? document.layout.items : [])
            .filter((item) => normalizeString(item?.blockId) !== "primaryBuilder")
            .map((item) => cloneValue(item)),
        },
      };
  return {
    document: normalizedPreviewDocument,
    reportSpec: augmentRuntimePreviewPrimaryRequest(
      lowerReportDocumentToReportSpec(normalizedPreviewDocument, {
        includePrimaryBlocks,
        runtimeDatasetScopeParams,
      }),
      config,
      state,
      drillTransitions,
      requestTransform,
    ),
  };
}

function attachRuntimePreviewCapabilities(previewModel = null, {
  config = null,
  state = null,
  authoringConfig = null,
  authoringState = null,
  refinements = [],
  drillTransitions = [],
} = {}) {
  if (!previewModel || typeof previewModel !== "object" || Array.isArray(previewModel)) {
    return previewModel;
  }
  return {
    ...previewModel,
    scopeCapability: resolveReportBuilderRuntimeScopeCapability({
      reportSpec: previewModel.reportSpec,
      reportDocument: previewModel.document,
      title: previewModel.document?.title || previewModel.reportSpec?.title || "",
    }),
    chartCapability: resolveReportBuilderRuntimeChartCapability({
      config: authoringConfig || config,
      state: authoringState || state,
    }),
    tableCapability: resolveReportBuilderRuntimeTableCapability({
      config: authoringConfig || config,
      state: authoringState || state,
    }),
    geoCapability: resolveReportBuilderRuntimeGeoCapability({
      config,
      state,
    }),
    refinementCapability: resolveReportBuilderRuntimeRefinementCapability({
      reportSpec: previewModel.reportSpec,
      refinements,
      drillTransitions,
    }),
  };
}

export function buildReportBuilderRuntimePreviewModel({
  container = {},
  config = {},
  state = null,
  refinements = [],
  drillTransitions = [],
  runtimeDatasetScopeParams = null,
  includeScopeBlock = true,
  includeRefinementBlock = true,
  trailingBlocks = [],
  requestTransform = null,
  semanticSummary = null,
  binding = null,
  semanticModel = null,
  includePrimaryBlocks = true,
} = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  const drilledState = applyReportRuntimeDrillTransitions(state, drillTransitions);
  const normalizedBinding = binding || drilledState?.binding || state?.binding || config?.binding || null;
  const authoringConfig = applyReportBuilderSemanticConfig(
    buildReportBuilderCalculatedFieldConfig(config, state),
    normalizedBinding,
    semanticModel,
  );
  const effectiveConfig = applyReportBuilderSemanticConfig(
    buildReportBuilderCalculatedFieldConfig(config, drilledState),
    normalizedBinding,
    semanticModel,
  );
  const authoredBlockKinds = new Set(
    normalizeReportBuilderDocumentBlocks(drilledState?.reportDocumentBlocks)
      .map((block) => normalizeString(block?.kind))
      .filter(Boolean),
  );
  const staticDatasets = normalizeReportBuilderStaticDatasets(drilledState?.reportStaticDatasets || state?.reportStaticDatasets);
  const paramIds = resolveReportBuilderScopeParamFilters(effectiveConfig)
    .map((filter) => resolveScopeParamId(filter))
    .filter(Boolean);
  const leadingBlocks = [
    ...(includeScopeBlock && !authoredBlockKinds.has("filterBarBlock") && paramIds.length > 0 ? [
      buildReportDocumentFilterBarBlock({
        id: "sharedFilters",
        title: "Filters",
        paramIds,
      }),
    ] : []),
  ];
  const initialPreviewModel = attachRuntimePreviewCapabilities(buildRuntimePreviewDocumentAndSpec({
    container,
    config: effectiveConfig,
    state: drilledState,
    refinements,
    leadingBlocks,
    trailingBlocks,
    drillTransitions,
    requestTransform: null,
    semanticSummary,
    binding,
    semanticModel,
    includePrimaryBlocks,
    runtimeDatasetScopeParams,
  }), {
    config: effectiveConfig,
    state: drilledState,
    authoringConfig,
    authoringState: state,
      refinements,
      drillTransitions,
  });
  const { refinementCapability } = initialPreviewModel;
  const shouldIncludeGenericRefinementBlock = includeRefinementBlock
    && !authoredBlockKinds.has("refinementBarBlock")
    && refinementCapability.supported;
  const finalLeadingBlocks = shouldIncludeGenericRefinementBlock
    ? [
        ...leadingBlocks,
        buildReportDocumentRefinementBarBlock({
          id: "activeRefinements",
          title: "Active Refinements",
        }),
      ]
    : leadingBlocks;
  const previewModelSource = shouldIncludeGenericRefinementBlock || typeof requestTransform === "function"
    ? attachRuntimePreviewCapabilities(buildRuntimePreviewDocumentAndSpec({
      container,
      config: effectiveConfig,
      state: drilledState,
      refinements,
      leadingBlocks: finalLeadingBlocks,
      trailingBlocks,
      drillTransitions,
      requestTransform,
      semanticSummary,
      binding,
      semanticModel,
      includePrimaryBlocks,
      runtimeDatasetScopeParams,
    }), {
      config: effectiveConfig,
      state: drilledState,
      authoringConfig,
      authoringState: state,
      refinements,
      drillTransitions,
    })
    : initialPreviewModel;
  const previewContext = resolveNormalizedReportSpecDocumentContext({
    reportSpec: previewModelSource?.reportSpec || null,
    document: previewModelSource?.document || null,
    title: previewModelSource?.document?.title || previewModelSource?.reportSpec?.title || "",
  });
  const semanticBindingViewState = buildReportBuilderSemanticBindingViewState({
    semanticSummary: previewContext?.semanticSummary || null,
    binding: previewContext?.binding || normalizedBinding,
  });
  return {
    ...previewModelSource,
    ...(previewContext?.document ? { document: cloneValue(previewContext.document) } : {}),
    ...(previewContext?.reportSpec ? { reportSpec: cloneValue(previewContext.reportSpec) } : {}),
    ...(semanticBindingViewState ? { semanticBindingViewState: cloneValue(semanticBindingViewState) } : {}),
    ...(staticDatasets.length > 0 ? { staticDatasetPayloads: buildReportBuilderStaticDatasetPayloadMap(staticDatasets) } : {}),
  };
}

export function buildReportBuilderRuntimePreview({
  model = null,
  rows = [],
  hasMore = false,
  datasetPayloads = {},
  error = null,
  additionalDiagnostics = [],
  runtimeBlockId = "authoredRuntimePreview",
  runtimeTitle = "",
  runtimeSubtitle = "",
  hostIntent = null,
  pageGeometry = null,
} = {}) {
  const artifacts = buildReportBuilderRuntimePreviewArtifacts({
    model,
    rows,
    hasMore,
    datasetPayloads,
    error,
    additionalDiagnostics,
    pageGeometry,
  });
  if (!artifacts) {
    return null;
  }
  return {
    ...artifacts,
    runtimeBlock: buildDashboardReportRuntimeBlock({
      id: runtimeBlockId,
      title: normalizeString(runtimeTitle || model?.document?.title || model?.reportSpec?.title || "Report Preview"),
      subtitle: normalizeString(
        runtimeSubtitle
        || model?.document?.subtitle
        || model?.document?.description
        || "Live report compiled from the current builder state.",
      ),
      reportSpec: artifacts.reportSpec,
      reportFill: artifacts.reportFill,
      reportPrint: artifacts.reportPrint,
      semanticBindingViewState: artifacts.semanticBindingViewState || model?.semanticBindingViewState || null,
      hostIntent,
    }),
  };
}

export function buildReportBuilderRuntimePreviewArtifacts({
  model = null,
  rows = [],
  hasMore = false,
  datasetPayloads = {},
  error = null,
  additionalDiagnostics = [],
  pageGeometry = null,
} = {}) {
  if (!model?.reportSpec) {
    return null;
  }
  const metadataContext = resolveNormalizedReportSpecDocumentContext({
    reportSpec: model?.reportSpec || null,
    document: model?.document || null,
    title: model?.document?.title || model?.reportSpec?.title || "",
  });
  const normalizedReportSpec = metadataContext?.reportSpec || model.reportSpec;
  const normalizedDocument = metadataContext?.document || model.document;
  const normalizedSemanticBindingViewState = resolvePreferredReportBuilderSemanticBindingViewState({
    metadataContexts: [metadataContext],
    candidates: [model?.semanticBindingViewState],
  });
  const primaryRequest = Array.isArray(normalizedReportSpec?.datasets)
    ? (normalizedReportSpec.datasets.find((dataset) => normalizeString(dataset?.id) === "primary")?.request || normalizedReportSpec.datasets[0]?.request || {})
    : {};
  const refinedRows = applyReportRuntimeRequestRefinements(Array.isArray(rows) ? rows : [], primaryRequest);
  const reportFill = buildReportFillFromReportSpec(normalizedReportSpec, {
    ...(datasetPayloads && typeof datasetPayloads === "object" && !Array.isArray(datasetPayloads)
      ? cloneValue(datasetPayloads)
      : {}),
    ...(model?.staticDatasetPayloads && typeof model.staticDatasetPayloads === "object" && !Array.isArray(model.staticDatasetPayloads)
      ? cloneValue(model.staticDatasetPayloads)
      : {}),
    primary: {
      rows: refinedRows,
      hasMore: hasMore === true,
      diagnostics: normalizeRuntimePreviewDiagnostics(error, additionalDiagnostics),
    },
  });
  const previewReportFill = cloneValue(reportFill);
  const reportPrint = buildReportPrintFromReportFill({
    reportSpec: normalizedReportSpec,
    reportFill: cloneValue(reportFill),
    ...(pageGeometry && typeof pageGeometry === "object" && !Array.isArray(pageGeometry)
      ? { pageGeometry }
      : {}),
  });
  const previewReportPrint = cloneValue(reportPrint);
  const exportRequest = buildDraftReportExportRequest({
    reportDocument: normalizedDocument,
    reportSpec: normalizedReportSpec,
    reportFill: previewReportFill,
    reportPrint: previewReportPrint,
    format: "pdf",
  });
  return {
    document: cloneValue(normalizedDocument),
    reportSpec: cloneValue(normalizedReportSpec),
    reportFill: previewReportFill,
    reportPrint: previewReportPrint,
    ...(normalizedSemanticBindingViewState ? { semanticBindingViewState: cloneValue(normalizedSemanticBindingViewState) } : {}),
    exportRequest,
  };
}
