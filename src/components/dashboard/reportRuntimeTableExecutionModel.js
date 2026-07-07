import { resolveKey } from "../../utils/selector.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function formatExecutionValue(value) {
  const normalized = normalizeString(value);
  return normalized || String(value ?? "");
}

function formatDrillExecutionLabel(field = {}, descriptor = {}, displayValue = undefined) {
  const sourceLabel = normalizeString(field?.label || descriptor?.fieldValueKey || "Selection");
  const valueLabel = formatExecutionValue(displayValue);
  return `${sourceLabel} = ${valueLabel}`;
}

function resolveDisplayValueMapValue(field = {}, value = undefined) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const displayValueMap = field?.displayValueMap && typeof field.displayValueMap === "object" && !Array.isArray(field.displayValueMap)
    ? field.displayValueMap
    : null;
  if (!displayValueMap) {
    return undefined;
  }
  const key = String(value);
  return Object.prototype.hasOwnProperty.call(displayValueMap, key)
    ? displayValueMap[key]
    : undefined;
}

function resolveTableExecutionValues(field = {}, item = {}) {
  const value = resolveKey(item, field?.valueKey);
  const displayValueKey = normalizeString(field?.displayValueKey || field?.valueKey);
  const valueKey = normalizeString(field?.valueKey);
  const displayValue = displayValueKey && displayValueKey !== valueKey
    ? resolveKey(item, displayValueKey)
    : undefined;
  const mappedDisplayValue = resolveDisplayValueMapValue(field, value);
  return {
    value,
    displayValue: displayValue !== undefined && displayValue !== null && displayValue !== ""
      ? displayValue
      : (mappedDisplayValue !== undefined && mappedDisplayValue !== null && mappedDisplayValue !== ""
          ? mappedDisplayValue
          : value),
  };
}

export function buildReportRuntimeTableActionExecutions({
  blockId = "",
  descriptors = [],
  field = {},
  item = {},
} = {}) {
  const { value, displayValue } = resolveTableExecutionValues(field, item);
  if (value === undefined || value === null || value === "") {
    return [];
  }
  const normalizedBlockId = normalizeString(blockId);
  return (Array.isArray(descriptors) ? descriptors : []).flatMap((descriptor) => {
    if (descriptor.kind === "keep" || descriptor.kind === "exclude") {
      return [{
        id: descriptor.id,
        label: descriptor.label,
        kind: descriptor.kind,
        refinement: {
          op: descriptor.kind,
          field: descriptor.fieldValueKey,
          value,
          sourceBlockId: normalizedBlockId,
          fieldLabel: field?.label,
          label: `${descriptor.label} = ${formatExecutionValue(displayValue)}`,
        },
      }];
    }
    if (descriptor.kind === "drill") {
      return [{
        id: descriptor.id,
        label: descriptor.label,
        kind: "drill",
        transition: {
          sourceField: descriptor.fieldValueKey,
          nextFieldRef: descriptor.nextFieldRef,
          sourceBlockId: normalizedBlockId,
        },
        refinement: {
          op: "drill",
          field: descriptor.fieldValueKey,
          value,
          sourceBlockId: normalizedBlockId,
          fieldLabel: field?.label,
          label: formatDrillExecutionLabel(field, descriptor, displayValue),
        },
      }];
    }
    if (descriptor.kind === "detail") {
      return [{
        id: descriptor.id,
        label: descriptor.label,
        kind: "detail",
        detailRequest: {
          action: {
            id: descriptor.id,
            kind: "detail",
            label: descriptor.label,
            targetRef: descriptor.targetRef,
          },
          item: cloneValue(item),
          value,
          field,
          sourceBlockId: normalizedBlockId,
        },
      }];
    }
    return [];
  });
}
