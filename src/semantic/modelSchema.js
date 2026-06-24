export const SEMANTIC_BINDING_MODES = ["raw", "semantic"];

export const SEMANTIC_FIELD_TYPES = [
    "dimension",
    "measure",
    "parameter",
];

export const SEMANTIC_DATA_TYPES = [
    "string",
    "number",
    "integer",
    "boolean",
    "date",
    "datetime",
    "time",
];

export const SEMANTIC_AGGREGATIONS = [
    "sum",
    "avg",
    "min",
    "max",
    "count",
    "countDistinct",
    "ratio",
];

export const SEMANTIC_TIME_GRAINS = [
    "hour",
    "day",
    "week",
    "month",
    "quarter",
    "year",
];

export const SEMANTIC_GOVERNANCE_STATUSES = [
    "draft",
    "approved",
    "deprecated",
];

export const SEMANTIC_CERTIFICATIONS = [
    "none",
    "reviewed",
    "certified",
];

export function normalizeSemanticString(value = "") {
    return String(value || "").trim();
}

export function normalizeSemanticArray(values = []) {
    if (Array.isArray(values)) {
        return values
            .map((entry) => normalizeSemanticString(entry))
            .filter(Boolean);
    }
    const normalized = normalizeSemanticString(values);
    return normalized ? [normalized] : [];
}
