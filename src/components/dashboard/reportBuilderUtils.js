import { resolveKey } from "../../utils/selector.js";
import { normalizeSemanticBinding, validateSemanticBinding } from "../../semantic/modelValidation.js";
import {
    applyReportCalculatedFields,
    normalizeReportCalculatedFields,
} from "../../reporting/calculatedFieldModel.js";
import { normalizeReportTableBlockColumn } from "../../reporting/tableVisualSpec.js";
import {
    buildReportBuilderCalculatedFieldConfig,
    normalizeReportBuilderLocalCalculatedFields,
    normalizeReportBuilderLocalTableCalculations,
} from "./reportBuilderCalculatedFieldAuthoring.js";
import {
    normalizeReportBuilderExplorationState,
} from "./reportBuilderExplorationSession.js";
import {
    buildReportBuilderSemanticSelection,
    resolveReportBuilderSemanticSelections,
} from "./reportBuilderSemantic.js";
import {
    resolveReportBuilderDrillMetadata,
} from "../../reporting/reportBuilderDrillMetadata.js";
import {
    getScopeParamValue,
    listScopeParamValues,
    mergeScopeParamValues,
    resolveScopeParamId,
    scopeParamStateSlice,
} from "../../reporting/scopeStateModel.js";
import {
    ALL_SUPPORTED_CHART_TYPES,
    chartFamilyAllowsSeriesOptions,
    chartFamilyForType,
    CARTESIAN_CHART_TYPES,
    isValidPerSeriesType,
    SINGLE_MEASURE_CATEGORY_TYPES,
    supportsStackIdForSeries,
} from "./reportBuilderChartRules.js";
import {
    REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY,
    resolveReportBuilderPersistedRuntimePreviewInteraction,
} from "./reportBuilderRuntimePreviewInteractionPersistence.js";
import {
    normalizeDynamicGroupRows,
    normalizeDynamicRow,
    projectLookupSelection,
    projectLookupSelections,
    projectManualSelection,
} from "./reportBuilderDynamicRows.js";
import {
    resolveReportBuilderDynamicFilterGroups,
    resolveReportBuilderScopeParamFilters,
} from "./reportBuilderPredicates.js";
import { resolveReportRelativeDateRange } from "../../reporting/reportRelativeDateRangeModel.js";

export {
    normalizeDynamicGroupRows,
    projectLookupSelection,
    projectLookupSelections,
    projectManualSelection,
};

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

export function collapseReportBuilderFilterBodyState(filterPanels = {}) {
    if (!filterPanels || typeof filterPanels !== "object" || Array.isArray(filterPanels)) {
        return { common: false };
    }
    return filterPanels.common ? { ...filterPanels, common: false } : filterPanels;
}

export function resolveReportBuilderRailFilterState({
    panelOpen = false,
    canShowResults = false,
    manualRunSequence = 0,
    seededRequestFingerprint = "",
    collapsedSeededFingerprint = "",
} = {}) {
    const open = !!panelOpen;
    const runSequence = Number(manualRunSequence || 0);
    const requestFingerprint = String(seededRequestFingerprint || "").trim();
    const lastCollapsedFingerprint = String(collapsedSeededFingerprint || "").trim();
    return {
        panelOpen: open,
        showRailCategories: !open,
        showOverlayBody: open,
        shouldAutoCollapseSeededPanel: open
            && !!canShowResults
            && Number.isFinite(runSequence)
            && runSequence === 0
            && requestFingerprint !== ""
            && requestFingerprint !== lastCollapsedFingerprint,
    };
}

