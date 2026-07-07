import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import { buildReportLayoutItem } from "../../reporting/reportLayoutModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function formatValue(value) {
  const normalized = normalizeString(value);
  return normalized || String(value ?? "");
}

function formatList(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => formatValue(value))
    .filter(Boolean)
    .join(", ");
}

function normalizeLayoutItem(item = null) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  return buildReportLayoutItem(item?.blockId, item, {
    preserveLegacyHalf: true,
  });
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveReportRuntimeMetadataContext(reportSpecOrContext = {}, reportDocument = null) {
  const explicitContext = isPlainObject(reportSpecOrContext)
    && (
      Object.prototype.hasOwnProperty.call(reportSpecOrContext, "reportSpec")
      || Object.prototype.hasOwnProperty.call(reportSpecOrContext, "reportDocument")
      || Object.prototype.hasOwnProperty.call(reportSpecOrContext, "document")
    );
  return resolveNormalizedReportSpecDocumentContext({
    reportSpec: explicitContext ? (reportSpecOrContext.reportSpec || null) : reportSpecOrContext,
    document: explicitContext
      ? (reportSpecOrContext.reportDocument || reportSpecOrContext.document || reportDocument)
      : reportDocument,
    title: explicitContext ? normalizeString(reportSpecOrContext.title || "") : "",
  });
}

function normalizeSemanticSummaryFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) {
        return null;
      }
      const id = normalizeString(field?.id);
      const label = normalizeString(field?.label || id);
      if (!id || !label) {
        return null;
      }
      const governance = field?.governance && typeof field.governance === "object" && !Array.isArray(field.governance)
        ? {
          ...(normalizeString(field.governance.status).toLowerCase() ? { status: normalizeString(field.governance.status).toLowerCase() } : {}),
          ...(normalizeString(field.governance.certification).toLowerCase() ? { certification: normalizeString(field.governance.certification).toLowerCase() } : {}),
          ...(normalizeString(field.governance.ownerRef) ? { ownerRef: normalizeString(field.governance.ownerRef) } : {}),
          ...(normalizeString(field.governance.classification) ? { classification: normalizeString(field.governance.classification) } : {}),
          ...(normalizeString(field.governance.deprecation) ? { deprecation: normalizeString(field.governance.deprecation) } : {}),
        }
        : null;
      return {
        id,
        label,
        ...(normalizeString(field?.rawId) ? { rawId: normalizeString(field.rawId) } : {}),
        ...(normalizeString(field?.description) ? { description: normalizeString(field.description) } : {}),
        ...(normalizeString(field?.format) ? { format: normalizeString(field.format) } : {}),
        ...(normalizeString(field?.category) ? { category: normalizeString(field.category) } : {}),
        ...(normalizeString(field?.definitionRef) ? { definitionRef: normalizeString(field.definitionRef) } : {}),
        ...(governance && Object.keys(governance).length > 0 ? { governance } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeBindingSelectionFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((field) => normalizeString(field))
    .filter(Boolean)
    .map((field) => ({
      id: field,
      rawId: field,
      label: field,
    }));
}

function summarizeSemanticGovernance(fields = []) {
  return (Array.isArray(fields) ? fields : []).reduce((counts, field) => {
    const governance = field?.governance && typeof field.governance === "object" ? field.governance : {};
    const status = normalizeString(governance.status).toLowerCase();
    if (status === "draft") {
      counts.draft += 1;
    } else if (status === "deprecated") {
      counts.deprecated += 1;
    }
    return counts;
  }, {
    draft: 0,
    deprecated: 0,
  });
}

function uniqueSemanticFieldMetadataValues(fields = [], property = "") {
  const values = [];
  const seen = new Set();
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    const value = normalizeString(field?.[property]);
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    values.push(value);
  });
  return values;
}

function uniqueSemanticGovernanceValues(fields = [], property = "") {
  const values = [];
  const seen = new Set();
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    const value = normalizeString(field?.governance?.[property]);
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    values.push(value);
  });
  return values;
}

