import {
  resolveReportBuilderDynamicFilterFamilies,
  resolveReportBuilderDynamicFilterGroups,
} from "./reportBuilderPredicates.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== undefined && entry !== null && entry !== "");
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

function normalizeSelectionDisplayValue(selection = null) {
  if (selection && typeof selection === "object" && !Array.isArray(selection)) {
    return normalizeString(selection?.label || selection?.name || selection?.value);
  }
  return normalizeString(selection);
}

function uniqueDisplayValues(values = []) {
  const result = [];
  const seen = new Set();
  normalizeArray(values).forEach((value) => {
    const normalized = normalizeSelectionDisplayValue(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

export function isReportBuilderUnifiedFilterSurfaceEnabled(config = {}) {
  return normalizeString(
    config?.reportSurfaceFilterMode
    || config?.result?.reportSurfaceFilterMode
    || "",
  ).toLowerCase() === "unified";
}

export function buildReportBuilderUnifiedFilterCriteria({
  config = {},
  state = {},
} = {}) {
  if (!isReportBuilderUnifiedFilterSurfaceEnabled(config)) {
    return [];
  }
  const dynamicFilterGroups = resolveReportBuilderDynamicFilterGroups(config);
  const dynamicFilterFamilies = resolveReportBuilderDynamicFilterFamilies(config);
  const filterLabelById = new Map();
  const scopedGroupLabelByFilterId = new Map();
  const scopedGroupIdByFilterId = new Map();

  normalizeArray(dynamicFilterGroups).forEach((group) => {
    const groupId = normalizeString(group?.id);
    normalizeArray(group?.filters).forEach((filterDef) => {
      const filterId = normalizeString(filterDef?.id);
      if (!filterId) {
        return;
      }
      if (!filterLabelById.has(filterId)) {
        filterLabelById.set(filterId, normalizeString(filterDef?.label || filterId) || filterId);
      }
      if (groupId && groupId !== "include" && groupId !== "exclude") {
        scopedGroupLabelByFilterId.set(`${groupId}:${filterId}`, normalizeString(group?.label || groupId) || groupId);
        scopedGroupIdByFilterId.set(`${groupId}:${filterId}`, groupId);
      }
    });
  });

  normalizeArray(dynamicFilterFamilies).forEach((family) => {
    const familyLabel = normalizeString(family?.label || family?.id);
    normalizeArray(family?.includeFilterIds).forEach((filterId) => {
      const normalizedFilterId = normalizeString(filterId);
      if (normalizedFilterId) {
        scopedGroupLabelByFilterId.set(`include:${normalizedFilterId}`, familyLabel);
        scopedGroupIdByFilterId.set(`include:${normalizedFilterId}`, normalizeString(family?.id));
      }
    });
    normalizeArray(family?.excludeFilterIds).forEach((filterId) => {
      const normalizedFilterId = normalizeString(filterId);
      if (normalizedFilterId) {
        scopedGroupLabelByFilterId.set(`exclude:${normalizedFilterId}`, familyLabel);
        scopedGroupIdByFilterId.set(`exclude:${normalizedFilterId}`, normalizeString(family?.id));
      }
    });
  });

  const criteria = [];
  normalizeArray(dynamicFilterGroups).forEach((group) => {
    const groupId = normalizeString(group?.id);
    const direction = groupId === "include" || groupId === "exclude" ? groupId : "";
    normalizeArray(state?.dynamicGroups?.[groupId]).forEach((row, index) => {
      const filterId = normalizeString(row?.filterId);
      if (!filterId) {
        return;
      }
      const displayValues = uniqueDisplayValues(row?.selections);
      if (displayValues.length === 0) {
        return;
      }
      const rawValues = normalizeArray(row?.selections)
        .map((selection) => (
          selection && typeof selection === "object" && !Array.isArray(selection)
            ? selection?.value
            : selection
        ))
        .filter((value) => value !== undefined && value !== null && value !== "");
      const filterLabel = filterLabelById.get(filterId) || filterId;
      const groupLabel = scopedGroupLabelByFilterId.get(`${groupId}:${filterId}`) || "";
      const resolvedGroupId = scopedGroupIdByFilterId.get(`${groupId}:${filterId}`) || "";
      const directionLabel = direction === "exclude"
        ? `Exclude ${filterLabel}`
        : direction === "include"
          ? `Include ${filterLabel}`
          : filterLabel;
      criteria.push({
        id: `${groupId || "group"}:${filterId}:${index + 1}`,
        ...(resolvedGroupId ? { groupId: resolvedGroupId } : {}),
        label: [groupLabel, directionLabel].filter(Boolean).join(" · "),
        ...(groupLabel ? { groupLabel } : {}),
        filterLabel,
        ...(direction ? { direction } : {}),
        enabled: row?.enabled !== false,
        rawValues,
        displayValues,
      });
    });
  });
  return criteria;
}

export function buildReportBuilderUnifiedFilterContent({
  config = {},
  state = {},
} = {}) {
  const criteria = buildReportBuilderUnifiedFilterCriteria({ config, state });
  return {
    criteria,
    criteriaCount: criteria.length,
  };
}
