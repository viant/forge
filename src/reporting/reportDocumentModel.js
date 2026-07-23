import {
  buildReportBuilderPublishedDatasetConfig,
  buildReportBuilderPublishedDatasetDeclarations,
  buildReportBuilderReportSpec,
  buildReportSpecChartBlock,
  normalizeReportBuilderPublishedDataSources,
} from "./reportSpecModel.js";
import { buildReportBuilderPublishedDatasetRefIndex } from "./reportBuilderPublishedDatasetModel.js";
import { resolveReportBuilderBlock } from "./reportBuilderBlockModel.js";
import { normalizeReportCalculatedFields } from "./calculatedFieldModel.js";
import { normalizeReportRefinements } from "./reportRefinementModel.js";
import {
  normalizeRefinementBarActionKinds,
  normalizeRefinementBarText,
} from "./refinementBarModel.js";
import { normalizeReportDocumentTableBlock } from "./tableVisualSpec.js";
import { buildReportBuilderCalculatedFieldConfig } from "../components/dashboard/reportBuilderCalculatedFieldAuthoring.js";
import { normalizeReportBuilderStaticDatasets } from "../components/dashboard/reportBuilderStaticDatasets.js";
import {
  buildReportBuilderRequest,
  normalizeReportBuilderChartSpec,
} from "../components/dashboard/reportBuilderUtils.js";
import { buildReportBuilderScopeParams } from "./reportBuilderScopeParamModel.js";
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
  mergeScopeParamValues,
} from "./scopeStateModel.js";
import { buildReportLayoutItem } from "./reportLayoutModel.js";
import { shouldKeepPrimaryDataset } from "./reportPrimaryDatasetModel.js";
import { isReportDatasetBackedBlockKind } from "./reportBlockKindModel.js";
import {
  listMeaningfulReportScopeParamIds,
  normalizeReportScopeContextPreset,
  resolveReportScopeContextPresetFromState,
} from "./reportContextPresetModel.js";
import { normalizeReportDatasetScope } from "./reportDatasetScopeModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function isTruncatedPlaceholder(value = "") {
  return normalizeString(value) === "[MaxDepth]";
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

