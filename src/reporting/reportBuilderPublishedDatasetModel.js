import {
  normalizeReportDatasetCapabilities,
  normalizeReportDatasetSource,
} from "./reportDatasetSourceModel.js";
import { normalizeReportDatasetScope } from "./reportDatasetScopeModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalObject(value) {
  return isPlainObject(value) ? cloneValue(value) : null;
}

function buildDerivedDimensionOptions(entry = {}) {
  const key = normalizeString(entry?.key || entry?.id);
  if (!key) {
    return null;
  }
  return {
    key,
    label: normalizeString(entry?.label || key) || key,
    kind: "dimension",
    ...(normalizeString(entry?.sourceKey || entry?.key || entry?.id) ? { sourceKey: normalizeString(entry?.sourceKey || entry?.key || entry?.id) } : {}),
    ...(normalizeString(entry?.displayKey) ? { displayKey: normalizeString(entry.displayKey) } : {}),
    ...(entry?.displayValueMap && typeof entry.displayValueMap === "object" && !Array.isArray(entry.displayValueMap)
      ? { displayValueMap: cloneValue(entry.displayValueMap) }
      : {}),
    ...(normalizeString(entry?.format) ? { format: normalizeString(entry.format) } : {}),
    ...(entry?.default === true ? { default: true } : {}),
    ...(entry?.chartAxis === true ? { chartAxis: true } : {}),
    ...(entry?.runtimeFilter && typeof entry.runtimeFilter === "object" && !Array.isArray(entry.runtimeFilter)
      ? { runtimeFilter: cloneValue(entry.runtimeFilter) }
      : {}),
    ...(normalizeString(entry?.rawId) ? { rawId: normalizeString(entry.rawId) } : {}),
    ...(normalizeString(entry?.description) ? { description: normalizeString(entry.description) } : {}),
    ...(normalizeString(entry?.category) ? { category: normalizeString(entry.category) } : {}),
    ...(normalizeString(entry?.definitionRef) ? { definitionRef: normalizeString(entry.definitionRef) } : {}),
    ...(normalizeString(entry?.semanticRef) ? { semanticRef: normalizeString(entry.semanticRef) } : {}),
    ...(entry?.governance && typeof entry.governance === "object" && !Array.isArray(entry.governance)
      ? { governance: cloneValue(entry.governance) }
      : {}),
  };
}

function buildDerivedMeasureOptions(entry = {}) {
  const key = normalizeString(entry?.key || entry?.id);
  if (!key) {
    return null;
  }
  return {
    key,
    label: normalizeString(entry?.label || key) || key,
    kind: "measure",
    ...(normalizeString(entry?.sourceKey || entry?.key || entry?.id) ? { sourceKey: normalizeString(entry?.sourceKey || entry?.key || entry?.id) } : {}),
    ...(normalizeString(entry?.format) ? { format: normalizeString(entry.format) } : {}),
    ...(entry?.default === true ? { default: true } : {}),
    ...(normalizeString(entry?.rawId) ? { rawId: normalizeString(entry.rawId) } : {}),
    ...(normalizeString(entry?.description) ? { description: normalizeString(entry.description) } : {}),
    ...(normalizeString(entry?.category) ? { category: normalizeString(entry.category) } : {}),
    ...(normalizeString(entry?.definitionRef) ? { definitionRef: normalizeString(entry.definitionRef) } : {}),
    ...(normalizeString(entry?.semanticRef) ? { semanticRef: normalizeString(entry.semanticRef) } : {}),
    ...(entry?.governance && typeof entry.governance === "object" && !Array.isArray(entry.governance)
      ? { governance: cloneValue(entry.governance) }
      : {}),
  };
}

function deriveColumnOptions(entry = {}) {
  const dimensions = (Array.isArray(entry?.dimensions) ? entry.dimensions : [])
    .map((item) => buildDerivedDimensionOptions(item))
    .filter(Boolean);
  const measures = (Array.isArray(entry?.measures) ? entry.measures : [])
    .map((item) => buildDerivedMeasureOptions(item))
    .filter(Boolean);
  return [...dimensions, ...measures];
}

function deriveValueFieldOptions(entry = {}) {
  return (Array.isArray(entry?.measures) ? entry.measures : [])
    .map((item) => {
      const key = normalizeString(item?.key || item?.id);
      if (!key) {
        return null;
      }
      return {
        value: key,
        label: normalizeString(item?.label || key) || key,
        ...(normalizeString(item?.format) ? { format: normalizeString(item.format) } : {}),
        ...(item?.default === true ? { default: true } : {}),
      };
    })
    .filter(Boolean);
}

function deriveSecondaryFieldOptions(entry = {}) {
  return (Array.isArray(entry?.dimensions) ? entry.dimensions : [])
    .map((item) => {
      const key = normalizeString(item?.key || item?.id);
      if (!key) {
        return null;
      }
      return {
        value: key,
        label: normalizeString(item?.label || key) || key,
        ...(normalizeString(item?.format) ? { format: normalizeString(item.format) } : {}),
        ...(item?.default === true ? { default: true } : {}),
      };
    })
    .filter(Boolean);
}

