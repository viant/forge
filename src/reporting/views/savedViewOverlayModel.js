import {
  listReportBuilderPinnedPredicates,
  resolveReportBuilderScopeParamFilters,
} from "../../components/dashboard/reportBuilderPredicates.js";
import {
  resolveReportDocumentPresentation,
  resolveReportDocumentBuilderContext,
} from "../reportDocumentModel.js";
import { resolveReportBuilderBlock } from "../reportBuilderBlockModel.js";
import { isSupportedScopeBindingTarget } from "../scopeBindingModel.js";
import { mergeScopeParamValues } from "../scopeStateModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value = 0) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function buildArtifactRef(kind = "", artifactId = "") {
  const normalizedKind = normalizeString(kind);
  const normalizedArtifactId = normalizeString(artifactId);
  return normalizedKind && normalizedArtifactId
    ? `${normalizedKind}://${normalizedArtifactId}`
    : "";
}

function normalizeArtifactReference(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const artifactRef = normalizeString(value?.artifactRef)
    || buildArtifactRef(
      normalizeString(value?.kind || value?.artifactKind),
      normalizeString(value?.sourceArtifactId || value?.payloadId || value?.reportId || value?.id),
    );
  const inferredReportId = artifactRef.startsWith("report://")
    ? artifactRef.slice("report://".length)
    : "";
  const reportId = normalizeString(value?.reportId || value?.reportRef?.reportId || inferredReportId);
  const documentVersion = normalizePositiveInteger(value?.documentVersion || value?.version);
  const sourceArtifactId = normalizeString(value?.sourceArtifactId || value?.payloadId || value?.id);
  if (!artifactRef && !reportId && documentVersion < 1 && !sourceArtifactId) {
    return null;
  }
  return {
    ...(artifactRef ? { artifactRef } : {}),
    ...(reportId ? { reportId } : {}),
    ...(documentVersion > 0 ? { documentVersion } : {}),
    ...(sourceArtifactId ? { sourceArtifactId } : {}),
  };
}

function normalizeOrder(order = null) {
  if (!isPlainObject(order)) {
    return null;
  }
  const field = normalizeString(order?.field);
  const direction = ["asc", "desc"].includes(normalizeString(order?.direction).toLowerCase())
    ? normalizeString(order.direction).toLowerCase()
    : "";
  const pageSize = normalizePositiveInteger(order?.pageSize);
  const page = normalizePositiveInteger(order?.page);
  if (!field && !direction && pageSize < 1 && page < 1) {
    return null;
  }
  return {
    ...(field ? { field } : {}),
    ...(direction ? { direction } : {}),
    ...(pageSize > 0 ? { pageSize } : {}),
    ...(page > 0 ? { page } : {}),
  };
}

function normalizePresentation(presentation = null) {
  if (!isPlainObject(presentation)) {
    return null;
  }
  const viewMode = ["chart", "table"].includes(normalizeString(presentation?.viewMode).toLowerCase())
    ? normalizeString(presentation.viewMode).toLowerCase()
    : "";
  const groupBy = normalizeString(presentation?.groupBy);
  const activeTablePreset = normalizeString(presentation?.activeTablePreset);
  const lastTablePreset = normalizeString(presentation?.lastTablePreset);
  const chartSpec = isPlainObject(presentation?.chartSpec) ? cloneValue(presentation.chartSpec) : null;
  if (!viewMode && !groupBy && !activeTablePreset && !lastTablePreset && !chartSpec) {
    return null;
  }
  return {
    ...(viewMode ? { viewMode } : {}),
    ...(groupBy ? { groupBy } : {}),
    ...(activeTablePreset ? { activeTablePreset } : {}),
    ...(lastTablePreset ? { lastTablePreset } : {}),
    ...(chartSpec ? { chartSpec } : {}),
  };
}

function normalizeOverlay(overlay = null) {
  if (!isPlainObject(overlay)) {
    return null;
  }
  const filters = isPlainObject(overlay?.filters) ? cloneValue(overlay.filters) : null;
  const parameters = isPlainObject(overlay?.parameters) ? cloneValue(overlay.parameters) : null;
  const order = normalizeOrder(overlay?.order);
  const presentation = normalizePresentation(overlay?.presentation);
  if (!filters && !parameters && !order && !presentation) {
    return null;
  }
  return {
    ...(filters ? { filters } : {}),
    ...(parameters ? { parameters } : {}),
    ...(order ? { order } : {}),
    ...(presentation ? { presentation } : {}),
  };
}