function resolveRelativeDateRangeDefault(seed = {}) {
    return resolveReportRelativeDateRange(seed?.preset);
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

function resolveSelectedDerivedMeasureIds(state = {}) {
    const currentMeasures = normalizeStringArray(state?.selectedMeasures);
    if (currentMeasures.length === 0) {
        return [];
    }
    const localCalculatedFields = normalizeReportBuilderLocalCalculatedFields(state?.localCalculatedFields);
    const localTableCalculations = normalizeReportBuilderLocalTableCalculations(state?.localTableCalculations);
    const derivedMeasureIds = new Set(
        normalizeReportCalculatedFields([
            ...localCalculatedFields,
            ...localTableCalculations,
        ])
            .map((field) => String(field?.id || field?.key || "").trim())
            .filter(Boolean),
    );
    return currentMeasures.filter((id) => derivedMeasureIds.has(id));
}

function appendPreservedDerivedSelections(config = {}, state = {}, {
    selectedMeasures = [],
    selectedDimensions = [],
} = {}) {
    const nextSelectedMeasures = [...normalizeStringArray(selectedMeasures)];
    const nextSelectedDimensions = [...normalizeStringArray(selectedDimensions)];
    const derivedMeasureIds = resolveSelectedDerivedMeasureIds(state);
    const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, state);
    const localTableCalculationIds = new Set(
        normalizeReportBuilderLocalTableCalculations(state?.localTableCalculations)
            .map((entry) => String(entry?.id || entry?.key || "").trim())
            .filter(Boolean),
    );
    const tableCalculationIndex = new Map(
        getNormalizedTableCalculationMeasures(effectiveConfig)
            .filter((entry) => localTableCalculationIds.has(String(entry?.id || "").trim()))
            .map((entry) => [String(entry?.id || "").trim(), entry])
            .filter(([id]) => !!id),
    );
    derivedMeasureIds.forEach((measureId) => {
        if (!nextSelectedMeasures.includes(measureId)) {
            nextSelectedMeasures.push(measureId);
        }
        const tableCalculation = tableCalculationIndex.get(measureId);
        if (!tableCalculation) {
            return;
        }
        const { requiredDimensionIds } = resolveReportBuilderTableCalculationDimensionRequirements(effectiveConfig, tableCalculation);
        normalizeStringArray(requiredDimensionIds).forEach((dimensionId) => {
            if (!nextSelectedDimensions.includes(dimensionId)) {
                nextSelectedDimensions.push(dimensionId);
            }
        });
    });
    return {
        selectedMeasures: nextSelectedMeasures,
        selectedDimensions: nextSelectedDimensions,
    };
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

function normalizeTablePresetColumns(columns = []) {
    return normalizeArray(columns)
        .map((entry) => normalizeReportTableBlockColumn(typeof entry === "string" ? { key: entry } : entry))
        .filter(Boolean);
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
    return [
        ...normalizeArray(config.calculatedFields),
        ...normalizeArray(config.computedMeasures),
    ].filter((entry) => isVisibleField(entry));
}

export function getTableCalculationReportBuilderMeasures(config = {}) {
    return normalizeArray(config.tableCalculations).filter((entry) => isVisibleField(entry));
}

export function getSelectableReportBuilderMeasures(config = {}) {
    return [
        ...getVisibleReportBuilderMeasures(config),
        ...getComputedReportBuilderMeasures(config),
        ...getTableCalculationReportBuilderMeasures(config),
    ];
}

export function getVisibleReportBuilderDimensions(config = {}) {
    return normalizeArray(config.dimensions).filter((entry) => isVisibleField(entry));
}

function getNormalizedTableCalculationMeasures(config = {}) {
    return normalizeReportCalculatedFields(getTableCalculationReportBuilderMeasures(config))
        .filter((entry) => entry?.kind === "tableCalc");
}

function getNormalizedReportBuilderCalculatedFields(config = {}) {
    return normalizeReportCalculatedFields([
        ...getComputedReportBuilderMeasures(config),
        ...getTableCalculationReportBuilderMeasures(config),
    ]);
}

function resolveReportBuilderTableCalculationDimensionRequirements(config = {}, definition = null) {
    const compute = definition?.compute || {};
    const sourceField = String(compute?.sourceField || "").trim();
    const fieldKeys = Array.from(new Set([
        ...normalizeArray(compute.partitionBy),
        ...normalizeArray(compute.orderBy).map((entry) => entry?.field),
    ].map((entry) => String(entry || "").trim()).filter(Boolean)));
    const requiredDimensions = [];
    const requiredDimensionIds = [];
    const requiredDimensionLabels = [];
    const missingDimensionFields = [];
    const seenDimensionIds = new Set();

    fieldKeys.forEach((fieldKey) => {
        const dimension = resolveReportBuilderDimensionByField(config, fieldKey);
        const dimensionId = String(dimension?.id || "").trim();
        if (dimension && dimensionId) {
            if (!seenDimensionIds.has(dimensionId)) {
                seenDimensionIds.add(dimensionId);
                requiredDimensions.push(dimension);
                requiredDimensionIds.push(dimensionId);
                requiredDimensionLabels.push(String(dimension?.label || dimensionId).trim());
            }
            return;
        }
        if (fieldKey === sourceField || resolveReportBuilderMeasureByField(config, fieldKey)) {
            return;
        }
        missingDimensionFields.push(fieldKey);
    });

    return {
        requiredDimensions,
        requiredDimensionIds,
        requiredDimensionLabels,
        missingDimensionFields,
    };
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
    const dataLabels = String(option.dataLabels || "").trim().toLowerCase();
    if (dataLabels) result.dataLabels = dataLabels;
    const pointColorMode = String(option.pointColorMode || "").trim().toLowerCase();
    if (pointColorMode) result.pointColorMode = pointColorMode === "bysign" ? "bySign" : pointColorMode;
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
    const eyebrow = String(chartSpec.eyebrow || "").trim();
    const accentTone = String(chartSpec.accentTone || "").trim();
    const highlights = normalizeStringArray(chartSpec.highlights);
    const type = String(chartSpec.type || "").trim().toLowerCase() || "line";
    const xField = normalizeChartSpecValue(chartSpec.xField);
    const yFields = normalizeStringArray(chartSpec.yFields || chartSpec.yField).filter(Boolean);
    const seriesField = normalizeChartSpecValue(chartSpec.seriesField);
    const seriesOptions = normalizeChartSeriesOptions(chartSpec.seriesOptions);
    return {
        ...(title ? { title } : {}),
        ...(eyebrow ? { eyebrow } : {}),
        ...(accentTone ? { accentTone } : {}),
        ...(highlights.length > 0 ? { highlights } : {}),
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
                if (["auto", "always", "none"].includes(option.dataLabels)) {
                    next.dataLabels = option.dataLabels;
                }
                if (["series", "bysign"].includes(option.pointColorMode)) {
                    next.pointColorMode = option.pointColorMode === "bysign" ? "bySign" : option.pointColorMode;
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

function resolveReportBuilderOrderFieldEntries(config = {}) {
    return normalizeArray(config?.result?.orderFields || config?.orderFields);
}

export function clearReportBuilderGroupByWhenMissing(config = {}, groupBy = "", selectedDimensions = []) {
    const normalizedGroupBy = String(groupBy || "").trim();
    if (!normalizedGroupBy) {
        return "";
    }
    const normalizedSelectedDimensions = normalizeArray(selectedDimensions)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
    const groupByOptions = normalizeArray(config?.groupBy?.options);
    const groupByDimensionId = String(
        groupByOptions.find((entry) => String(entry?.value || "").trim() === normalizedGroupBy)?.dimensionId
        || normalizedGroupBy,
    ).trim();
    return normalizedSelectedDimensions.includes(groupByDimensionId) ? normalizedGroupBy : "";
}

function resolveReportBuilderOrderFieldToken(entry = {}) {
    return String(entry?.value || entry?.field || "").trim();
}

function resolveReportBuilderOrderFieldEntry(config = {}, orderField = "") {
    const target = String(orderField || "").trim();
    if (!target) {
        return null;
    }
    return resolveReportBuilderOrderFieldEntries(config).find((entry) => resolveReportBuilderOrderFieldToken(entry) === target) || null;
}

function isReportBuilderOrderFieldCompatible(config = {}, state = {}, orderField = "") {
    const entry = resolveReportBuilderOrderFieldEntry(config, orderField);
    if (!entry) {
        return false;
    }
    const target = resolveReportBuilderOrderFieldToken(entry);
    if (!target) {
        return false;
    }
    const selectedDimensions = normalizeArray(state?.selectedDimensions).map((value) => String(value || "").trim()).filter(Boolean);
    const selectedMeasures = normalizeArray(state?.selectedMeasures).map((value) => String(value || "").trim()).filter(Boolean);
    const dimension = resolveReportBuilderDimensionByField(config, target);
    if (dimension) {
        return selectedDimensions.includes(String(dimension?.id || "").trim());
    }
    const measure = resolveReportBuilderMeasureByField(config, target);
    if (measure) {
        return selectedMeasures.includes(String(measure?.id || "").trim());
    }
    return true;
}

function resolveReportBuilderOrderFieldForTarget(config = {}, target = "") {
    const normalizedTarget = String(target || "").trim();
    if (!normalizedTarget) {
        return "";
    }
    const targetDimension = resolveReportBuilderDimensionByField(config, normalizedTarget);
    const targetMeasure = resolveReportBuilderMeasureByField(config, normalizedTarget);
    const match = resolveReportBuilderOrderFieldEntries(config).find((entry) => {
        const entryTarget = resolveReportBuilderOrderFieldToken(entry);
        if (!entryTarget) {
            return false;
        }
        if (entryTarget === normalizedTarget) {
            return true;
        }
        const entryDimension = resolveReportBuilderDimensionByField(config, entryTarget);
        if (entryDimension && targetDimension) {
            return String(entryDimension?.id || "").trim() === String(targetDimension?.id || "").trim();
        }
        const entryMeasure = resolveReportBuilderMeasureByField(config, entryTarget);
        if (entryMeasure && targetMeasure) {
            return String(entryMeasure?.id || "").trim() === String(targetMeasure?.id || "").trim();
        }
        return false;
    });
    return resolveReportBuilderOrderFieldToken(match);
}

function normalizeReportBuilderOrderDirection(value = "") {
    return String(value || "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function normalizeReportBuilderOrderState(config = {}, state = {}, defaults = {}) {
    const orderEntries = resolveReportBuilderOrderFieldEntries(config);
    if (orderEntries.length === 0) {
        return {
            orderField: "",
            orderDir: normalizeReportBuilderOrderDirection(state?.orderDir || defaults?.orderDir || "desc"),
        };
    }
    const currentOrderField = String(state?.orderField || "").trim();
    if (currentOrderField && isReportBuilderOrderFieldCompatible(config, state, currentOrderField)) {
        const currentEntry = resolveReportBuilderOrderFieldEntry(config, currentOrderField);
        return {
            orderField: resolveReportBuilderOrderFieldToken(currentEntry),
            orderDir: normalizeReportBuilderOrderDirection(state?.orderDir || currentEntry?.defaultDirection || defaults?.orderDir || "desc"),
        };
    }
    const fallbackTargets = [
        String(defaults?.orderField || "").trim(),
        ...normalizeArray(state?.selectedMeasures).map((value) => String(value || "").trim()),
        ...normalizeArray(state?.selectedDimensions).map((value) => String(value || "").trim()),
    ];
    for (const target of fallbackTargets) {
        const fallbackField = resolveReportBuilderOrderFieldForTarget(config, target);
        if (!fallbackField) {
            continue;
        }
        if (!isReportBuilderOrderFieldCompatible(config, state, fallbackField)) {
            continue;
        }
        const fallbackEntry = resolveReportBuilderOrderFieldEntry(config, fallbackField);
        return {
            orderField: fallbackField,
            orderDir: normalizeReportBuilderOrderDirection(fallbackEntry?.defaultDirection || defaults?.orderDir || state?.orderDir || "desc"),
        };
    }
    return {
        orderField: "",
        orderDir: normalizeReportBuilderOrderDirection(state?.orderDir || defaults?.orderDir || "desc"),
    };
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
            if (option.dataLabels && !["auto", "always", "none"].includes(option.dataLabels)) {
                errors.push({ field: `seriesOptions.${key}.dataLabels`, code: "invalidDataLabels" });
            }
            if (option.pointColorMode && !["series", "bySign", "bysign"].includes(option.pointColorMode)) {
                errors.push({ field: `seriesOptions.${key}.pointColorMode`, code: "invalidPointColorMode" });
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
    const binding = normalizeSemanticBinding(state?.binding);
    const drillMetadata = normalizeReportBuilderDrillMetadataState(state?.drillMetadata);
    const signature = JSON.stringify({
        ...(binding ? { binding } : {}),
        dimensions: normalizeStringArray(state?.selectedDimensions),
        measures: normalizeStringArray(state?.selectedMeasures),
        localCalculatedFields: normalizeReportBuilderLocalCalculatedFields(state?.localCalculatedFields),
        localTableCalculations: normalizeReportBuilderLocalTableCalculations(state?.localTableCalculations),
        ...(drillMetadata
            ? { drillMetadata }
            : {}),
    });
    let hash = 5381;
    for (let i = 0; i < signature.length; i += 1) {
        hash = ((hash << 5) + hash) + signature.charCodeAt(i);
        hash &= 0xffffffff;
    }
    return `rb_${(hash >>> 0).toString(16)}`;
}

function resolveValidSemanticBinding(binding = null) {
    const normalized = normalizeSemanticBinding(binding);
    if (!normalized) {
        return null;
    }
    const validation = validateSemanticBinding(normalized);
    return validation.valid ? validation.normalizedBinding : null;
}

function normalizeReportBuilderDrillMetadataState(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const normalized = resolveReportBuilderDrillMetadata({}, value);
    const next = {
        ...(Object.prototype.hasOwnProperty.call(value, "hierarchies") ? { hierarchies: normalized.hierarchies } : {}),
        ...(Object.prototype.hasOwnProperty.call(value, "detailTargets") ? { detailTargets: normalized.detailTargets } : {}),
        ...(Object.prototype.hasOwnProperty.call(value, "fieldActions") ? { fieldActions: normalized.fieldActions } : {}),
    };
    return Object.keys(next).length > 0 ? next : null;
}

function normalizeActiveTablePreset(preset = null) {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
        return null;
    }
    const id = String(preset.id || "").trim();
    const title = String(preset.title || "").trim();
    const eyebrow = String(preset.eyebrow || "").trim();
    const accentTone = String(preset.accentTone || "").trim();
    const highlights = normalizeStringArray(preset.highlights);
    const dimensions = normalizeStringArray(preset.dimensions);
    const measures = normalizeStringArray(preset.measures);
    const columns = normalizeTablePresetColumns(preset.columns);
    if (!id || !title || (dimensions.length === 0 && measures.length === 0)) {
        return null;
    }
    const groupBy = String(preset.groupBy || "").trim();
    const primaryMeasure = String(preset.primaryMeasure || measures[0] || "").trim();
    const orderField = String(preset.orderField || "").trim();
    const orderDir = String(preset.orderDir || "").trim().toLowerCase() === "asc" ? "asc" : "desc";
    const pageSize = Math.max(1, Number(preset.pageSize || 0) || 0) || null;
    const description = String(preset.description || "").trim();
    return {
        id,
        title,
        ...(description ? { description } : {}),
        ...(eyebrow ? { eyebrow } : {}),
        ...(accentTone ? { accentTone } : {}),
        ...(highlights.length > 0 ? { highlights } : {}),
        dimensions,
        measures,
        ...(columns.length > 0 ? { columns } : {}),
        ...(primaryMeasure ? { primaryMeasure } : {}),
        ...(groupBy ? { groupBy } : {}),
        ...(orderField ? { orderField } : {}),
        ...(pageSize ? { pageSize } : {}),
        ...(typeof preset?.clearChart === "boolean" ? { clearChart: preset.clearChart } : {}),
        orderDir,
    };
}

function resolveLocalDerivedPresetMeasureIds(preset = null, state = {}) {
    const normalizedPreset = normalizeActiveTablePreset(preset);
    const presetMeasureIds = new Set(normalizedPreset?.measures || []);
    return new Set(
        resolveSelectedDerivedMeasureIds(state)
            .filter((id) => !presetMeasureIds.has(id)),
    );
}

function resolveLocalDerivedPresetDimensionIds(config = {}, preset = null, state = {}) {
    const normalizedPreset = normalizeActiveTablePreset(preset);
    if (!normalizedPreset) {
        return new Set();
    }
    const presetDimensionIds = new Set(normalizedPreset.dimensions);
    const selectedLocalDerivedMeasureIds = new Set(resolveSelectedDerivedMeasureIds(state));
    const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, state);
    const mergedLocalTableCalculations = getNormalizedTableCalculationMeasures(effectiveConfig)
        .filter((entry) => selectedLocalDerivedMeasureIds.has(String(entry?.id || "").trim()));
    const extraDimensionIds = new Set();
    mergedLocalTableCalculations.forEach((tableCalculation) => {
        const { requiredDimensionIds } = resolveReportBuilderTableCalculationDimensionRequirements(effectiveConfig, tableCalculation);
        normalizeStringArray(requiredDimensionIds).forEach((dimensionId) => {
            if (!presetDimensionIds.has(dimensionId)) {
                extraDimensionIds.add(dimensionId);
            }
        });
    });
    return extraDimensionIds;
}

function reconcileActiveTablePresetState(config = {}, state = {}) {
    const next = {
        ...state,
        activeTablePreset: normalizeActiveTablePreset(state?.activeTablePreset),
        lastTablePreset: normalizeActiveTablePreset(state?.lastTablePreset),
    };
    if (next.activeTablePreset && matchesActiveTablePreset(config, next, next.activeTablePreset)) {
        next.lastTablePreset = next.activeTablePreset;
        return next;
    }
    if (next.activeTablePreset && !matchesActiveTablePreset(config, next, next.activeTablePreset)) {
        next.lastTablePreset = next.activeTablePreset;
        next.activeTablePreset = null;
        return next;
    }
    if (!next.activeTablePreset && next.lastTablePreset && matchesActiveTablePreset(config, next, next.lastTablePreset)) {
        next.activeTablePreset = next.lastTablePreset;
    }
    return next;
}

function matchesActiveTablePreset(config = {}, state = {}, preset = null) {
    const normalizedPreset = normalizeActiveTablePreset(preset);
    if (!normalizedPreset) {
        return false;
    }
    const ignoredSelectedMeasureIds = resolveLocalDerivedPresetMeasureIds(normalizedPreset, state);
    const ignoredSelectedDimensionIds = resolveLocalDerivedPresetDimensionIds(config, normalizedPreset, state);
    const comparableSelectedDimensions = normalizeStringArray(state?.selectedDimensions)
        .filter((id) => !ignoredSelectedDimensionIds.has(id));
    const comparableSelectedMeasures = normalizeStringArray(state?.selectedMeasures)
        .filter((id) => !ignoredSelectedMeasureIds.has(id));
    if (JSON.stringify(comparableSelectedDimensions) !== JSON.stringify(normalizedPreset.dimensions)) {
        return false;
    }
    if (JSON.stringify(comparableSelectedMeasures) !== JSON.stringify(normalizedPreset.measures)) {
        return false;
    }
    if (String(state?.primaryMeasure || "").trim() !== String(normalizedPreset.primaryMeasure || "").trim()) {
        return false;
    }
    if (String(state?.groupBy || "").trim() !== String(normalizedPreset.groupBy || "").trim()) {
        return false;
    }
    if (String(normalizedPreset.orderField || "").trim()) {
        if (String(state?.orderField || "").trim() !== normalizedPreset.orderField) {
            return false;
        }
        if (String(state?.orderDir || "").trim().toLowerCase() !== normalizedPreset.orderDir) {
            return false;
        }
    }
    if (normalizedPreset.pageSize && Number(state?.pageSize || 0) !== normalizedPreset.pageSize) {
        return false;
    }
    return true;
}

function resolveMergedSemanticBinding(configBinding = null, persistedBinding = null) {
    const normalizedConfig = resolveValidSemanticBinding(configBinding);
    const normalizedPersisted = resolveValidSemanticBinding(persistedBinding);
    if (!normalizedPersisted) {
        return normalizedConfig;
    }
    if (!normalizedConfig) {
        return normalizedPersisted;
    }
    if (normalizedConfig.mode !== normalizedPersisted.mode) {
        return normalizedConfig;
    }
    if (normalizedConfig.mode === "semantic" && (
        normalizedConfig.modelRef !== normalizedPersisted.modelRef
        || normalizedConfig.entity !== normalizedPersisted.entity
    )) {
        return normalizedConfig;
    }
    return normalizedPersisted;
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
        const eyebrow = String(entry?.eyebrow || "").trim();
        const accentTone = String(entry?.accentTone || "").trim();
        const highlights = normalizeStringArray(entry?.highlights);
        const groupDescription = String(entry?.groupDescription || "").trim();
        if (!built) {
            return null;
        }
        return {
            ...built,
            group: String(entry?.group || "").trim(),
            ...(groupDescription ? { groupDescription } : {}),
            ...(eyebrow ? { eyebrow } : {}),
            ...(accentTone ? { accentTone } : {}),
            ...(highlights.length > 0 ? { highlights } : {}),
            selectionPolicy: String(entry?.selectionPolicy || "").trim().toLowerCase() === "replace" ? "replace" : "",
            title: String(entry?.title || built.title || "").trim() || "Default chart",
        };
    }).filter(Boolean);
}

export function buildReportBuilderDefaultTablePresets(config = {}, state = {}) {
    return normalizeArray(config?.result?.defaultTablePresets).map((entry, index) => {
        const dimensions = normalizeStringArray(entry?.dimensions);
        const measures = normalizeStringArray(entry?.measures);
        const columns = normalizeTablePresetColumns(entry?.columns);
        const highlights = normalizeStringArray(entry?.highlights);
        const eyebrow = String(entry?.eyebrow || "").trim();
        const accentTone = String(entry?.accentTone || "").trim();
        const groupDescription = String(entry?.groupDescription || "").trim();
        if (dimensions.length === 0 && measures.length === 0) {
            return null;
        }
        return {
            id: String(entry?.id || `tablePreset_${index + 1}`).trim(),
            title: String(entry?.title || "Table preset").trim() || "Table preset",
            group: String(entry?.group || "Tables").trim() || "Tables",
            ...(groupDescription ? { groupDescription } : {}),
            description: String(entry?.description || "").trim(),
            ...(eyebrow ? { eyebrow } : {}),
            ...(accentTone ? { accentTone } : {}),
            ...(highlights.length > 0 ? { highlights } : {}),
            ...(columns.length > 0 ? { columns } : {}),
            selectionPolicy: String(entry?.selectionPolicy || "").trim().toLowerCase() === "merge" ? "merge" : "replace",
            dimensions,
            measures,
            primaryMeasure: String(entry?.primaryMeasure || measures[0] || "").trim(),
            ...(String(entry?.groupBy || "").trim() ? { groupBy: String(entry?.groupBy || "").trim() } : {}),
            orderField: String(entry?.orderField || "").trim(),
            orderDir: String(entry?.orderDir || "").trim().toLowerCase() === "asc" ? "asc" : "desc",
            pageSize: Math.max(1, Number(entry?.pageSize || 0) || 0) || null,
            clearChart: entry?.clearChart !== false,
            viewMode: "table",
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

export function buildReportBuilderQuickViewOptions({
    config = {},
    state = {},
    quickPresetPolicy = {},
    defaultTablePresets = [],
    modifiedTablePreset = null,
    defaultChartSpecs = [],
    previousChartPresets = [],
} = {}) {
    const buildTableQuickOptionMeta = (entry = {}) => {
        const metaItems = normalizeStringArray(entry?.highlights);
        if (metaItems.length > 0) {
            return metaItems;
        }
        const derivedItems = [];
        const dimensions = normalizeStringArray(entry?.dimensions);
        const measures = normalizeStringArray(entry?.measures);
        if (dimensions.length > 0) {
            derivedItems.push(`${dimensions.length} breakdown${dimensions.length === 1 ? "" : "s"}`);
        }
        if (measures.length > 0) {
            derivedItems.push(`${measures.length} measure${measures.length === 1 ? "" : "s"}`);
        }
        if (Number(entry?.pageSize || 0) > 0) {
            derivedItems.push(`${Number(entry.pageSize)} rows`);
        }
        return derivedItems;
    };

    const tables = normalizeArray(defaultTablePresets).map((entry, index) => {
        const prepared = prepareReportBuilderTablePresetApplication(config, state, entry, {
            forceAutoFetch: quickPresetPolicy.autoFetchOnSelect,
            selectionPolicy: entry.selectionPolicy || quickPresetPolicy.selectionPolicy,
        });
        const dependencyHint = prepared.canApply
            ? ""
            : (prepared.message ? ` — ${prepared.message}` : "");
        return {
            value: `table:${index}`,
            label: String(entry?.title || "").trim(),
            kind: "table",
            group: String(entry?.group || "Tables").trim() || "Tables",
            groupDescription: String(entry?.groupDescription || "").trim(),
            spec: entry,
            eyebrow: String(entry?.eyebrow || "").trim(),
            accentTone: String(entry?.accentTone || "").trim(),
            metaItems: buildTableQuickOptionMeta(entry),
            description: dependencyHint
                ? `${String(entry?.description || "Table preset").trim() || "Table preset"} ${dependencyHint.trim()}`
                : (String(entry?.description || "").trim() || "Table-first preset that reselects the current query, columns, and sort for an export-ready grid."),
            prepared,
        };
    });

    const modifiedTable = modifiedTablePreset
        ? [{
            value: "table:modified",
            label: `${String(modifiedTablePreset?.title || "").trim() || "Table preset"} (Modified)`,
            kind: "table",
            group: "Modified Table",
            groupDescription: String(modifiedTablePreset?.groupDescription || "").trim(),
            spec: modifiedTablePreset,
            eyebrow: String(modifiedTablePreset?.eyebrow || "").trim(),
            accentTone: String(modifiedTablePreset?.accentTone || "").trim(),
            metaItems: buildTableQuickOptionMeta(modifiedTablePreset),
            description: "Modified table preset. Reapply the last named table preset after custom table changes.",
            prepared: prepareReportBuilderTablePresetApplication(config, state, modifiedTablePreset, {
                forceAutoFetch: quickPresetPolicy.autoFetchOnSelect,
                selectionPolicy: "replace",
            }),
        }]
        : [];

    const defaults = normalizeArray(defaultChartSpecs).map((entry, index) => {
        const selectionPolicy = String(entry?.selectionPolicy || quickPresetPolicy.selectionPolicy || "").trim().toLowerCase() === "replace"
            ? "replace"
            : "merge";
        const prepared = prepareReportBuilderChartApplication(config, state, entry, {
            autoProvisionMissingDimensions: quickPresetPolicy.autoProvisionMissingDimensions,
            forceAutoFetch: quickPresetPolicy.autoFetchOnSelect,
            selectionPolicy,
        });
        const dependencyHint = prepared.requiresDimensionProvision
            ? (
                prepared.autoProvisionMissingDimensions
                    ? ` adds ${prepared.missingDimensionLabels.join(", ")}`
                    : ` requires ${prepared.missingDimensionLabels.join(", ")}`
            )
            : "";
        const authoredDescription = String(entry?.description || "").trim();
        const baseDescription = authoredDescription || `Preset (${entry.type}) that reselects the current table and chart for a curated visual read.`;
        return {
            value: `default:${index}`,
            label: String(entry?.title || "").trim(),
            kind: "default",
            group: String(entry?.group || "").trim() || "Presets",
            groupDescription: String(entry?.groupDescription || "").trim(),
            spec: entry,
            eyebrow: String(entry?.eyebrow || "").trim(),
            accentTone: String(entry?.accentTone || "").trim(),
            metaItems: normalizeStringArray(entry?.highlights),
            description: dependencyHint
                ? `${baseDescription} — ${dependencyHint.trim()}`
                : baseDescription,
            prepared,
        };
    });

    const previous = normalizeArray(previousChartPresets).map((entry, index) => ({
        value: `previous:${index}`,
        label: String(entry?.title || "").trim(),
        kind: "previous",
        group: "Previous",
        spec: entry.chartSpec,
        description: "Previous preset for this field set.",
    }));

    return [...modifiedTable, ...tables, ...defaults, ...previous];
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
    const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, state);
    const { normalizedChartSpec, dimensionIds, dimensions, measureIds, measures } = resolveReportBuilderChartDependencies(effectiveConfig, chartSpec);
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
    const baseSelectedDimensions = selectionPolicy === "replace"
        ? (dimensionIds.length > 0 ? [...dimensionIds] : selectedDimensionIds)
        : (autoProvisionMissingDimensions
            ? [...selectedDimensionIds, ...missingDimensionIds.filter((entry) => !selectedDimensionIds.includes(entry))]
            : selectedDimensionIds);
    const baseSelectedMeasures = selectionPolicy === "replace"
        ? (measureIds.length > 0 ? [...measureIds] : selectedMeasureIds)
        : (autoProvisionMissingMeasures
            ? [...selectedMeasureIds, ...missingMeasureIds.filter((entry) => !selectedMeasureIds.includes(entry))]
            : selectedMeasureIds);
    const {
        selectedDimensions: nextSelectedDimensions,
        selectedMeasures: nextSelectedMeasures,
    } = selectionPolicy === "replace"
        ? appendPreservedDerivedSelections(config, state, {
            selectedMeasures: baseSelectedMeasures,
            selectedDimensions: baseSelectedDimensions,
        })
        : {
            selectedDimensions: baseSelectedDimensions,
            selectedMeasures: baseSelectedMeasures,
        };
    const nextPrimaryMeasure = measureIds.length > 0
        ? measureIds[0]
        : (nextSelectedMeasures.includes(String(state?.primaryMeasure || "").trim()) ? String(state?.primaryMeasure || "").trim() : (nextSelectedMeasures[0] || ""));
    const nextGroupBy = selectionPolicy === "replace"
        ? String(
            dimensions.find((entry) => String(entry?.id || "").trim() === String(normalizedChartSpec?.seriesField || "").trim())?.id
            || ""
        ).trim()
        : String(state?.groupBy || "").trim();
    const nextState = {
        ...state,
        selectedDimensions: nextSelectedDimensions,
        selectedMeasures: nextSelectedMeasures,
        primaryMeasure: nextPrimaryMeasure,
        groupBy: nextGroupBy,
        chartSpec: normalizedChartSpec,
        viewMode: "chart",
        page: 1,
    };
    const normalizedOrder = normalizeReportBuilderOrderState(effectiveConfig, nextState, buildReportBuilderDefaultState(effectiveConfig));
    nextState.orderField = normalizedOrder.orderField;
    nextState.orderDir = normalizedOrder.orderDir;
    const chartFields = buildReportBuilderChartFields(effectiveConfig, nextState);
    const validation = validateReportBuilderChartSpec(effectiveConfig, normalizedChartSpec, chartFields);
    const missingDimensionLabels = missingDimensions.map((entry) => String(entry?.label || entry?.id || "").trim()).filter(Boolean);
    const missingDimensionLabel = missingDimensionLabels.join(", ");
    const missingMeasureLabels = missingMeasures.map((entry) => String(entry?.label || entry?.id || "").trim()).filter(Boolean);
    const dimensionSelectionChanged = JSON.stringify(nextSelectedDimensions) !== JSON.stringify(selectedDimensionIds);
    const measureSelectionChanged = JSON.stringify(nextSelectedMeasures) !== JSON.stringify(selectedMeasureIds);
    const primaryMeasureChanged = nextPrimaryMeasure !== String(state?.primaryMeasure || "").trim();
    const groupByChanged = nextGroupBy !== String(state?.groupBy || "").trim();
    const orderChanged = nextState.orderField !== String(state?.orderField || "").trim()
        || nextState.orderDir !== normalizeReportBuilderOrderDirection(state?.orderDir || "");
    const selectionChanged = dimensionSelectionChanged || measureSelectionChanged || primaryMeasureChanged || groupByChanged || orderChanged;
    const forceAutoFetch = options?.forceAutoFetch === true;
    const shouldFetch = (forceAutoFetch || effectiveConfig?.request?.autoFetch !== false) && canAutoFetchReportBuilder(effectiveConfig, nextState) && selectionChanged;
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
        groupByChanged,
        orderChanged,
        selectionChanged,
        shouldFetch,
        requiresManualRun: !shouldFetch && selectionChanged && canAutoFetchReportBuilder(effectiveConfig, nextState),
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

export function prepareReportBuilderTablePresetApplication(config = {}, state = {}, tablePreset = null, options = {}) {
    const normalizedPreset = tablePreset && typeof tablePreset === "object" ? tablePreset : null;
    if (!normalizedPreset) {
        return {
            normalizedPreset: null,
            nextState: state,
            canApply: false,
            reason: "missingPreset",
            message: "This table preset is incomplete.",
            shouldFetch: false,
            requiresManualRun: false,
            selectionChanged: false,
            dimensionSelectionChanged: false,
            measureSelectionChanged: false,
            primaryMeasureChanged: false,
            orderChanged: false,
            pageSizeChanged: false,
            viewChanged: false,
            missingDimensionIds: [],
            missingMeasureIds: [],
            missingDimensionLabels: [],
            missingMeasureLabels: [],
        };
    }
    const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, state);
    const dimensionDefs = getVisibleReportBuilderDimensions(effectiveConfig);
    const measureDefs = getSelectableReportBuilderMeasures(effectiveConfig);
    const dimensionIndex = new Map(dimensionDefs.map((entry) => [String(entry?.id || "").trim(), entry]));
    const measureIndex = new Map(measureDefs.map((entry) => [String(entry?.id || "").trim(), entry]));
    const requestedDimensions = normalizeStringArray(normalizedPreset.dimensions);
    const requestedMeasures = normalizeStringArray(normalizedPreset.measures);
    const missingDimensionIds = requestedDimensions.filter((id) => !dimensionIndex.has(id));
    const missingMeasureIds = requestedMeasures.filter((id) => !measureIndex.has(id));
    const missingDimensionLabels = missingDimensionIds.map((id) => id);
    const missingMeasureLabels = missingMeasureIds.map((id) => id);
    if (missingDimensionIds.length > 0 || missingMeasureIds.length > 0) {
        const missingParts = [
            missingDimensionLabels.length > 0 ? `breakdowns ${missingDimensionLabels.join(", ")}` : "",
            missingMeasureLabels.length > 0 ? `measures ${missingMeasureLabels.join(", ")}` : "",
        ].filter(Boolean);
        return {
            normalizedPreset,
            nextState: state,
            canApply: false,
            reason: "missingFields",
            message: `This table preset references unavailable ${missingParts.join(" and ")}.`,
            shouldFetch: false,
            requiresManualRun: false,
            selectionChanged: false,
            dimensionSelectionChanged: false,
            measureSelectionChanged: false,
            primaryMeasureChanged: false,
            orderChanged: false,
            pageSizeChanged: false,
            viewChanged: false,
            missingDimensionIds,
            missingMeasureIds,
            missingDimensionLabels,
            missingMeasureLabels,
        };
    }
    const selectionPolicy = String(options?.selectionPolicy || normalizedPreset.selectionPolicy || "").trim().toLowerCase() === "merge" ? "merge" : "replace";
    const currentDimensions = normalizeStringArray(state?.selectedDimensions);
    const currentMeasures = normalizeStringArray(state?.selectedMeasures);
    const baseSelectedDimensions = selectionPolicy === "merge"
        ? [...currentDimensions, ...requestedDimensions.filter((id) => !currentDimensions.includes(id))]
        : (requestedDimensions.length > 0 ? requestedDimensions : currentDimensions);
    const baseSelectedMeasures = selectionPolicy === "merge"
        ? [...currentMeasures, ...requestedMeasures.filter((id) => !currentMeasures.includes(id))]
        : (requestedMeasures.length > 0 ? requestedMeasures : currentMeasures);
    const {
        selectedDimensions: nextSelectedDimensions,
        selectedMeasures: nextSelectedMeasures,
    } = selectionPolicy === "replace"
        ? appendPreservedDerivedSelections(config, state, {
            selectedMeasures: baseSelectedMeasures,
            selectedDimensions: baseSelectedDimensions,
        })
        : {
            selectedDimensions: baseSelectedDimensions,
            selectedMeasures: baseSelectedMeasures,
        };
    const nextPrimaryMeasure = nextSelectedMeasures.includes(String(normalizedPreset.primaryMeasure || "").trim())
        ? String(normalizedPreset.primaryMeasure || "").trim()
        : (nextSelectedMeasures[0] || String(state?.primaryMeasure || "").trim());
    const nextState = {
        ...state,
        selectedDimensions: nextSelectedDimensions,
        selectedMeasures: nextSelectedMeasures,
        primaryMeasure: nextPrimaryMeasure,
        viewMode: "table",
        page: 1,
        groupBy: String(normalizedPreset.groupBy || "").trim(),
        ...(normalizedPreset.orderField ? { orderField: normalizedPreset.orderField } : {}),
        ...(normalizedPreset.orderDir ? { orderDir: normalizedPreset.orderDir } : {}),
        ...(normalizedPreset.pageSize ? { pageSize: normalizedPreset.pageSize } : {}),
        ...(normalizedPreset.clearChart ? { chartSpec: null } : {}),
        activeTablePreset: normalizeActiveTablePreset(normalizedPreset),
        lastTablePreset: normalizeActiveTablePreset(normalizedPreset),
    };
    const normalizedOrder = normalizeReportBuilderOrderState(effectiveConfig, nextState, buildReportBuilderDefaultState(effectiveConfig));
    nextState.orderField = normalizedOrder.orderField;
    nextState.orderDir = normalizedOrder.orderDir;
    const dimensionSelectionChanged = JSON.stringify(nextSelectedDimensions) !== JSON.stringify(currentDimensions);
    const measureSelectionChanged = JSON.stringify(nextSelectedMeasures) !== JSON.stringify(currentMeasures);
    const primaryMeasureChanged = nextPrimaryMeasure !== String(state?.primaryMeasure || "").trim();
    const orderChanged = nextState.orderField !== String(state?.orderField || "").trim()
        || nextState.orderDir !== normalizeReportBuilderOrderDirection(state?.orderDir || "");
    const pageSizeChanged = !!normalizedPreset.pageSize && normalizedPreset.pageSize !== Number(state?.pageSize || 0);
    const viewChanged = String(state?.viewMode || "").trim() !== "table";
    const chartChanged = normalizedPreset.clearChart === true && !!state?.chartSpec;
    const selectionChanged = dimensionSelectionChanged || measureSelectionChanged || primaryMeasureChanged || orderChanged || pageSizeChanged || viewChanged || chartChanged;
    const forceAutoFetch = options?.forceAutoFetch === true;
    const shouldFetch = (forceAutoFetch || effectiveConfig?.request?.autoFetch !== false) && canAutoFetchReportBuilder(effectiveConfig, nextState) && selectionChanged;
    return {
        normalizedPreset,
        nextState,
        canApply: true,
        reason: "",
        message: "",
        shouldFetch,
        requiresManualRun: !shouldFetch && selectionChanged && canAutoFetchReportBuilder(effectiveConfig, nextState),
        selectionChanged,
        dimensionSelectionChanged,
        measureSelectionChanged,
        primaryMeasureChanged,
        orderChanged,
        pageSizeChanged,
        viewChanged,
        missingDimensionIds,
        missingMeasureIds,
        missingDimensionLabels,
        missingMeasureLabels,
    };
}

export function prepareReportBuilderTableCalculationApplication(config = {}, state = {}, tableCalculationId = "", options = {}) {
    const calculationId = String(tableCalculationId || "").trim();
    const tableCalculation = getNormalizedTableCalculationMeasures(config)
        .find((entry) => String(entry?.id || "").trim() === calculationId);
    if (!tableCalculation) {
        return {
            tableCalculation: null,
            nextState: state,
            canApply: false,
            reason: "missingTableCalculation",
            message: "This table calculation is unavailable.",
            shouldFetch: false,
            requiresManualRun: false,
            selectionChanged: false,
            measureSelectionChanged: false,
            dimensionSelectionChanged: false,
            primaryMeasureChanged: false,
            viewChanged: false,
            pageChanged: false,
            requiredDimensionIds: [],
            requiredDimensionLabels: [],
            missingDimensionFields: [],
            requiresDimensionProvision: false,
        };
    }
    const {
        requiredDimensionIds,
        requiredDimensionLabels,
        missingDimensionFields,
    } = resolveReportBuilderTableCalculationDimensionRequirements(config, tableCalculation);
    if (missingDimensionFields.length > 0) {
        return {
            tableCalculation,
            nextState: state,
            canApply: false,
            reason: "missingDimensions",
            message: `This table calculation requires unavailable breakdowns ${missingDimensionFields.join(", ")}.`,
            shouldFetch: false,
            requiresManualRun: false,
            selectionChanged: false,
            measureSelectionChanged: false,
            dimensionSelectionChanged: false,
            primaryMeasureChanged: false,
            viewChanged: false,
            pageChanged: false,
            requiredDimensionIds,
            requiredDimensionLabels,
            missingDimensionFields,
            requiresDimensionProvision: false,
        };
    }
    const currentMeasures = normalizeStringArray(state?.selectedMeasures);
    const currentDimensions = normalizeStringArray(state?.selectedDimensions);
    const nextSelectedMeasures = currentMeasures.includes(calculationId)
        ? currentMeasures
        : [...currentMeasures, calculationId];
    const nextSelectedDimensions = [
        ...currentDimensions,
        ...requiredDimensionIds.filter((entry) => !currentDimensions.includes(entry)),
    ];
    const preservePrimaryMeasure = options?.preservePrimaryMeasure === true;
    const nextPrimaryMeasure = preservePrimaryMeasure
        && String(state?.primaryMeasure || "").trim()
        && nextSelectedMeasures.includes(String(state?.primaryMeasure || "").trim())
        ? String(state?.primaryMeasure || "").trim()
        : calculationId;
    const switchToTable = options?.switchToTable !== false;
    const nextState = {
        ...state,
        selectedDimensions: nextSelectedDimensions,
        selectedMeasures: nextSelectedMeasures,
        primaryMeasure: nextPrimaryMeasure,
        ...(switchToTable ? { viewMode: "table" } : {}),
        page: 1,
    };
    const normalizedOrder = normalizeReportBuilderOrderState(config, nextState, buildReportBuilderDefaultState(config));
    nextState.orderField = normalizedOrder.orderField;
    nextState.orderDir = normalizedOrder.orderDir;
    const measureSelectionChanged = JSON.stringify(nextSelectedMeasures) !== JSON.stringify(currentMeasures);
    const dimensionSelectionChanged = JSON.stringify(nextSelectedDimensions) !== JSON.stringify(currentDimensions);
    const primaryMeasureChanged = nextPrimaryMeasure !== String(state?.primaryMeasure || "").trim();
    const orderChanged = nextState.orderField !== String(state?.orderField || "").trim()
        || nextState.orderDir !== normalizeReportBuilderOrderDirection(state?.orderDir || "");
    const viewChanged = switchToTable && String(state?.viewMode || "").trim() !== "table";
    const pageChanged = Number(state?.page || 1) !== 1;
    const selectionChanged = measureSelectionChanged || dimensionSelectionChanged || primaryMeasureChanged || orderChanged || viewChanged || pageChanged;
    const forceAutoFetch = options?.forceAutoFetch === true;
    const shouldFetch = (forceAutoFetch || config?.request?.autoFetch !== false) && canAutoFetchReportBuilder(config, nextState) && selectionChanged;
    return {
        tableCalculation,
        nextState,
        canApply: true,
        reason: "",
        message: "",
        shouldFetch,
        requiresManualRun: !shouldFetch && selectionChanged && canAutoFetchReportBuilder(config, nextState),
        selectionChanged,
        measureSelectionChanged,
        dimensionSelectionChanged,
        primaryMeasureChanged,
        orderChanged,
        viewChanged,
        pageChanged,
        requiredDimensionIds,
        requiredDimensionLabels,
        missingDimensionFields,
        requiresDimensionProvision: requiredDimensionIds.some((entry) => !currentDimensions.includes(entry)),
    };
}

export function applyReportBuilderComputedMeasures(rows = [], config = {}) {
    return applyReportCalculatedFields(rows, getNormalizedReportBuilderCalculatedFields(config));
}

export function buildReportBuilderDefaultState(config = {}) {
    const measures = getSelectableReportBuilderMeasures(config);
    const dimensions = getVisibleReportBuilderDimensions(config);
    const staticFilters = resolveReportBuilderScopeParamFilters(config);
    const dynamicFilterGroups = resolveReportBuilderDynamicFilterGroups(config);

    const semanticSelections = resolveReportBuilderSemanticSelections(config, config?.binding);
    const selectedMeasures = semanticSelections?.hasExplicitMeasures
        ? semanticSelections.selectedMeasures
        : defaultSelectedIds(measures);
    const selectedDimensions = semanticSelections?.hasExplicitDimensions
        ? semanticSelections.selectedDimensions
        : defaultSelectedIds(
            dimensions.filter((entry) => entry?.default || entry?.chartAxis || entry?.required),
            0,
        );
    const dimensionFallback = semanticSelections?.hasExplicitDimensions
        ? selectedDimensions
        : (selectedDimensions.length > 0 ? selectedDimensions : defaultSelectedIds(dimensions));

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

    const defaultScopeParamValues = {};
    staticFilters.forEach((filter) => {
        const key = resolveScopeParamId(filter);
        if (!key) return;
        defaultScopeParamValues[key] = defaultStaticFilterValue(filter);
    });

    const defaultDynamicGroups = {};
    dynamicFilterGroups.forEach((group) => {
        const key = String(group.id || "").trim();
        if (!key) return;
        defaultDynamicGroups[key] = normalizeDynamicGroupRows(group.defaultRows, group);
    });

    const defaultChartSpec = sanitizeChartSpecAgainstConfig(config, config?.result?.defaultChartSpec || null);
    const defaultBinding = resolveValidSemanticBinding(config?.binding);
    const baseState = {
        selectedMeasures,
        primaryMeasure: String(config?.primaryMeasure || selectedMeasures[0] || "").trim(),
        selectedDimensions: dimensionFallback,
        binding: defaultBinding,
        localCalculatedFields: normalizeReportBuilderLocalCalculatedFields(config?.localCalculatedFields),
        localTableCalculations: normalizeReportBuilderLocalTableCalculations(config?.localTableCalculations),
        viewMode: isExplicitReportBuilderChartMode(config) && !defaultChartSpec ? "table" : defaultViewMode,
        chartSpec: defaultChartSpec,
        groupBy: groupByDefault,
        page: 1,
        pageSize: defaultPageSize,
        orderField: String(defaultOrder?.value || defaultOrder?.field || "").trim(),
        orderDir: String(defaultOrder?.defaultDirection || "desc").trim().toLowerCase() || "desc",
        ...scopeParamStateSlice(defaultScopeParamValues),
        dynamicGroups: defaultDynamicGroups,
    };
    const normalizedOrder = normalizeReportBuilderOrderState(config, baseState, baseState);
    return {
        ...baseState,
        orderField: normalizedOrder.orderField,
        orderDir: normalizedOrder.orderDir,
    };
}

export function mergeReportBuilderState(config = {}, persisted = {}) {
    const defaults = buildReportBuilderDefaultState(config);
    const dynamicFilterGroups = resolveReportBuilderDynamicFilterGroups(config);
    const next = {
        ...mergeScopeParamValues({
            ...defaults,
            ...clone(persisted || {}),
        }, {
            ...listScopeParamValues(defaults),
            ...listScopeParamValues(persisted),
        }),
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

    next.localCalculatedFields = normalizeReportBuilderLocalCalculatedFields(next.localCalculatedFields);
    next.localTableCalculations = normalizeReportBuilderLocalTableCalculations(next.localTableCalculations);
    next.drillMetadata = normalizeReportBuilderDrillMetadataState(next.drillMetadata);
    const normalizedExplorationState = normalizeReportBuilderExplorationState(next);
    Object.keys(next).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(normalizedExplorationState || {}, key)) {
            delete next[key];
        }
    });
    Object.assign(next, normalizedExplorationState || {});
    const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, next);
    next.selectedMeasures = normalizeArray(next.selectedMeasures).map((entry) => String(entry).trim()).filter(Boolean);
    next.selectedDimensions = normalizeArray(next.selectedDimensions).map((entry) => String(entry).trim()).filter(Boolean);
    next.binding = resolveMergedSemanticBinding(config?.binding, next.binding);
    if (!next.drillMetadata) {
        delete next.drillMetadata;
    }
    next.primaryMeasure = String(next.primaryMeasure || next.selectedMeasures[0] || defaults.primaryMeasure || "").trim();
    next.chartSpec = sanitizeChartSpecAgainstConfig(effectiveConfig, next.chartSpec);
    next.viewMode = String(next.viewMode || defaults.viewMode || "chart").trim() || "chart";
    next.groupBy = next.groupBy === undefined || next.groupBy === null
        ? String(defaults.groupBy || "").trim()
        : String(next.groupBy).trim();
    next.page = Math.max(1, Number(next.page || defaults.page || 1) || 1);
    next.pageSize = Math.max(1, Number(next.pageSize || defaults.pageSize || 50) || 50);
    const normalizedOrder = normalizeReportBuilderOrderState(effectiveConfig, next, defaults);
    next.orderField = normalizedOrder.orderField;
    next.orderDir = normalizedOrder.orderDir;
    if (!next.selectedMeasures.includes(next.primaryMeasure)) {
        next.primaryMeasure = next.selectedMeasures[0] || "";
    }
    if (isExplicitReportBuilderChartMode(effectiveConfig) && !next.chartSpec) {
        next.viewMode = "table";
    }
    return reconcileActiveTablePresetState(config, next);
}

export function sanitizeReportBuilderState(config = {}, state = {}) {
    const next = clone(state || {});
    const dynamicGroups = Array.isArray(next.dynamicGroups) ? {} : { ...(next.dynamicGroups || {}) };
    resolveReportBuilderDynamicFilterGroups(config).forEach((group) => {
        const groupId = String(group?.id || "").trim();
        if (!groupId) return;
        dynamicGroups[groupId] = normalizeDynamicGroupRows(next?.dynamicGroups?.[groupId], group);
    });
    next.dynamicGroups = dynamicGroups;
    next.localCalculatedFields = normalizeReportBuilderLocalCalculatedFields(next.localCalculatedFields);
    next.localTableCalculations = normalizeReportBuilderLocalTableCalculations(next.localTableCalculations);
    next.drillMetadata = normalizeReportBuilderDrillMetadataState(next.drillMetadata);
    const normalizedExplorationState = normalizeReportBuilderExplorationState(next);
    Object.keys(next).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(normalizedExplorationState || {}, key)) {
            delete next[key];
        }
    });
    Object.assign(next, normalizedExplorationState || {});
    const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, next);
    next.binding = resolveMergedSemanticBinding(config?.binding, next.binding);
    if (!next.drillMetadata) {
        delete next.drillMetadata;
    }
    const normalizedRuntimePreviewInteraction = resolveReportBuilderPersistedRuntimePreviewInteraction(next);
    if (normalizedRuntimePreviewInteraction) {
        next[REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY] = normalizedRuntimePreviewInteraction;
    } else {
        delete next[REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY];
    }
    next.chartSpec = sanitizeChartSpecAgainstConfig(effectiveConfig, next.chartSpec);
    next.primaryMeasure = String(next.primaryMeasure || next.selectedMeasures?.[0] || "").trim();
    next.selectedMeasures = normalizeArray(next.selectedMeasures).map((entry) => String(entry || "").trim()).filter(Boolean);
    next.selectedDimensions = normalizeArray(next.selectedDimensions).map((entry) => String(entry || "").trim()).filter(Boolean);
    const normalizedOrder = normalizeReportBuilderOrderState(effectiveConfig, next, buildReportBuilderDefaultState(config));
    next.orderField = normalizedOrder.orderField;
    next.orderDir = normalizedOrder.orderDir;
    if (isExplicitReportBuilderChartMode(effectiveConfig) && !next.chartSpec) {
        next.viewMode = "table";
    }
    return reconcileActiveTablePresetState(config, next);
}

