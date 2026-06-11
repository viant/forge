import { resolveKey } from "../../utils/selector.js";
import {
    ALL_SUPPORTED_CHART_TYPES,
    chartFamilyAllowsSeriesOptions,
    chartFamilyForType,
    CARTESIAN_CHART_TYPES,
    isValidPerSeriesType,
    SINGLE_MEASURE_CATEGORY_TYPES,
    supportsStackIdForSeries,
} from "./reportBuilderChartRules.js";

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

function setNestedValue(target, path, value) {
    const parts = String(path || "")
        .split(".")
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (!parts.length) {
        return target;
    }
    let current = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    return target;
}

function normalizeArray(values = []) {
    const isPresent = (entry) => entry !== undefined && entry !== null && entry !== "";
    if (Array.isArray(values)) {
        return values.filter(isPresent);
    }
    return isPresent(values) ? [values] : [];
}

export function shouldAutoCollapseReportBuilderFilters({
    canShowResults = false,
    hasCompletedCurrentRun = false,
    manualRunSequence = 0,
    collapsedRunSequence = 0,
} = {}) {
    const runSequence = Number(manualRunSequence || 0);
    const lastCollapsed = Number(collapsedRunSequence || 0);
    return !!canShowResults
        && !!hasCompletedCurrentRun
        && Number.isFinite(runSequence)
        && runSequence > 0
        && runSequence !== lastCollapsed;
}

function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function resolveRelativeDateRangeDefault(seed = {}) {
    const preset = String(seed?.preset || "").trim().toLowerCase();
    if (!preset) {
        return null;
    }
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    switch (preset) {
        case "last3days":
        case "last_3_days":
        case "3d":
            start.setDate(end.getDate() - 2);
            break;
        case "last7days":
        case "last_7_days":
        case "7d":
            start.setDate(end.getDate() - 6);
            break;
        case "last30days":
        case "last_30_days":
        case "30d":
            start.setDate(end.getDate() - 29);
            break;
        case "today":
            break;
        default:
            return null;
    }
    return {
        start: formatDateISO(start),
        end: formatDateISO(end),
    };
}

function defaultSelectedIds(items = [], fallbackCount = 1) {
    const explicit = normalizeArray(items)
        .filter((item) => item?.default)
        .map((item) => String(item.id || "").trim())
        .filter(Boolean);
    if (explicit.length > 0) {
        return explicit;
    }
    return normalizeArray(items)
        .slice(0, fallbackCount)
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean);
}

function defaultStaticFilterValue(filter = {}) {
    if (filter.type === "dateRange") {
        const seeded = filter.default && typeof filter.default === "object" ? filter.default : {};
        const relative = resolveRelativeDateRangeDefault(seeded);
        if (relative) {
            return relative;
        }
        return {
            start: seeded.start || "",
            end: seeded.end || "",
        };
    }
    const defaults = normalizeArray(filter.options)
        .filter((option) => option?.default)
        .map((option) => option.value);
    if (filter.multiple) {
        return defaults;
    }
    return defaults[0] ?? "";
}