function deriveChartFieldOptions(entry = {}) {
  return deriveColumnOptions(entry).map((item) => ({
    key: normalizeString(item?.displayKey || item?.key),
    aliases: [normalizeString(item?.key)].filter(Boolean),
    label: normalizeString(item?.label || item?.key),
    kind: normalizeString(item?.kind),
    ...(normalizeString(item?.format) ? { format: normalizeString(item.format) } : {}),
    ...(item?.default === true ? { default: true } : {}),
    ...(item?.chartAxis === true ? { chartAxis: true } : {}),
    ...(normalizeString(item?.rawId) ? { rawId: normalizeString(item.rawId) } : {}),
    ...(normalizeString(item?.description) ? { description: normalizeString(item.description) } : {}),
    ...(normalizeString(item?.category) ? { category: normalizeString(item.category) } : {}),
    ...(normalizeString(item?.definitionRef) ? { definitionRef: normalizeString(item.definitionRef) } : {}),
    ...(normalizeString(item?.semanticRef) ? { semanticRef: normalizeString(item.semanticRef) } : {}),
    ...(item?.governance && typeof item.governance === "object" && !Array.isArray(item.governance)
      ? { governance: cloneValue(item.governance) }
      : {}),
  }));
}

// A dataSourceRef names an endpoint, not a logical dataset: several
// independently scoped datasets may share one endpoint. Dataset ids are the
// canonical lookup keys; an endpoint ref may only resolve a dataset when it
// identifies exactly one and does not collide with a declared id.
export function buildReportBuilderPublishedDatasetRefIndex(sources = []) {
  const normalizedSources = (Array.isArray(sources) ? sources : []).filter(isPlainObject);
  const index = new Map();
  normalizedSources.forEach((source) => {
    const id = normalizeString(source?.id);
    if (id && !index.has(id)) {
      index.set(id, source);
    }
  });
  const declaredIds = new Set(index.keys());
  const sourcesByDataSourceRef = new Map();
  normalizedSources.forEach((source) => {
    const dataSourceRef = normalizeString(source?.dataSourceRef);
    if (!dataSourceRef) {
      return;
    }
    sourcesByDataSourceRef.set(dataSourceRef, [
      ...(sourcesByDataSourceRef.get(dataSourceRef) || []),
      source,
    ]);
  });
  sourcesByDataSourceRef.forEach((group, dataSourceRef) => {
    if (group.length === 1 && !declaredIds.has(dataSourceRef)) {
      index.set(dataSourceRef, group[0]);
    }
  });
  return index;
}

export function normalizeReportBuilderPublishedDataSources(config = {}) {
  const declared = [
    ...(Array.isArray(config?.datasets) ? config.datasets : []),
    ...(Array.isArray(config?.dataSources) ? config.dataSources : []),
  ];
  const seen = new Set();
  return declared
    .map((entry) => {
      if (!isPlainObject(entry)) {
        return null;
      }
      const dataSourceRef = normalizeString(entry?.dataSourceRef || entry?.value || entry?.id);
      const id = normalizeString(entry?.id || dataSourceRef);
      if (!dataSourceRef || !id) {
        return null;
      }
      return {
        id,
        dataSourceRef,
        label: normalizeString(entry?.label || dataSourceRef),
        description: normalizeString(entry?.description),
        kindLabel: normalizeString(entry?.kindLabel || entry?.kind || "published"),
        scope: normalizeReportDatasetScope(entry?.scope),
        source: normalizeReportDatasetSource(entry?.source),
        resultContract: normalizeOptionalObject(entry?.resultContract),
        capabilities: normalizeReportDatasetCapabilities(entry?.capabilities),
        request: isPlainObject(entry?.request) ? cloneValue(entry.request) : null,
        columnOptions: Array.isArray(entry?.columnOptions) && entry.columnOptions.length > 0
          ? cloneValue(entry.columnOptions)
          : deriveColumnOptions(entry),
        valueFieldOptions: Array.isArray(entry?.valueFieldOptions) && entry.valueFieldOptions.length > 0
          ? cloneValue(entry.valueFieldOptions)
          : deriveValueFieldOptions(entry),
        secondaryFieldOptions: Array.isArray(entry?.secondaryFieldOptions) && entry.secondaryFieldOptions.length > 0
          ? cloneValue(entry.secondaryFieldOptions)
          : deriveSecondaryFieldOptions(entry),
        chartFieldOptions: Array.isArray(entry?.chartFieldOptions) && entry.chartFieldOptions.length > 0
          ? cloneValue(entry.chartFieldOptions)
          : deriveChartFieldOptions(entry),
        scopeParamOptions: Array.isArray(entry?.scopeParamOptions) ? cloneValue(entry.scopeParamOptions) : [],
      };
    })
    .filter((entry) => {
      if (!entry) {
        return false;
      }
      const key = `${entry.id}::${entry.dataSourceRef}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .filter(Boolean);
}