export function buildReportBuilderRequest(config = {}, state = {}) {
    const effectiveConfig = buildReportBuilderCalculatedFieldConfig(config, state);
    const requestConfig = effectiveConfig.request || {};
    const resultConfig = effectiveConfig.result || {};
    const measures = normalizeArray(effectiveConfig.measures);
    const calculatedFields = getNormalizedReportBuilderCalculatedFields(effectiveConfig);
    const dimensions = normalizeArray(effectiveConfig.dimensions);
    const staticFilters = resolveReportBuilderScopeParamFilters(effectiveConfig);
    const dynamicFilterGroups = resolveReportBuilderDynamicFilterGroups(effectiveConfig);
    const groupByOptions = normalizeArray(effectiveConfig?.groupBy?.options);
    const orderFields = normalizeArray(resultConfig.orderFields || effectiveConfig.orderFields);
    const resolveBaseMeasureByField = (fieldKey = "") => {
        const target = String(fieldKey || "").trim();
        if (!target) {
            return null;
        }
        return measures.find((item) => {
            const measureId = String(item?.id || "").trim();
            const valueKey = String(item?.key || item?.id || "").trim();
            return target === measureId || target === valueKey;
        }) || null;
    };

    const calculatedFieldById = new Map();
    calculatedFields.forEach((entry) => {
        const aliases = [
            String(entry?.id || "").trim(),
            String(entry?.key || "").trim(),
        ].filter(Boolean);
        aliases.forEach((alias) => {
            if (!calculatedFieldById.has(alias)) {
                calculatedFieldById.set(alias, entry);
            }
        });
    });

    let request = clone(requestConfig.baseParameters || {});

    const selectedDimensionIds = new Set(
        normalizeArray(state.selectedDimensions).map((entry) => String(entry).trim()).filter(Boolean),
    );
    const resolvedDependencyIds = new Set();
    const enableFieldDependency = (fieldKey = "") => {
        const target = String(fieldKey || "").trim();
        if (!target || resolvedDependencyIds.has(target)) {
            return;
        }
        resolvedDependencyIds.add(target);
        const measure = resolveBaseMeasureByField(target);
        if (measure) {
            setNestedValue(request, measure.paramPath || `measures.${measure.id}`, true);
            return;
        }
        const dimension = resolveReportBuilderDimensionByField(effectiveConfig, target);
        const dimensionId = String(dimension?.id || "").trim();
        if (dimension && dimensionId) {
            selectedDimensionIds.add(dimensionId);
            return;
        }
        const calculatedField = calculatedFieldById.get(target);
        if (calculatedField) {
            normalizeArray(calculatedField.dependencies).forEach((dependencyId) => {
                enableFieldDependency(dependencyId);
            });
        }
    };

    normalizeArray(state.selectedMeasures).forEach((id) => {
        const match = measures.find((item) => String(item?.id || "").trim() === String(id).trim());
        if (match) {
            setNestedValue(request, match.paramPath || `measures.${match.id}`, true);
            return;
        }
        const calculatedField = calculatedFieldById.get(String(id).trim());
        if (!calculatedField) {
            return;
        }
        normalizeArray(calculatedField.dependencies).forEach((dependencyId) => {
            enableFieldDependency(dependencyId);
        });
    });

    getNormalizedTableCalculationMeasures(effectiveConfig)
        .filter((definition) => normalizeArray(state.selectedMeasures).map((entry) => String(entry).trim()).includes(String(definition?.id || "").trim()))
        .forEach((definition) => {
            const compute = definition.compute || {};
            [
                ...(Array.isArray(compute.partitionBy) ? compute.partitionBy : []),
                ...(Array.isArray(compute.orderBy) ? compute.orderBy.map((entry) => entry?.field) : []),
            ].forEach((fieldKey) => {
                const dimension = resolveReportBuilderDimensionByField(effectiveConfig, fieldKey);
                const dimensionId = String(dimension?.id || "").trim();
                if (dimensionId) {
                    selectedDimensionIds.add(dimensionId);
                }
            });
        });
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
        const filterId = resolveScopeParamId(filter);
        if (!filterId) return;
        const value = getScopeParamValue(state, filterId);
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

    const semanticSelection = buildReportBuilderSemanticSelection(effectiveConfig, state);
    if (semanticSelection) {
        request.semanticSelection = semanticSelection;
    }

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

    const staticFilters = resolveReportBuilderScopeParamFilters(config);
    for (const filter of staticFilters) {
        if (!filter?.required) continue;
        const filterId = resolveScopeParamId(filter);
        if (!filterId) continue;
        const value = getScopeParamValue(state, filterId);
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

export function buildReportBuilderColumns(config = {}, state = {}) {
    const measures = getSelectableReportBuilderMeasures(config);
    const dimensions = normalizeArray(config.dimensions);
    const activeTablePreset = state?.activeTablePreset && typeof state.activeTablePreset === "object" ? state.activeTablePreset : null;
    const presetColumnIndex = new Map(
        normalizeTablePresetColumns(activeTablePreset?.columns).map((column) => [String(column?.key || "").trim(), column]),
    );
    const applyPresetColumn = (column = {}) => {
        const override = presetColumnIndex.get(String(column?.key || "").trim());
        if (!override) {
            return column;
        }
        return {
            ...column,
            ...(override.label ? { label: override.label } : {}),
            ...(override.format ? { format: override.format } : {}),
            ...(override.align ? { align: override.align } : {}),
            ...(override.cellVisual ? { cellVisual: clone(override.cellVisual) } : {}),
        };
    };

    const selectedDimensions = normalizeArray(state.selectedDimensions)
        .map((id) => dimensions.find((entry) => String(entry?.id || "").trim() === String(id).trim()))
        .filter(Boolean)
        .map((entry) => applyPresetColumn({
            key: reportBuilderDimensionValueKey(entry),
            sourceKey: reportBuilderDimensionValueKey(entry),
            displayKey: resolveReportBuilderDimensionDisplayKey(entry),
            chartKey: resolveReportBuilderDimensionDisplayKey(entry),
            label: entry.label || entry.id,
            kind: "dimension",
            format: entry.format,
            ...(entry?.displayValueMap && typeof entry.displayValueMap === "object" && !Array.isArray(entry.displayValueMap)
                ? { displayValueMap: clone(entry.displayValueMap) }
                : {}),
            ...(entry?.runtimeFilter && typeof entry.runtimeFilter === "object" && !Array.isArray(entry.runtimeFilter)
                ? { runtimeFilterable: true }
                : {}),
        }));

    const selectedMeasures = normalizeArray(state.selectedMeasures)
        .map((id) => measures.find((entry) => String(entry?.id || "").trim() === String(id).trim()))
        .filter(Boolean)
        .map((entry) => applyPresetColumn({
            key: entry.key || entry.id,
            label: entry.label || entry.id,
            kind: "measure",
            format: entry.format,
            ...(entry?.displayValueMap && typeof entry.displayValueMap === "object" && !Array.isArray(entry.displayValueMap)
                ? { displayValueMap: clone(entry.displayValueMap) }
                : {}),
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
        const xSourceKey = reportBuilderDimensionValueKey(xField) || normalized.xField || "name";
        const hasXDisplayValueMap = xField?.displayValueMap && typeof xField.displayValueMap === "object" && !Array.isArray(xField.displayValueMap);
        return {
            ...container,
            dataSourceRef: container.dataSourceRef,
            collection: container.collection,
            chart: {
                type: seriesType,
                series: {
                    nameKey: xDisplayKey || normalized.xField,
                    ...(xSourceKey && ((xDisplayKey && xDisplayKey !== xSourceKey) || hasXDisplayValueMap) ? { sourceNameKey: xSourceKey } : {}),
                    ...(hasXDisplayValueMap
                        ? { displayValueMap: clone(xField.displayValueMap) }
                        : {}),
                    valueKey: String(yMeasure?.key || yMeasure?.id || "").trim(),
                    palette,
                },
            },
        };
    }

    const xSourceKey = reportBuilderDimensionValueKey(xField) || normalized.xField || "name";
    const hasXDisplayValueMap = xField?.displayValueMap && typeof xField.displayValueMap === "object" && !Array.isArray(xField.displayValueMap);
    const baseChart = {
        type: seriesType,
        xAxis: {
            dataKey: xDisplayKey || xSourceKey,
            ...(xSourceKey && ((xDisplayKey && xDisplayKey !== xSourceKey) || hasXDisplayValueMap) ? { sourceDataKey: xSourceKey } : {}),
            ...(hasXDisplayValueMap
                ? { displayValueMap: clone(xField.displayValueMap) }
                : {}),
            tickFormat: xField?.tickFormat,
        },
        yAxis: {
            format: yMeasures[0]?.format,
        },
    };

    if (family === "cartesian" && normalized.seriesField && yMeasures.length === 1) {
        const yMeasure = yMeasures[0];
        const seriesDimension = resolveReportBuilderDimensionByField(config, normalized.seriesField);
        const seriesDisplayKey = resolveReportBuilderDimensionDisplayKey(seriesDimension) || normalized.seriesField;
        const seriesSourceKey = reportBuilderDimensionValueKey(seriesDimension) || normalized.seriesField;
        const hasSeriesDisplayValueMap = seriesDimension?.displayValueMap && typeof seriesDimension.displayValueMap === "object" && !Array.isArray(seriesDimension.displayValueMap);
        return {
            ...container,
            dataSourceRef: container.dataSourceRef,
            collection: container.collection,
            chart: {
                ...baseChart,
                series: {
                    nameKey: seriesDisplayKey,
                    ...(seriesSourceKey && ((seriesDisplayKey && seriesDisplayKey !== seriesSourceKey) || hasSeriesDisplayValueMap) ? { sourceNameKey: seriesSourceKey } : {}),
                    ...(hasSeriesDisplayValueMap
                        ? { displayValueMap: clone(seriesDimension.displayValueMap) }
                        : {}),
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
        if (option.dataLabels) entry.dataLabels = option.dataLabels;
        if (option.pointColorMode) entry.pointColorMode = option.pointColorMode;
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