function normalizeReportDocumentTheme(theme = null) {
  const source = theme && typeof theme === "object" && !Array.isArray(theme) ? theme : {};
  const accentTone = normalizeString(source?.accentTone || source?.accent || "").toLowerCase();
  const badgePalette = normalizeString(source?.badgePalette || "").toLowerCase();
  const next = {
    ...(["blue", "green", "amber", "rose", "slate"].includes(accentTone) ? { accentTone } : {}),
    ...(["soft", "bold"].includes(badgePalette) ? { badgePalette } : {}),
  };
  return Object.keys(next).length > 0 ? next : null;
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
  const reportBuilderBlock = resolveReportBuilderBlock(document);
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
      ...(normalizedColumn?.displayIconMap || catalogEntry?.entry?.displayIconMap
        ? { displayIconMap: cloneValue(normalizedColumn?.displayIconMap || catalogEntry?.entry?.displayIconMap) }
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
  if (!normalizeString(nextBlock?.valueFormat) && normalizeString(valueFieldEntry?.entry?.format)) {
    nextBlock.valueFormat = normalizeString(valueFieldEntry.entry.format);
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
    if (!normalizeString(nextBlock?.secondaryFormat) && normalizeString(secondaryFieldEntry?.entry?.format)) {
      nextBlock.secondaryFormat = normalizeString(secondaryFieldEntry.entry.format);
    }
  }
  return nextBlock;
}

function resolveAuthoredFieldDisplayDescriptor(fieldCatalog = {}, field = "") {
  const catalogEntry = resolveReportBuilderCatalogEntry(fieldCatalog, field);
  const fieldId = resolveReportBuilderFieldId(catalogEntry?.entry);
  if (!catalogEntry?.entry || !fieldId) {
    return null;
  }
  const sourceKey = normalizeString(catalogEntry.entry.key || catalogEntry.entry.id || fieldId) || fieldId;
  const displayKey = normalizeString(
    catalogEntry.entry.displayKey
    || catalogEntry.entry.displayPath
    || sourceKey,
  ) || sourceKey;
  const displayValueMap = catalogEntry.entry.displayValueMap && typeof catalogEntry.entry.displayValueMap === "object" && !Array.isArray(catalogEntry.entry.displayValueMap)
    ? cloneValue(catalogEntry.entry.displayValueMap)
    : null;
  if (displayKey === sourceKey && !displayValueMap) {
    return null;
  }
  return {
    sourceKey,
    ...(displayKey !== sourceKey ? { displayKey } : {}),
    ...(displayValueMap ? { displayValueMap } : {}),
  };
}

function buildAuthoredTemplateFieldDisplayMap(template = "", fieldCatalog = {}) {
  const mappings = {};
  const matches = String(template || "").matchAll(/\brow\.([A-Za-z_][A-Za-z0-9_.]*)/g);
  for (const match of matches) {
    const field = normalizeString(match?.[1]);
    const descriptor = resolveAuthoredFieldDisplayDescriptor(fieldCatalog, field);
    if (field && descriptor) {
      mappings[field] = descriptor;
    }
  }
  return Object.keys(mappings).length > 0 ? mappings : null;
}

function buildAuthoredMarkdownBlock(block = {}, fieldCatalog = {}) {
  const normalizedBlock = buildReportDocumentMarkdownBlock(block);
  const templateFieldDisplayMap = buildAuthoredTemplateFieldDisplayMap(normalizedBlock?.markdown, fieldCatalog);
  return {
    ...normalizedBlock,
    ...(templateFieldDisplayMap ? { templateFieldDisplayMap } : {}),
  };
}

function buildAuthoredCollectionBlock(block = {}, fieldCatalog = {}) {
  const normalizedBlock = buildReportDocumentCollectionBlock(block);
  const itemTitleDisplay = resolveAuthoredFieldDisplayDescriptor(fieldCatalog, normalizedBlock?.itemTitleField);
  const secondaryDisplay = resolveAuthoredFieldDisplayDescriptor(fieldCatalog, normalizedBlock?.secondaryField);
  const templateFieldDisplayMap = buildAuthoredTemplateFieldDisplayMap(normalizedBlock?.bodyTemplate, fieldCatalog);
  return {
    ...normalizedBlock,
    ...(itemTitleDisplay?.displayKey ? { itemTitleDisplayKey: itemTitleDisplay.displayKey } : {}),
    ...(itemTitleDisplay?.displayValueMap ? { itemTitleDisplayValueMap: itemTitleDisplay.displayValueMap } : {}),
    ...(secondaryDisplay?.displayKey ? { secondaryDisplayKey: secondaryDisplay.displayKey } : {}),
    ...(secondaryDisplay?.displayValueMap ? { secondaryDisplayValueMap: secondaryDisplay.displayValueMap } : {}),
    ...(templateFieldDisplayMap ? { templateFieldDisplayMap } : {}),
  };
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

// Source-contract field metadata (Datly/Steward unified cube) persisted on the
// primary dataset catalog: request param paths, runtime-filter wiring,
// selection defaults, and semantic/governance descriptors. Restoring these
// keeps a reconstructed builder config faithful to the source contract when
// the embedded config was stripped.
function buildPrimaryDatasetFieldContract(entry = {}) {
  const paramPath = normalizeString(entry?.paramPath);
  const rawId = normalizeString(entry?.rawId);
  const semanticRef = normalizeString(entry?.semanticRef);
  const description = normalizeString(entry?.description);
  const category = normalizeString(entry?.category);
  const definitionRef = normalizeString(entry?.definitionRef);
  return {
    ...(paramPath ? { paramPath } : {}),
    ...(entry?.default === true ? { default: true } : {}),
    ...(entry?.chartAxis === true ? { chartAxis: true } : {}),
    ...(entry?.required === true ? { required: true } : {}),
    ...(isPlainObject(entry?.runtimeFilter) ? { runtimeFilter: cloneValue(entry.runtimeFilter) } : {}),
    ...(rawId ? { rawId } : {}),
    ...(semanticRef ? { semanticRef } : {}),
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    ...(definitionRef ? { definitionRef } : {}),
    ...(isPlainObject(entry?.governance) ? { governance: cloneValue(entry.governance) } : {}),
  };
}

function stripReportBuilderDocumentDatasetCatalog(config = {}) {
  const next = cloneValue(isPlainObject(config) ? config : {});
  delete next.binding;
  delete next.dataSources;
  delete next.datasets;
  return next;
}

function stripReportBuilderDocumentPrimaryFieldContract(config = {}) {
  const next = cloneValue(isPlainObject(config) ? config : {});
  delete next.dimensions;
  delete next.measures;
  delete next.calculatedFields;
  delete next.computedMeasures;
  delete next.tableCalculations;
  delete next.staticFilters;
  return next;
}

// document.presentation is the source of truth for the fields it carries, so
// drop the duplicated config-side copies from the embedded builder block.
// Only fields captured by the presentation are removed;
// normalizeReportDocumentBuilderConfig restores them on reconstruction, and
// older documents without presentation keep their config-side fields intact.
function stripReportBuilderDocumentPresentationMetadata(config = {}, presentation = null) {
  const next = cloneValue(isPlainObject(config) ? config : {});
  if (!isPlainObject(presentation)) {
    return next;
  }
  if (Array.isArray(presentation?.groupByOptions) && presentation.groupByOptions.length > 0 && isPlainObject(next.groupBy)) {
    delete next.groupBy.options;
    if (Object.keys(next.groupBy).length === 0) {
      delete next.groupBy;
    }
  }
  if (Array.isArray(presentation?.orderFields) && presentation.orderFields.length > 0) {
    delete next.orderFields;
  }
  if (isPlainObject(next.result)) {
    if (Array.isArray(presentation?.orderFields) && presentation.orderFields.length > 0) {
      delete next.result.orderFields;
    }
    if (Array.isArray(presentation?.defaultTablePresets) && presentation.defaultTablePresets.length > 0) {
      delete next.result.defaultTablePresets;
    }
    if (normalizeString(presentation?.defaultMode)) {
      delete next.result.defaultMode;
    }
    if ((Number(presentation?.pageSize || 0) || 0) > 0) {
      delete next.result.pageSize;
    }
    if (normalizeString(presentation?.chartCreationMode)) {
      delete next.result.chartCreationMode;
    }
    if (normalizeString(presentation?.resultPanePosition)) {
      delete next.result.resultPanePosition;
    }
    if (Array.isArray(presentation?.defaultChartSpecs) && presentation.defaultChartSpecs.length > 0) {
      delete next.result.defaultChartSpecs;
    }
    if (Object.keys(next.result).length === 0) {
      delete next.result;
    }
  }
  return next;
}

function stripReportBuilderDocumentAuthoringState(state = {}) {
  const next = cloneValue(isPlainObject(state) ? state : {});
  delete next.binding;
  delete next.reportDocumentBlocks;
  delete next.reportDocumentLayout;
  delete next.reportStaticDatasets;
  return next;
}

function buildReportBuilderReportDocumentDatasets(container = {}, config = {}, state = {}) {
  const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, state);
  const primaryDimensions = Array.isArray(effectiveConfig?.dimensions) ? cloneValue(effectiveConfig.dimensions) : [];
  const primaryMeasures = Array.isArray(effectiveConfig?.measures) ? cloneValue(effectiveConfig.measures) : [];
  const primaryCalculatedFields = Array.isArray(effectiveConfig?.calculatedFields) ? cloneValue(effectiveConfig.calculatedFields) : [];
  const primaryComputedMeasures = Array.isArray(effectiveConfig?.computedMeasures) ? cloneValue(effectiveConfig.computedMeasures) : [];
  const primaryTableCalculations = Array.isArray(effectiveConfig?.tableCalculations) ? cloneValue(effectiveConfig.tableCalculations) : [];
  const dataSourceRef = resolveDocumentDataSourceRef(container, config);
  const dimensions = (Array.isArray(effectiveConfig?.dimensions) ? effectiveConfig.dimensions : [])
    .map((entry) => {
      const id = normalizeString(entry?.id || entry?.key);
      const key = normalizeString(entry?.key || entry?.id);
      if (!id || !key) {
        return null;
      }
      return {
        id,
        key,
        label: normalizeString(entry?.label || key) || key,
        kind: "dimension",
        ...(normalizeString(entry?.sourceKey || entry?.key || entry?.id) ? { sourceKey: normalizeString(entry?.sourceKey || entry?.key || entry?.id) } : {}),
        ...(normalizeString(entry?.displayKey) ? { displayKey: normalizeString(entry.displayKey) } : {}),
        ...(entry?.displayValueMap && typeof entry.displayValueMap === "object" && !Array.isArray(entry.displayValueMap)
          ? { displayValueMap: cloneValue(entry.displayValueMap) }
          : {}),
        ...(normalizeString(entry?.format) ? { format: normalizeString(entry.format) } : {}),
        ...(normalizeString(entry?.rawId) ? { rawId: normalizeString(entry.rawId) } : {}),
        ...(normalizeString(entry?.description) ? { description: normalizeString(entry.description) } : {}),
        ...(normalizeString(entry?.category) ? { category: normalizeString(entry.category) } : {}),
        ...(normalizeString(entry?.definitionRef) ? { definitionRef: normalizeString(entry.definitionRef) } : {}),
        ...(normalizeString(entry?.semanticRef) ? { semanticRef: normalizeString(entry.semanticRef) } : {}),
        ...(entry?.governance && typeof entry.governance === "object" && !Array.isArray(entry.governance)
          ? { governance: cloneValue(entry.governance) }
          : {}),
        ...(entry?.default === true ? { default: true } : {}),
        ...(entry?.chartAxis === true ? { chartAxis: true } : {}),
        ...(normalizeString(entry?.paramPath) ? { paramPath: normalizeString(entry.paramPath) } : {}),
        ...(entry?.runtimeFilter && typeof entry.runtimeFilter === "object" && !Array.isArray(entry.runtimeFilter)
          ? { runtimeFilter: cloneValue(entry.runtimeFilter) }
          : {}),
      };
    })
    .filter(Boolean);
  const measures = [
    ...(Array.isArray(effectiveConfig?.measures) ? effectiveConfig.measures : []).map((entry) => {
      const id = normalizeString(entry?.id || entry?.key);
      const key = normalizeString(entry?.key || entry?.id);
      if (!id || !key) {
        return null;
      }
      return {
        id,
        key,
        label: normalizeString(entry?.label || key) || key,
        kind: "measure",
        ...(normalizeString(entry?.format) ? { format: normalizeString(entry.format) } : {}),
        ...(normalizeString(entry?.sourceKey || entry?.key || entry?.id) ? { sourceKey: normalizeString(entry?.sourceKey || entry?.key || entry?.id) } : {}),
        ...(normalizeString(entry?.rawId) ? { rawId: normalizeString(entry.rawId) } : {}),
        ...(normalizeString(entry?.description) ? { description: normalizeString(entry.description) } : {}),
        ...(normalizeString(entry?.category) ? { category: normalizeString(entry.category) } : {}),
        ...(normalizeString(entry?.definitionRef) ? { definitionRef: normalizeString(entry.definitionRef) } : {}),
        ...(normalizeString(entry?.semanticRef) ? { semanticRef: normalizeString(entry.semanticRef) } : {}),
        ...(entry?.governance && typeof entry.governance === "object" && !Array.isArray(entry.governance)
          ? { governance: cloneValue(entry.governance) }
          : {}),
        ...(entry?.default === true ? { default: true } : {}),
        ...(normalizeString(entry?.paramPath) ? { paramPath: normalizeString(entry.paramPath) } : {}),
      };
    }),
    ...normalizeReportCalculatedFields([
      ...(Array.isArray(effectiveConfig?.calculatedFields) ? effectiveConfig.calculatedFields : []),
      ...(Array.isArray(effectiveConfig?.computedMeasures) ? effectiveConfig.computedMeasures : []),
      ...(Array.isArray(effectiveConfig?.tableCalculations) ? effectiveConfig.tableCalculations : []),
    ], {
      datasetRef: "primary",
    }).map((entry) => {
      const id = normalizeString(entry?.id || entry?.key);
      const key = normalizeString(entry?.key || entry?.id);
      if (!id || !key) {
        return null;
      }
      return {
        id,
        key,
        label: normalizeString(entry?.label || key) || key,
        kind: "measure",
        ...(normalizeString(entry?.format) ? { format: normalizeString(entry.format) } : {}),
      };
    }),
  ].filter(Boolean);
  const primaryDataset = dataSourceRef
    ? {
      id: "primary",
      dataSourceRef,
      label: normalizeString(config?.title || dataSourceRef) || dataSourceRef,
      description: "Primary report dataset",
      kindLabel: "primary",
      ...(isPlainObject(config?.scope) ? { scope: cloneValue(config.scope) } : {}),
      ...(isPlainObject(config?.source) ? { source: cloneValue(config.source) } : {}),
      ...(isPlainObject(config?.resultContract) ? { resultContract: cloneValue(config.resultContract) } : {}),
      ...(isPlainObject(config?.capabilities) ? { capabilities: cloneValue(config.capabilities) } : {}),
      request: cloneValue(buildReportBuilderRequest(config, state)),
      ...(primaryDimensions.length > 0 ? { dimensions: primaryDimensions } : {}),
      ...(primaryMeasures.length > 0 ? { measures: primaryMeasures } : {}),
      ...(primaryCalculatedFields.length > 0 ? { calculatedFields: primaryCalculatedFields } : {}),
      ...(primaryComputedMeasures.length > 0 ? { computedMeasures: primaryComputedMeasures } : {}),
      ...(primaryTableCalculations.length > 0 ? { tableCalculations: primaryTableCalculations } : {}),
      columnOptions: [
        ...dimensions.map((entry) => ({
          key: entry.key,
          label: entry.label,
          kind: "dimension",
          ...(entry?.sourceKey ? { sourceKey: entry.sourceKey } : {}),
          ...(entry?.displayKey ? { displayKey: entry.displayKey } : {}),
          ...(entry?.displayValueMap ? { displayValueMap: cloneValue(entry.displayValueMap) } : {}),
          ...(entry?.format ? { format: entry.format } : {}),
          ...(entry?.rawId ? { rawId: entry.rawId } : {}),
          ...(entry?.description ? { description: entry.description } : {}),
          ...(entry?.category ? { category: entry.category } : {}),
          ...(entry?.definitionRef ? { definitionRef: entry.definitionRef } : {}),
          ...(entry?.semanticRef ? { semanticRef: entry.semanticRef } : {}),
          ...(entry?.governance ? { governance: cloneValue(entry.governance) } : {}),
          ...(entry?.default === true ? { default: true } : {}),
          ...(entry?.chartAxis === true ? { chartAxis: true } : {}),
          ...(entry?.paramPath ? { paramPath: entry.paramPath } : {}),
          ...(entry?.runtimeFilter ? { runtimeFilter: cloneValue(entry.runtimeFilter) } : {}),
        })),
        ...measures.map((entry) => ({
          key: entry.key,
          label: entry.label,
          kind: "measure",
          ...(entry?.sourceKey ? { sourceKey: entry.sourceKey } : {}),
          ...(entry?.format ? { format: entry.format } : {}),
          ...(entry?.rawId ? { rawId: entry.rawId } : {}),
          ...(entry?.description ? { description: entry.description } : {}),
          ...(entry?.category ? { category: entry.category } : {}),
          ...(entry?.definitionRef ? { definitionRef: entry.definitionRef } : {}),
          ...(entry?.semanticRef ? { semanticRef: entry.semanticRef } : {}),
          ...(entry?.governance ? { governance: cloneValue(entry.governance) } : {}),
          ...(entry?.default === true ? { default: true } : {}),
          ...(entry?.paramPath ? { paramPath: entry.paramPath } : {}),
        })),
      ],
      valueFieldOptions: measures.map((entry) => ({
        value: entry.key,
        label: entry.label,
        ...(entry?.format ? { format: entry.format } : {}),
        ...(entry?.rawId ? { rawId: entry.rawId } : {}),
        ...(entry?.description ? { description: entry.description } : {}),
        ...(entry?.category ? { category: entry.category } : {}),
        ...(entry?.definitionRef ? { definitionRef: entry.definitionRef } : {}),
        ...(entry?.semanticRef ? { semanticRef: entry.semanticRef } : {}),
        ...(entry?.governance ? { governance: cloneValue(entry.governance) } : {}),
        ...(entry?.default === true ? { default: true } : {}),
      })),
      secondaryFieldOptions: dimensions.map((entry) => ({
        value: entry.key,
        label: entry.label,
        ...(entry?.format ? { format: entry.format } : {}),
        ...(entry?.rawId ? { rawId: entry.rawId } : {}),
        ...(entry?.description ? { description: entry.description } : {}),
        ...(entry?.category ? { category: entry.category } : {}),
        ...(entry?.definitionRef ? { definitionRef: entry.definitionRef } : {}),
        ...(entry?.semanticRef ? { semanticRef: entry.semanticRef } : {}),
        ...(entry?.governance ? { governance: cloneValue(entry.governance) } : {}),
        ...(entry?.default === true ? { default: true } : {}),
      })),
      chartFieldOptions: [
        ...dimensions.map((entry) => ({
          key: normalizeString(entry?.displayKey || entry?.key),
          aliases: [entry.key],
          label: entry.label,
          kind: "dimension",
          ...(entry?.format ? { format: entry.format } : {}),
          ...(entry?.rawId ? { rawId: entry.rawId } : {}),
          ...(entry?.description ? { description: entry.description } : {}),
          ...(entry?.category ? { category: entry.category } : {}),
          ...(entry?.definitionRef ? { definitionRef: entry.definitionRef } : {}),
          ...(entry?.semanticRef ? { semanticRef: entry.semanticRef } : {}),
          ...(entry?.governance ? { governance: cloneValue(entry.governance) } : {}),
          ...(entry?.default === true ? { default: true } : {}),
          ...(entry?.chartAxis === true ? { chartAxis: true } : {}),
        })),
        ...measures.map((entry) => ({
          key: entry.key,
          aliases: [entry.key],
          label: entry.label,
          kind: "measure",
          ...(entry?.format ? { format: entry.format } : {}),
          ...(entry?.rawId ? { rawId: entry.rawId } : {}),
          ...(entry?.description ? { description: entry.description } : {}),
          ...(entry?.category ? { category: entry.category } : {}),
          ...(entry?.definitionRef ? { definitionRef: entry.definitionRef } : {}),
          ...(entry?.semanticRef ? { semanticRef: entry.semanticRef } : {}),
          ...(entry?.governance ? { governance: cloneValue(entry.governance) } : {}),
          ...(entry?.default === true ? { default: true } : {}),
          align: "right",
        })),
      ],
      scopeParamOptions: resolveReportBuilderScopeParamFilters(effectiveConfig)
        .map((filter) => {
          const value = normalizeString(filter?.id || filter?.field);
          if (!value) {
            return null;
          }
          return {
            value,
            label: normalizeString(filter?.label || value),
            ...(normalizeString(filter?.description) ? { description: normalizeString(filter.description) } : {}),
            kind: normalizeString(filter?.type || (filter?.multiple ? "multiSelect" : "value")) || "value",
            required: filter?.required === true,
            ...(normalizeString(filter?.semanticRef) ? { semanticRef: normalizeString(filter.semanticRef) } : {}),
            ...(filter?.multiple === true ? { multiple: true } : {}),
            ...(normalizeString(filter?.presentation) ? { presentation: normalizeString(filter.presentation) } : {}),
            ...(Array.isArray(filter?.options) ? { options: cloneValue(filter.options) } : {}),
            ...(normalizeString(filter?.paramPath) ? { paramPath: normalizeString(filter.paramPath) } : {}),
            ...(normalizeString(filter?.startParamPath) ? { startParamPath: normalizeString(filter.startParamPath) } : {}),
            ...(normalizeString(filter?.endParamPath) ? { endParamPath: normalizeString(filter.endParamPath) } : {}),
          };
        })
        .filter(Boolean),
    }
    : null;
  const staticDatasets = normalizeReportBuilderStaticDatasets(state?.reportStaticDatasets);
  const staticDatasetIds = new Set(
    staticDatasets.map((dataset) => normalizeString(dataset?.id)).filter(Boolean),
  );
  const publishedDatasets = normalizeReportBuilderPublishedDataSources(config).map((dataset) => ({
    id: normalizeString(dataset?.id),
    dataSourceRef: normalizeString(dataset?.dataSourceRef),
    label: normalizeString(dataset?.label),
    description: normalizeString(dataset?.description),
    kindLabel: normalizeString(dataset?.kindLabel),
    ...(normalizeReportDatasetScope(dataset?.scope) ? { scope: normalizeReportDatasetScope(dataset?.scope) } : {}),
    ...(isPlainObject(dataset?.source) ? { source: cloneValue(dataset.source) } : {}),
    ...(isPlainObject(dataset?.resultContract) ? { resultContract: cloneValue(dataset.resultContract) } : {}),
    ...(isPlainObject(dataset?.capabilities) ? { capabilities: cloneValue(dataset.capabilities) } : {}),
    request: dataset?.request && typeof dataset.request === "object" && !Array.isArray(dataset.request)
      ? cloneValue(dataset.request)
      : null,
    columnOptions: Array.isArray(dataset?.columnOptions) ? cloneValue(dataset.columnOptions) : [],
    valueFieldOptions: Array.isArray(dataset?.valueFieldOptions) ? cloneValue(dataset.valueFieldOptions) : [],
    secondaryFieldOptions: Array.isArray(dataset?.secondaryFieldOptions) ? cloneValue(dataset.secondaryFieldOptions) : [],
    chartFieldOptions: Array.isArray(dataset?.chartFieldOptions) ? cloneValue(dataset.chartFieldOptions) : [],
    scopeParamOptions: Array.isArray(dataset?.scopeParamOptions) ? cloneValue(dataset.scopeParamOptions) : [],
  })).filter((dataset) => (
    dataset.id
    && dataset.dataSourceRef
    && dataset.id !== "primary"
    && !staticDatasetIds.has(dataset.id)
  ));
  return [...(primaryDataset ? [primaryDataset] : []), ...publishedDatasets, ...staticDatasets];
}

function buildReportBuilderReportDocumentPresentation(config = {}, state = {}) {
  const result = isPlainObject(config?.result) ? config.result : {};
  const groupByOptions = Array.isArray(config?.groupBy?.options) ? cloneValue(config.groupBy.options) : [];
  const orderFields = Array.isArray(result?.orderFields)
    ? cloneValue(result.orderFields)
    : (Array.isArray(config?.orderFields) ? cloneValue(config.orderFields) : []);
  const defaultTablePresets = Array.isArray(result?.defaultTablePresets) ? cloneValue(result.defaultTablePresets) : [];
  const defaultMode = normalizeString(result?.defaultMode || "");
  const pageSize = Number(result?.pageSize || state?.pageSize || 0) || 0;
  const chartCreationMode = normalizeString(result?.chartCreationMode || "");
  const resultPanePosition = normalizeString(result?.resultPanePosition || "");
  const defaultChartSpecs = Array.isArray(result?.defaultChartSpecs) ? cloneValue(result.defaultChartSpecs) : [];
  if (groupByOptions.length === 0 && orderFields.length === 0 && defaultTablePresets.length === 0 && !defaultMode && pageSize < 1
    && !chartCreationMode && !resultPanePosition && defaultChartSpecs.length === 0) {
    return null;
  }
  return {
    ...(groupByOptions.length > 0 ? { groupByOptions } : {}),
    ...(orderFields.length > 0 ? { orderFields } : {}),
    ...(defaultTablePresets.length > 0 ? { defaultTablePresets } : {}),
    ...(defaultMode ? { defaultMode } : {}),
    ...(pageSize > 0 ? { pageSize } : {}),
    ...(chartCreationMode ? { chartCreationMode } : {}),
    ...(resultPanePosition ? { resultPanePosition } : {}),
    ...(defaultChartSpecs.length > 0 ? { defaultChartSpecs } : {}),
  };
}

export function resolveReportDocumentPresentation(document = null, fallbackConfig = {}, fallbackState = {}) {
  const explicitPresentation = document && typeof document === "object" && !Array.isArray(document)
    && document.presentation && typeof document.presentation === "object" && !Array.isArray(document.presentation)
      ? cloneValue(document.presentation)
      : null;
  const fallbackPresentation = buildReportBuilderReportDocumentPresentation(fallbackConfig, fallbackState);
  if (explicitPresentation && !fallbackPresentation) {
    return explicitPresentation;
  }
  if (!explicitPresentation) {
    return fallbackPresentation;
  }
  return {
    ...cloneValue(fallbackPresentation || {}),
    ...cloneValue(explicitPresentation),
  };
}

export function resolveReportDocumentBinding(document = null, fallbackConfig = null, fallbackState = null) {
  const documentBinding = isPlainObject(document?.binding) ? document.binding : null;
  if (documentBinding) {
    return cloneValue(documentBinding);
  }
  const stateBinding = isPlainObject(fallbackState?.binding) ? fallbackState.binding : null;
  if (stateBinding) {
    return cloneValue(stateBinding);
  }
  const configBinding = isPlainObject(fallbackConfig?.binding) ? fallbackConfig.binding : null;
  return configBinding ? cloneValue(configBinding) : null;
}

export function resolveReportDocumentStaticDatasets(document = null, fallbackState = null) {
  const explicitDocumentDatasets = Array.isArray(document?.datasets) ? document.datasets : [];
  const explicitStaticDatasets = explicitDocumentDatasets.some((dataset) => Array.isArray(dataset?.rows))
      ? normalizeReportBuilderStaticDatasets(
      explicitDocumentDatasets.filter((dataset) => Array.isArray(dataset?.rows)),
    )
    : [];
  if (explicitStaticDatasets.length > 0) {
    return explicitStaticDatasets;
  }
  return normalizeReportBuilderStaticDatasets(fallbackState?.reportStaticDatasets);
}

export function resolveReportDocumentPublishedDatasets(document = null, fallbackConfig = null) {
  const explicitDocumentDatasets = Array.isArray(document?.datasets) ? document.datasets : [];
  const explicitPublishedDatasets = explicitDocumentDatasets.some((dataset) => !Array.isArray(dataset?.rows))
    ? normalizeReportBuilderPublishedDataSources({
      datasets: explicitDocumentDatasets.filter((dataset) => !Array.isArray(dataset?.rows) && normalizeString(dataset?.id) !== "primary"),
    })
    : [];
  if (explicitPublishedDatasets.length > 0) {
    return explicitPublishedDatasets;
  }
  return normalizeReportBuilderPublishedDataSources(fallbackConfig);
}

export function applyReportDocumentDatasetCatalogToConfig(config = {}, document = null) {
  const publishedDatasets = resolveReportDocumentPublishedDatasets(document, config);
  if (publishedDatasets.length === 0) {
    return isPlainObject(config) ? cloneValue(config) : {};
  }
  return {
    ...(isPlainObject(config) ? stripReportBuilderDocumentDatasetCatalog(config) : {}),
    datasets: cloneValue(publishedDatasets),
  };
}

function hasMeaningfulReportRequest(request = null) {
  if (!isPlainObject(request)) {
    return false;
  }
  return Object.keys(request?.measures || {}).length > 0
    || Object.keys(request?.dimensions || {}).length > 0
    || Object.keys(request?.filters || {}).length > 0
    || (Array.isArray(request?.orderBy) && request.orderBy.length > 0)
    || (Array.isArray(request?.refinements) && request.refinements.length > 0)
    || isPlainObject(request?.semanticSelection);
}

function shouldPreferDocumentPrimaryRequest(documentRequest = null, generatedRequest = null) {
  if (!hasMeaningfulReportRequest(documentRequest)) {
    return false;
  }
  if (!hasMeaningfulReportRequest(generatedRequest)) {
    return true;
  }
  const documentHasFilters = Object.keys(documentRequest?.filters || {}).length > 0;
  const generatedHasFilters = Object.keys(generatedRequest?.filters || {}).length > 0;
  if (documentHasFilters && !generatedHasFilters) {
    return true;
  }
  const documentHasOrderBy = Array.isArray(documentRequest?.orderBy) && documentRequest.orderBy.length > 0;
  const generatedHasOrderBy = Array.isArray(generatedRequest?.orderBy) && generatedRequest.orderBy.length > 0;
  if (documentHasOrderBy && !generatedHasOrderBy) {
    return true;
  }
  const documentHasRefinements = Array.isArray(documentRequest?.refinements) && documentRequest.refinements.length > 0;
  const generatedHasRefinements = Array.isArray(generatedRequest?.refinements) && generatedRequest.refinements.length > 0;
  if (documentHasRefinements && !generatedHasRefinements) {
    return true;
  }
  const documentHasSemanticSelection = isPlainObject(documentRequest?.semanticSelection);
  const generatedHasSemanticSelection = isPlainObject(generatedRequest?.semanticSelection);
  if (documentHasSemanticSelection && !generatedHasSemanticSelection) {
    return true;
  }
  return false;
}

function resolveReportDocumentPrimaryDataset(document = null) {
  return (Array.isArray(document?.datasets) ? document.datasets : [])
    .find((dataset) => normalizeString(dataset?.id) === "primary" && !Array.isArray(dataset?.rows)) || null;
}

function buildPrimaryDatasetCatalogEntries(primaryDataset = {}, kind = "") {
  const explicitEntries = kind === "dimension"
    ? primaryDataset?.dimensions
    : primaryDataset?.measures;
  if (Array.isArray(explicitEntries) && explicitEntries.length > 0) {
    return explicitEntries;
  }
  const columnOptions = Array.isArray(primaryDataset?.columnOptions) ? primaryDataset.columnOptions : [];
  const matchingColumns = columnOptions.filter((entry) => normalizeString(entry?.kind) === kind);
  if (matchingColumns.length > 0) {
    return matchingColumns;
  }
  if (kind === "dimension") {
    return [
      ...(Array.isArray(primaryDataset?.secondaryFieldOptions) ? primaryDataset.secondaryFieldOptions : []),
      ...(Array.isArray(primaryDataset?.chartFieldOptions) ? primaryDataset.chartFieldOptions : [])
        .filter((entry) => normalizeString(entry?.kind) === "dimension"),
    ];
  }
  return [
    ...(Array.isArray(primaryDataset?.valueFieldOptions) ? primaryDataset.valueFieldOptions : []),
    ...(Array.isArray(primaryDataset?.chartFieldOptions) ? primaryDataset.chartFieldOptions : [])
      .filter((entry) => normalizeString(entry?.kind) === "measure"),
  ];
}

function mergePrimaryDatasetCatalogEntries(entries = [], persistedEntries = []) {
  const persistedByAlias = new Map();
  (Array.isArray(persistedEntries) ? persistedEntries : []).forEach((entry) => {
    [entry?.id, entry?.key, entry?.sourceKey, entry?.value, entry?.rawId]
      .map((value) => normalizeString(value))
      .filter(Boolean)
      .forEach((alias) => persistedByAlias.set(alias, entry));
  });
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const persisted = [entry?.id, entry?.key, entry?.sourceKey, entry?.value, entry?.rawId]
      .map((value) => normalizeString(value))
      .filter(Boolean)
      .map((alias) => persistedByAlias.get(alias))
      .find(Boolean);
    // The document is the durable source of presentation metadata; live config
    // values still win when they are present so current source contracts apply.
    return persisted ? { ...cloneValue(persisted), ...entry } : entry;
  });
}

