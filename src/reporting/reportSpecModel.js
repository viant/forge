import {
  buildDefaultReportBuilderChartSpec,
  buildExplicitReportBuilderChartContainer,
  buildReportBuilderColumns,
  buildReportBuilderChartFields,
  buildReportBuilderDefaultChartSpecs,
  buildReportBuilderRequest,
  getReportBuilderResultPanePosition,
  normalizeReportBuilderChartSpec,
  sanitizeReportBuilderState,
  validateReportBuilderChartSpec,
} from "../components/dashboard/reportBuilderUtils.js";
import { buildReportBuilderCalculatedFieldConfig } from "../components/dashboard/reportBuilderCalculatedFieldAuthoring.js";
import { buildReportBuilderStaticDatasetDeclarations } from "../components/dashboard/reportBuilderStaticDatasets.js";
import { getScopeParamValue } from "./scopeStateModel.js";
import { normalizeReportRefinements } from "./reportRefinementModel.js";
import { normalizeReportCalculatedFields } from "./calculatedFieldModel.js";
import { resolveReportBuilderDrillMetadata } from "./reportBuilderDrillMetadata.js";
import { normalizeReportTableCellVisual } from "./tableVisualSpec.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function resolveContainerIdentity(container = {}) {
  return normalizeString(
    container?.id
    || container?.stateKey
    || container?.windowKey
    || container?.windowId,
  );
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function setNestedValue(target, path, value) {
  const segments = normalizeString(path).split(".").filter(Boolean);
  if (!target || typeof target !== "object" || Array.isArray(target) || segments.length === 0) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!isPlainObject(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = value;
}

function normalizeStringArray(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function buildReportSpecColumns(columns = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => ({
    key: normalizeString(column?.key),
    sourceKey: normalizeString(column?.sourceKey || column?.key),
    displayKey: normalizeString(column?.displayKey || column?.key),
    label: normalizeString(column?.label || column?.key),
    kind: normalizeString(column?.kind),
    ...(normalizeString(column?.format) ? { format: normalizeString(column.format) } : {}),
    ...(normalizeString(column?.align) ? { align: normalizeString(column.align) } : {}),
    ...(column?.runtimeFilterable === true ? { runtimeFilterable: true } : {}),
    ...(normalizeReportTableCellVisual(column?.cellVisual) ? { cellVisual: normalizeReportTableCellVisual(column.cellVisual) } : {}),
  })).filter((column) => column.key);
}

function resolveReportSpecTitle(container = {}, config = {}) {
  return normalizeString(container?.title || config?.title || "Report");
}

function resolveReportSpecDataSourceRef(container = {}, config = {}) {
  return normalizeString(container?.dataSourceRef || config?.dataSourceRef);
}

export function normalizeReportBuilderPublishedDataSources(config = {}) {
  return (Array.isArray(config?.dataSources) ? config.dataSources : [])
    .map((entry) => {
      if (!isPlainObject(entry)) {
        return null;
      }
      const id = normalizeString(entry?.id || entry?.dataSourceRef || entry?.value);
      const dataSourceRef = normalizeString(entry?.dataSourceRef || entry?.value || entry?.id);
      if (!id || !dataSourceRef) {
        return null;
      }
      return {
        id,
        dataSourceRef,
        label: normalizeString(entry?.label || dataSourceRef),
        description: normalizeString(entry?.description),
        kindLabel: normalizeString(entry?.kindLabel || entry?.kind),
        request: isPlainObject(entry?.request) ? cloneValue(entry.request) : null,
        columnOptions: Array.isArray(entry?.columnOptions) ? cloneValue(entry.columnOptions) : [],
        valueFieldOptions: Array.isArray(entry?.valueFieldOptions) ? cloneValue(entry.valueFieldOptions) : [],
        secondaryFieldOptions: Array.isArray(entry?.secondaryFieldOptions) ? cloneValue(entry.secondaryFieldOptions) : [],
        chartFieldOptions: Array.isArray(entry?.chartFieldOptions) ? cloneValue(entry.chartFieldOptions) : [],
        scopeParamOptions: Array.isArray(entry?.scopeParamOptions) ? cloneValue(entry.scopeParamOptions) : [],
      };
    })
    .filter(Boolean);
}

export function buildReportBuilderPublishedDatasetConfig(baseConfig = {}, source = null) {
  const normalizedSource = source && typeof source === "object" && !Array.isArray(source)
    ? source
    : null;
  if (!normalizedSource) {
    return baseConfig;
  }
  const fieldOptions = (() => {
    const entries = [];
    const seen = new Set();
    [
      ...(Array.isArray(normalizedSource?.columnOptions) ? normalizedSource.columnOptions : []),
      ...(Array.isArray(normalizedSource?.chartFieldOptions) ? normalizedSource.chartFieldOptions : []),
    ].forEach((option) => {
      if (!isPlainObject(option)) {
        return;
      }
      const key = normalizeString(option?.key || option?.sourceKey);
      const kind = normalizeString(option?.kind);
      if (!key || !kind) {
        return;
      }
      const identity = `${kind}:${key}`;
      if (seen.has(identity)) {
        return;
      }
      seen.add(identity);
      entries.push(cloneValue(option));
    });
    return entries;
  })();
  const dimensions = fieldOptions
    .filter((column) => normalizeString(column?.kind) === "dimension")
    .map((column) => ({
      id: normalizeString(column?.key),
      key: normalizeString(column?.sourceKey || column?.key) || normalizeString(column?.key),
      label: normalizeString(column?.label || column?.key),
      ...(normalizeString(column?.displayKey) ? { displayKey: normalizeString(column.displayKey) } : {}),
      ...(column?.displayValueMap && typeof column.displayValueMap === "object" && !Array.isArray(column.displayValueMap)
        ? { displayValueMap: cloneValue(column.displayValueMap) }
        : {}),
      ...(normalizeString(column?.format) ? { format: normalizeString(column.format) } : {}),
    }))
    .filter((entry) => entry.id && entry.key && entry.label);
  const measures = fieldOptions
    .filter((column) => normalizeString(column?.kind) === "measure")
    .map((column) => ({
      id: normalizeString(column?.key),
      key: normalizeString(column?.sourceKey || column?.key) || normalizeString(column?.key),
      label: normalizeString(column?.label || column?.key),
      ...(normalizeString(column?.format) ? { format: normalizeString(column.format) } : {}),
    }))
    .filter((entry) => entry.id && entry.key && entry.label);
  return {
    ...(isPlainObject(baseConfig) ? cloneValue(baseConfig) : {}),
    dataSourceRef: normalizeString(normalizedSource?.dataSourceRef || baseConfig?.dataSourceRef),
    dimensions,
    measures,
  };
}

function buildReportBuilderPublishedDatasetRequest(source = {}, state = {}, datasetScopeParamValues = null) {
  const request = isPlainObject(source?.request) ? cloneValue(source.request) : null;
  if (!request) {
    return null;
  }
  (Array.isArray(source?.scopeParamOptions) ? source.scopeParamOptions : []).forEach((option) => {
    const paramId = normalizeString(option?.id || option?.value);
    if (!paramId) {
      return;
    }
    const rawValue = datasetScopeParamValues && Object.prototype.hasOwnProperty.call(datasetScopeParamValues, paramId)
      ? datasetScopeParamValues[paramId]
      : getScopeParamValue(state, paramId);
    const kind = normalizeString(option?.kind || "");
    if (kind.toLowerCase() === "daterange") {
      const startParamPath = normalizeString(option?.startParamPath);
      const endParamPath = normalizeString(option?.endParamPath);
      if (normalizeString(rawValue?.start) && startParamPath) {
        setNestedValue(request, startParamPath, rawValue.start);
      }
      if (normalizeString(rawValue?.end) && endParamPath) {
        setNestedValue(request, endParamPath, rawValue.end);
      }
      return;
    }
    if (rawValue == null || rawValue === "" || (Array.isArray(rawValue) && rawValue.length === 0)) {
      return;
    }
    const paramPath = normalizeString(option?.paramPath);
    if (!paramPath) {
      return;
    }
    setNestedValue(request, paramPath, cloneValue(rawValue));
  });
  return request;
}

export function buildReportBuilderPublishedDatasetDeclarations(config = {}, state = {}, referencedDatasetRefs = new Set(), runtimeDatasetScopeParams = null) {
  const sources = normalizeReportBuilderPublishedDataSources(config);
  if (sources.length === 0) {
    return [];
  }
  return sources
    .filter((source) => referencedDatasetRefs.has(source.id) || referencedDatasetRefs.has(source.dataSourceRef))
    .map((source) => {
      const matchedRef = referencedDatasetRefs.has(source.id) ? source.id : source.dataSourceRef;
      const scopedValues = runtimeDatasetScopeParams
        && typeof runtimeDatasetScopeParams === "object"
        && !Array.isArray(runtimeDatasetScopeParams)
        ? (
            runtimeDatasetScopeParams[source.id]
            || runtimeDatasetScopeParams[source.dataSourceRef]
            || null
          )
        : null;
      const request = buildReportBuilderPublishedDatasetRequest(source, state, scopedValues);
      if (!request) {
        return null;
      }
      return {
        id: matchedRef,
        dataSourceRef: source.dataSourceRef,
        request,
      };
    })
    .filter(Boolean);
}

function resolveReportBuilderChartSpecForReportSpec(config = {}, state = {}) {
  const explicit = normalizeReportBuilderChartSpec(state?.chartSpec);
  if (explicit) {
    return explicit;
  }
  if (normalizeString(state?.viewMode).toLowerCase() === "table") {
    return null;
  }
  const defaults = buildReportBuilderDefaultChartSpecs(config, state);
  if (defaults.length > 0) {
    return normalizeReportBuilderChartSpec(defaults[0]);
  }
  return buildDefaultReportBuilderChartSpec(config, state);
}

export function buildReportSpecChartBlock({
  container = {},
  config = {},
  state = {},
  chartSpec = null,
  blockId = "primaryChart",
  datasetRef = "primary",
  title = "",
} = {}) {
  const normalizedChartSpec = normalizeReportBuilderChartSpec({
    ...(chartSpec && typeof chartSpec === "object" && !Array.isArray(chartSpec) ? chartSpec : {}),
    ...(normalizeString(title) ? { title: normalizeString(title) } : {}),
  });
  if (!normalizedChartSpec) {
    return null;
  }
  const chartFields = buildReportBuilderChartFields(config, state);
  const validation = validateReportBuilderChartSpec(config, normalizedChartSpec, chartFields);
  const dataSourceRef = resolveReportSpecDataSourceRef(container, config);
  const chartContainer = buildExplicitReportBuilderChartContainer({
    dataSourceRef,
    collection: [],
  }, config, state, normalizedChartSpec);
  return {
    id: normalizeString(blockId || "primaryChart"),
    kind: "chartBlock",
    datasetRef: normalizeString(datasetRef || "primary"),
    chartSpec: normalizedChartSpec,
    chartModel: validation.valid ? cloneValue(chartContainer?.chart || null) : null,
  };
}

function buildReportSpecCalculatedFields(config = {}, state = {}) {
  const selectedMeasureIds = normalizeStringArray(state?.selectedMeasures);
  if (selectedMeasureIds.length === 0) {
    return [];
  }
  const availableDefinitions = normalizeReportCalculatedFields([
    ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []),
    ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []),
    ...(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []),
  ], {
    datasetRef: "primary",
  });
  const definitionsById = new Map(
    availableDefinitions
      .map((definition) => [normalizeString(definition?.id || definition?.key), definition])
      .filter(([id]) => !!id),
  );
  const visiting = new Set();
  const visited = new Set();
  const selectedDefinitions = [];

  function visitDefinition(id) {
    const normalizedId = normalizeString(id);
    if (!normalizedId || visited.has(normalizedId) || visiting.has(normalizedId)) {
      return;
    }
    const definition = definitionsById.get(normalizedId);
    if (!definition) {
      return;
    }
    visiting.add(normalizedId);
    normalizeStringArray(definition?.dependencies).forEach((dependencyId) => {
      visitDefinition(dependencyId);
    });
    visiting.delete(normalizedId);
    visited.add(normalizedId);
    selectedDefinitions.push(cloneValue(definition));
  }

  selectedMeasureIds.forEach((measureId) => {
    visitDefinition(measureId);
  });
  return selectedDefinitions;
}

