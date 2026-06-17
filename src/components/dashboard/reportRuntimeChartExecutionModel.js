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

export function buildReportRuntimeChartActionExecutions({
  blockId = "",
  descriptors = [],
  fields = [],
  selection = null,
} = {}) {
  const normalizedBlockId = normalizeString(blockId);
  const selectionRow = selection?.row && typeof selection.row === "object"
    ? cloneValue(selection.row)
    : {};
  const selectionRows = Array.isArray(selection?.selectionRows)
    ? selection.selectionRows.map((entry) => cloneValue(entry))
    : [];

  return (Array.isArray(descriptors) ? descriptors : []).flatMap((descriptor) => {
    const field = (Array.isArray(fields) ? fields : []).find((entry) => normalizeString(entry?.valueKey) === normalizeString(descriptor?.fieldValueKey));
    if (!field) {
      return [];
    }
    if (descriptor.kind === "keep" || descriptor.kind === "exclude") {
      return [{
        id: descriptor.id,
        label: descriptor.label,
        kind: descriptor.kind,
        refinement: {
          op: descriptor.kind,
          field: descriptor.fieldValueKey,
          value: descriptor.value,
          sourceBlockId: normalizedBlockId,
          fieldLabel: field?.label,
          label: `${descriptor.label} = ${formatExecutionValue(descriptor.displayValue ?? descriptor.value)}`,
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
          value: descriptor.value,
          sourceBlockId: normalizedBlockId,
          fieldLabel: field?.label,
          label: `${descriptor.label} = ${formatExecutionValue(descriptor.displayValue ?? descriptor.value)}`,
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
          item: {
            ...selectionRow,
            selectionRows,
          },
          value: descriptor.value,
          field,
          sourceBlockId: normalizedBlockId,
        },
      }];
    }
    return [];
  });
}
