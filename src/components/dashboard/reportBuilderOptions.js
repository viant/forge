function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function isEntityOptionName(name = "") {
  const normalized = normalizeString(name).replace(/[^a-zA-Z0-9]/g, "");
  return /^(account|agency|advertiser|campaign|order|line(item)?|audience|creative|pixel)(id|ids)?$/i.test(normalized);
}

function normalizedType(value = "") {
  const type = normalizeString(value).toLowerCase();
  if (["bool", "boolean"].includes(type)) return "boolean";
  if (["int", "integer"].includes(type)) return "integer";
  if (["number", "float", "double"].includes(type)) return "number";
  return "string";
}

function coerceValue(value, type) {
  if (type === "boolean") {
    if (value === true || value === false) return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
    return undefined;
  }
  if (type === "integer") {
    const numeric = Number(value);
    return Number.isInteger(numeric) ? numeric : undefined;
  }
  if (type === "number") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function valueKey(value) {
  return `${typeof value}:${JSON.stringify(value)}`;
}

function normalizeValueEntry(entry, type) {
  const rawValue = entry && typeof entry === "object" && !Array.isArray(entry)
    ? entry.value
    : entry;
  const value = coerceValue(rawValue, type);
  if (value === undefined) return null;
  const label = entry && typeof entry === "object" && !Array.isArray(entry)
    ? normalizeString(entry.label)
    : "";
  return {
    value,
    label: label || String(value),
  };
}

export function normalizeReportBuilderOptionDefinitions(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const name = normalizeString(entry.name);
      if (!name || seen.has(name) || isEntityOptionName(name)) return null;
      seen.add(name);
      const type = normalizedType(entry.type);
      const optionValues = (Array.isArray(entry.values) ? entry.values : [])
        .map((value) => normalizeValueEntry(value, type))
        .filter(Boolean);
      const allowedKeys = new Set(optionValues.map((value) => valueKey(value.value)));
      const coercedDefault = coerceValue(entry.default, type);
      const defaultValue = coercedDefault !== undefined
        && (allowedKeys.size === 0 || allowedKeys.has(valueKey(coercedDefault)))
        ? coercedDefault
        : undefined;
      return {
        name,
        label: normalizeString(entry.label) || name,
        type,
        description: normalizeString(entry.description),
        values: optionValues,
        ...(defaultValue !== undefined ? { default: defaultValue } : {}),
      };
    })
    .filter(Boolean);
}

export function resolveEffectiveReportBuilderOptions(definitions = [], selected = {}) {
  const source = selected && typeof selected === "object" && !Array.isArray(selected) ? selected : {};
  return normalizeReportBuilderOptionDefinitions(definitions).reduce((result, definition) => {
    const allowed = new Set(definition.values.map((entry) => valueKey(entry.value)));
    const selectedValue = coerceValue(source[definition.name], definition.type);
    const selectedValid = selectedValue !== undefined
      && (allowed.size === 0 || allowed.has(valueKey(selectedValue)));
    if (selectedValid) {
      result[definition.name] = selectedValue;
    } else if (Object.prototype.hasOwnProperty.call(definition, "default")) {
      result[definition.name] = cloneValue(definition.default);
    }
    return result;
  }, {});
}

export function updateReportBuilderOptionValue(definitions = [], selected = {}, name = "", value) {
  const target = normalizeString(name);
  const definition = normalizeReportBuilderOptionDefinitions(definitions)
    .find((entry) => entry.name === target);
  if (!definition) return resolveEffectiveReportBuilderOptions(definitions, selected);
  return resolveEffectiveReportBuilderOptions(definitions, {
    ...resolveEffectiveReportBuilderOptions(definitions, selected),
    [target]: value,
  });
}

export function countModifiedReportBuilderOptions(definitions = [], selected = {}) {
  const normalizedDefinitions = normalizeReportBuilderOptionDefinitions(definitions);
  const effective = resolveEffectiveReportBuilderOptions(normalizedDefinitions, selected);
  return normalizedDefinitions.filter((definition) => (
    JSON.stringify(effective[definition.name]) !== JSON.stringify(definition.default)
  )).length;
}

export function buildReportBuilderFilterToolbarModel({
  allowedFilterCount = 0,
  optionDefinitions = [],
  optionValues = {},
  modifiedFilterCount = 0,
} = {}) {
  const normalizedDefinitions = normalizeReportBuilderOptionDefinitions(optionDefinitions);
  return {
    visible: Math.max(0, Number(allowedFilterCount) || 0) > 0 || normalizedDefinitions.length > 0,
    activeNonDefaultCount: Math.max(0, Number(modifiedFilterCount) || 0)
      + countModifiedReportBuilderOptions(normalizedDefinitions, optionValues),
  };
}

export function isDemandSideReportOptionName(name = "") {
  return isEntityOptionName(name);
}