function buildReportSpecDrillMetadata(config = {}, state = {}) {
  const normalized = resolveReportBuilderDrillMetadata(config, state?.drillMetadata || null);
  if ((normalized?.hierarchies?.length || 0) === 0
    && (normalized?.detailTargets?.length || 0) === 0
    && (normalized?.fieldActions?.length || 0) === 0) {
    return null;
  }
  return normalized;
}

function normalizeSemanticSummaryGovernance(governance = {}) {
  if (!governance || typeof governance !== "object" || Array.isArray(governance)) {
    return null;
  }
  const status = normalizeString(governance.status).toLowerCase();
  const certification = normalizeString(governance.certification).toLowerCase();
  const ownerRef = normalizeString(governance.ownerRef);
  const classification = normalizeString(governance.classification);
  const deprecation = normalizeString(governance.deprecation);
  const next = {};
  if (status) {
    next.status = status;
  }
  if (certification) {
    next.certification = certification;
  }
  if (ownerRef) {
    next.ownerRef = ownerRef;
  }
  if (classification) {
    next.classification = classification;
  }
  if (deprecation) {
    next.deprecation = deprecation;
  }
  return Object.keys(next).length > 0 ? next : null;
}

function normalizeSemanticSummaryField(field = {}) {
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    return null;
  }
  const id = normalizeString(field?.id);
  const label = normalizeString(field?.label || id);
  if (!id || !label) {
    return null;
  }
  const rawId = normalizeString(field?.rawId);
  const description = normalizeString(field?.description);
  const format = normalizeString(field?.format);
  const category = normalizeString(field?.category);
  const definitionRef = normalizeString(field?.definitionRef);
  const governance = normalizeSemanticSummaryGovernance(field?.governance);
  return {
    id,
    ...(rawId ? { rawId } : {}),
    label,
    ...(description ? { description } : {}),
    ...(format ? { format } : {}),
    ...(category ? { category } : {}),
    ...(definitionRef ? { definitionRef } : {}),
    ...(governance ? { governance } : {}),
  };
}

