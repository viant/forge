import {
  buildReportBuilderPublishedDatasetConfig,
  buildReportBuilderPublishedDatasetDeclarations,
  buildReportBuilderReportSpec,
  buildReportSpecChartBlock,
  normalizeReportBuilderPublishedDataSources,
} from "./reportSpecModel.js";
import { normalizeReportCalculatedFields } from "./calculatedFieldModel.js";
import { normalizeReportRefinements } from "./reportRefinementModel.js";
import {
  normalizeRefinementBarActionKinds,
  normalizeRefinementBarText,
} from "./refinementBarModel.js";
import { normalizeReportDocumentTableBlock } from "./tableVisualSpec.js";
import { buildReportBuilderCalculatedFieldConfig } from "../components/dashboard/reportBuilderCalculatedFieldAuthoring.js";
import { normalizeReportBuilderStaticDatasets } from "../components/dashboard/reportBuilderStaticDatasets.js";
import { normalizeReportBuilderChartSpec } from "../components/dashboard/reportBuilderUtils.js";
import {
  listReportBuilderPinnedPredicates,
  resolveReportBuilderScopeParamFilters,
} from "../components/dashboard/reportBuilderPredicates.js";
import {
  SCOPE_PARAMS_BINDING_PREFIX,
  STATIC_FILTERS_BINDING_PREFIX,
  resolveScopeBindingFilterId,
} from "./scopeBindingModel.js";
import {
  getScopeParamValue,
  mergeScopeParamValues,
  resolveScopeParamId,
} from "./scopeStateModel.js";
import { buildReportLayoutItem } from "./reportLayoutModel.js";

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

function normalizeFilterBarTitle(value = "") {
  const normalized = normalizeString(value);
  const lowered = normalized.toLowerCase();
  if (!normalized || lowered === "scope" || lowered === "report scope") {
    return "Filters";
  }
  return normalized;
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStringArray(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function normalizeGeoFormat(value = "") {
  const normalized = normalizeString(value);
  if (normalized === "compactNumber") {
    return "compact";
  }
  return normalized;
}

export function extractReportDocumentTemplateIdentity(document = null) {
  const explicitTemplateId = normalizeString(document?.templateId);
  const explicitTemplateLabel = normalizeString(document?.templateLabel);
  if (explicitTemplateId || explicitTemplateLabel) {
    return {
      ...(explicitTemplateId ? { templateId: explicitTemplateId } : {}),
      ...(explicitTemplateLabel ? { templateLabel: explicitTemplateLabel } : {}),
    };
  }
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const reportBuilderBlock = blocks.find((block) => normalizeString(block?.kind) === "reportBuilderBlock") || null;
  const embeddedTemplateId = normalizeString(reportBuilderBlock?.state?.reportDocumentTemplateId);
  const embeddedTemplateLabel = normalizeString(reportBuilderBlock?.state?.reportDocumentTemplateLabel);
  if (!embeddedTemplateId && !embeddedTemplateLabel) {
    return null;
  }
  return {
    ...(embeddedTemplateId ? { templateId: embeddedTemplateId } : {}),
    ...(embeddedTemplateLabel ? { templateLabel: embeddedTemplateLabel } : {}),
  };
}

function buildLayoutItem(blockId = "", source = null) {
  return buildReportLayoutItem(blockId, source, {
    preserveLegacyHalf: true,
  });
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function setNestedValue(target, path, value) {
  const segments = String(path || "").split(".").map((segment) => segment.trim()).filter(Boolean);
  if (!target || typeof target !== "object" || Array.isArray(target) || segments.length === 0) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!cursor[segment] || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = value;
}

function buildReportBuilderFieldLookup(entries = []) {
  const result = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const normalizedEntry = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : null;
    if (!normalizedEntry) {
      return;
    }
    const aliases = [
      normalizeString(normalizedEntry?.id),
      normalizeString(normalizedEntry?.key),
      normalizeString(normalizedEntry?.chartKey),
      normalizeString(normalizedEntry?.displayKey),
      normalizeString(normalizedEntry?.displayPath),
    ].filter(Boolean);
    aliases.forEach((alias) => {
      if (!result.has(alias)) {
        result.set(alias, normalizedEntry);
      }
    });
  });
  return result;
}

function resolveReportBuilderFieldId(entry = {}) {
  return normalizeString(entry?.id || entry?.key);
}

function buildReportBuilderFieldCatalog(config = {}) {
  const lookup = new Map();
  const addEntries = (entries = [], kind = "") => {
    buildReportBuilderFieldLookup(entries).forEach((entry, alias) => {
      if (!lookup.has(alias)) {
        lookup.set(alias, { kind, entry });
      }
    });
  };
  addEntries(config?.dimensions, "dimension");
  addEntries(config?.measures, "measure");
  addEntries(
    normalizeReportCalculatedFields([
      ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []),
      ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []),
      ...(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []),
    ], {
      datasetRef: "primary",
    }),
    "calculated",
  );
  return { lookup };
}

function resolveReportBuilderCatalogEntry(fieldCatalog = {}, fieldKey = "") {
  const normalizedFieldKey = normalizeString(fieldKey);
  if (!normalizedFieldKey) {
    return null;
  }
  return fieldCatalog?.lookup instanceof Map ? fieldCatalog.lookup.get(normalizedFieldKey) || null : null;
}

function buildAuthoredChartBlockState(baseState = {}, chartSpec = {}, fieldCatalog = {}) {
  const nextState = cloneValue(isPlainObject(baseState) ? baseState : {});
  const selectedMeasures = normalizeStringArray(nextState?.selectedMeasures);
  const selectedDimensions = normalizeStringArray(nextState?.selectedDimensions);
  const addSelection = (fieldKey = "") => {
    const catalogEntry = resolveReportBuilderCatalogEntry(fieldCatalog, fieldKey);
    const fieldId = resolveReportBuilderFieldId(catalogEntry?.entry);
    if (!catalogEntry || !fieldId) {
      return;
    }
    if (catalogEntry.kind === "dimension") {
      if (!selectedDimensions.includes(fieldId)) {
        selectedDimensions.push(fieldId);
      }
      return;
    }
    if (!selectedMeasures.includes(fieldId)) {
      selectedMeasures.push(fieldId);
    }
  };
  addSelection(chartSpec?.xField);
  addSelection(chartSpec?.seriesField);
  normalizeStringArray(chartSpec?.yFields).forEach((fieldKey) => addSelection(fieldKey));
  nextState.selectedMeasures = selectedMeasures;
  nextState.selectedDimensions = selectedDimensions;
  return nextState;
}

