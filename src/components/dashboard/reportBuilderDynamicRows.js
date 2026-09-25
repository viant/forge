import { resolveKey } from "../../utils/selector.js";

// Dynamic filter row and lookup-selection normalization shared by the
// runtime state helpers (reportBuilderUtils.js) and the canonical predicate
// model (reportBuilderPredicates.js). Living in its own module keeps the
// predicate layer free of the wider utils surface (and of import cycles).

function clone(value) {
    if (Array.isArray(value)) {
        return value.map((item) => clone(item));
    }
    if (value && typeof value === "object") {
        const result = {};
        Object.entries(value).forEach(([key, item]) => {
            result[key] = clone(item);
        });
        return result;
    }
    return value;
}

function normalizeArray(values = []) {
    const isPresent = (entry) => entry !== undefined && entry !== null && entry !== "";
    if (Array.isArray(values)) {
        return values.filter(isPresent);
    }
    return isPresent(values) ? [values] : [];
}

export function normalizeDynamicRow(row = {}, group = {}, index = 0) {
    const filters = normalizeArray(group.filters);
    const firstFilterId = String(filters[0]?.id || "").trim();
    const rowId = String(row.id || `row_${index + 1}`).trim();
    return {
        id: rowId || `row_${index + 1}`,
        filterId: String(row.filterId || firstFilterId).trim(),
        enabled: row?.enabled !== false,
        selections: normalizeArray(row.selections).map((entry) => clone(entry)),
    };
}

function filterDefinitionForRow(group = {}, row = {}) {
    const filterId = String(row?.filterId || "").trim();
    return normalizeArray(group?.filters).find((entry) => String(entry?.id || "").trim() === filterId) || null;
}

function normalizeSelectionForFilter(filterDef = {}, entry = null) {
    const isObjectEntry = entry && typeof entry === "object" && !Array.isArray(entry);
    const valueSelector = String(filterDef?.valueSelector || "value").trim() || "value";
    const labelSelector = String(filterDef?.labelSelector || "label").trim() || "label";
    const record = isObjectEntry && entry?.record && typeof entry.record === "object"
        ? entry.record
        : (isObjectEntry ? entry : {});
    const rawValue = isObjectEntry
        ? (
            entry?.value
            ?? selectFirstDefined(entry, lookupValueFallbackSelectors(valueSelector))
            ?? selectFirstDefined(record, lookupValueFallbackSelectors(valueSelector))
        )
        : entry;
    const coerced = coerceManualSelectionValue(filterDef, rawValue);
    if (!coerced.ok) {
        return null;
    }
    const recordLabel = String(selectFirstDefined(record, lookupLabelFallbackSelectors(labelSelector, valueSelector)) ?? "").trim();
    const entryLabel = String(isObjectEntry ? (entry?.label ?? "") : "").trim();
    const label = recordLabel || entryLabel || String(coerced.label || "").trim();
    return {
        value: coerced.value,
        label,
        group: isObjectEntry ? (entry?.group || "") : "",
        record: {
            ...record,
            [valueSelector]: coerced.value,
            [labelSelector]: label,
        },
    };
}

export function normalizeDynamicGroupRows(rows = [], group = {}) {
    return normalizeArray(rows).map((row, index) => {
        const normalizedRow = normalizeDynamicRow(row, group, index);
        const filterDef = filterDefinitionForRow(group, normalizedRow);
        if (!filterDef) {
            return normalizedRow;
        }
        const originalSelections = normalizeArray(normalizedRow.selections);
        const normalizedSelections = originalSelections
            .map((entry) => normalizeSelectionForFilter(filterDef, entry))
            .filter(Boolean);
        if (originalSelections.length > 0 && normalizedSelections.length === 0) {
            return null;
        }
        return {
            ...normalizedRow,
            selections: normalizedSelections,
        };
    }).filter(Boolean);
}

function compactLookupRecord(filterDef = {}, record = {}) {
    if (!record || typeof record !== "object") {
        return null;
    }
    const selectors = [
        filterDef.valueSelector,
        filterDef.labelSelector,
        filterDef.groupSelector,
        ...(Array.isArray(filterDef.recordSelectors) ? filterDef.recordSelectors : []),
    ].map((entry) => String(entry || "").trim()).filter(Boolean);
    const compact = {};
    selectors.forEach((selector) => {
        const value = resolveKey(record, selector);
        if (value === undefined || value === null || value === "") {
            return;
        }
        compact[selector] = value;
    });
    return Object.keys(compact).length > 0 ? compact : null;
}