function collectScopeFilterIds(document = null) {
  const config = collectBuilderConfig(document);
  return new Set([
    ...listReportBuilderPinnedPredicates(config).map((predicate) => predicate.id),
    ...resolveReportBuilderScopeParamFilters(config)
      .map((entry) => normalizeString(entry?.id || entry?.key))
      .filter(Boolean),
  ]);
}

function collectScopeBindingTargets(document = null) {
  const block = resolveReportBuilderBlock(document);
  const bindings = Array.isArray(block?.scopeBindings) ? block.scopeBindings : [];
  const next = new Map();
  bindings.forEach((binding) => {
    const paramId = normalizeString(binding?.paramId);
    const target = normalizeString(binding?.target);
    if (!paramId || !target) {
      return;
    }
    const current = next.get(paramId) || [];
    current.push(target);
    next.set(paramId, current);
  });
  return next;
}

function collectScopeParamIds(document = null, reportSpec = null) {
  const params = [
    ...(Array.isArray(document?.scope?.params) ? document.scope.params : []),
    ...(Array.isArray(reportSpec?.scope?.params) ? reportSpec.scope.params : []),
  ];
  return new Set(
    params
      .map((entry) => normalizeString(entry?.id))
      .filter(Boolean),
  );
}

function collectBuilderFieldKeys(document = null, reportSpec = null) {
  const block = resolveReportBuilderBlock(document);
  const config = collectBuilderConfig(document);
  const state = isPlainObject(block?.state) ? block.state : {};
  const configFieldCollections = [
    ...(Array.isArray(config?.measures) ? config.measures : []),
    ...(Array.isArray(config?.dimensions) ? config.dimensions : []),
    ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []),
    ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []),
    ...(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []),
    ...(Array.isArray(state?.localCalculatedFields) ? state.localCalculatedFields : []),
    ...(Array.isArray(state?.localTableCalculations) ? state.localTableCalculations : []),
  ];
  const request = reportSpec?.datasets?.[0]?.request || {};
  return new Set(
    [
      ...configFieldCollections
        .flatMap((entry) => [normalizeString(entry?.key), normalizeString(entry?.id)])
        .filter(Boolean),
      ...Object.keys(isPlainObject(request?.dimensions) ? request.dimensions : {}),
      ...Object.keys(isPlainObject(request?.measures) ? request.measures : {}),
    ],
  );
}

function isSavedViewOverlayGroupByCompatible(document = null, state = {}, groupBy = "") {
  const normalizedGroupBy = normalizeString(groupBy);
  if (!normalizedGroupBy) {
    return false;
  }
  const selectedDimensions = new Set(
    (Array.isArray(state?.selectedDimensions) ? state.selectedDimensions : [])
      .map((entry) => normalizeString(entry))
      .filter(Boolean),
  );
  const presentation = resolveReportDocumentPresentation(document, collectBuilderConfig(document), state);
  const groupByOptions = Array.isArray(presentation?.groupByOptions) ? presentation.groupByOptions : [];
  const matchingOption = groupByOptions.find((entry) => normalizeString(entry?.value) === normalizedGroupBy);
  const dimensionId = normalizeString(matchingOption?.dimensionId || normalizedGroupBy);
  return !!dimensionId && selectedDimensions.has(dimensionId);
}

function collectBuilderConfig(document = null) {
  const block = resolveReportBuilderBlock(document);
  if (!isPlainObject(block?.config)) {
    return {};
  }
  return resolveReportDocumentBuilderContext(document, block.config, block?.state || {}).config || {};
}

function collectConfiguredMeasureEntries(document = null, state = {}) {
  const config = collectBuilderConfig(document);
  return [
    ...(Array.isArray(config?.measures) ? config.measures : []),
    ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []),
    ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []),
    ...(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []),
    ...(Array.isArray(state?.localCalculatedFields) ? state.localCalculatedFields : []),
    ...(Array.isArray(state?.localTableCalculations) ? state.localTableCalculations : []),
  ];
}