export function applyPrimaryDatasetFallbackConfig(document = null, baseConfig = {}) {
  const primaryDataset = resolveReportDocumentPrimaryDataset(document);
  const normalizedBaseConfig = isPlainObject(baseConfig) ? cloneValue(baseConfig) : {};
  if (!primaryDataset || !isPlainObject(primaryDataset)) {
    return normalizedBaseConfig;
  }
  const primaryDatasetDimensions = Array.isArray(primaryDataset?.dimensions) ? cloneValue(primaryDataset.dimensions) : [];
  const primaryDatasetMeasures = Array.isArray(primaryDataset?.measures) ? cloneValue(primaryDataset.measures) : [];
  const primaryDatasetCalculatedFields = Array.isArray(primaryDataset?.calculatedFields) ? cloneValue(primaryDataset.calculatedFields) : [];
  const primaryDatasetComputedMeasures = Array.isArray(primaryDataset?.computedMeasures) ? cloneValue(primaryDataset.computedMeasures) : [];
  const primaryDatasetTableCalculations = Array.isArray(primaryDataset?.tableCalculations) ? cloneValue(primaryDataset.tableCalculations) : [];
  const primaryDatasetDimensionCatalog = buildPrimaryDatasetCatalogEntries(primaryDataset, "dimension");
  const primaryDatasetMeasureCatalog = buildPrimaryDatasetCatalogEntries(primaryDataset, "measure");
  const dimensionEntries = Array.isArray(normalizedBaseConfig?.dimensions) && normalizedBaseConfig.dimensions.length > 0
    ? mergePrimaryDatasetCatalogEntries(normalizedBaseConfig.dimensions, primaryDatasetDimensionCatalog)
    : primaryDatasetDimensionCatalog;
  const dimensions = dimensionEntries.map((entry) => {
      const key = normalizeString(entry?.key || entry?.value || entry?.sourceKey);
      if (!key) {
        return null;
      }
      return {
        id: key,
        key: normalizeString(entry?.sourceKey || entry?.key || entry?.value) || key,
        label: normalizeString(entry?.label || key) || key,
        ...(normalizeString(entry?.displayKey) ? { displayKey: normalizeString(entry.displayKey) } : {}),
        ...(entry?.displayValueMap && typeof entry.displayValueMap === "object" && !Array.isArray(entry.displayValueMap)
          ? { displayValueMap: cloneValue(entry.displayValueMap) }
          : {}),
        ...(normalizeString(entry?.format) ? { format: normalizeString(entry.format) } : {}),
        ...buildPrimaryDatasetFieldContract(entry),
      };
    }).filter(Boolean);
  const measureEntries = Array.isArray(normalizedBaseConfig?.measures) && normalizedBaseConfig.measures.length > 0
    ? mergePrimaryDatasetCatalogEntries(normalizedBaseConfig.measures, primaryDatasetMeasureCatalog)
    : primaryDatasetMeasureCatalog;
  const measures = measureEntries.map((entry) => {
      const key = normalizeString(entry?.key || entry?.value || entry?.sourceKey);
      if (!key) {
        return null;
      }
      return {
        id: key,
        key: normalizeString(entry?.sourceKey || entry?.key || entry?.value) || key,
        label: normalizeString(entry?.label || key) || key,
        ...(normalizeString(entry?.format) ? { format: normalizeString(entry.format) } : {}),
        ...buildPrimaryDatasetFieldContract(entry),
      };
    }).filter(Boolean);
  const staticFilters = (Array.isArray(normalizedBaseConfig?.staticFilters) && normalizedBaseConfig.staticFilters.length > 0
    ? normalizedBaseConfig.staticFilters
    : (Array.isArray(primaryDataset?.scopeParamOptions) ? primaryDataset.scopeParamOptions : [])
      .map((entry) => {
        const value = normalizeString(entry?.value || entry?.id);
        if (!value) {
          return null;
        }
        const kind = normalizeString(entry?.kind || "value");
        return {
          id: value,
          label: normalizeString(entry?.label || value) || value,
          ...(normalizeString(entry?.description) ? { description: normalizeString(entry.description) } : {}),
          type: kind,
          required: entry?.required === true,
          ...(normalizeString(entry?.semanticRef) ? { semanticRef: normalizeString(entry.semanticRef) } : {}),
          ...(entry?.multiple === true ? { multiple: true } : {}),
          ...(normalizeString(entry?.presentation) ? { presentation: normalizeString(entry.presentation) } : {}),
          ...(Array.isArray(entry?.options) ? { options: cloneValue(entry.options) } : {}),
          ...(normalizeString(entry?.paramPath) ? { paramPath: normalizeString(entry.paramPath) } : {}),
          ...(normalizeString(entry?.startParamPath) ? { startParamPath: normalizeString(entry.startParamPath) } : {}),
          ...(normalizeString(entry?.endParamPath) ? { endParamPath: normalizeString(entry.endParamPath) } : {}),
        };
      })
      .filter(Boolean)
  );
  return {
    ...normalizedBaseConfig,
    ...(isPlainObject(document?.binding) && !isPlainObject(normalizedBaseConfig?.binding)
      ? { binding: cloneValue(document.binding) }
      : {}),
    ...(normalizeReportDatasetScope(primaryDataset?.scope) && !isPlainObject(normalizedBaseConfig?.scope)
      ? { scope: normalizeReportDatasetScope(primaryDataset.scope) }
      : {}),
    ...(isPlainObject(primaryDataset?.source) && !isPlainObject(normalizedBaseConfig?.source)
      ? { source: cloneValue(primaryDataset.source) }
      : {}),
    ...(isPlainObject(primaryDataset?.resultContract) && !isPlainObject(normalizedBaseConfig?.resultContract)
      ? { resultContract: cloneValue(primaryDataset.resultContract) }
      : {}),
    ...(isPlainObject(primaryDataset?.capabilities) && !isPlainObject(normalizedBaseConfig?.capabilities)
      ? { capabilities: cloneValue(primaryDataset.capabilities) }
      : {}),
    ...(dimensions.length > 0 ? { dimensions } : {}),
    ...(measures.length > 0 ? { measures } : {}),
    ...(primaryDatasetCalculatedFields.length > 0 && (!Array.isArray(normalizedBaseConfig?.calculatedFields) || normalizedBaseConfig.calculatedFields.length === 0)
      ? { calculatedFields: primaryDatasetCalculatedFields }
      : {}),
    ...(primaryDatasetComputedMeasures.length > 0 && (!Array.isArray(normalizedBaseConfig?.computedMeasures) || normalizedBaseConfig.computedMeasures.length === 0)
      ? { computedMeasures: primaryDatasetComputedMeasures }
      : {}),
    ...(primaryDatasetTableCalculations.length > 0 && (!Array.isArray(normalizedBaseConfig?.tableCalculations) || normalizedBaseConfig.tableCalculations.length === 0)
      ? { tableCalculations: primaryDatasetTableCalculations }
      : {}),
    ...(staticFilters.length > 0 ? { staticFilters } : {}),
  };
}

