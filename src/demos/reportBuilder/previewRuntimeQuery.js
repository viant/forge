import { applyPreviewRequestRefinements } from "./previewRuntimeRefinements.js";
import {
  listRuntimeFilterBindings,
  matchesRuntimeFilterBindingSelection,
} from "../../reporting/runtimeFilterBindingModel.js";

const FILTER_FIELD_ALIASES = {
  channelsFilter: 'channelsFilter',
  scopeFilter: 'scopeFilter',
  inventoryFilter: 'inventoryFilter',
  targetingFilter: 'targetingFilter',
  publisherFilter: 'publisherFilter',
  advertiserFilter: 'advertiserFilter',
  campaignFilter: 'campaignFilter',
  deviceFilter: 'deviceFilter',
};

function normalizeArray(values = []) {
  if (Array.isArray(values)) {
    return values.filter((entry) => entry !== undefined && entry !== null && entry !== "");
  }
  return values !== undefined && values !== null && values !== "" ? [values] : [];
}

export function applyPreviewRequestFilters(rows, request = {}, config = {}) {
  const filters = request?.filters || {};
  const from = String(filters?.from || '').trim();
  const to = String(filters?.to || '').trim();
  const runtimeFilterBindings = listRuntimeFilterBindings(config);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (from && String(row?.eventDate || '').trim() < from) {
      return false;
    }
    if (to && String(row?.eventDate || '').trim() > to) {
      return false;
    }
    return Object.entries(FILTER_FIELD_ALIASES).every(([filterId, fieldName]) => {
      const selected = filters?.[filterId];
      if (selected === undefined || selected === null || selected === '' || (Array.isArray(selected) && selected.length === 0)) {
        return true;
      }
      const allowed = Array.isArray(selected) ? selected : [selected];
      return allowed.map((entry) => String(entry || '').trim()).includes(String(row?.[fieldName] || '').trim());
    }) && runtimeFilterBindings.every((binding) => {
      const includeSelected = normalizeArray(filters?.[binding.includePath]);
      if (includeSelected.length > 0 && !matchesRuntimeFilterBindingSelection(row, binding, includeSelected)) {
        return false;
      }
      const excludeSelected = normalizeArray(filters?.[binding.excludePath]);
      if (excludeSelected.length > 0 && matchesRuntimeFilterBindingSelection(row, binding, excludeSelected)) {
        return false;
      }
      return true;
    });
  });
}

export function runPreviewRuntimeRequest(rows, request = {}, config = {}) {
  const filteredRows = applyPreviewRequestRefinements(applyPreviewRequestFilters(rows, request, config), request);
  const dimensions = Object.entries(request.dimensions || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const measures = Object.entries(request.measures || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const grouped = new Map();

  filteredRows.forEach((row) => {
    const bucket = JSON.stringify(dimensions.map((key) => row[key]));
    const existing = grouped.get(bucket) || {};
    dimensions.forEach((key) => {
      existing[key] = row[key];
    });
    measures.forEach((key) => {
      existing[key] = Number(existing[key] || 0) + Number(row[key] || 0);
    });
    grouped.set(bucket, existing);
  });

  const aggregated = Array.from(grouped.values());
  const [orderField = 'eventDate', orderDir = 'asc'] = String((request.orderBy || [])[0] || 'eventDate asc').split(/\s+/);
  aggregated.sort((left, right) => {
    const leftValue = left?.[orderField];
    const rightValue = right?.[orderField];
    if (leftValue === rightValue) return 0;
    const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
    return String(orderDir || 'asc').toLowerCase() === 'desc' ? -comparison : comparison;
  });

  const offset = Math.max(0, Number(request.offset || 0) || 0);
  const limit = Math.max(1, Number(request.limit || aggregated.length) || aggregated.length);
  return {
    rows: aggregated.slice(offset, offset + limit),
    hasMore: offset + limit < aggregated.length,
  };
}