function buildAuthoredTableBlock(block = {}, fieldCatalog = {}) {
  const normalizedBlock = block && typeof block === "object" && !Array.isArray(block)
    ? cloneValue(block)
    : null;
  if (!normalizedBlock) {
    return null;
  }
  const columns = Array.isArray(normalizedBlock?.columns) ? normalizedBlock.columns : [];
  normalizedBlock.columns = columns.map((column) => {
    const normalizedColumn = column && typeof column === "object" && !Array.isArray(column)
      ? cloneValue(column)
      : null;
    if (!normalizedColumn) {
      return column;
    }
    const catalogEntry = resolveReportBuilderCatalogEntry(fieldCatalog, normalizedColumn?.key);
    const fieldId = resolveReportBuilderFieldId(catalogEntry?.entry);
    if (!catalogEntry || !fieldId) {
      return normalizedColumn;
    }
    const sourceKey = normalizeString(catalogEntry?.entry?.key || catalogEntry?.entry?.id || fieldId) || fieldId;
    const displayKey = normalizeString(catalogEntry?.entry?.displayKey || catalogEntry?.entry?.displayPath || sourceKey) || sourceKey;
    return {
      ...normalizedColumn,
      sourceKey,
      displayKey,
      ...(normalizedColumn?.displayValueMap || catalogEntry?.entry?.displayValueMap
        ? { displayValueMap: cloneValue(normalizedColumn?.displayValueMap || catalogEntry?.entry?.displayValueMap) }
        : {}),
      ...(normalizeString(normalizedColumn?.label || catalogEntry?.entry?.label || fieldId)
        ? { label: normalizeString(normalizedColumn?.label || catalogEntry?.entry?.label || fieldId) }
        : {}),
      ...(normalizeString(normalizedColumn?.format || catalogEntry?.entry?.format)
        ? { format: normalizeString(normalizedColumn?.format || catalogEntry?.entry?.format) }
        : {}),
      ...(catalogEntry.kind === "dimension" && catalogEntry?.entry?.runtimeFilter && typeof catalogEntry.entry.runtimeFilter === "object" && !Array.isArray(catalogEntry.entry.runtimeFilter)
        ? { runtimeFilterable: true }
        : {}),
    };
  });
  return normalizedBlock;
}

function buildAuthoredKpiBlock(block = {}, fieldCatalog = {}) {
  const normalizedBlock = buildReportDocumentKpiBlock(block);
  if (!normalizedBlock) {
    return normalizedBlock;
  }
  const valueFieldEntry = resolveReportBuilderCatalogEntry(fieldCatalog, normalizedBlock?.valueField);
  const secondaryFieldEntry = resolveReportBuilderCatalogEntry(fieldCatalog, normalizedBlock?.secondaryField);
  const nextBlock = {
    ...normalizedBlock,
  };
  if (!normalizeString(nextBlock?.valueLabel)) {
    const valueFieldId = resolveReportBuilderFieldId(valueFieldEntry?.entry);
    const valueLabel = normalizeString(valueFieldEntry?.entry?.label || valueFieldId);
    if (valueLabel) {
      nextBlock.valueLabel = valueLabel;
    }
  }
  if (normalizeString(nextBlock?.secondaryField) && secondaryFieldEntry?.entry) {
    const secondaryFieldId = resolveReportBuilderFieldId(secondaryFieldEntry.entry);
    const secondaryDisplayKey = normalizeString(
      nextBlock?.secondaryDisplayKey
      || secondaryFieldEntry?.entry?.displayKey
      || secondaryFieldEntry?.entry?.displayPath
      || secondaryFieldEntry?.entry?.key
      || secondaryFieldId,
    );
    const secondaryDisplayValueMap = (
      !nextBlock?.secondaryDisplayValueMap
      && secondaryFieldEntry?.entry?.displayValueMap
      && typeof secondaryFieldEntry.entry.displayValueMap === "object"
      && !Array.isArray(secondaryFieldEntry.entry.displayValueMap)
    )
      ? cloneValue(secondaryFieldEntry.entry.displayValueMap)
      : null;
    if (secondaryDisplayKey && (secondaryDisplayKey !== normalizeString(nextBlock?.secondaryField) || secondaryDisplayValueMap)) {
      nextBlock.secondaryDisplayKey = secondaryDisplayKey;
    }
    if (secondaryDisplayValueMap) {
      nextBlock.secondaryDisplayValueMap = secondaryDisplayValueMap;
    }
    if (!normalizeString(nextBlock?.secondaryLabel)) {
      const secondaryLabel = normalizeString(secondaryFieldEntry?.entry?.label || secondaryFieldId);
      if (secondaryLabel) {
        nextBlock.secondaryLabel = secondaryLabel;
      }
    }
  }
  return nextBlock;
}

function buildAuthoredBadgesBlock(block = {}, fieldCatalog = {}) {
  const normalizedBlock = buildReportDocumentBadgesBlock(block);
  if (!normalizedBlock) {
    return normalizedBlock;
  }
  normalizedBlock.items = (Array.isArray(normalizedBlock?.items) ? normalizedBlock.items : []).map((item) => {
    const normalizedItem = item && typeof item === "object" && !Array.isArray(item)
      ? cloneValue(item)
      : null;
    if (!normalizedItem) {
      return item;
    }
    const valueFieldEntry = resolveReportBuilderCatalogEntry(fieldCatalog, normalizedItem?.valueField);
    const valueFieldId = resolveReportBuilderFieldId(valueFieldEntry?.entry);
    if (!normalizeString(normalizedItem?.valueField) || !valueFieldEntry?.entry || !valueFieldId) {
      return normalizedItem;
    }
    const displayKey = normalizeString(
      normalizedItem?.displayKey
      || valueFieldEntry?.entry?.displayKey
      || valueFieldEntry?.entry?.displayPath
      || valueFieldEntry?.entry?.key
      || valueFieldId,
    );
    if (displayKey && displayKey !== normalizeString(normalizedItem?.valueField)) {
      normalizedItem.displayKey = displayKey;
    }
    if (
      !normalizedItem?.displayValueMap
      && valueFieldEntry?.entry?.displayValueMap
      && typeof valueFieldEntry.entry.displayValueMap === "object"
      && !Array.isArray(valueFieldEntry.entry.displayValueMap)
    ) {
      normalizedItem.displayValueMap = cloneValue(valueFieldEntry.entry.displayValueMap);
    }
    if (!normalizeString(normalizedItem?.label)) {
      const label = normalizeString(valueFieldEntry?.entry?.label || valueFieldId);
      if (label) {
        normalizedItem.label = label;
      }
    }
    return normalizedItem;
  });
  return normalizedBlock;
}

