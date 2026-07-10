function normalizeString(value = "") {
  return String(value || "").trim();
}

function hasMeaningfulScopeParamValue(value = null) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    const start = normalizeString(value?.start);
    const end = normalizeString(value?.end);
    if (Object.prototype.hasOwnProperty.call(value, "start") || Object.prototype.hasOwnProperty.call(value, "end")) {
      return !!(start || end);
    }
    return keys.length > 0;
  }
  if (typeof value === "string") {
    return normalizeString(value).length > 0;
  }
  return value != null;
}

function normalizeParamIds(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

export function normalizeReportScopeContextPreset(value = null, {
  availableParamIds = null,
} = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const id = normalizeString(value?.id);
  if (!id) {
    return null;
  }
  const restrictToAvailableParamIds = availableParamIds != null;
  const allowedParamIds = new Set(normalizeParamIds(availableParamIds));
  const paramIds = normalizeParamIds(value?.paramIds).filter((paramId) => (
    !restrictToAvailableParamIds || allowedParamIds.has(paramId)
  ));
  if (paramIds.length === 0) {
    return null;
  }
  return {
    id,
    paramIds,
  };
}

export function resolveReportScopeContextPresetFromState(state = {}, scopeParams = []) {
  const availableParamIds = listMeaningfulReportScopeParamIds(scopeParams);
  return normalizeReportScopeContextPreset(state?.contextPreset, {
    availableParamIds,
  });
}

export function listMeaningfulReportScopeParamIds(scopeParams = []) {
  return (Array.isArray(scopeParams) ? scopeParams : [])
    .filter((param) => hasMeaningfulScopeParamValue(param?.value))
    .map((param) => normalizeString(param?.id))
    .filter(Boolean);
}