function normalizeDynamicRow(row = {}, group = {}, index = 0) {
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

function rowHasSelections(row = {}) {
    return Array.isArray(row?.selections) && row.selections.length > 0;
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

function firstResolvedValue(record = null, selectors = []) {
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

function camelToSnake(value = "") {
    return String(value || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[-\s]+/g, "_")
        .toLowerCase();
}

function buildFilterAliases(filters = {}) {
    const source = filters && typeof filters === "object" && !Array.isArray(filters) ? filters : {};
    const aliases = {};
    Object.entries(source).forEach(([key, value]) => {
        const trimmed = String(key || "").trim();
        if (!trimmed) return;
        const lower = trimmed.toLowerCase();
        const candidates = new Set([camelToSnake(trimmed)]);
        if (/Ids$/.test(trimmed)) {
            candidates.add(`${camelToSnake(trimmed.slice(0, -3))}_id`);
        } else if (/Id$/.test(trimmed)) {
            candidates.add(`${camelToSnake(trimmed.slice(0, -2))}_id`);
        }
        if (lower === "from" || lower === "to") {
            candidates.add(lower);
        }
        if (lower.endsWith("incl")) {
            candidates.add(camelToSnake(trimmed));
        }
        if (lower.endsWith("excl")) {
            candidates.add(camelToSnake(trimmed));
        }
        candidates.forEach((alias) => {
            if (!alias || alias === trimmed || Object.prototype.hasOwnProperty.call(source, alias) || Object.prototype.hasOwnProperty.call(aliases, alias)) {
                return;
            }
            aliases[alias] = clone(value);
        });
    });
    return aliases;
}

export function applyReportBuilderFilterAliases(request = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return request;
    }
    if (!request.filters || typeof request.filters !== "object" || Array.isArray(request.filters)) {
        return request;
    }
    return {
        ...request,
        filters: {
            ...request.filters,
            ...buildFilterAliases(request.filters),
        },
    };
}

function isVisibleField(entry = {}) {
    if (!entry || typeof entry !== "object") {
        return false;
    }
    if (entry.hidden === true) {
        return false;
    }
    if (entry.visible === false) {
        return false;
    }
    if (entry.expose === false) {
        return false;
    }
    return true;
}

function normalizeStringArray(values = []) {
    return normalizeArray(values).map((entry) => String(entry || "").trim()).filter(Boolean);
}

const DEFAULT_CHART_PALETTE = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
    "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
    "#bcbd22", "#17becf",
];

function supportedChartTypeSet(config = {}) {
    const supported = normalizeStringArray(
        config?.result?.chartWizard?.supportedTypes
        || config?.result?.supportedChartTypes
        || ALL_SUPPORTED_CHART_TYPES,
    ).filter((entry) => ALL_SUPPORTED_CHART_TYPES.includes(entry));
    return new Set(supported.length > 0 ? supported : ALL_SUPPORTED_CHART_TYPES);
}

function resolveChartCreationMode(config = {}) {
    return String(config?.result?.chartCreationMode || "").trim().toLowerCase();
}

export function isExplicitReportBuilderChartMode(config = {}) {
    return resolveChartCreationMode(config) === "explicit";
}

export function getReportBuilderSupportedChartTypes(config = {}) {
    return Array.from(supportedChartTypeSet(config));
}

export function getReportBuilderResultPanePosition(config = {}) {
    const position = String(config?.result?.resultPanePosition || "").trim().toLowerCase();
    return position === "left" ? "left" : "right";
}

export function getVisibleReportBuilderMeasures(config = {}) {
    return normalizeArray(config.measures).filter((entry) => isVisibleField(entry));
}

export function getComputedReportBuilderMeasures(config = {}) {
    return normalizeArray(config.computedMeasures).filter((entry) => isVisibleField(entry));
}

export function getSelectableReportBuilderMeasures(config = {}) {
    return [
        ...getVisibleReportBuilderMeasures(config),
        ...getComputedReportBuilderMeasures(config),
    ];
}

export function getVisibleReportBuilderDimensions(config = {}) {
    return normalizeArray(config.dimensions).filter((entry) => isVisibleField(entry));
}

function reportBuilderDimensionValueKey(entry = {}) {
    return String(entry?.key || entry?.id || "").trim();
}

export function resolveReportBuilderDimensionDisplayKey(entry = {}) {
    const displayKey = String(entry?.displayKey || entry?.displayPath || "").trim();
    return displayKey || reportBuilderDimensionValueKey(entry);
}

export function resolveReportBuilderDimensionByField(config = {}, fieldKey = "") {
    const target = String(fieldKey || "").trim();
    if (!target) {
        return null;
    }
    return getVisibleReportBuilderDimensions(config).find((entry) => {
        const dimensionId = String(entry?.id || "").trim();
        const valueKey = reportBuilderDimensionValueKey(entry);
        const displayKey = resolveReportBuilderDimensionDisplayKey(entry);
        return target === dimensionId || target === valueKey || target === displayKey;
    }) || null;
}

function normalizeChartSpecValue(value) {
    const normalized = String(value || "").trim();
    return normalized || null;
}

function normalizeChartSeriesOption(option) {
    if (!option || typeof option !== "object" || Array.isArray(option)) {
        return null;
    }
    const result = {};
    const type = String(option.type || "").trim().toLowerCase();
    if (type) result.type = type;
    const axis = String(option.axis || "").trim().toLowerCase();
    if (axis) result.axis = axis;
    const rawStackId = option.stackId;
    if (rawStackId !== undefined && rawStackId !== null && rawStackId !== "") {
        if (typeof rawStackId === "string") {
            const trimmed = rawStackId.trim();
            if (trimmed) result.stackId = trimmed;
        } else {
            result.stackId = rawStackId;
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}

function normalizeChartSeriesOptions(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return null;
    }
    const result = {};
    Object.entries(input).forEach(([key, option]) => {
        const trimmed = String(key || "").trim();
        if (!trimmed) return;
        const normalized = normalizeChartSeriesOption(option);
        if (normalized) result[trimmed] = normalized;
    });
    return Object.keys(result).length > 0 ? result : null;
}

export function normalizeReportBuilderChartSpec(chartSpec = {}) {
    if (!chartSpec || typeof chartSpec !== "object" || Array.isArray(chartSpec)) {
        return null;
    }
    const title = String(chartSpec.title || "").trim();
    const type = String(chartSpec.type || "").trim().toLowerCase() || "line";
    const xField = normalizeChartSpecValue(chartSpec.xField);
    const yFields = normalizeStringArray(chartSpec.yFields || chartSpec.yField).filter(Boolean);
    const seriesField = normalizeChartSpecValue(chartSpec.seriesField);
    const seriesOptions = normalizeChartSeriesOptions(chartSpec.seriesOptions);
    return {
        ...(title ? { title } : {}),
        type,
        xField,
        yFields: Array.from(new Set(yFields)),
        ...(seriesField ? { seriesField } : {}),
        ...(seriesOptions ? { seriesOptions } : {}),
    };
}

function chartFieldIndex(columns = []) {
    const result = new Map();
    normalizeArray(columns).forEach((column) => {
        const aliases = [
            String(column?.key || "").trim(),
            ...normalizeStringArray(column?.aliases),
        ].filter(Boolean);
        aliases.forEach((alias) => {
            if (!result.has(alias)) {
                result.set(alias, column);
            }
        });
    });
    return result;
}

function chartConfigUniverse(config = {}) {
    const fields = [
        ...getVisibleReportBuilderDimensions(config).flatMap((entry) => [
            String(entry?.id || "").trim(),
            reportBuilderDimensionValueKey(entry),
            resolveReportBuilderDimensionDisplayKey(entry),
        ]),
        ...getSelectableReportBuilderMeasures(config).map((entry) => entry?.key || entry?.id),
    ];
    return new Set(normalizeStringArray(fields));
}

function sanitizeChartSpecAgainstConfig(config = {}, chartSpec = null) {
    const normalized = normalizeReportBuilderChartSpec(chartSpec);
    if (!normalized) {
        return null;
    }
    if (!supportedChartTypeSet(config).has(normalized.type)) {
        return null;
    }
    const universe = chartConfigUniverse(config);
    if (!normalized.xField || !universe.has(normalized.xField)) {
        return null;
    }
    if (!Array.isArray(normalized.yFields) || normalized.yFields.length === 0) {
        return null;
    }
    if (normalized.yFields.some((entry) => !universe.has(entry))) {
        return null;
    }

    const family = chartFamilyForType(normalized.type);

    if (SINGLE_MEASURE_CATEGORY_TYPES.has(normalized.type) && normalized.yFields.length > 1) {
        return null;
    }

    if (normalized.seriesField) {
        if (!universe.has(normalized.seriesField)) {
            return null;
        }
        if (family === "category") {
            delete normalized.seriesField;
        } else if (family === "cartesian" && normalized.yFields.length > 1) {
            delete normalized.seriesField;
        } else if (normalized.seriesField === normalized.xField) {
            delete normalized.seriesField;
        }
    }

    if (normalized.seriesOptions) {
        if (normalized.seriesField) {
            delete normalized.seriesOptions;
        } else if (!chartFamilyAllowsSeriesOptions(normalized.type)) {
            delete normalized.seriesOptions;
        } else {
            const ySet = new Set(normalized.yFields);
            const cleaned = {};
            const stackAxis = new Map();
            Object.entries(normalized.seriesOptions).forEach(([key, option]) => {
                if (!ySet.has(key)) return;
                const next = {};
                if (option.type && isValidPerSeriesType(normalized.type, option.type)) {
                    next.type = option.type;
                }
                if (family === "cartesian" && (option.axis === "left" || option.axis === "right")) {
                    next.axis = option.axis;
                }
                if (typeof option.stackId === "string" && option.stackId && supportsStackIdForSeries(normalized.type, next.type || option.type)) {
                    const axis = next.axis || "left";
                    const prior = stackAxis.get(option.stackId);
                    if (prior && prior !== axis) {
                        // drop stackId from this entry to resolve axis conflict
                    } else {
                        next.stackId = option.stackId;
                        if (!prior) stackAxis.set(option.stackId, axis);
                    }
                }
                if (Object.keys(next).length > 0) cleaned[key] = next;
            });
            if (Object.keys(cleaned).length > 0) {
                normalized.seriesOptions = cleaned;
            } else {
                delete normalized.seriesOptions;
            }
        }
    }

    return normalized;
}

export function resolveReportBuilderMeasure(config = {}, id = "") {
    const targetId = String(id || "").trim();
    if (!targetId) {
        return null;
    }
    return getSelectableReportBuilderMeasures(config).find(
        (entry) => String(entry?.id || "").trim() === targetId,
    ) || null;
}

export function resolveReportBuilderMeasureByField(config = {}, fieldKey = "") {
    const target = String(fieldKey || "").trim();
    if (!target) {
        return null;
    }
    return getSelectableReportBuilderMeasures(config).find((entry) => {
        const measureId = String(entry?.id || "").trim();
        const valueKey = String(entry?.key || entry?.id || "").trim();
        return target === measureId || target === valueKey;
    }) || null;
}

export function buildReportBuilderChartFields(config = {}, state = {}) {
    return buildReportBuilderColumns(config, state).map((entry) => ({
        key: String(entry?.chartKey || entry?.displayKey || entry?.key || "").trim(),
        aliases: Array.from(new Set(normalizeStringArray([entry?.key, entry?.sourceKey]))),
        label: entry?.label || entry?.key || "",
        kind: entry?.kind || "",
        format: entry?.format,
        align: entry?.align,
    })).filter((entry) => entry.key && entry.kind);
}

export function validateReportBuilderChartSpec(config = {}, chartSpec = null, columns = []) {
    const normalized = normalizeReportBuilderChartSpec(chartSpec);
    if (!normalized) {
        return { valid: false, errors: [{ field: "chartSpec", code: "missing" }] };
    }
    const supportedTypes = supportedChartTypeSet(config);
    const errors = [];
    if (!supportedTypes.has(normalized.type)) {
        errors.push({ field: "type", code: "unsupportedType" });
    }
    const fields = chartFieldIndex(columns);
    const xField = normalized.xField ? fields.get(normalized.xField) : null;
    if (!xField) {
        errors.push({ field: "xField", code: "missingField" });
    } else if (xField.kind !== "dimension") {
        errors.push({ field: "xField", code: "wrongKind" });
    }
    if (!Array.isArray(normalized.yFields) || normalized.yFields.length === 0) {
        errors.push({ field: "yFields", code: "empty" });
    } else {
        normalized.yFields.forEach((fieldKey, index) => {
            const field = fields.get(fieldKey);
            if (!field) {
                errors.push({ field: `yFields.${index}`, code: "missingField" });
                return;
            }
            if (field.kind !== "measure") {
                errors.push({ field: `yFields.${index}`, code: "wrongKind" });
            }
        });
    }

    const family = chartFamilyForType(normalized.type);

    if (normalized.seriesField) {
        const seriesField = fields.get(normalized.seriesField);
        if (!seriesField) {
            errors.push({ field: "seriesField", code: "missingField" });
        } else if (seriesField.kind !== "dimension") {
            errors.push({ field: "seriesField", code: "wrongKind" });
        }
        if (normalized.seriesField === normalized.xField) {
            errors.push({ field: "seriesField", code: "duplicateField" });
        }
        if (family === "category") {
            errors.push({ field: "seriesField", code: "notAllowed" });
        } else if (family === "cartesian") {
            if (Array.isArray(normalized.yFields) && normalized.yFields.length > 1) {
                errors.push({ field: "seriesField", code: "tooManyMeasures" });
            }
            if (normalized.seriesOptions) {
                errors.push({ field: "seriesOptions", code: "notAllowed" });
            }
        }
    }

    if (family === "category") {
        if (SINGLE_MEASURE_CATEGORY_TYPES.has(normalized.type)
            && Array.isArray(normalized.yFields)
            && normalized.yFields.length > 1) {
            errors.push({ field: "yFields", code: "tooManyMeasures" });
        }
        if (normalized.seriesOptions && !chartFamilyAllowsSeriesOptions(normalized.type)) {
            errors.push({ field: "seriesOptions", code: "notAllowed" });
        }
    }

    const canValidateSeriesOptionsEntries = !!normalized.seriesOptions
        && typeof normalized.seriesOptions === "object"
        && !(normalized.seriesField && family === "cartesian")
        && !(!chartFamilyAllowsSeriesOptions(normalized.type));

    if (canValidateSeriesOptionsEntries) {
        const ySet = new Set(Array.isArray(normalized.yFields) ? normalized.yFields : []);
        const stackAxis = new Map();
        Object.entries(normalized.seriesOptions).forEach(([key, option]) => {
            if (!ySet.has(key)) {
                errors.push({ field: `seriesOptions.${key}`, code: "unknownMeasure" });
                return;
            }
            if (option.type && !isValidPerSeriesType(normalized.type, option.type)) {
                errors.push({
                    field: `seriesOptions.${key}.type`,
                    code: family === "cartesian" ? "invalidType" : "notAllowed",
                });
            }
            if (option.axis && family !== "cartesian") {
                errors.push({ field: `seriesOptions.${key}.axis`, code: "notAllowed" });
            } else if (option.axis && !["left", "right"].includes(option.axis)) {
                errors.push({ field: `seriesOptions.${key}.axis`, code: "invalidAxis" });
            }
            if (option.stackId !== undefined && typeof option.stackId !== "string") {
                errors.push({ field: `seriesOptions.${key}.stackId`, code: "invalidStackId" });
            } else if (typeof option.stackId === "string" && option.stackId && !supportsStackIdForSeries(normalized.type, option.type)) {
                errors.push({ field: `seriesOptions.${key}.stackId`, code: "notAllowed" });
            }
            if (typeof option.stackId === "string" && option.stackId
                && family === "cartesian") {
                const stackKey = option.stackId;
                const axis = option.axis || "left";
                if (stackAxis.has(stackKey) && stackAxis.get(stackKey) !== axis) {
                    errors.push({ field: `seriesOptions.${key}.stackId`, code: "axisConflict" });
                } else if (!stackAxis.has(stackKey)) {
                    stackAxis.set(stackKey, axis);
                }
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

export function isReportBuilderChartSpecStale(config = {}, chartSpec = null, columns = []) {
    const validation = validateReportBuilderChartSpec(config, chartSpec, columns);
    return !validation.valid;
}

export function buildReportBuilderSettingsHash(state = {}) {
    const signature = JSON.stringify({
        dimensions: normalizeStringArray(state?.selectedDimensions),
        measures: normalizeStringArray(state?.selectedMeasures),
    });
    let hash = 5381;
    for (let i = 0; i < signature.length; i += 1) {
        hash = ((hash << 5) + hash) + signature.charCodeAt(i);
        hash &= 0xffffffff;
    }
    return `rb_${(hash >>> 0).toString(16)}`;
}

export function buildDefaultReportBuilderChartSpec(config = {}, state = {}, seed = {}, options = {}) {
    const columns = buildReportBuilderChartFields(config, state);
    const dimensions = columns.filter((entry) => entry.kind === "dimension");
    const measures = columns.filter((entry) => entry.kind === "measure");
    if (dimensions.length === 0 || measures.length === 0) {
        return null;
    }
    const primaryMeasure = resolveReportBuilderMeasure(config, state?.primaryMeasure) || resolveReportBuilderMeasure(config, measures[0]?.key) || null;
    const defaultYField = String(primaryMeasure?.key || primaryMeasure?.id || measures[0]?.key || "").trim();
    const normalizedSeed = normalizeReportBuilderChartSpec(seed) || {};
    const title = String(normalizedSeed.title || "").trim();
    const type = supportedChartTypeSet(config).has(normalizedSeed.type) ? normalizedSeed.type : getReportBuilderSupportedChartTypes(config)[0];
    const xField = normalizedSeed.xField || dimensions[0]?.key || null;
    const family = chartFamilyForType(type);
    const suggestSeriesField = options?.suggestSeriesField === true;
    const seededYFields = Array.isArray(normalizedSeed.yFields) && normalizedSeed.yFields.length > 0
        ? normalizedSeed.yFields
        : (defaultYField ? [defaultYField] : []);
    const yFields = SINGLE_MEASURE_CATEGORY_TYPES.has(type) ? seededYFields.slice(0, 1) : seededYFields;
    const allowSeriesField = family === "cartesian" && yFields.length === 1;
    const seriesField = allowSeriesField
        ? (
            normalizedSeed.seriesField
            || (suggestSeriesField ? dimensions.find((entry) => entry.key !== xField)?.key : null)
            || null
        )
        : null;
    const allowSeriesOptions = chartFamilyAllowsSeriesOptions(type) && !seriesField;
    const seriesOptions = allowSeriesOptions ? normalizedSeed.seriesOptions : null;
    return normalizeReportBuilderChartSpec({
        ...normalizedSeed,
        ...(title ? { title } : {}),
        type,
        xField,
        yFields,
        ...(seriesField ? { seriesField } : { seriesField: null }),
        ...(seriesOptions ? { seriesOptions } : { seriesOptions: null }),
    });
}

export function buildReportBuilderDefaultChartSpecs(config = {}, state = {}) {
    return normalizeArray(config?.result?.defaultChartSpecs).map((entry) => {
        const built = buildDefaultReportBuilderChartSpec(config, state, entry);
        if (!built) {
            return null;
        }
        return {
            ...built,
            group: String(entry?.group || "").trim(),
            selectionPolicy: String(entry?.selectionPolicy || "").trim().toLowerCase() === "replace" ? "replace" : "",
            title: String(entry?.title || built.title || "").trim() || "Default chart",
        };
    }).filter(Boolean);
}

export function getReportBuilderQuickPresetPolicy(config = {}) {
    const quickPresets = config?.result?.quickPresets;
    const selectionPolicy = String(quickPresets?.selectionPolicy || "").trim().toLowerCase();
    return {
        autoProvisionMissingDimensions: quickPresets?.autoProvisionMissingDimensions === true,
        autoFetchOnSelect: quickPresets?.autoFetchOnSelect === true,
        selectionPolicy: selectionPolicy === "replace" ? "replace" : "merge",
    };
}

export function getReportBuilderAutoChartPolicy(config = {}) {
    const result = config?.result;
    return {
        autoApplyDefaultChartOnResult: result?.autoApplyDefaultChartOnResult === true,
    };
}

export function resolveReportBuilderChartDependencies(config = {}, chartSpec = null) {
    const normalized = normalizeReportBuilderChartSpec(chartSpec);
    if (!normalized) {
        return {
            normalizedChartSpec: null,
            dimensionIds: [],
            dimensions: [],
            measureIds: [],
            measures: [],
        };
    }
    const dimensions = [];
    const seen = new Set();
    [normalized.xField, normalized.seriesField].forEach((fieldKey) => {
        const dimension = resolveReportBuilderDimensionByField(config, fieldKey);
        const dimensionId = String(dimension?.id || "").trim();
        if (!dimension || !dimensionId || seen.has(dimensionId)) {
            return;
        }
        seen.add(dimensionId);
        dimensions.push(dimension);
    });
    const measures = [];
    const seenMeasures = new Set();
    normalizeStringArray(normalized.yFields).forEach((fieldKey) => {
        const measure = resolveReportBuilderMeasureByField(config, fieldKey);
        const measureId = String(measure?.id || "").trim();
        if (!measure || !measureId || seenMeasures.has(measureId)) {
            return;
        }
        seenMeasures.add(measureId);
        measures.push(measure);
    });
    return {
        normalizedChartSpec: normalized,
        dimensionIds: dimensions.map((entry) => String(entry?.id || "").trim()),
        dimensions,
        measureIds: measures.map((entry) => String(entry?.id || "").trim()),
        measures,
    };
}

export function prepareReportBuilderChartApplication(config = {}, state = {}, chartSpec = null, options = {}) {
    const { normalizedChartSpec, dimensionIds, dimensions, measureIds, measures } = resolveReportBuilderChartDependencies(config, chartSpec);
    const selectedDimensionIds = normalizeArray(state?.selectedDimensions)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
    const selectedMeasureIds = normalizeArray(state?.selectedMeasures)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
    const autoProvisionMissingDimensions = options?.autoProvisionMissingDimensions === true;
    const autoProvisionMissingMeasures = options?.autoProvisionMissingMeasures !== false;
    const selectionPolicy = String(options?.selectionPolicy || "").trim().toLowerCase() === "replace" ? "replace" : "merge";
    const missingDimensionIds = dimensionIds.filter((entry) => !selectedDimensionIds.includes(entry));
    const missingDimensions = dimensions.filter((entry) => missingDimensionIds.includes(String(entry?.id || "").trim()));
    const missingMeasureIds = measureIds.filter((entry) => !selectedMeasureIds.includes(entry));
    const missingMeasures = measures.filter((entry) => missingMeasureIds.includes(String(entry?.id || "").trim()));
    const nextSelectedDimensions = selectionPolicy === "replace"
        ? (dimensionIds.length > 0 ? [...dimensionIds] : selectedDimensionIds)
        : (autoProvisionMissingDimensions
            ? [...selectedDimensionIds, ...missingDimensionIds.filter((entry) => !selectedDimensionIds.includes(entry))]
            : selectedDimensionIds);
    const nextSelectedMeasures = selectionPolicy === "replace"
        ? (measureIds.length > 0 ? [...measureIds] : selectedMeasureIds)
        : (autoProvisionMissingMeasures
            ? [...selectedMeasureIds, ...missingMeasureIds.filter((entry) => !selectedMeasureIds.includes(entry))]
            : selectedMeasureIds);
    const nextPrimaryMeasure = measureIds.length > 0
        ? measureIds[0]
        : (nextSelectedMeasures.includes(String(state?.primaryMeasure || "").trim()) ? String(state?.primaryMeasure || "").trim() : (nextSelectedMeasures[0] || ""));
    const nextState = {
        ...state,
        selectedDimensions: nextSelectedDimensions,
        selectedMeasures: nextSelectedMeasures,
        primaryMeasure: nextPrimaryMeasure,
        chartSpec: normalizedChartSpec,
        viewMode: "chart",
        page: 1,
    };
    const chartFields = buildReportBuilderChartFields(config, nextState);
    const validation = validateReportBuilderChartSpec(config, normalizedChartSpec, chartFields);
    const missingDimensionLabels = missingDimensions.map((entry) => String(entry?.label || entry?.id || "").trim()).filter(Boolean);
    const missingDimensionLabel = missingDimensionLabels.join(", ");
    const missingMeasureLabels = missingMeasures.map((entry) => String(entry?.label || entry?.id || "").trim()).filter(Boolean);
    const dimensionSelectionChanged = JSON.stringify(nextSelectedDimensions) !== JSON.stringify(selectedDimensionIds);
    const measureSelectionChanged = JSON.stringify(nextSelectedMeasures) !== JSON.stringify(selectedMeasureIds);
    const primaryMeasureChanged = nextPrimaryMeasure !== String(state?.primaryMeasure || "").trim();
    const selectionChanged = dimensionSelectionChanged || measureSelectionChanged || primaryMeasureChanged;
    const forceAutoFetch = options?.forceAutoFetch === true;
    const shouldFetch = (forceAutoFetch || config?.request?.autoFetch !== false) && canAutoFetchReportBuilder(config, nextState) && selectionChanged;
    let reason = "";
    let message = "";
    if (!normalizedChartSpec) {
        reason = "missingChartSpec";
        message = "This chart preset is incomplete.";
    } else if (missingDimensionIds.length > 0 && !autoProvisionMissingDimensions) {
        reason = "missingDimensions";
        message = missingDimensionLabel
            ? `This chart needs the ${missingDimensionLabel} breakdown${missingDimensionLabels.length > 1 ? "s" : ""}.`
            : "This chart needs an additional breakdown to render.";
    } else if (!validation.valid) {
        reason = "invalidChartSpec";
        message = "This chart could not be applied with the current table fields.";
    }
    return {
        normalizedChartSpec,
        nextState,
        chartFields,
        validation,
        autoProvisionMissingDimensions,
        autoProvisionMissingMeasures,
        selectionPolicy,
        forceAutoFetch,
        missingDimensionIds,
        missingDimensionLabels,
        missingDimensions,
        missingMeasureIds,
        missingMeasureLabels,
        missingMeasures,
        requiresDimensionProvision: missingDimensionIds.length > 0,
        requiresMeasureProvision: missingMeasureIds.length > 0,
        dimensionSelectionChanged,
        measureSelectionChanged,
        primaryMeasureChanged,
        selectionChanged,
        shouldFetch,
        requiresManualRun: !shouldFetch && selectionChanged && canAutoFetchReportBuilder(config, nextState),
        canApply: !!normalizedChartSpec && validation.valid,
        reason,
        message,
    };
}

export function prepareReportBuilderAutoChartApplication(config = {}, state = {}) {
    const policy = getReportBuilderAutoChartPolicy(config);
    if (!policy.autoApplyDefaultChartOnResult) {
        return null;
    }

    const candidates = [];
    const directDefault = sanitizeChartSpecAgainstConfig(config, config?.result?.defaultChartSpec || null);
    if (directDefault) {
        candidates.push(directDefault);
    }
    buildReportBuilderDefaultChartSpecs(config, state).forEach((entry) => {
        candidates.push(entry);
    });

    const seen = new Set();
    for (const candidate of candidates) {
        const normalized = normalizeReportBuilderChartSpec(candidate);
        if (!normalized) {
            continue;
        }
        const fingerprint = JSON.stringify(normalized);
        if (!fingerprint || seen.has(fingerprint)) {
            continue;
        }
        seen.add(fingerprint);
        const prepared = prepareReportBuilderChartApplication(config, state, normalized, {
            autoProvisionMissingDimensions: false,
        });
        if (!prepared.canApply || prepared.requiresDimensionProvision) {
            continue;
        }
        return prepared;
    }
    return null;
}

function normalizeComputedMeasure(definition = {}) {
    if (!definition || typeof definition !== "object") {
        return null;
    }
    const compute = definition.compute || {};
    return {
        ...definition,
        key: definition.key || definition.id,
        dependencies: normalizeArray(definition.dependencies || compute.dependencies).map((entry) => String(entry).trim()).filter(Boolean),
        compute,
    };
}

export function applyReportBuilderComputedMeasures(rows = [], config = {}) {
    const computedMeasures = getComputedReportBuilderMeasures(config).map((entry) => normalizeComputedMeasure(entry)).filter(Boolean);
    if (computedMeasures.length === 0) {
        return Array.isArray(rows) ? rows : [];
    }
    return normalizeArray(rows).map((row) => {
        const next = { ...(row || {}) };
        computedMeasures.forEach((definition) => {
            const outputKey = String(definition.key || definition.id || "").trim();
            if (!outputKey) {
                return;
            }
            const compute = definition.compute || {};
            switch (String(compute.type || "").trim().toLowerCase()) {
                case "ratio": {
                    const numeratorKey = String(compute.numerator || "").trim();
                    const denominatorKey = String(compute.denominator || "").trim();
                    const numerator = Number(resolveKey(next, numeratorKey));
                    const denominator = Number(resolveKey(next, denominatorKey));
                    const scale = Number(compute.scale || 1);
                    const decimals = Number.isFinite(Number(compute.decimals)) ? Number(compute.decimals) : null;
                    let value = 0;
                    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
                        value = (numerator / denominator) * scale;
                    }
                    if (decimals != null) {
                        value = Number(value.toFixed(decimals));
                    }
                    next[outputKey] = value;
                    break;
                }
                default:
                    break;
            }
        });
        return next;
    });
}

export function buildReportBuilderDefaultState(config = {}) {
    const measures = getSelectableReportBuilderMeasures(config);
    const dimensions = getVisibleReportBuilderDimensions(config);
    const staticFilters = normalizeArray(config.staticFilters);
    const dynamicFilterGroups = normalizeArray(config.dynamicFilterGroups);

    const selectedMeasures = defaultSelectedIds(measures);
    const selectedDimensions = defaultSelectedIds(
        dimensions.filter((entry) => entry?.default || entry?.chartAxis || entry?.required),
        0,
    );
    const dimensionFallback = selectedDimensions.length > 0 ? selectedDimensions : defaultSelectedIds(dimensions);

    const groupByDefault = String(config?.groupBy?.default || "").trim();
    const viewModes = normalizeArray(config?.result?.viewModes);
    const defaultViewMode = String(
        config?.result?.defaultMode || viewModes[0] || "chart",
    ).trim() || "chart";
    const orderFields = normalizeArray(config?.result?.orderFields || config?.orderFields);
    const defaultOrder = orderFields.find((entry) => entry?.default) || orderFields[0] || null;
    const defaultPageSize = Number(
        config?.result?.pageSize || config?.request?.limit || 50,
    ) || 50;

    const defaultStaticFilters = {};
    staticFilters.forEach((filter) => {
        const key = String(filter.id || filter.field || "").trim();
        if (!key) return;
        defaultStaticFilters[key] = defaultStaticFilterValue(filter);
    });

    const defaultDynamicGroups = {};
    dynamicFilterGroups.forEach((group) => {
        const key = String(group.id || "").trim();
        if (!key) return;
        defaultDynamicGroups[key] = normalizeDynamicGroupRows(group.defaultRows, group);
    });

    const defaultChartSpec = sanitizeChartSpecAgainstConfig(config, config?.result?.defaultChartSpec || null);
    return {
        selectedMeasures,
        primaryMeasure: String(config?.primaryMeasure || selectedMeasures[0] || "").trim(),
        selectedDimensions: dimensionFallback,
        viewMode: isExplicitReportBuilderChartMode(config) && !defaultChartSpec ? "table" : defaultViewMode,
        chartSpec: defaultChartSpec,
        groupBy: groupByDefault,
        page: 1,
        pageSize: defaultPageSize,
        orderField: String(defaultOrder?.value || defaultOrder?.field || "").trim(),
        orderDir: String(defaultOrder?.defaultDirection || "desc").trim().toLowerCase() || "desc",
        staticFilters: defaultStaticFilters,
        dynamicGroups: defaultDynamicGroups,
    };
}

export function mergeReportBuilderState(config = {}, persisted = {}) {
    const defaults = buildReportBuilderDefaultState(config);
    const dynamicFilterGroups = normalizeArray(config.dynamicFilterGroups);
    const next = {
        ...defaults,
        ...clone(persisted || {}),
        staticFilters: {
            ...defaults.staticFilters,
            ...(persisted?.staticFilters || {}),
        },
        dynamicGroups: {
            ...defaults.dynamicGroups,
        },
    };

    dynamicFilterGroups.forEach((group) => {
        const groupId = String(group.id || "").trim();
        if (!groupId) return;
        const persistedRows = normalizeArray(persisted?.dynamicGroups?.[groupId]);
        next.dynamicGroups[groupId] = normalizeDynamicGroupRows(persistedRows, group);
    });

    next.selectedMeasures = normalizeArray(next.selectedMeasures).map((entry) => String(entry).trim()).filter(Boolean);
    next.selectedDimensions = normalizeArray(next.selectedDimensions).map((entry) => String(entry).trim()).filter(Boolean);
    next.primaryMeasure = String(next.primaryMeasure || next.selectedMeasures[0] || defaults.primaryMeasure || "").trim();
    next.chartSpec = sanitizeChartSpecAgainstConfig(config, next.chartSpec);
    next.viewMode = String(next.viewMode || defaults.viewMode || "chart").trim() || "chart";
    next.groupBy = String(next.groupBy || defaults.groupBy || "").trim();
    next.page = Math.max(1, Number(next.page || defaults.page || 1) || 1);
    next.pageSize = Math.max(1, Number(next.pageSize || defaults.pageSize || 50) || 50);
    next.orderField = String(next.orderField || defaults.orderField || "").trim();
    next.orderDir = String(next.orderDir || defaults.orderDir || "desc").trim().toLowerCase() || "desc";

    if (!next.selectedMeasures.includes(next.primaryMeasure)) {
        next.primaryMeasure = next.selectedMeasures[0] || "";
    }
    if (isExplicitReportBuilderChartMode(config) && !next.chartSpec) {
        next.viewMode = "table";
    }
    return next;
}

export function sanitizeReportBuilderState(config = {}, state = {}) {
    const next = clone(state || {});
    const dynamicGroups = Array.isArray(next.dynamicGroups) ? {} : { ...(next.dynamicGroups || {}) };
    normalizeArray(config?.dynamicFilterGroups).forEach((group) => {
        const groupId = String(group?.id || "").trim();
        if (!groupId) return;
        dynamicGroups[groupId] = normalizeDynamicGroupRows(next?.dynamicGroups?.[groupId], group);
    });
    next.dynamicGroups = dynamicGroups;
    next.chartSpec = sanitizeChartSpecAgainstConfig(config, next.chartSpec);
    if (isExplicitReportBuilderChartMode(config) && !next.chartSpec) {
        next.viewMode = "table";
    }
    return next;
}

export function buildReportBuilderRequest(config = {}, state = {}) {
    const requestConfig = config.request || {};
    const resultConfig = config.result || {};
    const measures = normalizeArray(config.measures);
    const computedMeasures = normalizeArray(config.computedMeasures).map((entry) => normalizeComputedMeasure(entry)).filter(Boolean);
    const dimensions = normalizeArray(config.dimensions);
    const staticFilters = normalizeArray(config.staticFilters);
    const dynamicFilterGroups = normalizeArray(config.dynamicFilterGroups);
    const groupByOptions = normalizeArray(config?.groupBy?.options);
    const orderFields = normalizeArray(resultConfig.orderFields || config.orderFields);

    let request = clone(requestConfig.baseParameters || {});

    normalizeArray(state.selectedMeasures).forEach((id) => {
        const match = measures.find((item) => String(item?.id || "").trim() === String(id).trim());
        if (match) {
            setNestedValue(request, match.paramPath || `measures.${match.id}`, true);
            return;
        }
        const computed = computedMeasures.find((item) => String(item?.id || "").trim() === String(id).trim());
        if (!computed) return;
        computed.dependencies.forEach((dependencyId) => {
            const dependency = measures.find((item) => String(item?.id || "").trim() === String(dependencyId).trim());
            if (!dependency) return;
            setNestedValue(request, dependency.paramPath || `measures.${dependency.id}`, true);
        });
    });

    const selectedDimensionIds = new Set(
        normalizeArray(state.selectedDimensions).map((entry) => String(entry).trim()).filter(Boolean),
    );
    const groupByValue = String(state.groupBy || "").trim();
    if (groupByValue) {
        const groupByOption = groupByOptions.find((entry) => String(entry?.value || "").trim() === groupByValue);
        const dimensionId = String(groupByOption?.dimensionId || groupByValue).trim();
        if (dimensionId) {
            selectedDimensionIds.add(dimensionId);
        }
        if (groupByOption?.paramPath) {
            setNestedValue(request, groupByOption.paramPath, groupByOption.paramValue ?? true);
        }
    }

    Array.from(selectedDimensionIds).forEach((id) => {
        const match = dimensions.find((item) => String(item?.id || "").trim() === id);
        if (!match) return;
        setNestedValue(request, match.paramPath || `dimensions.${match.id}`, true);
    });

    staticFilters.forEach((filter) => {
        const filterId = String(filter.id || filter.field || "").trim();
        if (!filterId) return;
        const value = state?.staticFilters?.[filterId];
        if (filter.type === "dateRange") {
            if (value?.start && (filter.startParamPath || filter.paramPaths?.start)) {
                setNestedValue(request, filter.startParamPath || filter.paramPaths.start, value.start);
            }
            if (value?.end && (filter.endParamPath || filter.paramPaths?.end)) {
                setNestedValue(request, filter.endParamPath || filter.paramPaths.end, value.end);
            }
            return;
        }
        if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
            return;
        }
        const paramPath = filter.paramPath || `filters.${filterId}`;
        setNestedValue(request, paramPath, clone(value));
    });

    const dynamicAggregates = {};
    dynamicFilterGroups.forEach((group) => {
        const groupId = String(group.id || "").trim();
        if (!groupId) return;
        const rows = normalizeArray(state?.dynamicGroups?.[groupId]);
        rows.forEach((row) => {
            if (row?.enabled === false) {
                return;
            }
            const filterDef = normalizeArray(group.filters).find((entry) => String(entry?.id || "").trim() === String(row.filterId || "").trim());
            if (!filterDef) return;
            if (filterDef.requestMapping === "hook" || filterDef.handledByHook === true) {
                return;
            }
            const paramPath = String(filterDef.paramPath || `filters.${filterDef.id}`).trim();
            const values = normalizeArray(row.selections).map((entry) => entry?.value).filter((entry) => entry !== undefined && entry !== null && entry !== "");
            if (!paramPath || values.length === 0) return;
            const emitArray = filterDef.emitArray === true || filterDef.valueMode === "array";
            if (filterDef.multiple === false && !emitArray) {
                dynamicAggregates[paramPath] = values[0];
                return;
            }
            dynamicAggregates[paramPath] = [
                ...normalizeArray(dynamicAggregates[paramPath]),
                ...values,
            ];
        });
    });

    Object.entries(dynamicAggregates).forEach(([paramPath, values]) => {
        if (Array.isArray(values)) {
            const unique = Array.from(new Set(values.map((entry) => JSON.stringify(entry)))).map((entry) => JSON.parse(entry));
            setNestedValue(request, paramPath, unique);
            return;
        }
        setNestedValue(request, paramPath, values);
    });

    request = applyReportBuilderFilterAliases(request);

    const pageSize = Math.max(1, Number(state.pageSize || resultConfig.pageSize || requestConfig.limit || 50) || 50);
    const page = Math.max(1, Number(state.page || 1) || 1);
    request.limit = pageSize;
    request.offset = (page - 1) * pageSize;
    if (requestConfig.offset != null) {
        request.offset = requestConfig.offset;
    }
    if (requestConfig.timeoutMs != null) {
        request.timeoutMs = requestConfig.timeoutMs;
    }
    const selectedOrder = orderFields.find((entry) => {
        const value = String(entry?.value || entry?.field || "").trim();
        return value && value === String(state.orderField || "").trim();
    });
    if (selectedOrder) {
        const dir = String(state.orderDir || selectedOrder.defaultDirection || "desc").trim().toLowerCase() || "desc";
        if (Array.isArray(selectedOrder.orderBy) && selectedOrder.orderBy.length > 0) {
            request.orderBy = clone(selectedOrder.orderBy).map((entry) => String(entry).replace(/\$\{dir\}/g, dir));
        } else if (selectedOrder.orderByDesc && dir === "desc") {
            request.orderBy = [selectedOrder.orderByDesc];
        } else if (selectedOrder.orderByAsc && dir === "asc") {
            request.orderBy = [selectedOrder.orderByAsc];
        } else {
            const field = String(selectedOrder.field || selectedOrder.value || "").trim();
            if (field) {
                request.orderBy = [`${field} ${dir}`];
            }
        }
    } else if (requestConfig.orderBy) {
        request.orderBy = clone(requestConfig.orderBy);
    }
    return request;
}

export function resolveReportBuilderReadiness(config = {}, state = {}) {
    const selectedMeasures = normalizeArray(state?.selectedMeasures).map((entry) => String(entry).trim()).filter(Boolean);
    if (selectedMeasures.length === 0) {
        return { canRun: false, reason: "measure" };
    }

    const staticFilters = normalizeArray(config?.staticFilters);
    for (const filter of staticFilters) {
        if (!filter?.required) continue;
        const filterId = String(filter.id || filter.field || "").trim();
        if (!filterId) continue;
        const value = state?.staticFilters?.[filterId];
        if (filter.type === "dateRange") {
            if (!value?.start || !value?.end) {
                return { canRun: false, reason: "requiredFilter" };
            }
            continue;
        }
        if (filter.multiple) {
            if (!Array.isArray(value) || value.length === 0) {
                return { canRun: false, reason: "requiredFilter" };
            }
            continue;
        }
        if (value == null || value === "") {
            return { canRun: false, reason: "requiredFilter" };
        }
    }

    return { canRun: true, reason: "" };
}

export function canAutoFetchReportBuilder(config = {}, state = {}) {
    return resolveReportBuilderReadiness(config, state).canRun;
}

export function projectLookupSelection(filterDef = {}, record = {}) {
    const valueSelector = String(filterDef.valueSelector || filterDef.valueField || filterDef.field || "id").trim();
    const labelSelector = String(filterDef.labelSelector || filterDef.previewSelector || filterDef.labelField || valueSelector).trim();
    const groupSelector = String(filterDef.groupSelector || "").trim();
    const value = selectFirstDefined(record, lookupValueFallbackSelectors(valueSelector));
    const label = selectFirstDefined(record, lookupLabelFallbackSelectors(labelSelector, valueSelector));
    const group = groupSelector ? resolveKey(record, groupSelector) : "";
    return {
        value,
        label: label == null || label === "" ? String(value ?? "") : String(label),
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
        .map((record) => projectLookupSelection(filterDef, record));
}

function coerceManualSelectionValue(filterDef = {}, rawValue = "") {
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
            return { ok: true, value: normalized, label: normalized };
    }
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

export function buildReportBuilderColumns(config = {}, state = {}) {
    const measures = getSelectableReportBuilderMeasures(config);
    const dimensions = normalizeArray(config.dimensions);

    const selectedDimensions = normalizeArray(state.selectedDimensions)
        .map((id) => dimensions.find((entry) => String(entry?.id || "").trim() === String(id).trim()))
        .filter(Boolean)
        .map((entry) => ({
            key: reportBuilderDimensionValueKey(entry),
            sourceKey: reportBuilderDimensionValueKey(entry),
            displayKey: resolveReportBuilderDimensionDisplayKey(entry),
            chartKey: resolveReportBuilderDimensionDisplayKey(entry),
            label: entry.label || entry.id,
            kind: "dimension",
            format: entry.format,
        }));

    const selectedMeasures = normalizeArray(state.selectedMeasures)
        .map((id) => measures.find((entry) => String(entry?.id || "").trim() === String(id).trim()))
        .filter(Boolean)
        .map((entry) => ({
            key: entry.key || entry.id,
            label: entry.label || entry.id,
            kind: "measure",
            format: entry.format,
            align: entry.align || "right",
        }));

    return [...selectedDimensions, ...selectedMeasures];
}

export function buildExplicitReportBuilderChartContainer(container = {}, config = {}, state = {}, chartSpec = null) {
    const normalized = normalizeReportBuilderChartSpec(chartSpec);
    if (!normalized) {
        return container;
    }
    const measures = getSelectableReportBuilderMeasures(config);
    const xField = resolveReportBuilderDimensionByField(config, normalized.xField);
    const yMeasures = normalizeStringArray(normalized.yFields)
        .map((fieldKey) => measures.find((entry) => String(entry?.key || entry?.id || "").trim() === fieldKey))
        .filter(Boolean);
    if (!xField || yMeasures.length === 0) {
        return container;
    }
    const configuredPalette = config.result?.palette;
    const palette = Array.isArray(configuredPalette) && configuredPalette.length > 0
        ? configuredPalette
        : DEFAULT_CHART_PALETTE;
    const seriesType = normalized.type || "line";
    const family = chartFamilyForType(seriesType);
    const xDisplayKey = resolveReportBuilderDimensionDisplayKey(xField);

    if (seriesType === "pie" || seriesType === "donut") {
        const yMeasure = yMeasures[0];
        return {
            ...container,
            dataSourceRef: container.dataSourceRef,
            collection: container.collection,
            chart: {
                type: seriesType,
                series: {
                    nameKey: xDisplayKey || normalized.xField,
                    valueKey: String(yMeasure?.key || yMeasure?.id || "").trim(),
                    palette,
                },
            },
        };
    }

    const baseChart = {
        type: seriesType,
        xAxis: {
            dataKey: xDisplayKey || reportBuilderDimensionValueKey(xField) || normalized.xField || "name",
            tickFormat: xField?.tickFormat,
        },
        yAxis: {
            format: yMeasures[0]?.format,
        },
    };

    if (family === "cartesian" && normalized.seriesField && yMeasures.length === 1) {
        const yMeasure = yMeasures[0];
        const seriesDimension = resolveReportBuilderDimensionByField(config, normalized.seriesField);
        return {
            ...container,
            dataSourceRef: container.dataSourceRef,
            collection: container.collection,
            chart: {
                ...baseChart,
                series: {
                    nameKey: resolveReportBuilderDimensionDisplayKey(seriesDimension) || normalized.seriesField,
                    valueKey: String(yMeasure?.key || yMeasure?.id || "").trim(),
                    values: [{
                        value: String(yMeasure?.key || yMeasure?.id || "").trim(),
                        label: yMeasure?.label || yMeasure?.id,
                        color: yMeasure?.color || palette[0],
                        format: yMeasure?.format,
                        type: seriesType,
                    }],
                    palette,
                },
            },
        };
    }

    const seriesOptions = normalized.seriesOptions && typeof normalized.seriesOptions === "object"
        ? normalized.seriesOptions
        : {};
    const values = yMeasures.map((measure, index) => {
        const measureKey = String(measure?.key || measure?.id || "").trim();
        const option = seriesOptions[measureKey] || {};
        const entry = {
            value: measureKey,
            label: measure?.label || measure?.id,
            color: measure?.color || palette[index % palette.length],
            format: measure?.format,
            type: option.type || seriesType,
        };
        if (option.axis) entry.axis = option.axis;
        if (option.stackId) entry.stackId = option.stackId;
        return entry;
    });

    return {
        ...container,
        dataSourceRef: container.dataSourceRef,
        collection: container.collection,
        chart: {
            ...baseChart,
            series: {
                values,
                palette,
            },
        },
    };
}

export function addDynamicFilterRow(state = {}, group = {}) {
    const groupId = String(group.id || "").trim();
    if (!groupId) return state;
    const nextRows = normalizeArray(state?.dynamicGroups?.[groupId]).map((row, index) => normalizeDynamicRow(row, group, index));
    nextRows.push(normalizeDynamicRow({}, group, nextRows.length));
    return {
        ...state,
        dynamicGroups: {
            ...(state.dynamicGroups || {}),
            [groupId]: normalizeDynamicGroupRows(nextRows, group),
        },
    };
}

export function updateDynamicFilterRow(state = {}, group = {}, rowId = "", patch = {}) {
    const groupId = String(group.id || "").trim();
    if (!groupId || !rowId) return state;
    const nextRows = normalizeArray(state?.dynamicGroups?.[groupId]).map((row, index) => {
        const normalized = normalizeDynamicRow(row, group, index);
        if (normalized.id !== rowId) {
            return normalized;
        }
        return normalizeDynamicRow({
            ...normalized,
            ...patch,
        }, group, index);
    });
    return {
        ...state,
        dynamicGroups: {
            ...(state.dynamicGroups || {}),
            [groupId]: normalizeDynamicGroupRows(nextRows, group),
        },
    };
}

export function removeDynamicFilterRow(state = {}, group = {}, rowId = "") {
    const groupId = String(group.id || "").trim();
    if (!groupId || !rowId) return state;
    return {
        ...state,
        dynamicGroups: {
            ...(state.dynamicGroups || {}),
            [groupId]: normalizeDynamicGroupRows(
                normalizeArray(state?.dynamicGroups?.[groupId]).filter((row) => String(row?.id || "").trim() !== rowId),
                group,
            ),
        },
    };
}