function buildStaticDatasetReportBuilderConfig(baseConfig = {}, dataset = null) {
  const normalizedDataset = dataset && typeof dataset === "object" && !Array.isArray(dataset)
    ? dataset
    : null;
  if (!normalizedDataset) {
    return baseConfig;
  }
  const columnOptions = Array.isArray(normalizedDataset?.columnOptions)
    ? normalizedDataset.columnOptions
    : [];
  const dimensions = columnOptions
    .filter((column) => normalizeString(column?.kind) === "dimension")
    .map((column) => ({
      id: normalizeString(column?.key),
      key: normalizeString(column?.key),
      label: normalizeString(column?.label || column?.key),
      ...(normalizeString(column?.format) ? { format: normalizeString(column.format) } : {}),
    }))
    .filter((entry) => entry.id && entry.key && entry.label);
  const measures = columnOptions
    .filter((column) => normalizeString(column?.kind) === "measure")
    .map((column) => ({
      id: normalizeString(column?.key),
      key: normalizeString(column?.key),
      label: normalizeString(column?.label || column?.key),
      ...(normalizeString(column?.format) ? { format: normalizeString(column.format) } : {}),
    }))
    .filter((entry) => entry.id && entry.key && entry.label);
  return {
    ...(isPlainObject(baseConfig) ? cloneValue(baseConfig) : {}),
    dataSourceRef: normalizeString(normalizedDataset?.dataSourceRef || baseConfig?.dataSourceRef),
    dimensions,
    measures,
  };
}

function augmentReportRequestField(request = {}, fieldLookup = new Map(), fieldKey = "", defaultPathPrefix = "") {
  const normalizedFieldKey = normalizeString(fieldKey);
  if (!normalizedFieldKey || !request || typeof request !== "object" || Array.isArray(request)) {
    return false;
  }
  const entry = fieldLookup.get(normalizedFieldKey);
  if (!entry) {
    return false;
  }
  setNestedValue(
    request,
    normalizeString(entry?.paramPath || `${defaultPathPrefix}.${normalizeString(entry?.id || normalizedFieldKey)}`),
    true,
  );
  return true;
}

function augmentReportRequestForAuthoredBlocks(baseSpec = {}, blocks = [], config = {}) {
  const datasets = Array.isArray(baseSpec?.datasets) ? baseSpec.datasets : [];
  const primaryDatasetIndex = datasets.findIndex((dataset) => normalizeString(dataset?.id) === "primary");
  if (primaryDatasetIndex === -1) {
    return baseSpec;
  }
  const nextSpec = cloneValue(baseSpec);
  const request = nextSpec?.datasets?.[primaryDatasetIndex]?.request;
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return nextSpec;
  }
  const fieldCatalog = buildReportBuilderFieldCatalog(config);
  const calculatedFields = Array.isArray(nextSpec?.calculatedFields) ? nextSpec.calculatedFields : [];
  nextSpec.calculatedFields = calculatedFields;
  const calculatedFieldIds = new Set(
    calculatedFields
      .map((field) => resolveReportBuilderFieldId(field))
      .filter(Boolean),
  );
  const visitingCalculatedFields = new Set();
  const enableField = (fieldKey = "") => {
    const catalogEntry = resolveReportBuilderCatalogEntry(fieldCatalog, fieldKey);
    if (!catalogEntry) {
      return false;
    }
    if (catalogEntry.kind === "calculated") {
      const calculatedField = catalogEntry.entry;
      const calculatedFieldId = resolveReportBuilderFieldId(calculatedField);
      if (!calculatedFieldId) {
        return false;
      }
      if (!calculatedFieldIds.has(calculatedFieldId)) {
        nextSpec.calculatedFields.push(cloneValue(calculatedField));
        calculatedFieldIds.add(calculatedFieldId);
      }
      if (visitingCalculatedFields.has(calculatedFieldId)) {
        return true;
      }
      visitingCalculatedFields.add(calculatedFieldId);
      normalizeStringArray(calculatedField?.dependencies).forEach((dependencyKey) => enableField(dependencyKey));
      visitingCalculatedFields.delete(calculatedFieldId);
      return true;
    }
    setNestedValue(
      request,
      normalizeString(
        catalogEntry?.entry?.paramPath
          || `${catalogEntry.kind === "measure" ? "measures" : "dimensions"}.${resolveReportBuilderFieldId(catalogEntry?.entry) || normalizeString(fieldKey)}`,
      ),
      true,
    );
    return true;
  };

  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const normalizedBlock = block && typeof block === "object" && !Array.isArray(block) ? block : null;
    if (!normalizedBlock) {
      return;
    }
    const normalizedDatasetRef = normalizeString(normalizedBlock?.datasetRef || "primary") || "primary";
    if (normalizedDatasetRef !== "primary") {
      return;
    }
    switch (normalizeString(normalizedBlock?.kind)) {
      case "chartBlock":
        enableField(normalizedBlock?.chartSpec?.xField);
        normalizeString(normalizedBlock?.chartSpec?.seriesField) && enableField(normalizedBlock.chartSpec.seriesField);
        (Array.isArray(normalizedBlock?.chartSpec?.yFields) ? normalizedBlock.chartSpec.yFields : [])
          .forEach((fieldKey) => enableField(fieldKey));
        break;
      case "kpiBlock":
        enableField(normalizedBlock?.valueField);
        enableField(normalizedBlock?.secondaryField);
        break;
      case "badgesBlock":
        (Array.isArray(normalizedBlock?.items) ? normalizedBlock.items : []).forEach((item) => {
          enableField(item?.valueField);
        });
        break;
      case "tableBlock":
        (Array.isArray(normalizedBlock?.columns) ? normalizedBlock.columns : []).forEach((column) => {
          enableField(column?.key);
          enableField(column?.cellVisual?.valueField);
        });
        break;
      case "geoMapBlock":
        enableField(normalizedBlock?.geo?.key);
        enableField(normalizedBlock?.geo?.labelKey);
        enableField(normalizedBlock?.geo?.metric?.key);
        enableField(normalizedBlock?.geo?.color?.field);
        break;
      default:
        break;
    }
  });
  return nextSpec;
}