function collectOrderFieldEntries(document = null) {
  const presentation = resolveReportDocumentPresentation(document, collectBuilderConfig(document));
  return Array.isArray(presentation?.orderFields) ? presentation.orderFields : [];
}

function resolveFieldEntryByToken(entries = [], token = "") {
  const normalizedToken = normalizeString(token);
  if (!normalizedToken) {
    return null;
  }
  return (Array.isArray(entries) ? entries : []).find((entry) => {
    const id = normalizeString(entry?.id);
    const key = normalizeString(entry?.key || entry?.id);
    return normalizedToken === id || normalizedToken === key;
  }) || null;
}

function isSavedViewOverlayOrderFieldCompatible(document = null, state = {}, orderField = "") {
  const normalizedOrderField = normalizeString(orderField);
  if (!normalizedOrderField) {
    return false;
  }
  const orderEntries = collectOrderFieldEntries(document);
  const matchingOrderEntry = orderEntries.find((entry) => {
    const token = normalizeString(entry?.value || entry?.field);
    return token === normalizedOrderField;
  });
  if (!matchingOrderEntry) {
    return false;
  }
  const config = collectBuilderConfig(document);
  const configuredMeasures = collectConfiguredMeasureEntries(document, state);
  const selectedDimensions = new Set(
    (Array.isArray(state?.selectedDimensions) ? state.selectedDimensions : [])
      .map((entry) => normalizeString(entry))
      .filter(Boolean),
  );
  const selectedMeasures = new Set(
    (Array.isArray(state?.selectedMeasures) ? state.selectedMeasures : [])
      .map((entry) => normalizeString(entry))
      .filter(Boolean),
  );
  const target = normalizeString(matchingOrderEntry?.field || matchingOrderEntry?.value);
  const dimension = resolveFieldEntryByToken(config?.dimensions, target);
  if (dimension) {
    return selectedDimensions.has(normalizeString(dimension?.id));
  }
  const measure = resolveFieldEntryByToken(configuredMeasures, target);
  if (measure) {
    return selectedMeasures.has(normalizeString(measure?.id));
  }
  return true;
}

function collectPresetTitles(document = null) {
  const presentation = resolveReportDocumentPresentation(document, collectBuilderConfig(document));
  const presets = Array.isArray(presentation?.defaultTablePresets) ? presentation.defaultTablePresets : [];
  return new Set(
    presets
      .map((entry) => normalizeString(entry?.title))
      .filter(Boolean),
  );
}

function normalizePresetEntry(preset = null, index = 0) {
  if (!isPlainObject(preset)) {
    return null;
  }
  const title = normalizeString(preset?.title);
  const dimensions = Array.isArray(preset?.dimensions)
    ? preset.dimensions.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
  const measures = Array.isArray(preset?.measures)
    ? preset.measures.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
  if (!title || (dimensions.length === 0 && measures.length === 0)) {
    return null;
  }
  const normalizedId = normalizeString(preset?.id) || `savedViewOverlayPreset_${index + 1}`;
  const normalized = {
    id: normalizedId,
    title,
    ...(dimensions.length > 0 ? { dimensions } : {}),
    ...(measures.length > 0 ? { measures } : {}),
  };
  [
    "eyebrow",
    "accentTone",
    "description",
    "primaryMeasure",
    "groupBy",
    "orderField",
    "orderDir",
  ].forEach((key) => {
    const value = normalizeString(preset?.[key]);
    if (value) {
      normalized[key] = value;
    }
  });
  if (Array.isArray(preset?.highlights) && preset.highlights.length > 0) {
    normalized.highlights = preset.highlights.map((entry) => normalizeString(entry)).filter(Boolean);
  }
  if (Array.isArray(preset?.columns) && preset.columns.length > 0) {
    normalized.columns = cloneValue(preset.columns);
  }
  if (normalizePositiveInteger(preset?.pageSize) > 0) {
    normalized.pageSize = normalizePositiveInteger(preset.pageSize);
  }
  if (typeof preset?.clearChart === "boolean") {
    normalized.clearChart = preset.clearChart;
  }
  return normalized;
}

function collectPresetMap(document = null) {
  const presentation = resolveReportDocumentPresentation(document, collectBuilderConfig(document));
  const presets = Array.isArray(presentation?.defaultTablePresets) ? presentation.defaultTablePresets : [];
  return new Map(
    presets
      .map((entry, index) => {
        const normalizedPreset = normalizePresetEntry(entry, index);
        return normalizedPreset ? [normalizedPreset.title, normalizedPreset] : null;
      })
      .filter(Boolean),
  );
}

