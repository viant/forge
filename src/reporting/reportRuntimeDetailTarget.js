function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function uniqueResolvedValues(values = []) {
  const unique = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    if (value === undefined) {
      return;
    }
    const fingerprint = JSON.stringify(value);
    if (seen.has(fingerprint)) {
      return;
    }
    seen.add(fingerprint);
    unique.push(cloneValue(value));
  });
  return unique;
}

export function resolveReportRuntimeDetailParameterValue(value, {
  row = {},
  runtimeValue,
  selectionRows = [],
} = {}) {
  const normalized = normalizeString(value);
  if (normalized === "$value") {
    return {
      resolved: runtimeValue !== undefined,
      value: runtimeValue,
    };
  }
  const rowMatch = /^\$row\.(.+)$/.exec(normalized);
  if (!rowMatch) {
    return {
      resolved: true,
      value,
    };
  }
  const field = rowMatch[1];
  if (row && Object.prototype.hasOwnProperty.call(row, field) && row[field] !== undefined) {
    return {
      resolved: true,
      value: cloneValue(row[field]),
    };
  }
  const candidateValues = uniqueResolvedValues(
    (Array.isArray(selectionRows) ? selectionRows : []).map((entry) => entry?.[field]),
  );
  if (candidateValues.length === 1) {
    return {
      resolved: true,
      value: candidateValues[0],
    };
  }
  return {
    resolved: false,
    field,
    ambiguous: candidateValues.length > 1,
  };
}

export function resolveReportRuntimeDetailTarget(target = {}, context = {}) {
  const parameters = {};
  const unresolvedParameters = [];
  Object.entries(target?.parameters || {}).forEach(([key, value]) => {
    const resolved = resolveReportRuntimeDetailParameterValue(value, context);
    if (!resolved.resolved) {
      unresolvedParameters.push({
        parameter: key,
        ...(resolved.field ? { field: resolved.field } : {}),
        ...(resolved.ambiguous ? { ambiguous: true } : {}),
      });
      return;
    }
    parameters[key] = resolved.value;
  });
  return {
    targetRef: target?.targetRef,
    navigationMode: target?.navigationMode,
    parameters,
    unresolvedParameters,
  };
}