function summarizeMetadataChip(label = "", values = [], maxVisible = 2) {
  const normalizedLabel = normalizeString(label);
  const resolvedValues = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!normalizedLabel || resolvedValues.length === 0) {
    return "";
  }
  if (resolvedValues.length <= maxVisible) {
    return `${normalizedLabel} ${resolvedValues.join(", ")}`;
  }
  return `${normalizedLabel} ${resolvedValues.slice(0, maxVisible).join(", ")} +${resolvedValues.length - maxVisible}`;
}

function normalizeScopeParams(params = []) {
  return (Array.isArray(params) ? params : [])
    .map((param) => {
      if (!param || typeof param !== "object" || Array.isArray(param)) {
        return null;
      }
      const id = normalizeString(param?.id);
      const label = normalizeString(param?.label || id);
      if (!id || !label) {
        return null;
      }
      const description = normalizeString(param?.description);
      return {
        id,
        label,
        ...(description ? { description } : {}),
        value: cloneValue(param?.value),
      };
    })
    .filter(Boolean);
}

function resolveReportRuntimeFieldColumn(reportSpec = {}, datasetRef = "", fieldKey = "") {
  const normalizedDatasetRef = normalizeString(datasetRef);
  const normalizedFieldKey = normalizeString(fieldKey);
  const tableBlocks = Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : [];
  for (const block of tableBlocks) {
    if (normalizeString(block?.kind) !== "tableBlock" || normalizeString(block?.datasetRef) !== normalizedDatasetRef) {
      continue;
    }
    const matchingColumn = (Array.isArray(block?.columns) ? block.columns : []).find((column) => (
      normalizeString(column?.key) === normalizedFieldKey
      || normalizeString(column?.sourceKey) === normalizedFieldKey
      || normalizeString(column?.displayKey) === normalizedFieldKey
    ));
    if (matchingColumn) {
      return matchingColumn;
    }
  }
  return null;
}

export function resolveReportRuntimeFieldLabel(reportSpec = {}, datasetRef = "", fieldKey = "", fallbackLabel = "") {
  const matchingColumn = resolveReportRuntimeFieldColumn(reportSpec, datasetRef, fieldKey);
  if (matchingColumn) {
    return normalizeString(matchingColumn?.label || fallbackLabel || fieldKey);
  }
  return normalizeString(fallbackLabel || fieldKey);
}

export function resolveReportRuntimeDatasetRequest(reportSpec = {}, datasetRef = "") {
  const normalizedDatasetRef = normalizeString(datasetRef);
  const dataset = (Array.isArray(reportSpec?.datasets) ? reportSpec.datasets : [])
    .find((entry) => normalizeString(entry?.id) === normalizedDatasetRef);
  return dataset?.request && typeof dataset.request === "object" ? dataset.request : {};
}

export function resolveReportRuntimeBlocks(reportSpec = {}, reportFill = {}) {
  const fillBlocks = Array.isArray(reportFill?.blocks) ? reportFill.blocks : [];
  const blockIndex = new Map(
    fillBlocks
      .map((block) => [normalizeString(block?.id), block])
      .filter(([id]) => !!id),
  );
  const layoutItemIndex = new Map(
    (Array.isArray(reportSpec?.layoutIntent?.items) ? reportSpec.layoutIntent.items : [])
      .map((item) => normalizeLayoutItem(item))
      .filter(Boolean)
      .map((item) => [item.blockId, item]),
  );
  const cloneBlockWithLayout = (block = null) => {
    const nextBlock = cloneValue(block);
    const blockId = normalizeString(nextBlock?.id);
    const layoutItem = layoutItemIndex.get(blockId);
    if (layoutItem) {
      nextBlock.layoutItem = cloneValue(layoutItem);
    }
    return nextBlock;
  };
  const ordered = [];
  const seen = new Set();
  const blockOrder = Array.isArray(reportSpec?.layoutIntent?.blockOrder)
    ? reportSpec.layoutIntent.blockOrder
    : [];
  blockOrder.forEach((blockId) => {
    const normalizedId = normalizeString(blockId);
    const block = blockIndex.get(normalizedId);
    if (!block || seen.has(normalizedId)) {
      return;
    }
    seen.add(normalizedId);
    ordered.push(cloneBlockWithLayout(block));
  });
  fillBlocks.forEach((block) => {
    const blockId = normalizeString(block?.id);
    if (blockId && seen.has(blockId)) {
      return;
    }
    if (blockId) {
      seen.add(blockId);
    }
    ordered.push(cloneBlockWithLayout(block));
  });
  return ordered;
}