export function applyReportDocumentPresentationFallbackConfig(document = null, baseConfig = {}) {
  const presentation = resolveReportDocumentPresentation(document);
  const normalizedBaseConfig = isPlainObject(baseConfig) ? cloneValue(baseConfig) : {};
  if (!presentation) {
    return normalizedBaseConfig;
  }
  const next = {
    ...normalizedBaseConfig,
  };
  if ((!next.groupBy || typeof next.groupBy !== "object" || Array.isArray(next.groupBy) || !Array.isArray(next.groupBy.options) || next.groupBy.options.length === 0)
    && Array.isArray(presentation?.groupByOptions) && presentation.groupByOptions.length > 0) {
    next.groupBy = {
      ...(isPlainObject(next.groupBy) ? next.groupBy : {}),
      options: cloneValue(presentation.groupByOptions),
    };
  }
  const nextResult = isPlainObject(next.result) ? cloneValue(next.result) : {};
  if ((!Array.isArray(nextResult?.orderFields) || nextResult.orderFields.length === 0)
    && Array.isArray(presentation?.orderFields) && presentation.orderFields.length > 0) {
    nextResult.orderFields = cloneValue(presentation.orderFields);
  }
  if ((!Array.isArray(next.orderFields) || next.orderFields.length === 0)
    && Array.isArray(presentation?.orderFields) && presentation.orderFields.length > 0) {
    next.orderFields = cloneValue(presentation.orderFields);
  }
  if ((!Array.isArray(nextResult?.defaultTablePresets) || nextResult.defaultTablePresets.length === 0)
    && Array.isArray(presentation?.defaultTablePresets) && presentation.defaultTablePresets.length > 0) {
    nextResult.defaultTablePresets = cloneValue(presentation.defaultTablePresets);
  }
  if (!normalizeString(nextResult?.defaultMode) && normalizeString(presentation?.defaultMode)) {
    nextResult.defaultMode = normalizeString(presentation.defaultMode);
  }
  if ((Number(nextResult?.pageSize || 0) || 0) < 1 && (Number(presentation?.pageSize || 0) || 0) > 0) {
    nextResult.pageSize = Number(presentation.pageSize || 0) || 0;
  }
  if (!normalizeString(nextResult?.chartCreationMode) && normalizeString(presentation?.chartCreationMode)) {
    nextResult.chartCreationMode = normalizeString(presentation.chartCreationMode);
  }
  if (!normalizeString(nextResult?.resultPanePosition) && normalizeString(presentation?.resultPanePosition)) {
    nextResult.resultPanePosition = normalizeString(presentation.resultPanePosition);
  }
  if ((!Array.isArray(nextResult?.defaultChartSpecs) || nextResult.defaultChartSpecs.length === 0)
    && Array.isArray(presentation?.defaultChartSpecs) && presentation.defaultChartSpecs.length > 0) {
    nextResult.defaultChartSpecs = cloneValue(presentation.defaultChartSpecs);
  }
  if (Object.keys(nextResult).length > 0) {
    next.result = nextResult;
  }
  return next;
}

