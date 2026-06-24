import {
  collectPreviewSemanticEntityParameters,
} from "./previewSemanticEntityFields.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDateValue(value = "") {
  return normalizeString(value);
}

function normalizeOptionValues(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((option) => normalizeString(option?.value))
    .filter(Boolean);
}

function resolveSemanticEntity(model = null, entityId = "") {
  const entities = Array.isArray(model?.entities) ? model.entities : [];
  return entities.find((entity) => normalizeString(entity?.id) === normalizeString(entityId)) || null;
}

function buildSemanticParameterRuleIndex(staticFilters = []) {
  const rules = new Map();
  (Array.isArray(staticFilters) ? staticFilters : []).forEach((filter) => {
    const semanticRef = normalizeString(filter?.semanticRef);
    if (!semanticRef || rules.has(semanticRef)) {
      return;
    }
    const rawId = normalizeString(filter?.id || filter?.field);
    rules.set(semanticRef, {
      semanticRef,
      rawId,
      label: normalizeString(filter?.label || rawId || semanticRef),
      type: normalizeString(filter?.type),
      multiple: filter?.multiple === true,
      allowedValues: normalizeOptionValues(filter?.options),
    });
  });
  return rules;
}

function normalizeParameterPayload(parameters = null) {
  if (!isPlainObject(parameters)) {
    return {};
  }
  return cloneValue(parameters);
}

function buildParameterPath(parameterId = "") {
  return `selection.parameters.${normalizeString(parameterId)}`;
}

function buildParameterDiagnostic({
  code = "",
  severity = "error",
  parameterId = "",
  message = "",
  suggestedFix = "",
} = {}) {
  const normalizedParameterId = normalizeString(parameterId);
  const normalizedMessage = normalizeString(message);
  if (!normalizedParameterId || !normalizedMessage) {
    return null;
  }
  return {
    ...(normalizeString(code) ? { code: normalizeString(code) } : {}),
    severity: normalizeString(severity || "error").toLowerCase() || "error",
    path: buildParameterPath(normalizedParameterId),
    message: normalizedMessage,
    ...(normalizeString(suggestedFix) ? { suggestedFix: normalizeString(suggestedFix) } : {}),
  };
}

export function validatePreviewSemanticSelectionParameters({
  model = null,
  entityId = "",
  parameters = null,
  staticFilters = [],
} = {}) {
  const normalizedParameters = normalizeParameterPayload(parameters);
  const entity = resolveSemanticEntity(model, entityId);
  if (!entity) {
    return {
      parameters: normalizedParameters,
      diagnostics: [],
    };
  }
  const parameterDefinitions = new Map(
    collectPreviewSemanticEntityParameters(entity)
      .map((parameter) => [normalizeString(parameter?.id || parameter?.key), parameter])
      .filter(([id]) => !!id),
  );
  const rules = buildSemanticParameterRuleIndex(staticFilters);
  const diagnostics = [];

  Object.keys(normalizedParameters).forEach((parameterId) => {
    const normalizedParameterId = normalizeString(parameterId);
    if (!normalizedParameterId) {
      return;
    }
    const definition = parameterDefinitions.get(normalizedParameterId);
    const rule = rules.get(normalizedParameterId);
    const label = normalizeString(rule?.label || definition?.label || normalizedParameterId);
    const value = normalizedParameters[normalizedParameterId];

    if (!definition) {
      diagnostics.push(buildParameterDiagnostic({
        code: "unknownParameter",
        parameterId: normalizedParameterId,
        message: `${label} is not available in the current semantic entity.`,
        suggestedFix: "Remove the unsupported semantic scope parameter or choose a supported filter.",
      }));
      return;
    }

    if (normalizeString(rule?.type).toLowerCase() === "daterange") {
      const start = normalizeDateValue(value?.start);
      const end = normalizeDateValue(value?.end);
      if ((start && !end) || (!start && end)) {
        diagnostics.push(buildParameterDiagnostic({
          code: "incompleteParameter",
          parameterId: normalizedParameterId,
          message: `${label} requires both start and end dates.`,
          suggestedFix: "Provide both start and end dates to continue.",
        }));
        return;
      }
      if (start && end && start > end) {
        diagnostics.push(buildParameterDiagnostic({
          code: "invalidParameterRange",
          parameterId: normalizedParameterId,
          message: `${label} start date must be on or before the end date.`,
          suggestedFix: "Adjust the date range so the start date is not after the end date.",
        }));
        return;
      }
    }

    const allowedValues = Array.isArray(rule?.allowedValues) ? rule.allowedValues : [];
    if (allowedValues.length === 0) {
      return;
    }
    const allowedValueSet = new Set(allowedValues);
    const currentValues = rule?.multiple
      ? (Array.isArray(value) ? value.map((entry) => normalizeString(entry)).filter(Boolean) : [])
      : [normalizeString(value)].filter(Boolean);
    const unsupportedValues = currentValues.filter((entry) => !allowedValueSet.has(entry));
    if (unsupportedValues.length === 0) {
      return;
    }
    diagnostics.push(buildParameterDiagnostic({
      code: "unsupportedParameterValue",
      parameterId: normalizedParameterId,
      message: `${label} contains unsupported values: ${unsupportedValues.join(", ")}.`,
      suggestedFix: "Choose one of the configured semantic scope values before running the report.",
    }));
  });

  return {
    parameters: normalizedParameters,
    diagnostics: diagnostics.filter(Boolean),
  };
}