export function resolveReportRuntimePrimaryBlocks(reportSpec = {}, reportFill = {}) {
  const blocks = resolveReportRuntimeBlocks(reportSpec, reportFill);
  const blockIndex = new Map(blocks.map((block) => [normalizeString(block?.id), block]));
  const orderedPrimaryIds = normalizeString(reportSpec?.parameters?.viewMode).toLowerCase() === "table"
    ? ["primaryTable", "primaryChart"]
    : ["primaryChart", "primaryTable"];
  const primary = orderedPrimaryIds
    .map((blockId) => blockIndex.get(blockId))
    .filter(Boolean);
  const primaryIds = new Set(primary.map((block) => normalizeString(block?.id)).filter(Boolean));
  const beforePrimary = [];
  const afterPrimary = [];
  let encounteredPrimary = false;
  blocks.forEach((block) => {
    const blockId = normalizeString(block?.id);
    if (primaryIds.has(blockId)) {
      encounteredPrimary = true;
      return;
    }
    if (encounteredPrimary) {
      afterPrimary.push(block);
      return;
    }
    beforePrimary.push(block);
  });
  return {
    primary,
    beforePrimary,
    afterPrimary,
  };
}

export function resolveReportRuntimeBindingSummary(reportSpecOrContext = {}, reportDocument = null) {
  const metadataContext = resolveReportRuntimeMetadataContext(reportSpecOrContext, reportDocument);
  const semanticSummary = metadataContext?.semanticSummary && typeof metadataContext.semanticSummary === "object" && !Array.isArray(metadataContext.semanticSummary)
    ? metadataContext.semanticSummary
    : null;
  const binding = metadataContext?.binding;
  const bindingSelectedDimensions = normalizeBindingSelectionFields(binding?.selectedDimensions);
  const bindingSelectedMeasures = normalizeBindingSelectionFields(binding?.selectedMeasures);
  if (normalizeString(semanticSummary?.kind).toLowerCase() === "semantic") {
    const selectedDimensions = normalizeSemanticSummaryFields(semanticSummary?.selectedDimensions);
    const selectedMeasures = normalizeSemanticSummaryFields(semanticSummary?.selectedMeasures);
    const selectedParameters = normalizeSemanticSummaryFields(semanticSummary?.selectedParameters);
    const resolvedSelectedDimensions = selectedDimensions.length > 0
      ? selectedDimensions
      : bindingSelectedDimensions;
    const resolvedSelectedMeasures = selectedMeasures.length > 0
      ? selectedMeasures
      : bindingSelectedMeasures;
    return {
      kind: "semantic",
      title: "Semantic Binding",
      modelRef: normalizeString(semanticSummary?.modelRef || binding?.modelRef),
      modelLabel: normalizeString(semanticSummary?.modelLabel),
      ...(normalizeString(semanticSummary?.modelDescription) ? { modelDescription: normalizeString(semanticSummary?.modelDescription) } : {}),
      entity: normalizeString(semanticSummary?.entity || binding?.entity),
      entityLabel: normalizeString(semanticSummary?.entityLabel),
      ...(normalizeString(semanticSummary?.entityDescription) ? { entityDescription: normalizeString(semanticSummary?.entityDescription) } : {}),
      dimensionCount: resolvedSelectedDimensions.length,
      measureCount: resolvedSelectedMeasures.length,
      ...(selectedParameters.length > 0 ? { parameterCount: selectedParameters.length } : {}),
      selectedDimensions: resolvedSelectedDimensions,
      selectedMeasures: resolvedSelectedMeasures,
      ...(selectedParameters.length > 0 ? { selectedParameters } : {}),
      governanceCounts: summarizeSemanticGovernance([
        ...resolvedSelectedDimensions,
        ...resolvedSelectedMeasures,
        ...selectedParameters,
      ]),
    };
  }
  if (!binding || normalizeString(binding?.mode).toLowerCase() !== "semantic") {
    return null;
  }
  const selectedDimensions = normalizeBindingSelectionFields(binding?.selectedDimensions);
  const selectedMeasures = normalizeBindingSelectionFields(binding?.selectedMeasures);
  return {
    kind: "semantic",
    title: "Semantic Binding",
    modelRef: normalizeString(binding?.modelRef),
    entity: normalizeString(binding?.entity),
    dimensionCount: selectedDimensions.length,
    measureCount: selectedMeasures.length,
    selectedDimensions,
    selectedMeasures,
    governanceCounts: {
      draft: 0,
      deprecated: 0,
    },
  };
}

