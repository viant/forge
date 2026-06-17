import { resolveKey } from "../../utils/selector.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function supportsRuntimeRefinement(field = {}) {
  return field?.runtimeFilterable === true;
}

function resolveRuntimeFieldActionKey(blockId = "", valueKey = "") {
  return `${normalizeString(blockId)}:${normalizeString(valueKey)}`;
}

function hasPresentValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveUniqueSelectionFieldValue(rows = [], selector = "") {
  const normalizedSelector = normalizeString(selector);
  if (!normalizedSelector) {
    return undefined;
  }
  const seen = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = resolveKey(row, normalizedSelector);
    if (!hasPresentValue(value)) {
      return;
    }
    const key = JSON.stringify(cloneValue(value));
    if (!seen.has(key)) {
      seen.set(key, cloneValue(value));
    }
  });
  return seen.size === 1 ? Array.from(seen.values())[0] : undefined;
}

function resolveChartFieldSelectionValues(field = {}, selection = null) {
  const row = selection?.row && typeof selection.row === "object" ? selection.row : null;
  const selectionRows = Array.isArray(selection?.selectionRows) ? selection.selectionRows : [];
  const sourceFallback = field?.selectionSource === "seriesKey"
    ? selection?.seriesKey
    : selection?.xValue;
  const rowValue = row ? resolveKey(row, field?.valueKey) : undefined;
  const rawValue = hasPresentValue(rowValue)
    ? rowValue
    : (hasPresentValue(resolveUniqueSelectionFieldValue(selectionRows, field?.valueKey))
        ? resolveUniqueSelectionFieldValue(selectionRows, field?.valueKey)
        : sourceFallback);
  const rowDisplayValue = row ? resolveKey(row, field?.displayValueKey || field?.valueKey) : undefined;
  const selectionDisplayValue = resolveUniqueSelectionFieldValue(selectionRows, field?.displayValueKey || field?.valueKey);
  const displayValue = hasPresentValue(rowDisplayValue)
    ? rowDisplayValue
    : (hasPresentValue(selectionDisplayValue) ? selectionDisplayValue : sourceFallback);
  return {
    value: rawValue,
    displayValue: hasPresentValue(displayValue) ? displayValue : rawValue,
  };
}

export function formatRefinementActionLabel(actionKind = "", fieldLabel = "") {
  const normalizedKind = normalizeString(actionKind).toLowerCase();
  const normalizedLabel = normalizeString(fieldLabel || "Field");
  if (normalizedKind === "keep") {
    return `Keep ${normalizedLabel}`;
  }
  if (normalizedKind === "exclude") {
    return `Exclude ${normalizedLabel}`;
  }
  if (normalizedKind === "drill") {
    return `Drill ${normalizedLabel}`;
  }
  if (normalizedKind === "detail") {
    return `Detail ${normalizedLabel}`;
  }
  return `${normalizedKind || "Action"} ${normalizedLabel}`.trim();
}

export function resolveReportRuntimeChartSelectionSummary({
  blockTitle = "",
  selection = null,
} = {}) {
  const xValue = selection?.displayXValue ?? selection?.xValue;
  const seriesKey = normalizeString(selection?.displaySeriesKey ?? selection?.seriesKey);
  if (selection?.source === "pie" && xValue !== undefined && xValue !== null && xValue !== "") {
    return String(xValue);
  }
  if (seriesKey && xValue !== undefined && xValue !== null && xValue !== "") {
    return `${String(xValue)} • ${seriesKey}`;
  }
  if (seriesKey) {
    return seriesKey;
  }
  if (xValue !== undefined && xValue !== null && xValue !== "") {
    return String(xValue);
  }
  return normalizeString(blockTitle || "Selected chart value");
}

export function buildReportRuntimeChartActionDescriptors({
  blockId = "",
  fields = [],
  selection = null,
  providerActionsByField = new Map(),
} = {}) {
  return (Array.isArray(fields) ? fields : []).flatMap((field) => {
    const { value, displayValue } = resolveChartFieldSelectionValues(field, selection);
    if (value === undefined || value === null || value === "") {
      return [];
    }
    const key = resolveRuntimeFieldActionKey(blockId, field?.valueKey);
    const providerActions = Array.isArray(providerActionsByField.get(key))
      ? providerActionsByField.get(key)
      : [];
    const hasProviderActionConfig = providerActionsByField.has(key);
    const actionsByKind = providerActions.reduce((acc, action) => {
      const kind = normalizeString(action?.kind).toLowerCase();
      if (!kind) {
        return acc;
      }
      const current = acc.get(kind) || [];
      current.push(action);
      acc.set(kind, current);
      return acc;
    }, new Map());
    const descriptors = [];
    const keepExcludeKinds = hasProviderActionConfig
      ? ["keep", "exclude"].filter((kindName) => actionsByKind.has(kindName) && supportsRuntimeRefinement(field))
      : (supportsRuntimeRefinement(field) ? ["keep", "exclude"] : []);
    keepExcludeKinds.forEach((kindName) => {
    const kindActions = actionsByKind.get(kindName) || [null];
    kindActions.forEach((metadataAction, index) => {
        descriptors.push({
          id: kindActions.length > 1
            ? `${kindName}:${normalizeString(blockId)}:${normalizeString(field?.valueKey)}:${index}`
            : `${kindName}:${normalizeString(blockId)}:${normalizeString(field?.valueKey)}`,
          kind: kindName,
          fieldValueKey: normalizeString(field?.valueKey),
          label: normalizeString(metadataAction?.label || formatRefinementActionLabel(kindName, field?.label)),
          value,
          displayValue,
        });
      });
    });
    (actionsByKind.get("drill") || []).forEach((drillAction) => {
      if (!supportsRuntimeRefinement(field) || !normalizeString(drillAction?.nextFieldRef)) {
        return;
      }
      descriptors.push({
        id: drillAction.id || `drill:${normalizeString(blockId)}:${normalizeString(field?.valueKey)}`,
        kind: "drill",
        fieldValueKey: normalizeString(field?.valueKey),
        label: normalizeString(drillAction.label || formatRefinementActionLabel("drill", field?.label)),
        value,
        displayValue,
        nextFieldRef: normalizeString(drillAction.nextFieldRef),
      });
    });
    (actionsByKind.get("detail") || []).forEach((detailAction) => {
      if (!normalizeString(detailAction?.targetRef)) {
        return;
      }
      descriptors.push({
        id: detailAction.id || `detail:${normalizeString(blockId)}:${normalizeString(field?.valueKey)}`,
        kind: "detail",
        fieldValueKey: normalizeString(field?.valueKey),
        label: normalizeString(detailAction.label || formatRefinementActionLabel("detail", field?.label)),
        value,
        displayValue,
        targetRef: normalizeString(detailAction.targetRef),
      });
    });
    return descriptors;
  });
}