function resolveDocumentId(container = {}) {
  return resolveContainerIdentity(container) || "reportDocument";
}

function resolveDocumentTitle(container = {}, config = {}) {
  return normalizeString(container?.title || config?.title || "Report");
}

function resolveDocumentMetadataValue(value, fallback = "") {
  const normalized = normalizeString(value);
  return normalized || normalizeString(fallback);
}

function resolveDocumentDataSourceRef(container = {}, config = {}) {
  return normalizeString(container?.dataSourceRef || config?.dataSourceRef);
}

function resolveDocumentTemplateIdentity(state = {}) {
  const templateId = normalizeString(state?.reportDocumentTemplateId);
  const templateLabel = normalizeString(state?.reportDocumentTemplateLabel);
  if (!templateId && !templateLabel) {
    return null;
  }
  return {
    ...(templateId ? { templateId } : {}),
    ...(templateLabel ? { templateLabel } : {}),
  };
}

function stripReportBuilderDocumentAuthoringState(state = {}) {
  const next = cloneValue(isPlainObject(state) ? state : {});
  delete next.reportDocumentBlocks;
  delete next.reportDocumentLayout;
  return next;
}

function resolveScopeParamValue(filter = {}, state = {}, runtimeDatasetScopeParams = null, datasetRef = "") {
  const filterId = resolveScopeParamId(filter);
  if (!filterId) {
    return null;
  }
  const normalizedDatasetRef = normalizeString(datasetRef);
  const datasetScopedValues = normalizedDatasetRef
    && runtimeDatasetScopeParams
    && typeof runtimeDatasetScopeParams === "object"
    && !Array.isArray(runtimeDatasetScopeParams)
    && runtimeDatasetScopeParams[normalizedDatasetRef]
    && typeof runtimeDatasetScopeParams[normalizedDatasetRef] === "object"
    && !Array.isArray(runtimeDatasetScopeParams[normalizedDatasetRef])
      ? runtimeDatasetScopeParams[normalizedDatasetRef]
      : null;
  const rawValue = datasetScopedValues && Object.prototype.hasOwnProperty.call(datasetScopedValues, filterId)
    ? datasetScopedValues[filterId]
    : getScopeParamValue(state, filterId);
  if (filter?.type === "dateRange") {
    const start = normalizeString(rawValue?.start);
    const end = normalizeString(rawValue?.end);
    return start || end ? { start, end } : null;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.length > 0 ? cloneValue(rawValue) : [];
  }
  return rawValue ?? null;
}

function collectPinnedPredicateScopeParams(config = {}, state = {}) {
  return listReportBuilderPinnedPredicates(config).map((predicate) => {
    const value = resolveScopeParamValue(
      { id: predicate.id, ...(predicate.kind === "dateRange" ? { type: "dateRange" } : {}) },
      state,
    );
    return {
      id: predicate.id,
      kind: predicate.kind === "dateRange"
        ? "dateRange"
        : (predicate.multiple === true ? "multiSelect" : "value"),
      label: normalizeString(predicate.label || predicate.id),
      ...(predicate.description ? { description: predicate.description } : {}),
      required: predicate.required === true,
      ...(predicate.multiple === true ? { multiple: true } : {}),
      ...(predicate.presentation ? { presentation: normalizeString(predicate.presentation) } : {}),
      ...(Array.isArray(predicate.options) ? { options: cloneValue(predicate.options) } : {}),
      value,
    };
  });
}

function collectLegacyStaticFilterScopeParams(config = {}, state = {}, excludedIds = new Set()) {
  return resolveReportBuilderScopeParamFilters(config)
    .map((filter) => {
      const id = normalizeString(filter?.id || filter?.field);
      if (!id || excludedIds.has(id)) {
        return null;
      }
      const value = resolveScopeParamValue(filter, state);
      const description = normalizeString(filter?.description);
      return {
        id,
        kind: normalizeString(filter?.type || (filter?.multiple ? "multiSelect" : "value")) || "value",
        label: normalizeString(filter?.label || id),
        ...(description ? { description } : {}),
        required: filter?.required === true,
        ...(filter?.multiple === true ? { multiple: true } : {}),
        ...(normalizeString(filter?.presentation) ? { presentation: normalizeString(filter.presentation) } : {}),
        ...(Array.isArray(filter?.options) ? { options: cloneValue(filter.options) } : {}),
        value,
      };
    })
    .filter(Boolean);
}

function collectConfiguredDataSourceScopeParams(config = {}, state = {}, excludedIds = new Set(), runtimeDatasetScopeParams = null) {
  const seen = new Set(excludedIds instanceof Set ? [...excludedIds] : []);
  const params = [];
  (Array.isArray(config?.dataSources) ? config.dataSources : []).forEach((source) => {
    const datasetRef = normalizeString(source?.id || source?.dataSourceRef || source?.value);
    if (!datasetRef) {
      return;
    }
    (Array.isArray(source?.scopeParamOptions) ? source.scopeParamOptions : []).forEach((option) => {
      const id = normalizeString(option?.id || option?.value);
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      const kind = normalizeString(option?.kind || "value") || "value";
      const value = resolveScopeParamValue({
        id,
        ...(kind === "dateRange" ? { type: "dateRange" } : {}),
        ...(option?.multiple === true ? { multiple: true } : {}),
      }, state, runtimeDatasetScopeParams, datasetRef);
      params.push({
        id,
        kind,
        label: normalizeString(option?.label || id),
        ...(normalizeString(option?.description) ? { description: normalizeString(option.description) } : {}),
        required: option?.required === true,
        ...(option?.multiple === true ? { multiple: true } : {}),
        ...(normalizeString(option?.presentation) ? { presentation: normalizeString(option.presentation) } : {}),
        ...(Array.isArray(option?.options) ? { options: cloneValue(option.options) } : {}),
        datasetRef,
        value,
      });
    });
  });
  return params;
}