function pushDiagnostic(diagnostics = [], {
  code = "",
  severity = "warning",
  path = "",
  message = "",
} = {}) {
  const normalizedCode = normalizeString(code);
  const normalizedPath = normalizeString(path);
  const normalizedMessage = normalizeString(message);
  if (!normalizedCode || !normalizedMessage) {
    return;
  }
  diagnostics.push({
    code: normalizedCode,
    severity: normalizeString(severity).toLowerCase() || "warning",
    ...(normalizedPath ? { path: normalizedPath } : {}),
    message: normalizedMessage,
  });
}

export function extractSavedViewOverlayArtifactState(value = null) {
  const directState = isPlainObject(value?.savedViewOverlay)
    ? value.savedViewOverlay
    : null;
  const source = directState || value;
  if (!isPlainObject(source)) {
    return null;
  }
  const kind = directState
    ? normalizeString(value?.source?.kind || value?.kind)
    : normalizeString(source?.kind || value?.source?.kind || value?.kind);
  if (!directState && kind && kind !== "reportBuilder.savedView") {
    return null;
  }
  const overlay = normalizeOverlay(source?.overlay);
  const baseReportRef = normalizeArtifactReference(
    source?.baseReportRef
    || source?.baseReport
    || source?.baseRef,
  );
  const publishedSnapshotRef = normalizeArtifactReference(
    source?.publishedSnapshotRef
    || source?.publishedSnapshot
    || source?.snapshotRef,
  );
  if (!overlay && !baseReportRef && !publishedSnapshotRef) {
    return null;
  }
  return {
    ...(overlay ? { overlay } : {}),
    ...(baseReportRef ? { baseReportRef } : {}),
    ...(publishedSnapshotRef ? { publishedSnapshotRef } : {}),
  };
}