export function resolveReportRuntimeBindingSummaryChips(bindingSummary = null) {
  if (!bindingSummary || typeof bindingSummary !== "object" || Array.isArray(bindingSummary)) {
    return [];
  }
  const summarizeSelectedLabels = (title, fields = [], count = 0) => {
    const labels = (Array.isArray(fields) ? fields : [])
      .map((field) => normalizeString(field?.label))
      .filter(Boolean);
    if (labels.length === 0) {
      const normalizedTitle = normalizeString(title).toLowerCase();
      if (normalizedTitle === "dimensions") {
        return `${Number(count || 0)} dimensions`;
      }
      if (normalizedTitle === "measures") {
        return `${Number(count || 0)} measures`;
      }
      if (normalizedTitle === "parameters") {
        return `${Number(count || 0)} parameters`;
      }
      return `${Number(count || 0)} ${normalizedTitle}`;
    }
    if (labels.length <= 2) {
      return `${title} ${labels.join(", ")}`;
    }
    return `${title} ${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  };
  const semanticFields = [
    ...(Array.isArray(bindingSummary.selectedDimensions) ? bindingSummary.selectedDimensions : []),
    ...(Array.isArray(bindingSummary.selectedMeasures) ? bindingSummary.selectedMeasures : []),
    ...(Array.isArray(bindingSummary.selectedParameters) ? bindingSummary.selectedParameters : []),
  ];
  const categoryChip = summarizeMetadataChip(
    "Categories",
    uniqueSemanticFieldMetadataValues(semanticFields, "category"),
    2,
  );
  const ownerRefs = uniqueSemanticGovernanceValues(semanticFields, "ownerRef");
  const ownerChip = ownerRefs.length === 0
    ? ""
    : ownerRefs.length === 1
      ? `Owner ${ownerRefs[0]}`
      : summarizeMetadataChip("Owners", ownerRefs, 1);
  const lineageChip = summarizeMetadataChip(
    "Lineage",
    uniqueSemanticFieldMetadataValues(semanticFields, "definitionRef"),
    1,
  );
  return [
    normalizeString(bindingSummary.modelLabel || bindingSummary.modelRef)
      ? `Model ${normalizeString(bindingSummary.modelLabel || bindingSummary.modelRef)}`
      : "",
    normalizeString(bindingSummary.entityLabel || bindingSummary.entity)
      ? `Entity ${normalizeString(bindingSummary.entityLabel || bindingSummary.entity)}`
      : "",
    summarizeSelectedLabels("Dimensions", bindingSummary.selectedDimensions, bindingSummary.dimensionCount),
    summarizeSelectedLabels("Measures", bindingSummary.selectedMeasures, bindingSummary.measureCount),
    Number(bindingSummary.parameterCount || 0) > 0
      ? summarizeSelectedLabels("Parameters", bindingSummary.selectedParameters, bindingSummary.parameterCount)
      : "",
    categoryChip,
    ownerChip,
    lineageChip,
    Number(bindingSummary.governanceCounts?.deprecated || 0) > 0
      ? `${Number(bindingSummary.governanceCounts.deprecated)} deprecated`
      : "",
    Number(bindingSummary.governanceCounts?.draft || 0) > 0
      ? `${Number(bindingSummary.governanceCounts.draft)} draft`
      : "",
  ].filter(Boolean);
}

export function resolveReportRuntimeCompactBindingSummaryChips(bindingSummary = null) {
  if (!bindingSummary || typeof bindingSummary !== "object" || Array.isArray(bindingSummary)) {
    return [];
  }
  const summarizeSelectedLabels = (title, fields = [], count = 0) => {
    const labels = (Array.isArray(fields) ? fields : [])
      .map((field) => normalizeString(field?.label))
      .filter(Boolean);
    if (labels.length === 0) {
      const normalizedTitle = normalizeString(title).toLowerCase();
      if (normalizedTitle === "dimensions") {
        return `${Number(count || 0)} dimensions`;
      }
      if (normalizedTitle === "measures") {
        return `${Number(count || 0)} measures`;
      }
      if (normalizedTitle === "parameters") {
        return `${Number(count || 0)} parameters`;
      }
      return `${Number(count || 0)} ${normalizedTitle}`;
    }
    if (labels.length <= 2) {
      return `${title} ${labels.join(", ")}`;
    }
    return `${title} ${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  };
  return [
    normalizeString(bindingSummary.modelLabel || bindingSummary.modelRef)
      ? `Model ${normalizeString(bindingSummary.modelLabel || bindingSummary.modelRef)}`
      : "",
    normalizeString(bindingSummary.entityLabel || bindingSummary.entity)
      ? `Entity ${normalizeString(bindingSummary.entityLabel || bindingSummary.entity)}`
      : "",
    summarizeSelectedLabels("Dimensions", bindingSummary.selectedDimensions, bindingSummary.dimensionCount),
    summarizeSelectedLabels("Measures", bindingSummary.selectedMeasures, bindingSummary.measureCount),
    Number(bindingSummary.parameterCount || 0) > 0
      ? summarizeSelectedLabels("Parameters", bindingSummary.selectedParameters, bindingSummary.parameterCount)
      : "",
  ].filter(Boolean);
}

export function resolveReportRuntimeScopeSummary(reportSpecOrContext = {}, reportDocument = null) {
  const metadataContext = resolveReportRuntimeMetadataContext(reportSpecOrContext, reportDocument);
  const params = normalizeScopeParams(metadataContext?.scopeParams);
  if (params.length === 0) {
    return null;
  }
  return {
    title: "Filters",
    paramCount: params.length,
    params,
  };
}

export function resolveReportRuntimeRefinementFields(reportSpec = {}, block = {}) {
  const request = resolveReportRuntimeDatasetRequest(reportSpec, block?.datasetRef);
  const requestedDimensions = new Set(
    Object.entries(request?.dimensions || {})
      .filter(([, enabled]) => enabled)
      .map(([field]) => normalizeString(field))
      .filter(Boolean),
  );
  const columns = Array.isArray(block?.content?.columns)
    ? block.content.columns
    : (Array.isArray(block?.columns) ? block.columns : []);
  return columns
    .map((column) => {
      const valueKey = normalizeString(column?.sourceKey || column?.displayKey || column?.key);
      const displayValueKey = normalizeString(column?.displayKey || column?.key || valueKey);
      if (!valueKey || !requestedDimensions.has(valueKey)) {
        return null;
      }
      return {
        key: normalizeString(column?.key || valueKey),
        valueKey,
        displayValueKey,
        label: normalizeString(column?.label || valueKey),
        runtimeFilterable: column?.runtimeFilterable === true,
        ...(column?.displayValueMap && typeof column.displayValueMap === "object" && !Array.isArray(column.displayValueMap)
          ? { displayValueMap: cloneValue(column.displayValueMap) }
          : {}),
      };
    })
    .filter(Boolean);
}

export function resolveReportRuntimeChartActionFields(reportSpec = {}, block = {}) {
  const chartSpec = block?.content?.chartSpec || block?.chartSpec || {};
  const datasetRef = normalizeString(block?.datasetRef);
  const next = [];
  const xField = normalizeString(chartSpec?.xField);
  if (xField) {
    const xColumn = resolveReportRuntimeFieldColumn(reportSpec, datasetRef, xField);
    next.push({
      kind: "xField",
      valueKey: xField,
      displayValueKey: normalizeString(xColumn?.displayKey || xColumn?.key || xField),
      label: resolveReportRuntimeFieldLabel(reportSpec, datasetRef, xField, xField),
      selectionSource: "xValue",
      runtimeFilterable: xColumn?.runtimeFilterable === true,
    });
  }
  const seriesField = normalizeString(chartSpec?.seriesField);
  if (seriesField) {
    const seriesColumn = resolveReportRuntimeFieldColumn(reportSpec, datasetRef, seriesField);
    next.push({
      kind: "seriesField",
      valueKey: seriesField,
      displayValueKey: normalizeString(seriesColumn?.displayKey || seriesColumn?.key || seriesField),
      label: resolveReportRuntimeFieldLabel(reportSpec, datasetRef, seriesField, seriesField),
      selectionSource: "seriesKey",
      runtimeFilterable: seriesColumn?.runtimeFilterable === true,
    });
  }
  return next;
}

export function resolveReportRuntimeFieldActionKey(blockId = "", valueKey = "") {
  return `${normalizeString(blockId)}:${normalizeString(valueKey)}`;
}

export function buildReportRuntimeUnsupportedRefinementDiagnostics({
  block = {},
  fields = [],
  providerActionsByField = new Map(),
} = {}) {
  const normalizedBlockId = normalizeString(block?.id);
  const unsupportedFields = (Array.isArray(fields) ? fields : [])
    .map((field) => {
      if (field?.runtimeFilterable === true) {
        return null;
      }
      const actions = Array.isArray(providerActionsByField.get(resolveReportRuntimeFieldActionKey(normalizedBlockId, field?.valueKey)))
        ? providerActionsByField.get(resolveReportRuntimeFieldActionKey(normalizedBlockId, field?.valueKey))
        : [];
      const unsupportedKinds = Array.from(new Set(
        actions
          .map((action) => normalizeString(action?.kind).toLowerCase())
          .filter((kind) => ["keep", "exclude", "drill"].includes(kind)),
      ));
      if (unsupportedKinds.length === 0) {
        return null;
      }
      return {
        label: normalizeString(field?.label || field?.valueKey),
        unsupportedKinds,
      };
    })
    .filter(Boolean);
  if (unsupportedFields.length === 0) {
    return [];
  }
  const fieldText = unsupportedFields.map((entry) => entry.label).join(", ");
  return [{
    code: "runtimeRefinementUnsupported",
    severity: "warning",
    message: unsupportedFields.length === 1
      ? `Runtime refinement actions are unavailable for ${fieldText} because no backend runtime filter mapping is declared.`
      : `Runtime refinement actions are unavailable for ${fieldText} because no backend runtime filter mappings are declared.`,
  }];
}

export function formatReportRuntimeScopeValue(param = {}) {
  const value = param?.value;
  if (value && typeof value === "object" && !Array.isArray(value) && ("start" in value || "end" in value)) {
    const start = normalizeString(value?.start);
    const end = normalizeString(value?.end);
    return [start || "open", end || "open"].join(" to ");
  }
  if (Array.isArray(value)) {
    return formatList(value) || "None";
  }
  const normalized = normalizeString(value);
  return normalized || (value == null ? "Not set" : String(value));
}

export function formatReportRuntimeRefinement(refinement = {}) {
  const label = normalizeString(refinement?.label);
  if (label) {
    return label;
  }
  const op = normalizeString(refinement?.op);
  const field = normalizeString(refinement?.field);
  const values = formatList(refinement?.values);
  const opLabel = {
    keep: "Keep",
    exclude: "Exclude",
    drill: "Drill",
    detail: "Detail",
  }[op] || op || "Refinement";
  const fieldText = normalizeString(refinement?.fieldLabel) || field || "field";
  return values ? `${opLabel}: ${fieldText} = ${values}` : `${opLabel}: ${fieldText}`;
}

export function resolveReportRuntimeActiveScopeSummary(refinements = []) {
  const items = (Array.isArray(refinements) ? refinements : [])
    .filter((refinement) => refinement && typeof refinement === "object" && !Array.isArray(refinement))
    .map((refinement, index) => ({
      id: normalizeString(refinement?.id) || `refinement:${index}`,
      label: formatReportRuntimeRefinement(refinement),
    }))
    .filter((item) => !!item.label);
  if (items.length === 0) {
    return null;
  }
  return {
    title: "Active Refinements",
    description: "Keep, exclude, and drill actions applied on top of the baseline scope above, for this session only.",
    count: items.length,
    items,
  };
}