export function buildReportDocumentScopeParams(config = {}, state = {}, runtimeDatasetScopeParams = null) {
  const predicateParams = collectPinnedPredicateScopeParams(config, state);
  const predicateParamIds = new Set(predicateParams.map((param) => param.id));
  const legacyParams = collectLegacyStaticFilterScopeParams(config, state, predicateParamIds);
  const configuredSourceParams = collectConfiguredDataSourceScopeParams(
    config,
    state,
    new Set([...predicateParamIds, ...legacyParams.map((param) => param.id)]),
    runtimeDatasetScopeParams,
  );
  return [
    ...predicateParams,
    ...legacyParams,
    ...configuredSourceParams,
  ];
}

export function buildReportBuilderBlockScopeBindings(config = {}) {
  const predicateBindings = listReportBuilderPinnedPredicates(config).map((predicate) => ({
    paramId: predicate.id,
    target: `${SCOPE_PARAMS_BINDING_PREFIX}${predicate.id}`,
  }));
  const predicateParamIds = new Set(predicateBindings.map((binding) => binding.paramId));
  const legacyBindings = resolveReportBuilderScopeParamFilters(config)
    .map((filter) => {
      const paramId = normalizeString(filter?.id || filter?.field);
      if (!paramId || predicateParamIds.has(paramId)) {
        return null;
      }
      return {
        paramId,
        target: `${STATIC_FILTERS_BINDING_PREFIX}${paramId}`,
      };
    })
    .filter(Boolean);
  const seen = new Set([...predicateBindings, ...legacyBindings].map((binding) => binding.paramId));
  const configuredSourceBindings = (Array.isArray(config?.dataSources) ? config.dataSources : [])
    .flatMap((source) => (Array.isArray(source?.scopeParamOptions) ? source.scopeParamOptions : []))
    .map((option) => {
      const paramId = normalizeString(option?.id || option?.value);
      if (!paramId || seen.has(paramId)) {
        return null;
      }
      seen.add(paramId);
      return {
        paramId,
        target: `${SCOPE_PARAMS_BINDING_PREFIX}${paramId}`,
      };
    })
    .filter(Boolean);
  return [...predicateBindings, ...legacyBindings, ...configuredSourceBindings];
}

export function buildReportDocumentMarkdownBlock({
  id = "markdownBlock",
  title = "",
  markdown = "",
} = {}) {
  return {
    id: normalizeString(id || "markdownBlock"),
    kind: "markdownBlock",
    title: normalizeString(title),
    markdown: String(markdown || ""),
  };
}

export function buildReportDocumentFilterBarBlock({
  id = "filterBar",
  title = "Filters",
  paramIds = [],
  datasetRef = "primary",
} = {}) {
  return {
    id: normalizeString(id || "filterBar"),
    kind: "filterBarBlock",
    title: normalizeFilterBarTitle(title || "Filters"),
    datasetRef: normalizeString(datasetRef || "primary") || "primary",
    paramIds: (Array.isArray(paramIds) ? paramIds : [])
      .map((entry) => normalizeString(entry))
      .filter(Boolean),
  };
}

export function buildReportDocumentRefinementBarBlock({
  id = "refinementTrail",
  title = "Refinements",
  actionKinds,
  emptyLabel = "No active refinements",
} = {}) {
  return {
    id: normalizeString(id || "refinementTrail"),
    kind: "refinementBarBlock",
    title: normalizeRefinementBarText(title, "Refinements"),
    actionKinds: normalizeRefinementBarActionKinds(actionKinds, {
      defaultActionKinds: ["remove", "clearAll"],
    }),
    emptyLabel: normalizeRefinementBarText(emptyLabel, "No active refinements"),
  };
}

export function buildReportDocumentKpiBlock(block = {}) {
  const valueField = normalizeString(block?.valueField || "value");
  const secondaryField = normalizeString(block?.secondaryField);
  return {
    id: normalizeString(block?.id || "kpiBlock"),
    kind: "kpiBlock",
    title: normalizeString(block?.title || "KPI"),
    datasetRef: normalizeString(block?.datasetRef || "primary"),
    valueField,
    valueLabel: normalizeString(block?.valueLabel || valueField || "Value"),
    ...(secondaryField
      ? {
        secondaryField,
        secondaryLabel: normalizeString(block?.secondaryLabel || secondaryField),
        ...(normalizeString(block?.secondaryDisplayKey)
          ? { secondaryDisplayKey: normalizeString(block.secondaryDisplayKey) }
          : {}),
        ...(block?.secondaryDisplayValueMap && typeof block.secondaryDisplayValueMap === "object" && !Array.isArray(block.secondaryDisplayValueMap)
          ? { secondaryDisplayValueMap: cloneValue(block.secondaryDisplayValueMap) }
          : {}),
      }
      : {}),
    ...(normalizeString(block?.description)
      ? { description: normalizeString(block.description) }
      : {}),
    ...(normalizeString(block?.tone) ? { tone: normalizeString(block.tone) } : {}),
    ...(normalizeString(block?.emptyLabel)
      ? { emptyLabel: normalizeString(block.emptyLabel) }
      : {}),
  };
}

function normalizeReportDocumentBadgeItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const label = normalizeString(item?.label);
      const value = normalizeString(item?.value);
      const valueField = normalizeString(item?.valueField);
      const format = normalizeString(item?.format);
      const displayKey = normalizeString(item?.displayKey);
      const labelMode = normalizeString(item?.labelMode).toLowerCase();
      const rules = (Array.isArray(item?.rules) ? item.rules : [])
        .map((rule) => {
          if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
            return null;
          }
          const next = {
            ...("value" in rule ? { value: cloneValue(rule.value) } : {}),
            ...(normalizeString(rule?.label) ? { label: normalizeString(rule.label) } : {}),
            ...(normalizeString(rule?.tone) ? { tone: normalizeString(rule.tone) } : {}),
          };
          return Object.keys(next).length > 0 ? next : null;
        })
        .filter(Boolean);
      const tone = normalizeString(item?.tone || item?.severity);
      if (!label && !value && !valueField) {
        return null;
      }
      return {
        id: normalizeString(item?.id || `badge_${index + 1}`) || `badge_${index + 1}`,
        ...(label ? { label } : {}),
        ...(value ? { value } : {}),
        ...(valueField ? { valueField } : {}),
        ...(format ? { format } : {}),
        ...(displayKey ? { displayKey } : {}),
        ...(item?.displayValueMap && typeof item.displayValueMap === "object" && !Array.isArray(item.displayValueMap)
          ? { displayValueMap: cloneValue(item.displayValueMap) }
          : {}),
        ...(["field", "manual"].includes(labelMode) ? { labelMode } : {}),
        ...(rules.length > 0 ? { rules } : {}),
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
}

export function buildReportDocumentBadgesBlock(block = {}) {
  const items = normalizeReportDocumentBadgeItems(block?.items);
  return {
    id: normalizeString(block?.id || "badgesBlock"),
    kind: "badgesBlock",
    title: normalizeString(block?.title || "Status Pills") || "Status Pills",
    datasetRef: normalizeString(block?.datasetRef || "primary") || "primary",
    items,
  };
}

export function buildReportDocumentChartBlock(block = {}) {
  const normalizedTitle = normalizeString(block?.title || block?.chartSpec?.title || "Chart") || "Chart";
  const normalizedChartSpec = normalizeReportBuilderChartSpec({
    ...(block?.chartSpec && typeof block.chartSpec === "object" && !Array.isArray(block.chartSpec)
      ? block.chartSpec
      : {}),
    title: normalizedTitle,
  });
  return {
    id: normalizeString(block?.id || "chartBlock"),
    kind: "chartBlock",
    title: normalizedTitle,
    datasetRef: normalizeString(block?.datasetRef || "primary"),
    chartSpec: normalizedChartSpec,
  };
}

export function buildReportDocumentTableBlock(block = {}) {
  return normalizeReportDocumentTableBlock(block);
}

export function buildReportDocumentGeoMapBlock(block = {}) {
  const geo = block?.geo && typeof block.geo === "object" && !Array.isArray(block.geo)
    ? cloneValue(block.geo)
    : {};
  if (geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)) {
    const metricFormat = normalizeGeoFormat(geo.metric.format);
    if (metricFormat) {
      geo.metric.format = metricFormat;
    } else {
      delete geo.metric.format;
    }
  }
  const geoFormat = normalizeGeoFormat(geo.format);
  if (geoFormat) {
    geo.format = geoFormat;
  } else {
    delete geo.format;
  }
  return {
    id: normalizeString(block?.id || "geoMapBlock"),
    kind: "geoMapBlock",
    title: normalizeString(block?.title || "Geo Map"),
    datasetRef: normalizeString(block?.datasetRef || "primary"),
    geo,
  };
}

function normalizeReportBuilderDocumentBlock(block = {}) {
  if (!isPlainObject(block)) {
    return null;
  }
  const normalizedKind = normalizeString(block?.kind);
  if (normalizedKind === "markdownBlock") {
    return buildReportDocumentMarkdownBlock(block);
  }
  if (normalizedKind === "filterBarBlock") {
    return buildReportDocumentFilterBarBlock(block);
  }
  if (normalizedKind === "refinementBarBlock") {
    const actionKinds = block?.actionKinds != null
      ? normalizeRefinementBarActionKinds(block?.actionKinds)
      : null;
    return {
      id: normalizeString(block?.id || "refinementTrail"),
      kind: "refinementBarBlock",
      ...(block?.title != null ? { title: normalizeRefinementBarText(block?.title) } : {}),
      ...(actionKinds != null ? { actionKinds } : {}),
      ...(block?.emptyLabel != null ? { emptyLabel: normalizeRefinementBarText(block?.emptyLabel) } : {}),
    };
  }
  if (normalizedKind === "kpiBlock") {
    return buildReportDocumentKpiBlock(block);
  }
  if (normalizedKind === "badgesBlock") {
    return buildReportDocumentBadgesBlock(block);
  }
  if (normalizedKind === "chartBlock") {
    return buildReportDocumentChartBlock(block);
  }
  if (normalizedKind === "tableBlock") {
    return normalizeReportDocumentTableBlock(block);
  }
  if (normalizedKind === "geoMapBlock") {
    return buildReportDocumentGeoMapBlock(block);
  }
  return cloneValue(block);
}

export function normalizeReportBuilderDocumentBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => normalizeReportBuilderDocumentBlock(block))
    .filter(Boolean);
}

function mergeReportBuilderDocumentBlocks(stateBlocks = [], additionalBlocks = []) {
  const merged = [];
  const indexById = new Map();
  [...stateBlocks, ...additionalBlocks].forEach((block) => {
    const normalizedBlock = normalizeReportBuilderDocumentBlock(block);
    if (!normalizedBlock) {
      return;
    }
    const blockId = normalizeString(normalizedBlock?.id);
    if (!blockId) {
      merged.push(normalizedBlock);
      return;
    }
    if (!indexById.has(blockId)) {
      indexById.set(blockId, merged.length);
      merged.push(normalizedBlock);
      return;
    }
    merged[indexById.get(blockId)] = normalizedBlock;
  });
  return merged;
}

function normalizeReportBuilderDocumentLayoutItems(layout = null, blockIds = []) {
  const items = Array.isArray(layout)
    ? layout
    : (Array.isArray(layout?.items) ? layout.items : []);
  const knownIds = new Set([
    "primaryBuilder",
    ...(Array.isArray(blockIds) ? blockIds : []).map((entry) => normalizeString(entry)).filter(Boolean),
  ]);
  const seen = new Set();
  const normalized = [];
  items.forEach((item) => {
    const normalizedItem = buildLayoutItem(item?.blockId || item, item);
    const blockId = normalizeString(normalizedItem?.blockId);
    if (!blockId || seen.has(blockId) || !knownIds.has(blockId) || !normalizedItem) {
      return;
    }
    seen.add(blockId);
    normalized.push(normalizedItem);
  });
  if (!seen.has("primaryBuilder")) {
    normalized.unshift({ blockId: "primaryBuilder" });
    seen.add("primaryBuilder");
  }
  (Array.isArray(blockIds) ? blockIds : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean)
    .forEach((blockId) => {
      if (seen.has(blockId)) {
        return;
      }
      seen.add(blockId);
      normalized.push({ blockId });
    });
  return normalized;
}

