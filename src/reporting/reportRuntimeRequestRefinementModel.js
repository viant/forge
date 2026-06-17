function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function setNestedValue(target, path, value) {
  const parts = normalizeString(path).split(".").map((entry) => entry.trim()).filter(Boolean);
  if (parts.length === 0) {
    return target;
  }
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
  return target;
}

function getNestedValue(target, path) {
  const parts = normalizeString(path).split(".").map((entry) => entry.trim()).filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  let current = target;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function normalizeRuntimeRefinementValues(refinement = {}) {
  const values = Array.isArray(refinement?.values) ? refinement.values : [];
  return values.filter((value) => value !== undefined && value !== null && value !== "");
}

import {
  hasRuntimeFilterBinding,
  resolveRuntimeFilterBinding,
} from "./runtimeFilterBindingModel.js";

export function resolveRuntimeFilterConfig(config = {}, fieldRef = "") {
  return resolveRuntimeFilterBinding(config, fieldRef);
}

export function hasRuntimeRequestRefinementFilter(config = {}, fieldRef = "") {
  return hasRuntimeFilterBinding(config, fieldRef);
}

function formatRuntimeFilterValues(runtimeFilter = {}, refinement = {}, refinements = []) {
  const rawValues = normalizeRuntimeRefinementValues(refinement);
  if (rawValues.length === 0) {
    return [];
  }
  const format = normalizeString(runtimeFilter?.format).toLowerCase();
  if (format !== "locationtuple") {
    return rawValues.map((value) => cloneValue(value));
  }
  const parentField = normalizeString(runtimeFilter?.parentField);
  const parentRefinement = refinements.find((entry) => normalizeString(entry?.field) === parentField);
  const parentValue = normalizeRuntimeRefinementValues(parentRefinement)[0];
  if (!parentValue) {
    return [];
  }
  return rawValues
    .map((value) => `${normalizeString(parentValue)}/${normalizeString(value)}`)
    .filter(Boolean);
}

function mergeUniqueValues(existingValue, nextValues = []) {
  const existing = Array.isArray(existingValue)
    ? existingValue
    : (existingValue !== undefined && existingValue !== null && existingValue !== "" ? [existingValue] : []);
  const seen = new Set();
  const merged = [];
  [...existing, ...(Array.isArray(nextValues) ? nextValues : [])].forEach((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(cloneValue(value));
  });
  return merged;
}

export function applyRuntimeRequestRefinementFilters(request = {}, config = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return request;
  }
  const refinements = Array.isArray(request?.refinements)
    ? request.refinements.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    : [];
  if (refinements.length === 0) {
    return cloneValue(request);
  }
  const nextRequest = cloneValue(request);
  const nextFilters = nextRequest.filters && typeof nextRequest.filters === "object" && !Array.isArray(nextRequest.filters)
    ? { ...nextRequest.filters }
    : {};

  refinements.forEach((refinement) => {
    const op = normalizeString(refinement?.op).toLowerCase();
    if (!["keep", "exclude", "drill"].includes(op)) {
      return;
    }
    const runtimeFilter = resolveRuntimeFilterConfig(config, refinement?.field);
    if (!runtimeFilter) {
      return;
    }
    const targetPath = normalizeString(
      op === "exclude"
        ? runtimeFilter.excludePath
        : runtimeFilter.includePath,
    );
    if (!targetPath) {
      return;
    }
    const mappedValues = formatRuntimeFilterValues(runtimeFilter, refinement, refinements);
    if (mappedValues.length === 0) {
      return;
    }
    const existing = getNestedValue(nextFilters, targetPath);
    setNestedValue(nextFilters, targetPath, mergeUniqueValues(existing, mappedValues));
  });

  nextRequest.filters = nextFilters;
  return nextRequest;
}