export function normalizeReportDocumentBuilderConfig(document = null, baseConfig = {}, fallbackState = null) {
  const catalogConfig = applyReportDocumentDatasetCatalogToConfig(baseConfig, document);
  const resolvedBinding = resolveReportDocumentBinding(document, catalogConfig, fallbackState);
  const configWithBinding = resolvedBinding
    ? { ...catalogConfig, binding: cloneValue(resolvedBinding) }
    : catalogConfig;
  return applyReportDocumentPresentationFallbackConfig(
    document,
    applyPrimaryDatasetFallbackConfig(document, configWithBinding),
  );
}

export function resolveReportDocumentBuilderContext(document = null, baseConfig = null, baseState = null) {
  const normalizedState = isPlainObject(baseState) ? cloneValue(baseState) : {};
  const resolvedStaticDatasets = resolveReportDocumentStaticDatasets(document, normalizedState);
  if (resolvedStaticDatasets.length > 0) {
    normalizedState.reportStaticDatasets = cloneValue(resolvedStaticDatasets);
  }
  const normalizedConfig = normalizeReportDocumentBuilderConfig(document, baseConfig, normalizedState);
  const hasConfig = isPlainObject(normalizedConfig) && Object.keys(normalizedConfig).length > 0;
  const resolvedBinding = resolveReportDocumentBinding(document, hasConfig ? normalizedConfig : baseConfig, normalizedState);
  if (resolvedBinding) {
    normalizedState.binding = cloneValue(resolvedBinding);
  }
  return {
    config: hasConfig ? normalizedConfig : null,
    state: normalizedState,
    ...(resolvedBinding ? { binding: cloneValue(resolvedBinding) } : {}),
    ...(resolvedStaticDatasets.length > 0 ? { staticDatasets: cloneValue(resolvedStaticDatasets) } : {}),
  };
}

function resolveLoweredPrimaryDataset(document = null, generatedDataset = null, loweredContainer = {}) {
  const documentPrimaryDataset = resolveReportDocumentPrimaryDataset(document);
  if (!documentPrimaryDataset) {
    return generatedDataset;
  }
  const generated = isPlainObject(generatedDataset) ? cloneValue(generatedDataset) : {
    id: "primary",
  };
  const documentRequest = isPlainObject(documentPrimaryDataset?.request) ? cloneValue(documentPrimaryDataset.request) : null;
  const generatedRequest = isPlainObject(generated?.request) ? cloneValue(generated.request) : null;
  return {
    ...generated,
    id: "primary",
    dataSourceRef: normalizeString(
      documentPrimaryDataset?.dataSourceRef
      || generated?.dataSourceRef
      || loweredContainer?.dataSourceRef,
    ),
    request: shouldPreferDocumentPrimaryRequest(documentRequest, generatedRequest)
      ? documentRequest
      : (generatedRequest || documentRequest || {}),
  };
}

export function buildReportDocumentScopeParams(config = {}, state = {}, runtimeDatasetScopeParams = null) {
  return buildReportBuilderScopeParams(config, state, runtimeDatasetScopeParams);
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
  const configuredSourceBindings = normalizeReportBuilderPublishedDataSources(config)
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
  datasetRef = "",
} = {}) {
  return {
    id: normalizeString(id || "markdownBlock"),
    kind: "markdownBlock",
    title: normalizeString(title),
    markdown: String(markdown || ""),
    ...(normalizeString(datasetRef) ? { datasetRef: normalizeString(datasetRef) } : {}),
  };
}

