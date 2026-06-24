function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

export const REPORT_CALCULATED_FIELD_FUNCTION_SPECS = Object.freeze({
  if: { minArgs: 3, maxArgs: 3 },
  case: { minArgs: 3 },
  coalesce: { minArgs: 1 },
  isnull: { minArgs: 1, maxArgs: 1 },
  nullif: { minArgs: 2, maxArgs: 2 },
  abs: { minArgs: 1, maxArgs: 1 },
  round: { minArgs: 1, maxArgs: 2 },
  floor: { minArgs: 1, maxArgs: 1 },
  ceil: { minArgs: 1, maxArgs: 1 },
  min: { minArgs: 1 },
  max: { minArgs: 1 },
  least: { minArgs: 1 },
  greatest: { minArgs: 1 },
  concat: { minArgs: 1 },
  lower: { minArgs: 1, maxArgs: 1 },
  upper: { minArgs: 1, maxArgs: 1 },
});

export const REPORT_CALCULATED_FIELD_TABLE_CALC_SPECS = Object.freeze([
  {
    name: "percentOfTotal",
    label: "Percent of Total",
    supportsPartition: true,
    supportsDecimals: true,
    usesFilteredScopeTotal: true,
    nullBehavior: "nonFiniteValuesYieldZeroAndAreExcludedFromTotals",
    defaultFormat: "percent",
  },
  {
    name: "deltaFromPrevious",
    label: "Delta From Previous",
    supportsPartition: true,
    requiresOrder: true,
    nullBehavior: "nonFiniteValuesYieldZeroAndDoNotAdvancePreviousFiniteValue",
    defaultFormat: "number",
  },
  {
    name: "runningTotal",
    label: "Running Total",
    supportsPartition: true,
    requiresOrder: true,
    nullBehavior: "nonFiniteValuesDoNotAdvanceRunningTotal",
    defaultFormat: "number",
  },
  {
    name: "movingAverage",
    label: "Moving Average",
    supportsPartition: true,
    requiresOrder: true,
    requiresWindowSize: true,
    supportsDecimals: true,
    nullBehavior: "windowAveragesIgnoreNonFiniteValues",
    defaultFormat: "number",
  },
  {
    name: "rank",
    label: "Rank",
    supportsPartition: true,
    requiresOrder: true,
    supportsRankDirection: true,
    supportsTieBreaker: true,
    tieMode: "dense",
    nullBehavior: "nonFiniteValuesYieldNullAndDoNotAdvanceRank",
    defaultFormat: "number",
  },
]);

export function listReportCalculatedFieldFunctionSpecs() {
  return Object.entries(REPORT_CALCULATED_FIELD_FUNCTION_SPECS)
    .map(([name, spec]) => ({
      name,
      ...(Number.isFinite(spec?.minArgs) ? { minArgs: Number(spec.minArgs) } : {}),
      ...(Number.isFinite(spec?.maxArgs) ? { maxArgs: Number(spec.maxArgs) } : {}),
    }))
    .sort((left, right) => normalizeString(left.name).localeCompare(normalizeString(right.name)));
}

export function listReportCalculatedFieldTableCalculationSpecs() {
  return REPORT_CALCULATED_FIELD_TABLE_CALC_SPECS
    .map((entry) => cloneValue(entry))
    .sort((left, right) => normalizeString(left.name).localeCompare(normalizeString(right.name)));
}
