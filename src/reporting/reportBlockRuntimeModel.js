import { resolveKey } from "../utils/selector.js";
import {
  applyDashboardFiltersToCollection,
  applyDashboardSelectionToCollection,
  evaluateDashboardCondition,
} from "../components/dashboard/dashboardUtils.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function normalizeReportRuntimeCondition(condition = null) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return null;
  }
  const normalized = cloneValue(condition);
  const selector = normalizeString(normalized?.selector || normalized?.field || normalized?.key);
  if (selector.startsWith("dashboard.selection.")) {
    normalized.source = "selection";
    normalized.selector = selector.slice("dashboard.selection.".length);
  } else if (selector === "dashboard.selection") {
    normalized.source = "selection";
    normalized.selector = "";
  } else if (selector.startsWith("dashboard.filters.")) {
    normalized.source = "filters";
    normalized.selector = selector.slice("dashboard.filters.".length);
  } else if (selector.startsWith("filters.")) {
    normalized.source = "filters";
    normalized.selector = selector.slice("filters.".length);
  }
  return normalized;
}

export function resolveReportRuntimeFilterValues(scopeParams = []) {
  const entries = scopeParams instanceof Map
    ? Array.from(scopeParams.entries()).map(([id, entry]) => ({ id, ...(entry || {}) }))
    : (Array.isArray(scopeParams) ? scopeParams : []);
  return entries.reduce((result, entry) => {
    const id = normalizeString(entry?.id || entry?.field);
    if (id) {
      result[id] = cloneValue(entry?.value);
    }
    return result;
  }, {});
}

export function resolveReportRuntimeBlockRows(block = {}, rows = [], {
  filters = {},
  selection = {},
} = {}) {
  const runtime = block?.runtime && typeof block.runtime === "object" && !Array.isArray(block.runtime)
    ? block.runtime
    : {};
  const filtered = applyDashboardFiltersToCollection(rows, runtime?.filterBindings, filters);
  return applyDashboardSelectionToCollection(filtered, runtime?.selectionBindings, selection);
}

export function isReportRuntimeBlockVisible(block = {}, {
  metrics = {},
  filters = {},
  selection = {},
} = {}) {
  const condition = normalizeReportRuntimeCondition(block?.runtime?.visibleWhen);
  if (!condition) {
    return true;
  }
  return evaluateDashboardCondition(condition, {
    metrics,
    dashboardFilters: filters,
    dashboardSelection: selection,
  });
}

export function resolveReportRuntimeSelectionActions(block = {}, event = "onSelect") {
  const normalizedEvent = normalizeString(event || "onSelect") || "onSelect";
  return (Array.isArray(block?.runtime?.actions) ? block.runtime.actions : [])
    .filter((action) => normalizeString(action?.kind).toLowerCase() === "select")
    .filter((action) => normalizeString(action?.event || "onSelect") === normalizedEvent)
    .map((action) => cloneValue(action));
}

export function resolveReportRuntimeHostActions(block = {}, event = "onSelect") {
  const normalizedEvent = normalizeString(event || "onSelect") || "onSelect";
  return (Array.isArray(block?.runtime?.actions) ? block.runtime.actions : [])
    .filter((action) => normalizeString(action?.kind).toLowerCase() === "host")
    .filter((action) => normalizeString(action?.event || "onSelect") === normalizedEvent)
    .map((action) => cloneValue(action));
}

export function buildReportRuntimeHostExecution(action = {}, item = null, sourceBlockId = "") {
  return {
    id: normalizeString(action?.id || action?.handler || "hostAction"),
    kind: "host",
    label: normalizeString(action?.label || action?.handler || "Action"),
    handler: normalizeString(action?.handler),
    arguments: cloneValue(action?.arguments || action?.args || {}),
    item: cloneValue(item),
    sourceBlockId: normalizeString(sourceBlockId) || null,
  };
}

export function buildReportRuntimeSelection(action = {}, item = null, sourceBlockId = "") {
  const row = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const dimension = normalizeString(action?.dimension || action?.field);
  const entityKey = dimension ? resolveKey(row, dimension) : null;
  return {
    dimension: dimension || null,
    entityKey: entityKey ?? null,
    selected: cloneValue(row),
    sourceBlockId: normalizeString(sourceBlockId) || null,
  };
}