function normalizeSemanticSummary(summary = {}) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return null;
  }
  const kind = normalizeString(summary.kind).toLowerCase();
  if (kind !== "semantic") {
    return null;
  }
  const modelRef = normalizeString(summary.modelRef);
  const entity = normalizeString(summary.entity);
  if (!modelRef || !entity) {
    return null;
  }
  const selectedParameters = (Array.isArray(summary.selectedParameters) ? summary.selectedParameters : [])
    .map((field) => normalizeSemanticSummaryField(field))
    .filter(Boolean);
  return {
    kind: "semantic",
    modelRef,
    ...(normalizeString(summary.modelLabel) ? { modelLabel: normalizeString(summary.modelLabel) } : {}),
    ...(normalizeString(summary.modelDescription) ? { modelDescription: normalizeString(summary.modelDescription) } : {}),
    entity,
    ...(normalizeString(summary.entityLabel) ? { entityLabel: normalizeString(summary.entityLabel) } : {}),
    ...(normalizeString(summary.entityDescription) ? { entityDescription: normalizeString(summary.entityDescription) } : {}),
    selectedDimensions: (Array.isArray(summary.selectedDimensions) ? summary.selectedDimensions : [])
      .map((field) => normalizeSemanticSummaryField(field))
      .filter(Boolean),
    selectedMeasures: (Array.isArray(summary.selectedMeasures) ? summary.selectedMeasures : [])
      .map((field) => normalizeSemanticSummaryField(field))
      .filter(Boolean),
    ...(selectedParameters.length > 0 ? { selectedParameters } : {}),
  };
}

