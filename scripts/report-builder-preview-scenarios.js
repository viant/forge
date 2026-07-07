export const REPORT_BUILDER_PREVIEW_SCENARIO_FILE_RE = /^report-builder-preview-.*\.scenario\.(json|mjs)$/;

export function normalizeScenarioArg(arg = "") {
  const raw = String(arg || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.endsWith(".scenario.json") || raw.endsWith(".scenario.mjs")) {
    return raw;
  }
  if (raw.startsWith("report-builder-preview-")) {
    return `${raw}.scenario.json`;
  }
  return `report-builder-preview-${raw}.scenario.json`;
}

export function previewScenarioDisplayName(file = "") {
  return String(file || "").replace(/\.scenario\.(json|mjs)$/, "");
}

export function parsePreviewScenarioRunnerArgs(args = []) {
  const rawArgs = Array.isArray(args) ? args.slice() : [];
  const scenarioArgs = [];
  let list = false;
  let continueOnError = false;
  let outputRoot = "";
  let baseUrl = "";
  let summaryFile = "";
  let help = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = String(rawArgs[index] || "").trim();
    if (!arg) {
      continue;
    }
    if (arg === "--list" || arg === "-l") {
      list = true;
      continue;
    }
    if (arg === "--continue-on-error") {
      continueOnError = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--output-root") {
      outputRoot = String(rawArgs[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--output-root=")) {
      outputRoot = arg.slice("--output-root=".length).trim();
      continue;
    }
    if (arg === "--base-url") {
      baseUrl = String(rawArgs[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length).trim();
      continue;
    }
    if (arg === "--summary-file") {
      summaryFile = String(rawArgs[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--summary-file=")) {
      summaryFile = arg.slice("--summary-file=".length).trim();
      continue;
    }
    scenarioArgs.push(arg);
  }

  return {
    list,
    continueOnError,
    outputRoot,
    baseUrl,
    summaryFile,
    help,
    scenarioArgs,
  };
}

export function isSemanticPreviewScenario(file = "") {
  return String(file || "").includes("-semantic-");
}

export function isSemanticLeftRailPreviewScenario(file = "") {
  const normalized = String(file || "");
  return isSemanticPreviewScenario(normalized) && normalized.includes("-left-rail-");
}

export function buildPreviewScenarioGroups(availableFiles = []) {
  const files = Array.isArray(availableFiles) ? availableFiles.slice().sort() : [];
  return {
    all: files,
    semantic: files.filter((file) => isSemanticPreviewScenario(file)),
    "semantic-left-rail": files.filter((file) => isSemanticLeftRailPreviewScenario(file)),
    legacy: files.filter((file) => !isSemanticPreviewScenario(file)),
  };
}

export function expandPreviewScenarioArgs(args = [], availableFiles = []) {
  const files = Array.isArray(availableFiles) ? availableFiles.slice().sort() : [];
  const groups = buildPreviewScenarioGroups(files);
  if (!Array.isArray(args) || args.length === 0) {
    return groups.all;
  }

  const expanded = [];
  const pushUnique = (file) => {
    if (!file || expanded.includes(file)) {
      return;
    }
    expanded.push(file);
  };

  args.forEach((arg) => {
    const raw = String(arg || "").trim();
    if (!raw || raw.startsWith("-")) {
      return;
    }
    const groupKey = raw.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(groups, groupKey)) {
      groups[groupKey].forEach((file) => pushUnique(file));
      return;
    }
    const normalized = normalizeScenarioArg(raw);
    if (files.includes(normalized)) {
      pushUnique(normalized);
      return;
    }
    if (normalized.endsWith(".scenario.json")) {
      const moduleVariant = normalized.replace(/\.scenario\.json$/, ".scenario.mjs");
      if (files.includes(moduleVariant)) {
        pushUnique(moduleVariant);
        return;
      }
    }
    pushUnique(normalized);
  });

  const missing = expanded.filter((file) => !files.includes(file));
  if (missing.length > 0) {
    throw new Error(`Unknown preview scenarios: ${missing.join(", ")}`);
  }
  return expanded;
}

export function buildPreviewScenarioRunSummary({
  generatedAt = "",
  outputRoot = "",
  baseUrl = "",
  total = 0,
  results = [],
} = {}) {
  const normalizedResults = Array.isArray(results) ? results.slice() : [];
  const passed = normalizedResults.filter((entry) => entry?.status === "passed").length;
  const failed = normalizedResults.filter((entry) => entry?.status === "failed").length;
  return {
    generatedAt,
    outputRoot,
    baseUrl,
    total: total === undefined || total === null
      ? normalizedResults.length
      : (Number(total) || 0),
    passed,
    failed,
    results: normalizedResults,
  };
}