export function buildSavedViewOverlaySummary(value = null, {
  document = null,
  reportSpec = null,
} = {}) {
  const directState = isPlainObject(value?.savedViewOverlay)
    ? value.savedViewOverlay
    : null;
  const source = directState || value;
  const overlayState = extractSavedViewOverlayArtifactState(source);
  if (!overlayState) {
    return null;
  }
  const diagnostics = [];
  const overlayPath = directState ? "$.savedViewOverlay.overlay" : "$.overlay";
  const refPath = directState ? "$.savedViewOverlay" : "$";
  const rawOverlay = isPlainObject(source?.overlay) ? source.overlay : null;
  const rawOrder = isPlainObject(rawOverlay?.order) ? rawOverlay.order : null;
  const rawPresentation = isPlainObject(rawOverlay?.presentation) ? rawOverlay.presentation : null;

  const supportedOverlayKeys = new Set(["filters", "parameters", "order", "presentation"]);
  Object.keys(isPlainObject(rawOverlay) ? rawOverlay : {}).forEach((key) => {
    if (!supportedOverlayKeys.has(key)) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnsupportedKey",
        path: `${overlayPath}.${key}`,
        message: `Saved view overlays do not support '${key}'.`,
      });
    }
  });

  if (rawOverlay?.filters != null && !isPlainObject(rawOverlay.filters)) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayInvalidFilters",
      severity: "error",
      path: `${overlayPath}.filters`,
      message: "Saved view overlay filters must be an object keyed by static filter id.",
    });
  }
  if (rawOverlay?.parameters != null && !isPlainObject(rawOverlay.parameters)) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayInvalidParameters",
      severity: "error",
      path: `${overlayPath}.parameters`,
      message: "Saved view overlay parameters must be an object keyed by parameter id.",
    });
  }
  if (rawOverlay?.order != null && !isPlainObject(rawOverlay.order)) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayInvalidOrder",
      severity: "error",
      path: `${overlayPath}.order`,
      message: "Saved view overlay order must be an object.",
    });
  }
  if (rawOverlay?.presentation != null && !isPlainObject(rawOverlay.presentation)) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayInvalidPresentation",
      severity: "error",
      path: `${overlayPath}.presentation`,
      message: "Saved view overlay presentation must be an object.",
    });
  }

  const supportedOrderKeys = new Set(["field", "direction", "pageSize", "page"]);
  Object.keys(rawOrder || {}).forEach((key) => {
    if (!supportedOrderKeys.has(key)) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnsupportedOrderKey",
        path: `${overlayPath}.order.${key}`,
        message: `Saved view overlay order does not support '${key}'.`,
      });
    }
  });
  if (normalizeString(rawOrder?.direction) && !["asc", "desc"].includes(normalizeString(rawOrder?.direction).toLowerCase())) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayInvalidOrderDirection",
      severity: "error",
      path: `${overlayPath}.order.direction`,
      message: `Unsupported saved view overlay order direction '${rawOrder.direction}'.`,
    });
  }

  const supportedPresentationKeys = new Set(["viewMode", "groupBy", "chartSpec", "activeTablePreset", "lastTablePreset"]);
  Object.keys(rawPresentation || {}).forEach((key) => {
    if (!supportedPresentationKeys.has(key)) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnsupportedPresentationKey",
        path: `${overlayPath}.presentation.${key}`,
        message: `Saved view overlay presentation does not support '${key}'.`,
      });
    }
  });
  if (normalizeString(rawPresentation?.viewMode) && !["chart", "table"].includes(normalizeString(rawPresentation?.viewMode).toLowerCase())) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayInvalidViewMode",
      severity: "error",
      path: `${overlayPath}.presentation.viewMode`,
      message: `Unsupported saved view overlay viewMode '${rawPresentation.viewMode}'.`,
    });
  }
  if (rawPresentation?.chartSpec != null && !isPlainObject(rawPresentation.chartSpec)) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayInvalidChartSpec",
      severity: "error",
      path: `${overlayPath}.presentation.chartSpec`,
      message: "Saved view overlay chartSpec must be an object.",
    });
  }

  if (overlayState.overlay && !overlayState.baseReportRef && !overlayState.publishedSnapshotRef) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayMissingBaseReference",
      path: refPath,
      message: "Saved view overlays should declare a base report ref or published snapshot ref.",
    });
  }
  const baseReportId = normalizeString(overlayState.baseReportRef?.reportId);
  const snapshotReportId = normalizeString(overlayState.publishedSnapshotRef?.reportId);
  if (baseReportId && snapshotReportId && baseReportId !== snapshotReportId) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlaySnapshotBaseReportMismatch",
      path: `${refPath}.publishedSnapshotRef.reportId`,
      message: `Saved view overlay published snapshot report '${snapshotReportId}' does not match base report '${baseReportId}'.`,
    });
  }
  const baseDocumentVersion = normalizePositiveInteger(overlayState.baseReportRef?.documentVersion);
  const snapshotDocumentVersion = normalizePositiveInteger(overlayState.publishedSnapshotRef?.documentVersion);
  if (baseDocumentVersion > 0 && snapshotDocumentVersion > 0 && snapshotDocumentVersion < baseDocumentVersion) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlaySnapshotBaseVersionStale",
      path: `${refPath}.publishedSnapshotRef.documentVersion`,
      message: `Saved view overlay published snapshot version ${snapshotDocumentVersion} is older than base report version ${baseDocumentVersion}.`,
    });
  }

  const scopeFilterIds = collectScopeFilterIds(document);
  const scopeBindingTargets = collectScopeBindingTargets(document);
  const baseBuilderState = isPlainObject(resolveReportBuilderBlock(document)?.state)
    ? resolveReportBuilderBlock(document).state
    : {};
  Object.keys(isPlainObject(overlayState.overlay?.filters) ? overlayState.overlay.filters : {}).forEach((filterId) => {
    if (scopeFilterIds.size > 0 && !scopeFilterIds.has(filterId)) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnknownFilter",
        path: `${overlayPath}.filters.${filterId}`,
        message: `Saved view overlay filter '${filterId}' is not available in the base report.`,
      });
    }
  });

  const scopeParamIds = collectScopeParamIds(document, reportSpec);
  Object.keys(isPlainObject(overlayState.overlay?.parameters) ? overlayState.overlay.parameters : {}).forEach((paramId) => {
    if (scopeParamIds.size > 0 && !scopeParamIds.has(paramId)) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnknownParameter",
        path: `${overlayPath}.parameters.${paramId}`,
        message: `Saved view overlay parameter '${paramId}' is not available in the base report.`,
      });
      return;
    }
    const bindingTargets = scopeBindingTargets.get(paramId) || [];
    if (bindingTargets.length === 0) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnboundParameter",
        path: `${overlayPath}.parameters.${paramId}`,
        message: `Saved view overlay parameter '${paramId}' is not bound into the base report.`,
      });
      return;
    }
    const supportedTargets = bindingTargets.filter((target) => isSupportedScopeBindingTarget(target));
    if (supportedTargets.length === 0) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnsupportedParameterTarget",
        path: `${overlayPath}.parameters.${paramId}`,
        message: `Saved view overlay parameter '${paramId}' is bound to an unsupported target.`,
      });
    }
  });

  const fieldKeys = collectBuilderFieldKeys(document, reportSpec);
  const orderField = normalizeString(overlayState.overlay?.order?.field);
  if (orderField && !isSavedViewOverlayOrderFieldCompatible(document, baseBuilderState, orderField)) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayUnknownOrderField",
      path: `${overlayPath}.order.field`,
      message: `Saved view overlay order field '${orderField}' is not available in the base report.`,
    });
  }
  const groupByField = normalizeString(overlayState.overlay?.presentation?.groupBy);
  if (groupByField && !isSavedViewOverlayGroupByCompatible(document, baseBuilderState, groupByField)) {
    pushDiagnostic(diagnostics, {
      code: "savedViewOverlayUnknownGroupByField",
      path: `${overlayPath}.presentation.groupBy`,
      message: `Saved view overlay groupBy field '${groupByField}' is not available in the base report.`,
    });
  }

  const presetTitles = collectPresetTitles(document);
  ["activeTablePreset", "lastTablePreset"].forEach((key) => {
    const presetTitle = normalizeString(overlayState.overlay?.presentation?.[key]);
    if (presetTitle && presetTitles.size > 0 && !presetTitles.has(presetTitle)) {
      pushDiagnostic(diagnostics, {
        code: "savedViewOverlayUnknownTablePreset",
        path: `${overlayPath}.presentation.${key}`,
        message: `Saved view overlay table preset '${presetTitle}' is not available in the base report.`,
      });
    }
  });

  const filtersCount = Object.keys(isPlainObject(overlayState.overlay?.filters) ? overlayState.overlay.filters : {}).length;
  const parametersCount = Object.keys(isPlainObject(overlayState.overlay?.parameters) ? overlayState.overlay.parameters : {}).length;
  const chips = [
    filtersCount > 0 ? `${filtersCount} ${filtersCount === 1 ? "filter" : "filters"}` : "",
    parametersCount > 0 ? `${parametersCount} ${parametersCount === 1 ? "parameter" : "parameters"}` : "",
    orderField
      ? `Order ${orderField}${normalizeString(overlayState.overlay?.order?.direction) ? ` ${normalizeString(overlayState.overlay.order.direction)}` : ""}`
      : "",
    normalizeString(overlayState.overlay?.presentation?.viewMode)
      ? `${normalizeString(overlayState.overlay.presentation.viewMode)} view`
      : "",
    normalizeString(overlayState.overlay?.presentation?.activeTablePreset)
      ? `Preset ${normalizeString(overlayState.overlay.presentation.activeTablePreset)}`
      : "",
    normalizeString(overlayState.overlay?.presentation?.lastTablePreset)
      ? `Last preset ${normalizeString(overlayState.overlay.presentation.lastTablePreset)}`
      : "",
    overlayState.baseReportRef?.documentVersion
      ? `Base v${overlayState.baseReportRef.documentVersion}`
      : (normalizeString(overlayState.baseReportRef?.reportId) ? `Base ${normalizeString(overlayState.baseReportRef.reportId)}` : ""),
    overlayState.publishedSnapshotRef?.documentVersion
      ? `Snapshot v${overlayState.publishedSnapshotRef.documentVersion}`
      : (normalizeString(overlayState.publishedSnapshotRef?.sourceArtifactId) ? `Snapshot ${normalizeString(overlayState.publishedSnapshotRef.sourceArtifactId)}` : ""),
    diagnostics.length > 0
      ? `${diagnostics.length} ${diagnostics.length === 1 ? "overlay diagnostic" : "overlay diagnostics"}`
      : "",
  ].filter(Boolean);
  return {
    title: "Saved View Overlay",
    text: chips.join(" • "),
    chips,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
    savedViewOverlay: cloneValue(overlayState),
  };
}