export function buildReportBuilderReportSpec({
  container = {},
  config = {},
  state = {},
  refinements = [],
  semanticSummary = null,
  includePrimaryBlocks = true,
} = {}) {
  const normalizedState = sanitizeReportBuilderState(config, state);
  const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, normalizedState);
  const request = buildReportBuilderRequest(config, normalizedState);
  const normalizedRefinements = normalizeReportRefinements(refinements);
  if (Array.isArray(request?.semanticSelection?.refinements)) {
    request.semanticSelection.refinements = cloneValue(normalizedRefinements);
  }
  if (normalizedRefinements.length > 0) {
    request.refinements = cloneValue(normalizedRefinements);
  }
  const tableColumns = buildReportSpecColumns(buildReportBuilderColumns(effectiveConfig, normalizedState));
  const chartSpec = resolveReportBuilderChartSpecForReportSpec(effectiveConfig, normalizedState);
  const calculatedFields = buildReportSpecCalculatedFields(effectiveConfig, normalizedState);
  const drillMetadata = buildReportSpecDrillMetadata(effectiveConfig, normalizedState);
  const normalizedSemanticSummary = normalizeSemanticSummary(semanticSummary);
  const referencedDatasetRefs = new Set(
    (Array.isArray(normalizedState?.reportDocumentBlocks) ? normalizedState.reportDocumentBlocks : [])
      .map((block) => normalizeString(block?.datasetRef))
      .filter((datasetRef) => !!datasetRef && datasetRef !== "primary"),
  );
  const publishedDatasets = buildReportBuilderPublishedDatasetDeclarations(effectiveConfig, normalizedState, referencedDatasetRefs);
  const staticDatasets = buildReportBuilderStaticDatasetDeclarations(normalizedState?.reportStaticDatasets);
  const chartBlock = chartSpec
    ? buildReportSpecChartBlock({
      container,
      config: effectiveConfig,
      state: normalizedState,
      chartSpec,
    })
    : null;
  const blocks = includePrimaryBlocks
    ? [
      {
        id: "primaryTable",
        kind: "tableBlock",
        datasetRef: "primary",
        columns: tableColumns,
      },
      ...(chartBlock ? [chartBlock] : []),
    ]
    : [];

  return {
    version: 1,
    kind: "reportSpec",
    source: {
      kind: "dashboard.reportBuilder",
      containerId: resolveContainerIdentity(container),
      stateKey: normalizeString(container?.stateKey || resolveContainerIdentity(container)),
      dataSourceRef: resolveReportSpecDataSourceRef(container, config),
    },
    title: resolveReportSpecTitle(container, config),
    ...(normalizedState?.binding ? { binding: cloneValue(normalizedState.binding) } : {}),
    ...(normalizedSemanticSummary ? { semanticSummary: cloneValue(normalizedSemanticSummary) } : {}),
    parameters: {
      viewMode: normalizeString(normalizedState?.viewMode || "table"),
      groupBy: normalizeString(normalizedState?.groupBy),
      pageSize: Math.max(1, Number(normalizedState?.pageSize || 0) || 0) || 50,
      orderField: normalizeString(normalizedState?.orderField),
      orderDir: normalizeString(normalizedState?.orderDir || "desc"),
    },
    layoutIntent: {
      kind: "single",
      resultPanePosition: getReportBuilderResultPanePosition(config),
      blockOrder: blocks.map((block) => block.id),
    },
    ...(drillMetadata ? { drillMetadata: cloneValue(drillMetadata) } : {}),
    refinements: normalizedRefinements,
    calculatedFields,
    datasets: [
      {
        id: "primary",
        dataSourceRef: resolveReportSpecDataSourceRef(container, config),
        request: cloneValue(request),
      },
      ...publishedDatasets,
      ...staticDatasets,
    ],
    blocks,
  };
}