export function buildReportBuilderReportDocument({
  container = {},
  config = {},
  state = {},
  additionalBlocks = [],
  refinements = [],
  semanticSummary = null,
  runtimeDatasetScopeParams = null,
} = {}) {
  const documentId = resolveDocumentId(container);
  const blockId = "primaryBuilder";
  const scopeParams = buildReportDocumentScopeParams(config, state, runtimeDatasetScopeParams);
  const documentBlocks = mergeReportBuilderDocumentBlocks(
    normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks),
    additionalBlocks,
  );
  const source = {
    kind: "dashboard.reportBuilder",
    containerId: resolveContainerIdentity(container),
    stateKey: normalizeString(container?.stateKey || resolveContainerIdentity(container)),
    dataSourceRef: resolveDocumentDataSourceRef(container, config),
  };

  return {
    version: 1,
    kind: "reportDocument",
    id: documentId,
    title: resolveDocumentMetadataValue(state?.reportDocumentTitle, resolveDocumentTitle(container, config)),
    subtitle: normalizeString(state?.reportDocumentSubtitle),
    description: normalizeString(state?.reportDocumentDescription),
    ...(resolveDocumentTemplateIdentity(state) || {}),
    ...(semanticSummary && typeof semanticSummary === "object" && !Array.isArray(semanticSummary)
      ? { semanticSummary: cloneValue(semanticSummary) }
      : {}),
    refinements: normalizeReportRefinements(refinements),
    scope: {
      params: scopeParams,
      dataSourceRef: resolveDocumentDataSourceRef(container, config),
    },
    layout: {
      type: normalizeString(state?.reportDocumentLayout?.type || "stack") || "stack",
      items: normalizeReportBuilderDocumentLayoutItems(
        state?.reportDocumentLayout,
        documentBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
      ),
    },
    blocks: [
      {
        id: blockId,
        kind: "reportBuilderBlock",
        title: resolveDocumentTitle(container, config),
        source,
        config: cloneValue(config),
        state: stripReportBuilderDocumentAuthoringState(state),
        scopeBindings: buildReportBuilderBlockScopeBindings(config),
      },
      ...documentBlocks.map((block) => cloneValue(block)),
    ],
  };
}

function applyReportBuilderBlockScope(document = {}, block = {}) {
  const scopeParams = new Map(
    (Array.isArray(document?.scope?.params) ? document.scope.params : [])
      .map((param) => [normalizeString(param?.id), param])
      .filter(([id]) => !!id),
  );
  const boundScopeValues = {};
  (Array.isArray(block?.scopeBindings) ? block.scopeBindings : []).forEach((binding) => {
    const paramId = normalizeString(binding?.paramId);
    const filterId = resolveScopeBindingFilterId(binding?.target);
    if (!paramId || !filterId) {
      return;
    }
    const param = scopeParams.get(paramId);
    if (!param) {
      return;
    }
    boundScopeValues[filterId] = cloneValue(param.value);
  });
  return {
    ...block,
    state: mergeScopeParamValues(cloneValue(block?.state || {}), boundScopeValues),
  };
}

function orderLoweredBlocksByDocumentLayout(document = {}, baseSpec = {}, allBlocks = []) {
  const blockIndex = new Map(
    (Array.isArray(allBlocks) ? allBlocks : [])
      .map((block) => [normalizeString(block?.id), block])
      .filter(([id]) => !!id),
  );
  const ordered = [];
  const layoutItems = [];
  const seen = new Set();
  const primaryBuilderBlockIds = (Array.isArray(baseSpec?.layoutIntent?.blockOrder) ? baseSpec.layoutIntent.blockOrder : [])
    .map((blockId) => normalizeString(blockId))
    .filter(Boolean);
  const pushOrderedBlock = (blockId = "", layoutItem = null) => {
    const normalizedBlockId = normalizeString(blockId);
    const block = blockIndex.get(normalizedBlockId);
    if (!block || seen.has(normalizedBlockId)) {
      return;
    }
    seen.add(normalizedBlockId);
    ordered.push(block);
    layoutItems.push(buildLayoutItem(normalizedBlockId, layoutItem) || { blockId: normalizedBlockId });
  };
  (Array.isArray(document?.layout?.items) ? document.layout.items : []).forEach((item) => {
    const blockId = normalizeString(item?.blockId);
    if (!blockId) {
      return;
    }
    const expandedBlockIds = blockId === "primaryBuilder" ? primaryBuilderBlockIds : [blockId];
    expandedBlockIds.forEach((expandedBlockId) => {
      pushOrderedBlock(expandedBlockId, item);
    });
  });
  (Array.isArray(allBlocks) ? allBlocks : []).forEach((block) => {
    const blockId = normalizeString(block?.id);
    if (blockId && seen.has(blockId)) {
      return;
    }
    if (blockId) {
      pushOrderedBlock(blockId);
      return;
    }
    ordered.push(block);
  });
  return {
    blocks: ordered,
    items: layoutItems,
  };
}