function selectFirstDefined(record = {}, selectors = []) {
    for (const selector of selectors) {
        const key = String(selector || "").trim();
        if (!key) continue;
        const value = resolveKey(record, key);
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }
    return undefined;
}

function selectorLeaf(selector = "") {
    const normalized = String(selector || "").trim();
    if (!normalized) return "";
    const parts = normalized.split(".").map((entry) => entry.trim()).filter(Boolean);
    return parts[parts.length - 1] || normalized;
}

function lookupValueFallbackSelectors(selector = "") {
    const leaf = selectorLeaf(selector);
    const lower = leaf.toLowerCase();
    const selectors = [selector, leaf];
    if (lower === "id" || lower.endsWith("id")) {
        selectors.push("id", "value");
    }
    return Array.from(new Set(selectors.filter(Boolean)));
}

function lookupLabelFallbackSelectors(selector = "", valueSelector = "") {
    const leaf = selectorLeaf(selector);
    const lower = leaf.toLowerCase();
    const selectors = [selector, leaf];
    if (lower === "label" || lower.endsWith("label")) {
        selectors.push("label", "name", "displayName", "displayPath");
    } else if (lower === "name" || lower.endsWith("name")) {
        selectors.push("name", "label", "displayName", "displayPath");
    } else {
        selectors.push("label", "name", "displayName", "displayPath");
    }
    const valueLeaf = selectorLeaf(valueSelector);
    if (valueLeaf && valueLeaf !== leaf) {
        selectors.push(valueLeaf);
    }
    return Array.from(new Set(selectors.filter(Boolean)));
}

function coerceManualSelectionValue(filterDef = {}, rawValue = "") {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return { ok: false };
    }
    const normalized = String(rawValue ?? "").trim();
    if (!normalized) {
        return { ok: false };
    }
    const valueType = String(filterDef?.manualValueType || "string").trim().toLowerCase();
    switch (valueType) {
        case "int":
        case "integer":
            if (!/^-?\d+$/.test(normalized)) {
                return { ok: false };
            }
            return { ok: true, value: Number(normalized), label: normalized };
        case "string":
        default:
            if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                return { ok: true, value: rawValue, label: normalized };
            }
            return { ok: true, value: normalized, label: normalized };
    }
}

export function projectLookupSelection(filterDef = {}, record = {}) {
    const valueSelector = String(filterDef.valueSelector || filterDef.valueField || filterDef.field || "id").trim();
    const labelSelector = String(filterDef.labelSelector || filterDef.previewSelector || filterDef.labelField || valueSelector).trim();
    const groupSelector = String(filterDef.groupSelector || "").trim();
    const rawValue = selectFirstDefined(record, lookupValueFallbackSelectors(valueSelector));
    const coerced = coerceManualSelectionValue(filterDef, rawValue);
    if (!coerced.ok) {
        return null;
    }
    const value = coerced.value;
    const label = selectFirstDefined(record, lookupLabelFallbackSelectors(labelSelector, valueSelector));
    const group = groupSelector ? resolveKey(record, groupSelector) : "";
    const resolvedLabel = label == null || label === "" ? String(coerced.label || value || "") : String(label);
    return {
        value,
        label: resolvedLabel,
        group: group == null ? "" : String(group),
        record: compactLookupRecord(filterDef, record),
    };
}

export function projectLookupSelections(filterDef = {}, payload = null) {
    const records = Array.isArray(payload)
        ? payload
        : (payload == null ? [] : [payload]);
    return records
        .filter((record) => record && typeof record === "object")
        .map((record) => projectLookupSelection(filterDef, record))
        .filter(Boolean);
}

export function projectManualSelection(filterDef = {}, rawValue = "") {
    const coerced = coerceManualSelectionValue(filterDef, rawValue);
    if (!coerced.ok) {
        return null;
    }
    const valueSelector = String(filterDef?.valueSelector || "value").trim() || "value";
    const labelSelector = String(filterDef?.labelSelector || "label").trim() || "label";
    return {
        value: coerced.value,
        label: coerced.label,
        group: "",
        record: {
            [valueSelector]: coerced.value,
            [labelSelector]: coerced.label,
        },
    };
}
