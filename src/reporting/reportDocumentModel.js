import { buildReportBuilderReportSpec, buildReportSpecChartBlock } from "./reportSpecModel.js";
import { normalizeReportCalculatedFields } from "./calculatedFieldModel.js";
import { normalizeReportRefinements } from "./reportRefinementModel.js";
import {
  normalizeRefinementBarActionKinds,
  normalizeRefinementBarText,
} from "./refinementBarModel.js";
import { normalizeReportDocumentTableBlock } from "./tableVisualSpec.js";
import { buildReportBuilderCalculatedFieldConfig } from "../components/dashboard/reportBuilderCalculatedFieldAuthoring.js";
import { normalizeReportBuilderChartSpec } from "../components/dashboard/reportBuilderUtils.js";

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

function normalizeGeoFormat(value = "") {
  const normalized = normalizeString(value);
  if (normalized === "compactNumber") {
    return "compact";
  }
  return normalized;
}

function normalizeLayoutItemSize(value = "") {
  return normalizeString(value).toLowerCase() === "half" ? "half" : "";
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

function buildLayoutItem(blockId = "", { size = "" } = {}) {
  const normalizedBlockId = normalizeString(blockId);
  if (!normalizedBlockId) {
    return null;
  }
  const normalizedSize = normalizeLayoutItemSize(size);
  return normalizedSize
    ? { blockId: normalizedBlockId, size: normalizedSize }
    : { blockId: normalizedBlockId };
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
  return normalizeString(container?.id || container?.stateKey || "reportDocument");
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

function resolveScopeParamValue(filter = {}, state = {}) {
  const filterId = normalizeString(filter?.id || filter?.field);
  if (!filterId) {
    return null;
  }
  const rawValue = state?.staticFilters?.[filterId];
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

export function buildReportDocumentScopeParams(config = {}, state = {}) {
  return (Array.isArray(config?.staticFilters) ? config.staticFilters : [])
    .map((filter) => {
      const id = normalizeString(filter?.id || filter?.field);
      if (!id) {
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
        value,
      };
    })
    .filter(Boolean);
}

export function buildReportBuilderBlockScopeBindings(config = {}) {
  return (Array.isArray(config?.staticFilters) ? config.staticFilters : [])
    .map((filter) => {
      const paramId = normalizeString(filter?.id || filter?.field);
      if (!paramId) {
        return null;
      }
      return {
        paramId,
        target: `staticFilters.${paramId}`,
      };
    })
    .filter(Boolean);
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
} = {}) {
  return {
    id: normalizeString(id || "filterBar"),
    kind: "filterBarBlock",
    title: normalizeString(title || "Filters"),
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
      }
      : {}),
    ...(normalizeString(block?.description)
      ? { description: normalizeString(block.description) }
      : {}),
    ...(normalizeString(block?.emptyLabel)
      ? { emptyLabel: normalizeString(block.emptyLabel) }
      : {}),
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
    const normalizedItem = buildLayoutItem(item?.blockId || item, {
      size: item?.size,
    });
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
} = {}) {
  const documentId = resolveDocumentId(container);
  const blockId = "primaryBuilder";
  const scopeParams = buildReportDocumentScopeParams(config, state);
  const documentBlocks = mergeReportBuilderDocumentBlocks(
    normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks),
    additionalBlocks,
  );
  const source = {
    kind: "dashboard.reportBuilder",
    containerId: normalizeString(container?.id),
    stateKey: normalizeString(container?.stateKey || container?.id),
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
  const nextState = cloneValue(block?.state || {});
  const nextStaticFilters = {
    ...(nextState.staticFilters || {}),
  };
  (Array.isArray(block?.scopeBindings) ? block.scopeBindings : []).forEach((binding) => {
    const paramId = normalizeString(binding?.paramId);
    const target = normalizeString(binding?.target);
    if (!paramId || !target.startsWith("staticFilters.")) {
      return;
    }
    const param = scopeParams.get(paramId);
    if (!param) {
      return;
    }
    const filterId = normalizeString(target.slice("staticFilters.".length));
    if (!filterId) {
      return;
    }
    nextStaticFilters[filterId] = cloneValue(param.value);
  });
  nextState.staticFilters = nextStaticFilters;
  return {
    ...block,
    state: nextState,
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
    layoutItems.push(buildLayoutItem(normalizedBlockId, {
      size: layoutItem?.size,
    }) || { blockId: normalizedBlockId });
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

export function lowerReportDocumentToReportSpec(document = {}) {
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
  });
  const additionalBlocks = blocks
    .filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock")
    .map((block) => {
      const normalizedBlock = normalizeReportBuilderDocumentBlock(block);
      if (normalizeString(normalizedBlock?.kind) === "chartBlock") {
        return buildReportSpecChartBlock({
          container: loweredContainer,
          config: effectiveConfig,
          state: buildAuthoredChartBlockState(scopedState, normalizedBlock?.chartSpec || {}, effectiveFieldCatalog),
          chartSpec: normalizedBlock?.chartSpec || null,
          blockId: normalizedBlock?.id,
          datasetRef: normalizedBlock?.datasetRef,
          title: normalizedBlock?.title,
        });
      }
      if (normalizeString(normalizedBlock?.kind) === "tableBlock") {
        return buildAuthoredTableBlock(normalizedBlock, effectiveFieldCatalog);
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
    blocks: nextBlocks,
  };
  return augmentReportRequestForAuthoredBlocks(nextSpec, nextBlocks, effectiveConfig);
}