export function applySavedViewOverlayScopeParams(value = null, {
  scopeParams = [],
} = {}) {
  const overlayState = extractSavedViewOverlayArtifactState(value);
  const nextScopeParams = (Array.isArray(scopeParams) ? scopeParams : [])
    .map((param) => cloneValue(param));
  const parameterOverrides = isPlainObject(overlayState?.overlay?.parameters)
    ? overlayState.overlay.parameters
    : null;
  if (!parameterOverrides || nextScopeParams.length === 0) {
    return nextScopeParams;
  }
  return nextScopeParams.map((param) => {
    const paramId = normalizeString(param?.id);
    if (!paramId || !Object.prototype.hasOwnProperty.call(parameterOverrides, paramId)) {
      return param;
    }
    return {
      ...param,
      value: cloneValue(parameterOverrides[paramId]),
    };
  });
}

export function applySavedViewOverlayToBuilderState(value = null, {
  document = null,
  reportSpec = null,
  state = {},
} = {}) {
  const overlayState = extractSavedViewOverlayArtifactState(value);
  const overlay = overlayState?.overlay;
  let nextState = isPlainObject(state) ? cloneValue(state) : {};
  if (!overlay) {
    return nextState;
  }
  const scopeFilterIds = collectScopeFilterIds(document);
  const fieldKeys = collectBuilderFieldKeys(document, reportSpec);
  const presetMap = collectPresetMap(document);
  if (isPlainObject(overlay.filters)) {
    const overlayScopeValues = {};
    Object.entries(overlay.filters).forEach(([filterId, filterValue]) => {
      const normalizedFilterId = normalizeString(filterId);
      if (!normalizedFilterId) {
        return;
      }
      if (scopeFilterIds.size > 0 && !scopeFilterIds.has(normalizedFilterId)) {
        return;
      }
      overlayScopeValues[normalizedFilterId] = cloneValue(filterValue);
    });
    nextState = mergeScopeParamValues(nextState, overlayScopeValues);
  }
  if (isPlainObject(overlay.order)) {
    const orderField = normalizeString(overlay.order.field);
    const hasExplicitOrderField = !!orderField;
    const orderFieldValid = !hasExplicitOrderField || isSavedViewOverlayOrderFieldCompatible(document, nextState, orderField);
    if (orderField && orderFieldValid) {
      nextState.orderField = orderField;
    }
    if (orderFieldValid) {
      const orderDirection = normalizeString(overlay.order.direction).toLowerCase();
      if (orderDirection === "asc" || orderDirection === "desc") {
        nextState.orderDir = orderDirection;
      }
      const pageSize = normalizePositiveInteger(overlay.order.pageSize);
      if (pageSize > 0) {
        nextState.pageSize = pageSize;
      }
      const page = normalizePositiveInteger(overlay.order.page);
      if (page > 0) {
        nextState.page = page;
      }
    }
  }
  if (isPlainObject(overlay.presentation)) {
    const viewMode = normalizeString(overlay.presentation.viewMode).toLowerCase();
    if (viewMode === "chart" || viewMode === "table") {
      nextState.viewMode = viewMode;
    }
    const groupBy = normalizeString(overlay.presentation.groupBy);
    if (groupBy && isSavedViewOverlayGroupByCompatible(document, nextState, groupBy)) {
      nextState.groupBy = groupBy;
    }
    if (isPlainObject(overlay.presentation.chartSpec)) {
      nextState.chartSpec = cloneValue(overlay.presentation.chartSpec);
    }
    const activePresetTitle = normalizeString(overlay.presentation.activeTablePreset);
    if (activePresetTitle && presetMap.has(activePresetTitle)) {
      nextState.activeTablePreset = cloneValue(presetMap.get(activePresetTitle));
    }
    const lastPresetTitle = normalizeString(overlay.presentation.lastTablePreset);
    if (lastPresetTitle && presetMap.has(lastPresetTitle)) {
      nextState.lastTablePreset = cloneValue(presetMap.get(lastPresetTitle));
    }
  }
  return nextState;
}
