function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const DATASET_SCOPE_MODES = new Set(["inherit", "append", "override", "exclude"]);
const RELATIVE_DATE_PRESETS = new Set(["today", "yesterday", "last3days", "last7days", "last30days", "3d", "7d", "30d"]);

function normalizeDatasetScopeMode(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return DATASET_SCOPE_MODES.has(normalized) ? normalized : "";
}

function normalizeStringArray(values = []) {
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

export function normalizeReportDatasetScope(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const next = cloneValue(value);
  const rawMode = normalizeString(next?.mode);
  const normalizedMode = normalizeDatasetScopeMode(next?.mode);
  if (normalizedMode) {
    next.mode = normalizedMode;
  } else if (Object.prototype.hasOwnProperty.call(next, "mode") && rawMode) {
    throw new Error(`Unknown dataset scope mode '${String(next.mode || "").trim()}'.`);
  } else if (Object.prototype.hasOwnProperty.call(next, "mode")) {
    delete next.mode;
  }
  if (Object.prototype.hasOwnProperty.call(next, "inheritContext")) {
    next.inheritContext = next.inheritContext === true;
  }
  if (isPlainObject(next?.local)) {
    next.local = cloneValue(next.local);
  } else if (Object.prototype.hasOwnProperty.call(next, "local")) {
    delete next.local;
  }
  if (Object.prototype.hasOwnProperty.call(next, "exclude")) {
    const normalizedExclude = normalizeStringArray(next.exclude);
    if (normalizedExclude.length > 0) {
      next.exclude = normalizedExclude;
    } else {
      delete next.exclude;
    }
  }
  if (Object.prototype.hasOwnProperty.call(next, "relativeDateRange")) {
    const relativeDateRange = isPlainObject(next.relativeDateRange) ? cloneValue(next.relativeDateRange) : null;
    const preset = normalizeString(relativeDateRange?.preset).toLowerCase().replaceAll("_", "");
    const startExpression = normalizeString(relativeDateRange?.startExpression);
    const endExpression = normalizeString(relativeDateRange?.endExpression);
    const startParamPath = normalizeString(relativeDateRange?.startParamPath);
    const endParamPath = normalizeString(relativeDateRange?.endParamPath);
    if ((!RELATIVE_DATE_PRESETS.has(preset) && (!startExpression || !endExpression)) || !startParamPath || !endParamPath) {
      throw new Error("Dataset relativeDateRange requires a supported preset or start/end expressions, plus startParamPath and endParamPath.");
    }
    next.relativeDateRange = {
      ...(preset ? { preset } : {}),
      ...(startExpression ? { startExpression } : {}),
      ...(endExpression ? { endExpression } : {}),
      ...(normalizeString(relativeDateRange?.format) ? { format: normalizeString(relativeDateRange.format) } : {}),
      startParamPath,
      endParamPath,
    };
  }
  if (next.mode === "exclude" && (!Array.isArray(next.exclude) || next.exclude.length === 0)) {
    throw new Error("Dataset scope mode 'exclude' requires at least one excluded scope param id.");
  }
  return Object.keys(next).length > 0 ? next : null;
}

export function resolveReportDatasetScopePolicy(scope = null) {
  const normalizedScope = normalizeReportDatasetScope(scope);
  if (!normalizedScope) {
    return {
      mode: "inherit",
      local: {},
      exclude: [],
      relativeDateRange: null,
    };
  }
  const explicitMode = normalizeDatasetScopeMode(normalizedScope?.mode);
  const normalizedLocal = isPlainObject(normalizedScope?.local)
    ? cloneValue(normalizedScope.local)
    : {};
  const normalizedExclude = normalizeStringArray(normalizedScope?.exclude);
  const relativeDateRange = isPlainObject(normalizedScope?.relativeDateRange)
    ? cloneValue(normalizedScope.relativeDateRange)
    : null;
  if (explicitMode) {
    return {
      mode: explicitMode,
      local: normalizedLocal,
      exclude: normalizedExclude,
      relativeDateRange,
    };
  }
  const legacyLocal = cloneValue(normalizedScope);
  delete legacyLocal.mode;
  delete legacyLocal.local;
  delete legacyLocal.exclude;
  delete legacyLocal.relativeDateRange;
  const inheritContext = legacyLocal?.inheritContext;
  delete legacyLocal.inheritContext;
  const mergedLocal = {
    ...legacyLocal,
    ...normalizedLocal,
  };
  const hasLocal = Object.keys(mergedLocal).length > 0;
  if (inheritContext === false && normalizedExclude.length > 0) {
    throw new Error("Legacy dataset scope cannot combine inheritContext=false with exclude entries. Use explicit mode instead.");
  }
  if (normalizedExclude.length > 0) {
    return {
      mode: "exclude",
      local: mergedLocal,
      exclude: normalizedExclude,
      relativeDateRange,
    };
  }
  if (inheritContext === false) {
    return {
      mode: "override",
      local: mergedLocal,
      exclude: [],
      relativeDateRange,
    };
  }
  return {
    mode: hasLocal ? "append" : "inherit",
    local: mergedLocal,
    exclude: [],
    relativeDateRange,
  };
}