export function lowerReportDocumentToReportSpec(document = {}, {
  includePrimaryBlocks = true,
  runtimeDatasetScopeParams = null,
} = {}) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const reportBuilderBlock = blocks.find((block) => normalizeString(block?.kind) === "reportBuilderBlock");
  if (!reportBuilderBlock) {
    throw new Error("ReportDocument must contain at least one reportBuilderBlock.");
  }
  const scopedReportBuilderBlock = applyReportBuilderBlockScope(document, reportBuilderBlock);
  const source = reportBuilderBlock?.source && typeof reportBuilderBlock.source === "object" ? reportBuilderBlock.source : {};
  const scopedConfig = scopedReportBuilderBlock?.config || {};
  const scopedState = scopedReportBuilderBlock?.state || {};
  const effectiveConfig = buildReportBuilderCalculatedFieldConfig(scopedConfig, scopedState);
  const effectiveFieldCatalog = buildReportBuilderFieldCatalog(effectiveConfig);
  const staticDatasets = normalizeReportBuilderStaticDatasets(scopedState?.reportStaticDatasets);
  const staticDatasetIndex = new Map(
    staticDatasets
      .map((dataset) => [normalizeString(dataset?.id), dataset])
      .filter(([datasetId]) => !!datasetId),
  );
  const publishedDatasetSources = normalizeReportBuilderPublishedDataSources(scopedConfig);
  const publishedDatasetIndex = new Map();
  publishedDatasetSources.forEach((source) => {
    if (normalizeString(source?.id)) {
      publishedDatasetIndex.set(normalizeString(source.id), source);
    }
    if (normalizeString(source?.dataSourceRef)) {
      publishedDatasetIndex.set(normalizeString(source.dataSourceRef), source);
    }
  });
  const loweredContainer = {
    id: normalizeString(source.containerId || document?.id),
    stateKey: normalizeString(source.stateKey || source.containerId || document?.id),
    title: normalizeString(document?.title || reportBuilderBlock?.title),
    dataSourceRef: normalizeString(source.dataSourceRef || document?.scope?.dataSourceRef),
  };
  const baseSpec = buildReportBuilderReportSpec({
    container: loweredContainer,
    config: scopedConfig,
    state: scopedState,
    refinements: normalizeReportRefinements(document?.refinements),
    semanticSummary: document?.semanticSummary || null,
    includePrimaryBlocks,
  });
  const resolveDatasetSpecificRuntimeContext = (datasetRef = "") => {
    const normalizedDatasetRef = normalizeString(datasetRef || "primary") || "primary";
    if (!normalizedDatasetRef || normalizedDatasetRef === "primary") {
      return {
        config: effectiveConfig,
        fieldCatalog: effectiveFieldCatalog,
        container: loweredContainer,
      };
    }
    const staticDataset = staticDatasetIndex.get(normalizedDatasetRef) || null;
    if (staticDataset) {
      const datasetConfig = buildStaticDatasetReportBuilderConfig(effectiveConfig, staticDataset);
      return {
        config: datasetConfig,
        fieldCatalog: buildReportBuilderFieldCatalog(datasetConfig),
        container: {
          ...loweredContainer,
          dataSourceRef: normalizeString(staticDataset?.dataSourceRef || loweredContainer?.dataSourceRef),
        },
      };
    }
    const publishedDataset = publishedDatasetIndex.get(normalizedDatasetRef) || null;
    if (publishedDataset) {
      const datasetConfig = buildReportBuilderPublishedDatasetConfig(effectiveConfig, publishedDataset);
      return {
        config: datasetConfig,
        fieldCatalog: buildReportBuilderFieldCatalog(datasetConfig),
        container: {
          ...loweredContainer,
          dataSourceRef: normalizeString(publishedDataset?.dataSourceRef || loweredContainer?.dataSourceRef),
        },
      };
    }
    return {
      config: effectiveConfig,
      fieldCatalog: effectiveFieldCatalog,
      container: loweredContainer,
    };
  };
  const additionalBlocks = blocks
    .filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock")
    .map((block) => {
      const normalizedBlock = normalizeReportBuilderDocumentBlock(block);
      const datasetContext = resolveDatasetSpecificRuntimeContext(normalizedBlock?.datasetRef);
      if (normalizeString(normalizedBlock?.kind) === "chartBlock") {
        const chartState = buildAuthoredChartBlockState({
          ...cloneValue(scopedState),
          selectedDimensions: [],
          selectedMeasures: [],
          primaryMeasure: "",
          groupBy: "",
        }, normalizedBlock?.chartSpec || {}, datasetContext.fieldCatalog);
        return buildReportSpecChartBlock({
          container: datasetContext.container,
          config: datasetContext.config,
          state: chartState,
          chartSpec: normalizedBlock?.chartSpec || null,
          blockId: normalizedBlock?.id,
          datasetRef: normalizedBlock?.datasetRef,
          title: normalizedBlock?.title,
        });
      }
      if (normalizeString(normalizedBlock?.kind) === "tableBlock") {
        return buildAuthoredTableBlock(normalizedBlock, datasetContext.fieldCatalog);
      }
      if (normalizeString(normalizedBlock?.kind) === "kpiBlock") {
        return buildAuthoredKpiBlock(normalizedBlock, datasetContext.fieldCatalog);
      }
      if (normalizeString(normalizedBlock?.kind) === "badgesBlock") {
        return buildAuthoredBadgesBlock(normalizedBlock, datasetContext.fieldCatalog);
      }
      return normalizedBlock;
    })
    .filter(Boolean);
  const loweredLayout = orderLoweredBlocksByDocumentLayout(
    document,
    baseSpec,
    [...(Array.isArray(baseSpec?.blocks) ? baseSpec.blocks : []), ...additionalBlocks],
  );
  const nextBlocks = loweredLayout.blocks;
  const referencedDatasetRefs = new Set(
    nextBlocks
      .map((block) => normalizeString(block?.datasetRef))
      .filter((datasetRef) => !!datasetRef && datasetRef !== "primary"),
  );
  const additionalPublishedDatasets = buildReportBuilderPublishedDatasetDeclarations(
    scopedConfig,
    scopedState,
    referencedDatasetRefs,
    runtimeDatasetScopeParams,
  );
  const mergedDatasets = [
    ...(Array.isArray(baseSpec?.datasets) ? baseSpec.datasets : []),
    ...additionalPublishedDatasets.filter((dataset) => !((Array.isArray(baseSpec?.datasets) ? baseSpec.datasets : []).some((entry) => normalizeString(entry?.id) === normalizeString(dataset?.id)))),
  ];
  const nextSpec = {
    ...baseSpec,
    scope: {
      params: cloneValue(document?.scope?.params || []),
      dataSourceRef: normalizeString(document?.scope?.dataSourceRef || source.dataSourceRef || baseSpec?.source?.dataSourceRef),
    },
    layoutIntent: {
      ...(baseSpec?.layoutIntent || {}),
      blockOrder: nextBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
      items: loweredLayout.items,
    },
    datasets: mergedDatasets,
    blocks: nextBlocks,
  };
  return augmentReportRequestForAuthoredBlocks(nextSpec, nextBlocks, effectiveConfig);
}
