import { extractData } from "../dataSourceExtract.js";
import { resolveKey, setSelector } from "../../utils/selector.js";
import { resolveReportBuilderDataSourceFetcher } from "./reportBuilderDataSourceFetch.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function titleizeFieldLabel(value = "") {
    const normalized = normalizeString(value);
    if (!normalized) {
        return "";
    }
    return normalized
        .replace(/Id$/i, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
        .join(" ");
}

function normalizeDisplayLookup(config = {}) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return null;
    }
    const dataSourceRef = normalizeString(config?.dataSourceRef);
    const resolveInput = normalizeString(config?.resolveInput);
    const batchResolveInput = normalizeString(config?.batchResolveInput);
    const valuePath = normalizeString(config?.valuePath || "id") || "id";
    const labelPath = normalizeString(config?.labelPath || "name") || "name";
    if (!dataSourceRef || (!resolveInput && !batchResolveInput)) {
        return null;
    }
    return {
        dataSourceRef,
        resolveInput,
        batchResolveInput,
        valuePath,
        labelPath,
        parameters: config?.parameters && typeof config.parameters === "object" && !Array.isArray(config.parameters)
            ? cloneValue(config.parameters)
            : {},
    };
}

function normalizeHydrationSpec(entry = {}) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
    }
    const valueKey = normalizeString(entry?.key || entry?.id);
    const displayKey = normalizeString(entry?.displayKey);
    const displayLookup = normalizeDisplayLookup(entry?.displayLookup);
    if (!valueKey || !displayKey || !displayLookup || displayKey === valueKey) {
        return null;
    }
    return {
        valueKey,
        displayKey,
        fieldLabel: titleizeFieldLabel(entry?.label || valueKey) || valueKey,
        displayLookup,
    };
}

function collectHydrationSpecs(config = {}, request = {}) {
    const requestedDimensions = request?.dimensions && typeof request.dimensions === "object" && !Array.isArray(request.dimensions)
        ? request.dimensions
        : {};
    return (Array.isArray(config?.dimensions) ? config.dimensions : [])
        .map((entry) => normalizeHydrationSpec(entry))
        .filter(Boolean)
        .filter((entry) => requestedDimensions[entry.valueKey] === true);
}

function selectionNeedsHydration(row = {}, spec = {}) {
    const rawValue = resolveKey(row, spec?.valueKey);
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return false;
    }
    const displayValue = resolveKey(row, spec?.displayKey);
    if (displayValue === undefined || displayValue === null || displayValue === "") {
        return true;
    }
    return normalizeString(displayValue) === normalizeString(rawValue);
}

function uniqueHydrationValues(rows = [], spec = {}) {
    const seen = new Set();
    const next = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (!selectionNeedsHydration(row, spec)) {
            return;
        }
        const rawValue = resolveKey(row, spec.valueKey);
        const key = JSON.stringify(rawValue);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        next.push(rawValue);
    });
    return next;
}

async function fetchDisplayLookupRecords(builderContext, spec = {}, values = []) {
    const displayLookup = spec?.displayLookup || {};
    const dataSourceContext = builderContext?.Context?.(displayLookup.dataSourceRef);
    const fetcher = resolveReportBuilderDataSourceFetcher(dataSourceContext);
    if (!fetcher) {
        throw new Error(`display lookup datasource '${displayLookup.dataSourceRef}' has no fetch handler`);
    }
    const selectors = dataSourceContext?.dataSource?.selectors || {};
    const paging = dataSourceContext?.dataSource?.paging || null;
    const parameters = {
        ...(displayLookup.parameters || {}),
    };
    if (displayLookup.batchResolveInput) {
        parameters[displayLookup.batchResolveInput] = values;
        if (!Object.prototype.hasOwnProperty.call(parameters, "Limit")) {
            parameters.Limit = values.length;
        }
    } else if (displayLookup.resolveInput && values.length > 0) {
        parameters[displayLookup.resolveInput] = values[0];
    }
    const body = await fetcher({
        parameters,
        requestKind: "runtimeDisplayHydration",
    });
    return extractData(selectors, paging, body).records || [];
}

function buildLookupValueMap(records = [], spec = {}) {
    const map = new Map();
    (Array.isArray(records) ? records : []).forEach((record) => {
        const value = resolveKey(record, spec?.displayLookup?.valuePath);
        const label = resolveKey(record, spec?.displayLookup?.labelPath);
        if (value === undefined || value === null || value === "") {
            return;
        }
        if (label === undefined || label === null || label === "") {
            return;
        }
        map.set(JSON.stringify(value), label);
    });
    return map;
}

function applyHydrationValues(rows = [], spec = {}, lookup = new Map()) {
    let changed = false;
    const nextRows = (Array.isArray(rows) ? rows : []).map((row) => {
        if (!selectionNeedsHydration(row, spec)) {
            return row;
        }
        const rawValue = resolveKey(row, spec.valueKey);
        const hydratedValue = lookup.get(JSON.stringify(rawValue));
        if (hydratedValue === undefined || hydratedValue === null || hydratedValue === "") {
            const rawText = normalizeString(rawValue);
            const needsFallbackPrefix = rawText && /^\d+$/.test(rawText);
            if (!needsFallbackPrefix) {
                return row;
            }
            changed = true;
            return setSelector(
                cloneValue(row) || {},
                spec.displayKey,
                `${spec.fieldLabel || "Value"} ${rawText}`,
            );
        }
        changed = true;
        return setSelector(cloneValue(row) || {}, spec.displayKey, hydratedValue);
    });
    return changed ? nextRows : rows;
}

export async function hydrateReportBuilderRuntimeRows({
    builderContext = null,
    config = {},
    request = {},
    rows = [],
} = {}) {
    if (!builderContext?.Context || !Array.isArray(rows) || rows.length === 0) {
        return rows;
    }
    const specs = collectHydrationSpecs(config, request);
    if (specs.length === 0) {
        return rows;
    }
    let nextRows = rows;
    for (const spec of specs) {
        const values = uniqueHydrationValues(nextRows, spec);
        if (values.length === 0) {
            continue;
        }
        const records = await fetchDisplayLookupRecords(builderContext, spec, values);
        const lookup = buildLookupValueMap(records, spec);
        if (lookup.size === 0) {
            continue;
        }
        nextRows = applyHydrationValues(nextRows, spec, lookup);
    }
    return nextRows;
}
