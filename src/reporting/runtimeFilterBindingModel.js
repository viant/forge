function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeArray(values = []) {
  if (Array.isArray(values)) {
    return values.filter((entry) => entry !== undefined && entry !== null && entry !== "");
  }
  return values !== undefined && values !== null && values !== "" ? [values] : [];
}

export function normalizeRuntimeFilterPath(path = "") {
  const normalizedPath = normalizeString(path);
  return normalizedPath.startsWith("filters.")
    ? normalizedPath.slice("filters.".length)
    : normalizedPath;
}

export function normalizeRuntimeFilterBinding(dimension = {}) {
  const runtimeFilter = dimension?.runtimeFilter;
  if (!runtimeFilter || typeof runtimeFilter !== "object" || Array.isArray(runtimeFilter)) {
    return null;
  }
  const fieldKey = normalizeString(dimension?.key || dimension?.id);
  if (!fieldKey) {
    return null;
  }
  const includePath = normalizeRuntimeFilterPath(runtimeFilter.includeParamPath || runtimeFilter.paramPath);
  const excludePath = normalizeRuntimeFilterPath(runtimeFilter.excludeParamPath);
  return {
    fieldKey,
    includePath,
    excludePath,
    format: normalizeString(runtimeFilter.format).toLowerCase(),
    parentField: normalizeString(runtimeFilter.parentField),
  };
}

export function listRuntimeFilterBindings(config = {}) {
  return (Array.isArray(config?.dimensions) ? config.dimensions : [])
    .map((dimension) => normalizeRuntimeFilterBinding(dimension))
    .filter(Boolean);
}

export function resolveRuntimeFilterBinding(config = {}, fieldRef = "") {
  const normalizedFieldRef = normalizeString(fieldRef);
  if (!normalizedFieldRef) {
    return null;
  }
  return listRuntimeFilterBindings(config).find((binding) => binding.fieldKey === normalizedFieldRef) || null;
}

export function hasRuntimeFilterBinding(config = {}, fieldRef = "") {
  return !!resolveRuntimeFilterBinding(config, fieldRef);
}

export function matchesRuntimeFilterBindingValue(row = {}, binding = {}, selectedValue = "") {
  const normalizedSelectedValue = normalizeString(selectedValue);
  if (!normalizedSelectedValue) {
    return true;
  }
  if (binding?.format === "locationtuple") {
    const parentValue = normalizeString(row?.[binding.parentField]);
    const childValue = normalizeString(row?.[binding.fieldKey]);
    return `${parentValue}/${childValue}` === normalizedSelectedValue;
  }
  return normalizeString(row?.[binding?.fieldKey]) === normalizedSelectedValue;
}

export function matchesRuntimeFilterBindingSelection(row = {}, binding = {}, selectedValues = []) {
  const normalizedValues = normalizeArray(selectedValues);
  if (normalizedValues.length === 0) {
    return true;
  }
  return normalizedValues.some((value) => matchesRuntimeFilterBindingValue(row, binding, value));
}