export function buildReportDocumentFilterBarBlock({
  id = "filterBar",
  title = "Filters",
  paramIds = [],
  datasetRef = "primary",
  mode = "",
  placement = "",
  groupOrder = [],
  visibleGroups = [],
  collapsedGroups = [],
} = {}) {
  const normalizedParamIds = (Array.isArray(paramIds) ? paramIds : [])
    .map((entry) => normalizeString(entry))
    .filter((entry) => !!entry && !isTruncatedPlaceholder(entry));
  const normalizedMode = (() => {
    const candidate = normalizeString(mode).toLowerCase();
    return ["baseline", "unified"].includes(candidate) ? candidate : "";
  })();
  const normalizedPlacement = (() => {
    const candidate = normalizeString(placement).toLowerCase();
    return ["inherit", "inline", "rail-left", "hidden"].includes(candidate) ? candidate : "";
  })();
  const normalizeIdList = (values = []) => (Array.isArray(values) ? values : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  if (normalizedParamIds.length === 0 && (Array.isArray(paramIds) ? paramIds : []).some((entry) => isTruncatedPlaceholder(entry))) {
    return null;
  }
  return {
    id: normalizeString(id || "filterBar"),
    kind: "filterBarBlock",
    title: normalizeFilterBarTitle(title || "Filters"),
    datasetRef: normalizeString(datasetRef || "primary") || "primary",
    ...(normalizedParamIds.length > 0 ? { paramIds: normalizedParamIds } : {}),
    ...(normalizedMode ? { mode: normalizedMode } : {}),
    ...(normalizedPlacement ? { placement: normalizedPlacement } : {}),
    ...(normalizeIdList(groupOrder).length > 0 ? { groupOrder: normalizeIdList(groupOrder) } : {}),
    ...(normalizeIdList(visibleGroups).length > 0 ? { visibleGroups: normalizeIdList(visibleGroups) } : {}),
    ...(normalizeIdList(collapsedGroups).length > 0 ? { collapsedGroups: normalizeIdList(collapsedGroups) } : {}),
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
  const presentationMode = normalizeString(block?.presentationMode).toLowerCase();
  const normalizedPresentationMode = ["card", "body", "both"].includes(presentationMode)
    ? presentationMode
    : "card";
  const rowSelector = normalizeString(block?.rowSelector).toLowerCase();
  const normalizedRowSelector = ["firstrow", "maxbyvalue", "minbyvalue"].includes(rowSelector)
    ? rowSelector
    : "firstrow";
  const bodyFormat = normalizeString(block?.bodyFormat).toLowerCase();
  const normalizedBodyFormat = bodyFormat === "markdown" ? "markdown" : "markdown";
  const bodyTemplate = String(block?.bodyTemplate || "");
  return {
    id: normalizeString(block?.id || "kpiBlock"),
    kind: "kpiBlock",
    title: normalizeString(block?.title || "KPI"),
    datasetRef: normalizeString(block?.datasetRef || "primary"),
    valueField,
    valueLabel: normalizeString(block?.valueLabel || valueField || "Value"),
    ...(normalizeString(block?.valueFormat) ? { valueFormat: normalizeString(block.valueFormat) } : {}),
    ...(secondaryField
      ? {
        secondaryField,
        secondaryLabel: normalizeString(block?.secondaryLabel || secondaryField),
        ...(normalizeString(block?.secondaryFormat) ? { secondaryFormat: normalizeString(block.secondaryFormat) } : {}),
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
    ...(normalizedRowSelector !== "firstrow" ? { rowSelector: normalizedRowSelector } : {}),
    ...(normalizedPresentationMode !== "card" ? { presentationMode: normalizedPresentationMode } : {}),
    ...((normalizedPresentationMode !== "card" || bodyTemplate.trim()) ? { bodyFormat: normalizedBodyFormat } : {}),
    ...(bodyTemplate.trim() ? { bodyTemplate } : {}),
  };
}

function normalizeCollectionLayout(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return ["grid", "list"].includes(normalized) ? normalized : "grid";
}

function normalizeCollectionColumns(value = 0) {
  const normalized = Math.trunc(Number(value));
  return Number.isInteger(normalized) && normalized >= 1 && normalized <= 4 ? normalized : 2;
}

function normalizeCollectionRowLimit(value = 0) {
  const normalized = Math.trunc(Number(value));
  return Number.isInteger(normalized) && normalized > 0 ? normalized : 6;
}

function normalizeCollectionToneRules(rules = []) {
  return (Array.isArray(rules) ? rules : [])
    .map((rule) => {
      if (!rule || typeof rule !== "object" || Array.isArray(rule) || !("value" in rule)) {
        return null;
      }
      return {
        value: cloneValue(rule.value),
        ...(normalizeString(rule?.tone) ? { tone: normalizeString(rule.tone).toLowerCase() } : {}),
        ...(normalizeString(rule?.label) ? { label: normalizeString(rule.label) } : {}),
        ...(normalizeString(rule?.color) ? { color: normalizeString(rule.color) } : {}),
        ...(normalizeString(rule?.background) ? { background: normalizeString(rule.background) } : {}),
      };
    })
    .filter(Boolean);
}

export function buildReportDocumentCollectionBlock(block = {}) {
  const itemTitleField = normalizeString(block?.itemTitleField);
  const valueField = normalizeString(block?.valueField);
  const secondaryField = normalizeString(block?.secondaryField);
  const bodyTemplate = String(block?.bodyTemplate || "");
  const toneField = normalizeString(block?.toneField);
  const toneRules = normalizeCollectionToneRules(block?.toneRules);
  return {
    id: normalizeString(block?.id || "collectionBlock"),
    kind: "collectionBlock",
    title: normalizeString(block?.title || "Collection") || "Collection",
    datasetRef: normalizeString(block?.datasetRef || "primary"),
    ...(itemTitleField ? { itemTitleField } : {}),
    ...(normalizeString(block?.itemTitleLabel) ? { itemTitleLabel: normalizeString(block.itemTitleLabel) } : {}),
    ...(normalizeString(block?.itemTitleDisplayKey) ? { itemTitleDisplayKey: normalizeString(block.itemTitleDisplayKey) } : {}),
    ...(block?.itemTitleDisplayValueMap && typeof block.itemTitleDisplayValueMap === "object" && !Array.isArray(block.itemTitleDisplayValueMap)
      ? { itemTitleDisplayValueMap: cloneValue(block.itemTitleDisplayValueMap) }
      : {}),
    ...(valueField
      ? {
        valueField,
        valueLabel: normalizeString(block?.valueLabel || valueField || "Value"),
        ...(normalizeString(block?.valueFormat) ? { valueFormat: normalizeString(block.valueFormat) } : {}),
      }
      : {}),
    ...(secondaryField
      ? {
        secondaryField,
        secondaryLabel: normalizeString(block?.secondaryLabel || secondaryField),
        ...(normalizeString(block?.secondaryFormat) ? { secondaryFormat: normalizeString(block.secondaryFormat) } : {}),
        ...(normalizeString(block?.secondaryDisplayKey) ? { secondaryDisplayKey: normalizeString(block.secondaryDisplayKey) } : {}),
        ...(block?.secondaryDisplayValueMap && typeof block.secondaryDisplayValueMap === "object" && !Array.isArray(block.secondaryDisplayValueMap)
          ? { secondaryDisplayValueMap: cloneValue(block.secondaryDisplayValueMap) }
          : {}),
      }
      : {}),
    layout: normalizeCollectionLayout(block?.layout),
    columns: normalizeCollectionColumns(block?.columns),
    rowLimit: normalizeCollectionRowLimit(block?.rowLimit),
    bodyFormat: "markdown",
    ...(bodyTemplate.trim() ? { bodyTemplate } : {}),
    ...(block?.templateFieldDisplayMap && typeof block.templateFieldDisplayMap === "object" && !Array.isArray(block.templateFieldDisplayMap)
      ? { templateFieldDisplayMap: cloneValue(block.templateFieldDisplayMap) }
      : {}),
    ...(toneField ? { toneField } : {}),
    ...(toneRules.length > 0 ? { toneRules } : {}),
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    ...(normalizeString(block?.emptyLabel) ? { emptyLabel: normalizeString(block.emptyLabel) } : {}),
  };
}

export function buildReportDocumentSectionBlock(block = {}) {
  const navigationLabel = normalizeString(block?.navigationLabel || block?.title || "Section") || "Section";
  return {
    id: normalizeString(block?.id || "sectionBlock"),
    kind: "sectionBlock",
    title: normalizeString(block?.title || "Section") || "Section",
    ...(normalizeString(block?.subtitle) ? { subtitle: normalizeString(block.subtitle) } : {}),
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    navigationLabel,
  };
}

function normalizeReportDocumentTabGroupSectionIds(sectionIds = []) {
  const seen = new Set();
  return (Array.isArray(sectionIds) ? sectionIds : [])
    .map((sectionId) => normalizeString(sectionId))
    .filter((sectionId) => {
      if (!sectionId || seen.has(sectionId)) {
        return false;
      }
      seen.add(sectionId);
      return true;
    });
}

export function buildReportDocumentTabGroupBlock(block = {}) {
  const sectionIds = normalizeReportDocumentTabGroupSectionIds(block?.sectionIds);
  const defaultSectionId = normalizeString(block?.defaultSectionId);
  return {
    id: normalizeString(block?.id || "tabGroupBlock"),
    kind: "tabGroupBlock",
    title: normalizeString(block?.title || "Sections") || "Sections",
    sectionIds,
    ...(defaultSectionId && sectionIds.includes(defaultSectionId) ? { defaultSectionId } : {}),
  };
}

function normalizeReportDocumentCompositeChildBlockIds(childBlockIds = []) {
  const seen = new Set();
  return (Array.isArray(childBlockIds) ? childBlockIds : [])
    .map((blockId) => normalizeString(blockId))
    .filter((blockId) => {
      if (!blockId || seen.has(blockId)) {
        return false;
      }
      seen.add(blockId);
      return true;
    });
}

export function buildReportDocumentCompositeBlock(block = {}) {
  const childBlockIds = normalizeReportDocumentCompositeChildBlockIds(block?.childBlockIds);
  return {
    id: normalizeString(block?.id || "compositeBlock"),
    kind: "compositeBlock",
    title: normalizeString(block?.title || "Grouped Panel") || "Grouped Panel",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    childBlockIds,
  };
}

function normalizeReportDocumentStepperSteps(steps = []) {
  return (Array.isArray(steps) ? steps : [])
    .map((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) {
        return null;
      }
      const title = normalizeString(step?.title);
      const body = String(step?.body || "");
      const tone = normalizeString(step?.tone).toLowerCase();
      if (!title && !body.trim()) {
        return null;
      }
      return {
        id: normalizeString(step?.id || `step_${index + 1}`) || `step_${index + 1}`,
        title,
        body,
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
}

export function buildReportDocumentStepperBlock(block = {}) {
  const steps = normalizeReportDocumentStepperSteps(block?.steps);
  return {
    id: normalizeString(block?.id || "stepperBlock"),
    kind: "stepperBlock",
    title: normalizeString(block?.title || "Stepper") || "Stepper",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    steps,
  };
}

export function buildReportDocumentInfoPanelBlock(block = {}) {
  return {
    id: normalizeString(block?.id || "infoPanelBlock"),
    kind: "infoPanelBlock",
    title: normalizeString(block?.title || "Info Panel") || "Info Panel",
    ...(normalizeString(block?.eyebrow) ? { eyebrow: normalizeString(block.eyebrow) } : {}),
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    ...(normalizeString(block?.tone) ? { tone: normalizeString(block.tone).toLowerCase() } : {}),
    bodyFormat: "markdown",
    body: String(block?.body || ""),
  };
}

function normalizeReportDocumentCalloutBadges(badges = [], badgesText = "") {
  const explicitBadges = normalizeStringArray(badges);
  if (explicitBadges.length > 0) {
    return explicitBadges;
  }
  return String(badgesText || "")
    .split(/[\n,]/)
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
}

export function buildReportDocumentCalloutBlock(block = {}) {
  const badges = normalizeReportDocumentCalloutBadges(block?.badges, block?.badgesText);
  return {
    id: normalizeString(block?.id || "calloutBlock"),
    kind: "calloutBlock",
    title: normalizeString(block?.title || "Callout") || "Callout",
    ...(normalizeString(block?.icon) ? { icon: normalizeString(block.icon) } : {}),
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    ...(normalizeString(block?.tone) ? { tone: normalizeString(block.tone).toLowerCase() } : {}),
    ...(badges.length > 0 ? { badges } : {}),
    bodyFormat: "markdown",
    body: String(block?.body || ""),
  };
}

function normalizeReportDocumentKanbanCards(cards = []) {
  return (Array.isArray(cards) ? cards : [])
    .map((card, index) => {
      if (!card || typeof card !== "object" || Array.isArray(card)) {
        return null;
      }
      const title = normalizeString(card?.title);
      const body = String(card?.body || "");
      const badge = normalizeString(card?.badge);
      const tone = normalizeString(card?.tone).toLowerCase();
      if (!title && !body.trim() && !badge) {
        return null;
      }
      return {
        id: normalizeString(card?.id || `card_${index + 1}`) || `card_${index + 1}`,
        title,
        body,
        ...(badge ? { badge } : {}),
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeReportDocumentKanbanColumns(columns = []) {
  return (Array.isArray(columns) ? columns : [])
    .map((column, index) => {
      if (!column || typeof column !== "object" || Array.isArray(column)) {
        return null;
      }
      const title = normalizeString(column?.title);
      const tone = normalizeString(column?.tone).toLowerCase();
      const cards = normalizeReportDocumentKanbanCards(column?.cards);
      if (!title && cards.length === 0) {
        return null;
      }
      return {
        id: normalizeString(column?.id || `column_${index + 1}`) || `column_${index + 1}`,
        title,
        ...(tone ? { tone } : {}),
        cards,
      };
    })
    .filter(Boolean);
}

export function buildReportDocumentKanbanBlock(block = {}) {
  return {
    id: normalizeString(block?.id || "kanbanBlock"),
    kind: "kanbanBlock",
    title: normalizeString(block?.title || "Pipeline") || "Pipeline",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    columns: normalizeReportDocumentKanbanColumns(block?.columns),
  };
}

function normalizeReportDocumentTimelineEvents(events = []) {
  return (Array.isArray(events) ? events : [])
    .map((event, index) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return null;
      }
      const title = normalizeString(event?.title);
      const body = String(event?.body || "");
      const date = normalizeString(event?.date);
      const badge = normalizeString(event?.badge);
      const tone = normalizeString(event?.tone).toLowerCase();
      if (!title && !body.trim() && !date && !badge) {
        return null;
      }
      return {
        id: normalizeString(event?.id || `event_${index + 1}`) || `event_${index + 1}`,
        ...(date ? { date } : {}),
        title,
        body,
        ...(badge ? { badge } : {}),
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
}

export function buildReportDocumentTimelineBlock(block = {}) {
  return {
    id: normalizeString(block?.id || "timelineBlock"),
    kind: "timelineBlock",
    title: normalizeString(block?.title || "Timeline") || "Timeline",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    events: normalizeReportDocumentTimelineEvents(block?.events),
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

export function normalizeReportBlockRuntime(runtime = null, block = {}) {
  const source = isPlainObject(runtime) ? runtime : {};
  const visibleWhen = isPlainObject(source?.visibleWhen)
    ? cloneValue(source.visibleWhen)
    : (isPlainObject(block?.visibleWhen) ? cloneValue(block.visibleWhen) : null);
  const filterBindings = isPlainObject(source?.filterBindings)
    ? cloneValue(source.filterBindings)
    : (isPlainObject(block?.filterBindings) ? cloneValue(block.filterBindings) : null);
  const selectionBindings = isPlainObject(source?.selectionBindings)
    ? cloneValue(source.selectionBindings)
    : (isPlainObject(block?.selectionBindings) ? cloneValue(block.selectionBindings) : null);
  const actions = Array.isArray(source?.actions)
    ? cloneValue(source.actions)
    : (Array.isArray(block?.actions) ? cloneValue(block.actions) : []);
  const normalized = {
    ...(visibleWhen ? { visibleWhen } : {}),
    ...(filterBindings && Object.keys(filterBindings).length > 0 ? { filterBindings } : {}),
    ...(selectionBindings && Object.keys(selectionBindings).length > 0 ? { selectionBindings } : {}),
    ...(actions.length > 0 ? { actions } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function withReportBlockRuntime(normalizedBlock = null, sourceBlock = {}) {
  if (!normalizedBlock) {
    return normalizedBlock;
  }
  const runtime = normalizeReportBlockRuntime(sourceBlock?.runtime, sourceBlock);
  return runtime ? { ...normalizedBlock, runtime } : normalizedBlock;
}

function normalizeReportBuilderDocumentBlockContent(block = {}) {
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
  if (normalizedKind === "collectionBlock") {
    return buildReportDocumentCollectionBlock(block);
  }
  if (normalizedKind === "sectionBlock") {
    return buildReportDocumentSectionBlock(block);
  }
  if (normalizedKind === "tabGroupBlock") {
    return buildReportDocumentTabGroupBlock(block);
  }
  if (normalizedKind === "compositeBlock") {
    return buildReportDocumentCompositeBlock(block);
  }
  if (normalizedKind === "stepperBlock") {
    return buildReportDocumentStepperBlock(block);
  }
  if (normalizedKind === "infoPanelBlock") {
    return buildReportDocumentInfoPanelBlock(block);
  }
  if (normalizedKind === "calloutBlock") {
    return buildReportDocumentCalloutBlock(block);
  }
  if (normalizedKind === "kanbanBlock") {
    return buildReportDocumentKanbanBlock(block);
  }
  if (normalizedKind === "timelineBlock") {
    return buildReportDocumentTimelineBlock(block);
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

function normalizeReportBuilderDocumentBlock(block = {}) {
  return withReportBlockRuntime(normalizeReportBuilderDocumentBlockContent(block), block);
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
  const normalizedBlockIds = (Array.isArray(blockIds) ? blockIds : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const preludeBlockIds = normalizedBlockIds.filter((blockId) => (
    blockId !== "primaryBuilder"
      && ["scopeFilters", "sharedFilters", "activeRefinements", "activeDrillPath"].includes(blockId)
  ));
  const trailingBlockIds = normalizedBlockIds.filter((blockId) => (
    blockId !== "primaryBuilder" && !preludeBlockIds.includes(blockId)
  ));
  [...preludeBlockIds, "primaryBuilder", ...trailingBlockIds].forEach((blockId) => {
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
  const contextPreset = resolveReportScopeContextPresetFromState(state, scopeParams);
  const binding = resolveReportDocumentBinding(null, config, state);
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
  const presentation = buildReportBuilderReportDocumentPresentation(config, state);

  return {
    version: 1,
    kind: "reportDocument",
    id: documentId,
    title: resolveDocumentMetadataValue(state?.reportDocumentTitle, resolveDocumentTitle(container, config)),
    subtitle: normalizeString(state?.reportDocumentSubtitle),
    description: normalizeString(state?.reportDocumentDescription),
    ...(normalizeReportDocumentTheme({
      accentTone: state?.reportDocumentThemeAccent,
      badgePalette: state?.reportDocumentBadgePalette,
    }) ? { theme: normalizeReportDocumentTheme({
      accentTone: state?.reportDocumentThemeAccent,
      badgePalette: state?.reportDocumentBadgePalette,
    }) } : {}),
    ...(resolveDocumentTemplateIdentity(state) || {}),
    ...(binding ? { binding: cloneValue(binding) } : {}),
    ...(semanticSummary && typeof semanticSummary === "object" && !Array.isArray(semanticSummary)
      ? { semanticSummary: cloneValue(semanticSummary) }
      : {}),
    refinements: normalizeReportRefinements(refinements),
    scope: {
      ...(contextPreset ? { contextPreset: cloneValue(contextPreset) } : {}),
      params: scopeParams,
      dataSourceRef: resolveDocumentDataSourceRef(container, config),
    },
    ...(presentation ? { presentation } : {}),
    datasets: buildReportBuilderReportDocumentDatasets(container, config, state),
    layout: {
      type: normalizeString(state?.reportDocumentLayout?.type || "stack") || "stack",
      items: normalizeReportBuilderDocumentLayoutItems(
        state?.reportDocumentLayout,
        documentBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
      ),
    },
    blocks: [
      ...documentBlocks.map((block) => cloneValue(block)),
      {
        id: blockId,
        kind: "reportBuilderBlock",
        title: resolveDocumentTitle(container, config),
        source,
        config: stripReportBuilderDocumentPresentationMetadata(
          stripReportBuilderDocumentPrimaryFieldContract(
            stripReportBuilderDocumentDatasetCatalog(config),
          ),
          presentation,
        ),
        state: stripReportBuilderDocumentAuthoringState(state),
        scopeBindings: buildReportBuilderBlockScopeBindings(config),
      },
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

// Documents persisted by older builders may carry thin scope params (id/value
// only) or omit scope.params entirely, which used to leave reportFill digging
// filter metadata out of the embedded builder config. Regenerate the canonical
// params from the effective config/state and let document-authored fields win,
// so the lowered spec carries full scope-param metadata on its own.
function enrichLoweredScopeParams(documentParams = [], canonicalParams = []) {
  const canonicalById = new Map(
    (Array.isArray(canonicalParams) ? canonicalParams : [])
      .map((param) => [normalizeString(param?.id), param])
      .filter(([id]) => !!id),
  );
  const seen = new Set();
  const enriched = (Array.isArray(documentParams) ? documentParams : [])
    .map((param) => {
      const id = normalizeString(param?.id);
      if (!id) {
        return null;
      }
      seen.add(id);
      const canonical = canonicalById.get(id);
      return canonical
        ? { ...cloneValue(canonical), ...cloneValue(param) }
        : cloneValue(param);
    })
    .filter(Boolean);
  canonicalById.forEach((param, id) => {
    if (!seen.has(id)) {
      enriched.push(cloneValue(param));
    }
  });
  return enriched;
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
  const reportBuilderBlock = resolveReportBuilderBlock(document);
  if (!reportBuilderBlock) {
    throw new Error("ReportDocument must contain at least one reportBuilderBlock.");
  }
  const scopedReportBuilderBlock = applyReportBuilderBlockScope(document, reportBuilderBlock);
  const source = reportBuilderBlock?.source && typeof reportBuilderBlock.source === "object" ? reportBuilderBlock.source : {};
  const builderContext = resolveReportDocumentBuilderContext(
    document,
    scopedReportBuilderBlock?.config || {},
    scopedReportBuilderBlock?.state || {},
  );
  const effectiveScopedConfig = builderContext?.config || {};
  const effectiveScopedState = builderContext?.state || {};
  const effectiveConfig = buildReportBuilderCalculatedFieldConfig(effectiveScopedConfig, effectiveScopedState);
  const effectiveFieldCatalog = buildReportBuilderFieldCatalog(effectiveConfig);
  const staticDatasets = Array.isArray(builderContext?.staticDatasets) ? builderContext.staticDatasets : [];
  const loweringState = effectiveScopedState;
  const staticDatasetIndex = new Map(
    staticDatasets
      .map((dataset) => [normalizeString(dataset?.id), dataset])
      .filter(([datasetId]) => !!datasetId),
  );
  const publishedDatasetSources = resolveReportDocumentPublishedDatasets(document, effectiveScopedConfig);
  const publishedDatasetIndex = buildReportBuilderPublishedDatasetRefIndex(publishedDatasetSources);
  const loweredContainer = {
    id: normalizeString(source.containerId || document?.id),
    stateKey: normalizeString(source.stateKey || source.containerId || document?.id),
    title: normalizeString(document?.title || reportBuilderBlock?.title),
    dataSourceRef: normalizeString(source.dataSourceRef || document?.scope?.dataSourceRef),
  };
  const baseSpec = buildReportBuilderReportSpec({
    container: loweredContainer,
    config: effectiveScopedConfig,
    state: loweringState,
    refinements: normalizeReportRefinements(document?.refinements),
    semanticSummary: document?.semanticSummary || null,
    includePrimaryBlocks,
  });
  const primaryRequestContext = {
    dataSourceRef: normalizeString(baseSpec?.source?.dataSourceRef || loweredContainer?.dataSourceRef),
    request: cloneValue(buildReportBuilderRequest(effectiveScopedConfig, effectiveScopedState)),
  };
  const datasetBackedBlocks = blocks
    .filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock")
    .filter((block) => isReportDatasetBackedBlockKind(block?.kind));
  const explicitDatasetRefs = datasetBackedBlocks
    .map((block) => normalizeString(block?.datasetRef))
    .filter(Boolean);
  const shouldOmitPrimaryDataset = !shouldKeepPrimaryDataset({
    includePrimaryBlocks,
    datasetBackedBlockDatasetRefs: explicitDatasetRefs.length === datasetBackedBlocks.length ? explicitDatasetRefs : [],
    availableNonPrimaryDatasetRefs: [
      ...Array.from(staticDatasetIndex.keys()),
      ...Array.from(publishedDatasetIndex.keys()),
    ],
  });
  if (shouldOmitPrimaryDataset) {
    baseSpec.datasets = (Array.isArray(baseSpec?.datasets) ? baseSpec.datasets : [])
      .filter((dataset) => normalizeString(dataset?.id) !== "primary");
  }
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
          ...cloneValue(effectiveScopedState),
          selectedDimensions: [],
          selectedMeasures: [],
          primaryMeasure: "",
          groupBy: "",
        }, normalizedBlock?.chartSpec || {}, datasetContext.fieldCatalog);
        return withReportBlockRuntime(buildReportSpecChartBlock({
          container: datasetContext.container,
          config: datasetContext.config,
          state: chartState,
          chartSpec: normalizedBlock?.chartSpec || null,
          blockId: normalizedBlock?.id,
          datasetRef: normalizedBlock?.datasetRef,
          title: normalizedBlock?.title,
        }), normalizedBlock);
      }
      if (normalizeString(normalizedBlock?.kind) === "tableBlock") {
        return withReportBlockRuntime(buildAuthoredTableBlock(normalizedBlock, datasetContext.fieldCatalog), normalizedBlock);
      }
      if (normalizeString(normalizedBlock?.kind) === "markdownBlock") {
        return withReportBlockRuntime(buildAuthoredMarkdownBlock(normalizedBlock, datasetContext.fieldCatalog), normalizedBlock);
      }
      if (normalizeString(normalizedBlock?.kind) === "kpiBlock") {
        return withReportBlockRuntime(buildAuthoredKpiBlock(normalizedBlock, datasetContext.fieldCatalog), normalizedBlock);
      }
      if (normalizeString(normalizedBlock?.kind) === "collectionBlock") {
        return withReportBlockRuntime(buildAuthoredCollectionBlock(normalizedBlock, datasetContext.fieldCatalog), normalizedBlock);
      }
      if (normalizeString(normalizedBlock?.kind) === "badgesBlock") {
        return withReportBlockRuntime(buildAuthoredBadgesBlock(normalizedBlock, datasetContext.fieldCatalog), normalizedBlock);
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
    effectiveScopedConfig,
    effectiveScopedState,
    referencedDatasetRefs,
    runtimeDatasetScopeParams,
    primaryRequestContext,
  );
  const refreshedPublishedDatasetIndex = new Map(
    additionalPublishedDatasets
      .map((dataset) => [normalizeString(dataset?.id), dataset])
      .filter(([datasetId]) => !!datasetId),
  );
  const baseDatasets = Array.isArray(baseSpec?.datasets) ? baseSpec.datasets : [];
  const mergedDatasets = [
    ...baseDatasets.map((dataset) => (
      refreshedPublishedDatasetIndex.get(normalizeString(dataset?.id)) || dataset
    )),
    ...additionalPublishedDatasets.filter((dataset) => !baseDatasets.some((entry) => normalizeString(entry?.id) === normalizeString(dataset?.id))),
  ];
  const resolvedPrimaryDataset = shouldOmitPrimaryDataset
    ? null
    : resolveLoweredPrimaryDataset(
      document,
      mergedDatasets.find((dataset) => normalizeString(dataset?.id) === "primary") || null,
      loweredContainer,
    );
  const nextDatasets = [
    ...(resolvedPrimaryDataset ? [resolvedPrimaryDataset] : []),
    ...mergedDatasets.filter((dataset) => normalizeString(dataset?.id) !== "primary"),
  ];
  const loweredScopeParams = enrichLoweredScopeParams(
    document?.scope?.params,
    buildReportDocumentScopeParams(effectiveScopedConfig, effectiveScopedState, runtimeDatasetScopeParams),
  );
  const loweredContextPreset = normalizeReportScopeContextPreset(document?.scope?.contextPreset, {
    availableParamIds: listMeaningfulReportScopeParamIds(loweredScopeParams),
  });
  const nextSpec = {
    ...baseSpec,
    ...(normalizeReportDocumentTheme(document?.theme) ? { theme: normalizeReportDocumentTheme(document.theme) } : {}),
    scope: {
      ...(loweredContextPreset ? { contextPreset: loweredContextPreset } : {}),
      params: loweredScopeParams,
      dataSourceRef: normalizeString(document?.scope?.dataSourceRef || source.dataSourceRef || baseSpec?.source?.dataSourceRef),
    },
    layoutIntent: {
      ...(baseSpec?.layoutIntent || {}),
      blockOrder: nextBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
      items: loweredLayout.items,
    },
    datasets: nextDatasets,
    blocks: nextBlocks,
  };
  return augmentReportRequestForAuthoredBlocks(nextSpec, nextBlocks, effectiveConfig);
}
