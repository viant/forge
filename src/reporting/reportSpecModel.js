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
import { normalizeReportRefinements } from "./reportRefinementModel.js";
import { normalizeReportCalculatedFields } from "./calculatedFieldModel.js";
import { resolveReportBuilderDrillMetadata } from "./reportBuilderDrillMetadata.js";
import { normalizeReportTableCellVisual } from "./tableVisualSpec.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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
  const chartBlock = chartSpec
    ? buildReportSpecChartBlock({
      container,
      config: effectiveConfig,
      state: normalizedState,
      chartSpec,
    })
    : null;
  const blocks = [
    {
      id: "primaryTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: tableColumns,
    },
    ...(chartBlock ? [chartBlock] : []),
  ];

  return {
    version: 1,
    kind: "reportSpec",
    source: {
      kind: "dashboard.reportBuilder",
      containerId: normalizeString(container?.id),
      stateKey: normalizeString(container?.stateKey || container?.id),
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
    ],
    blocks,
  };
}
