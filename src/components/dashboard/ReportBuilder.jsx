import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon } from "@blueprintjs/core";
import { useSignals } from "@preact/signals-react/runtime";

import Chart from "../Chart.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey } from "../../utils/selector.js";
import { formatDashboardValue } from "./dashboardUtils.js";
import {
    chartFamilyForType,
    chartFamilyHelperText,
    chartTypeLabel,
    CARTESIAN_CHART_TYPES,
    PER_SERIES_TYPE_CHOICES,
    SINGLE_MEASURE_CATEGORY_TYPES,
    supportsStackForSeries,
} from "./reportBuilderChartRules.js";
import {
    formatCompactDateRangeSummary,
    resolveCompactStatusText,
    resolveCompactSummaryItems,
} from "./reportBuilderCompactState.js";
import {
    buildReportBuilderActionModel,
} from "./reportBuilderActionModel.js";
import {
    buildReportBuilderChartQueryRequest,
    getReportBuilderChartDataPolicy,
    resolveReportBuilderChartCollection,
    resolveReportBuilderExportCollection,
} from "./reportBuilderResultData.js";
import {
    hasStoredReportBuilderState,
    loadStoredReportBuilderState,
    persistStoredReportBuilderState,
    replaceReportBuilderWindowState,
    resolveLegacyReportBuilderStateStorageScopes,
    resolveReportBuilderStateStorageScope,
    resolveEffectiveReportBuilderState,
    shouldHydrateStoredReportBuilderWindowState,
    shouldPersistReportBuilderWindowState,
} from "./reportBuilderPersistence.js";
import {
    applyReportBuilderRequestHook,
    applyReportBuilderStateHook,
    buildLookupHydrationJobs,
    hydrateReportBuilderLookupLabels,
    prefillSignature,
    shouldDeferReportBuilderRequestForPrefill,
    resolveReportBuilderHookHandler,
    resolveReportBuilderLookupDescriptor,
    resolveReportBuilderNotices,
} from "./reportBuilderHooks.js";
import {
    InlineStaticFilterControl,
    ReportBuilderChartDialog,
    ReportBuilderChartQuickActions,
    ReportBuilderCompactSheetTab,
    ReportBuilderOverflowActions,
    ReportBuilderResultState,
    StaticFilterSection,
} from "./reportBuilderComponents.jsx";
import {
    buildDynamicFamilyOptions,
    buildDynamicFamilyRows,
    DynamicFamilyGroup,
    DynamicFilterGroup,
} from "./reportBuilderDynamicFilters.jsx";
import {
    applyReportBuilderComputedMeasures,
    addDynamicFilterRow,
    buildDefaultReportBuilderChartSpec,
    buildExplicitReportBuilderChartContainer,
    buildReportBuilderChartFields,
    buildReportBuilderColumns,
    buildReportBuilderDefaultChartSpecs,
    buildReportBuilderDefaultState,
    applyReportBuilderFilterAliases,
    getReportBuilderQuickPresetPolicy,
    buildReportBuilderRequest,
    buildReportBuilderSettingsHash,
    canAutoFetchReportBuilder,
    prepareReportBuilderAutoChartApplication,
    getReportBuilderResultPanePosition,
    getSelectableReportBuilderMeasures,
    getReportBuilderSupportedChartTypes,
    getVisibleReportBuilderDimensions,
    isExplicitReportBuilderChartMode,
    isReportBuilderChartSpecStale,
    mergeReportBuilderState,
    normalizeDynamicGroupRows,
    normalizeReportBuilderChartSpec,
    prepareReportBuilderChartApplication,
    projectManualSelection,
    projectLookupSelections,
    removeDynamicFilterRow,
    resolveReportBuilderDimensionDisplayKey,
    resolveReportBuilderMeasure,
    resolveReportBuilderReadiness,
    sanitizeReportBuilderState,
    shouldAutoCollapseReportBuilderFilters,
    updateDynamicFilterRow,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";

function getBuilderConfig(container = {}) {
    return container.dashboard?.reportBuilder || container.reportBuilder || container.builder || {};
}

function getLookupExtensionConfig(config = {}) {
    const extension = config?.extensions?.lookupFilters;
    if (extension && typeof extension === "object") {
        return extension;
    }
    return {};
}

function getBuilderStateKey(container = {}) {
    return String(container.stateKey || container.id || "reportBuilder").trim() || "reportBuilder";
}

function measureById(config = {}, id = "") {
    return resolveReportBuilderMeasure(config, id);
}

function dimensionById(config = {}, id = "") {
    return (config.dimensions || []).find((entry) => String(entry?.id || "").trim() === String(id || "").trim()) || null;
}

function groupByOption(config = {}, value = "") {
    return (config?.groupBy?.options || []).find((entry) => String(entry?.value || "").trim() === String(value || "").trim()) || null;
}

function resolveMeasureSections(config = {}, measures = []) {
    const sectionConfig = Array.isArray(config.measureSections) ? config.measureSections : [];
    const configIndex = new Map(
        sectionConfig
            .map((section, index) => ({
                id: String(section?.id || "").trim(),
                label: section?.label,
                order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index,
            }))
            .filter((section) => section.id)
            .map((section) => [section.id, section]),
    );
    const grouped = new Map();
    measures.forEach((measure) => {
        const sectionId = String(measure?.section || "").trim() || "default";
        const sectionMeta = configIndex.get(sectionId) || {};
        const existing = grouped.get(sectionId) || {
            id: sectionId,
            label: sectionMeta.label || (sectionId === "default" ? "" : sectionId),
            order: Number.isFinite(sectionMeta.order) ? sectionMeta.order : Number.MAX_SAFE_INTEGER,
            measures: [],
        };
        existing.measures.push(measure);
        grouped.set(sectionId, existing);
    });
    const sections = Array.from(grouped.values())
        .filter((section) => Array.isArray(section.measures) && section.measures.length > 0)
        .sort((left, right) => {
            if (left.order !== right.order) {
                return left.order - right.order;
            }
            return String(left.label || left.id).localeCompare(String(right.label || right.id));
        });
    const sectionIds = sections.map((section) => String(section.id || "").trim().toLowerCase()).filter(Boolean);
    const shouldFlattenDefaultSections = sectionIds.length > 1 && sectionIds.every((id) => ["core", "computed", "default"].includes(id));
    if (!shouldFlattenDefaultSections) {
        return sections;
    }
    return [{
        id: "all",
        label: "",
        order: 0,
        measures: sections.flatMap((section) => section.measures || []),
    }];
}

function hasConfiguredFilterValue(filter = {}, value) {
    if (filter.type === "dateRange") {
        return !!(value?.start || value?.end);
    }
    if (filter.multiple) {
        return Array.isArray(value) && value.length > 0;
    }
    return value != null && value !== "";
}

function countConfiguredFilterValue(filter = {}, value) {
    if (!hasConfiguredFilterValue(filter, value)) {
        return 0;
    }
    if (filter.type === "dateRange") {
        return 1;
    }
    if (filter.multiple) {
        return Array.isArray(value) ? value.length : 0;
    }
    return 1;
}

function countConfiguredDynamicSelections(rows = []) {
    return (Array.isArray(rows) ? rows : []).reduce((total, row) => (
        total + (Array.isArray(row?.selections) ? row.selections.length : 0)
    ), 0);
}

function filterCategoryIcon(category = {}) {
    if (typeof category === "string") {
        return "filter";
    }
    const explicit = String(category?.icon || "").trim();
    return explicit || "filter";
}

function filterCategoryStateLabel({ active = false, configuredCount = 0 } = {}) {
    if (configuredCount > 0) {
        return String(configuredCount);
    }
    return active ? "Shown" : "Add";
}

function filterCategoryTitle(label = "", { active = false, configuredCount = 0 } = {}) {
    const parts = [String(label || "").trim()].filter(Boolean);
    if (configuredCount > 0) {
        parts.push(`${configuredCount} configured`);
    }
    parts.push(active ? "shown" : "available");
    return parts.join(" • ");
}

function renderReportBuilderError(error) {
    if (error == null) {
        return "";
    }
    if (typeof error === "string") {
        return error;
    }
    if (typeof error?.message === "string" && error.message.trim()) {
        return error.message.trim();
    }
    try {
        return JSON.stringify(error);
    } catch (_) {
        return "Unexpected error";
    }
}

function escapeCsvCell(value) {
    const text = value == null ? "" : String(value);
    if (!/[",\n]/.test(text)) {
        return text;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

function buildChartContainer(container = {}, config = {}, state = {}) {
    const selectedMeasures = (state.selectedMeasures || [])
        .map((id) => measureById(config, id))
        .filter(Boolean);
    const primaryMeasure = measureById(config, state.primaryMeasure) || selectedMeasures[0] || null;
    const selectedDimensions = (state.selectedDimensions || [])
        .map((id) => dimensionById(config, id))
        .filter(Boolean);
    const xDimension = selectedDimensions.find((entry) => entry?.chartAxis || entry?.axis === "x")
        || selectedDimensions[0]
        || (config.dimensions || []).find((entry) => entry?.chartAxis || entry?.axis === "x")
        || config.dimensions?.[0]
        || null;
    const groupOption = groupByOption(config, state.groupBy);
    const groupDimension = dimensionById(config, groupOption?.dimensionId || groupOption?.value || state.groupBy);
    const palette = selectedMeasures.map((entry, index) => entry?.color || config.result?.palette?.[index]).filter(Boolean);

    const directSeries = {
        values: selectedMeasures.map((entry, index) => ({
            value: entry.key || entry.id,
            label: entry.label || entry.id,
            color: entry.color || config.result?.palette?.[index],
            format: entry.format,
        })),
    };

    const groupedSeries = {
        nameKey: resolveReportBuilderDimensionDisplayKey(groupDimension) || groupDimension?.key || groupDimension?.id,
        valueKey: primaryMeasure?.key || primaryMeasure?.id,
        palette,
    };
    const preferDirectSeries = selectedMeasures.length > 1;

    return {
        ...container,
        dataSourceRef: container.dataSourceRef,
        collection: container.collection,
        chart: {
            type: config.result?.chartType || "line",
            xAxis: {
                dataKey: resolveReportBuilderDimensionDisplayKey(xDimension) || xDimension?.key || xDimension?.id || "name",
                tickFormat: xDimension?.tickFormat,
            },
            yAxis: {
                format: primaryMeasure?.format,
            },
            series: !preferDirectSeries && groupDimension ? groupedSeries : directSeries,
        },
    };
}

function resolveReportBuilderCellValue(row = {}, column = {}) {
    const displayKey = String(column?.displayKey || "").trim();
    if (column?.kind === "dimension" && displayKey) {
        const displayValue = resolveKey(row, displayKey);
        if (displayValue !== undefined && displayValue !== null && displayValue !== "") {
            return displayValue;
        }
    }
    return resolveKey(row, column?.key);
}

const REPORT_BUILDER_CHART_PRESET_PREFIX = "reportBuilder.chartPresets";

function chartPresetStorageKey(storageScope = "") {
    const normalized = String(storageScope || "").trim() || "reportBuilder";
    return `${REPORT_BUILDER_CHART_PRESET_PREFIX}.${normalized}`;
}

function loadStoredChartPresets(storageScope = "", legacyScopes = []) {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }
    try {
        const scopes = Array.from(new Set([storageScope, ...(Array.isArray(legacyScopes) ? legacyScopes : [legacyScopes])]
            .map((entry) => String(entry || "").trim())));
        if (scopes.length === 0) {
            scopes.push("");
        }
        for (const scope of scopes) {
            const raw = window.localStorage.getItem(chartPresetStorageKey(scope));
            if (!raw) {
                continue;
            }
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
        return [];
    } catch (_) {
        return [];
    }
}

function persistStoredChartPresets(storageScope = "", presets = [], legacyScopes = []) {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(chartPresetStorageKey(storageScope), JSON.stringify(presets));
        Array.from(new Set((Array.isArray(legacyScopes) ? legacyScopes : [legacyScopes])
            .map((entry) => String(entry || "").trim())
            .filter((entry) => entry && entry !== String(storageScope || "").trim()))).forEach((scope) => {
            window.localStorage.removeItem(chartPresetStorageKey(scope));
        });
    } catch (_) {}
}

function dedupeChartPresets(presets = []) {
    const seen = new Map();
    normalizeArray(presets).forEach((preset) => {
        const title = String(preset?.title || "").trim();
        const settingsHash = String(preset?.settingsHash || "").trim();
        const chartSpec = normalizeReportBuilderChartSpec(preset?.chartSpec);
        if (!title || !settingsHash || !chartSpec) {
            return;
        }
        const key = JSON.stringify({ title, settingsHash, chartSpec });
        if (seen.has(key)) {
            return;
        }
        seen.set(key, {
            title,
            settingsHash,
            chartSpec,
            updatedAt: Number(preset?.updatedAt || Date.now()) || Date.now(),
        });
    });
    return Array.from(seen.values()).sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

function upsertChartPreset(presets = [], nextPreset = null) {
    return dedupeChartPresets([nextPreset, ...normalizeArray(presets)]);
}

function fieldLabelForError(field = "", { dimensions = [], measures = [] } = {}) {
    const raw = String(field || "").trim();
    if (!raw) return "Field";
    if (raw === "xField") return "X-axis";
    if (raw === "yFields") return "Measures";
    if (raw === "seriesField") return "Series dimension";
    if (raw === "seriesOptions") return "Per-measure options";
    if (raw === "type") return "Chart type";
    if (raw === "chartSpec") return "Chart";
    const yMatch = /^yFields\.(\d+)$/.exec(raw);
    if (yMatch) {
        return `Measure ${Number(yMatch[1]) + 1}`;
    }
    const optMatch = /^seriesOptions\.([^.]+)(?:\.(\w+))?$/.exec(raw);
    if (optMatch) {
        const measureKey = optMatch[1];
        const measure = measures.find((entry) => entry.key === measureKey);
        const label = measure?.label || measureKey;
        switch (optMatch[2]) {
            case "type": return `${label} render type`;
            case "axis": return `${label} axis`;
            case "stackId": return `${label} stack group`;
            default: return label;
        }
    }
    return raw;
}

function chartErrorMessage(error = {}, context = {}) {
    const field = String(error?.field || "").trim();
    const label = fieldLabelForError(field, context);
    switch (String(error?.code || "").trim()) {
        case "missingField":
            return `${label} is no longer available in the current table.`;
        case "wrongKind":
            return `${label} has the wrong field type for this chart.`;
        case "duplicateField":
            return `${label} duplicates another chart field.`;
        case "unsupportedType":
            return "This chart type is not supported by the current renderer.";
        case "empty":
            return `${label} requires at least one selection.`;
        case "notAllowed":
            if (field === "seriesField") {
                return "A series dimension cannot be combined with this chart type or with multiple measures.";
            }
            if (field === "seriesOptions") {
                return "Per-measure options cannot be combined with a series dimension or with this chart type.";
            }
            if (field.endsWith(".axis")) {
                return `${label} isn't supported for this chart type.`;
            }
            if (field.endsWith(".stackId")) {
                return `${label} isn't supported for this measure on the current chart type.`;
            }
            if (field.endsWith(".type")) {
                return `${label} isn't allowed for this chart type.`;
            }
            return `${label} isn't allowed for this chart type.`;
        case "tooManyMeasures":
            if (field === "seriesField") {
                return "A series dimension can only be used with a single measure. Remove extra measures to continue.";
            }
            return "This chart type supports only one measure. Remove extras to continue.";
        case "unknownMeasure":
            return `${label} refers to a measure that is no longer selected.`;
        case "invalidType":
            return `${label} isn't a valid render type for this chart family.`;
        case "invalidAxis":
            return `${label} must be set to left or right.`;
        case "invalidStackId":
            return `${label} must be a plain text value.`;
        case "axisConflict":
            return `${label} conflicts with another measure assigned to the opposite axis. Stacked measures must share an axis.`;
        case "missing":
        default:
            return "Chart settings are incomplete.";
    }
}

function sanitizeChartDraftPatch(currentDraft = {}, patch = {}) {
    const next = { ...(currentDraft || {}), ...(patch || {}) };
    const nextType = String(next.type || "").trim().toLowerCase();
    const nextFamily = chartFamilyForType(nextType);
    let nextY = Array.isArray(next.yFields) ? next.yFields.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
    nextY = Array.from(new Set(nextY));
    if (SINGLE_MEASURE_CATEGORY_TYPES.has(nextType)) {
        nextY = nextY.slice(0, 1);
    }
    next.yFields = nextY;
    if (nextFamily === "category") {
        next.seriesField = null;
    } else if (nextY.length > 1) {
        next.seriesField = null;
    } else if (next.seriesField && next.seriesField === next.xField) {
        next.seriesField = null;
    }
    const optionsAllowed = (nextFamily === "cartesian" || nextType === "horizontal_bar")
        && nextY.length > 1
        && !next.seriesField;
    if (!optionsAllowed) {
        next.seriesOptions = null;
    } else if (next.seriesOptions && typeof next.seriesOptions === "object" && !Array.isArray(next.seriesOptions)) {
        const ySet = new Set(nextY);
        const cleaned = {};
        Object.entries(next.seriesOptions).forEach(([key, value]) => {
            if (!ySet.has(key)) return;
            if (!value || typeof value !== "object") return;
            const trimmed = {};
            const nextSeriesType = String(value.type || "").trim().toLowerCase();
            Object.entries(value).forEach(([optionKey, optionValue]) => {
                if (optionValue === "" || optionValue === null || optionValue === undefined) return;
                if (optionKey === "stackId" && !supportsStackForSeries(nextType, nextSeriesType)) {
                    return;
                }
                if (optionKey === "axis" && nextFamily !== "cartesian") {
                    return;
                }
                if (optionKey === "type" && nextFamily !== "cartesian") {
                    return;
                }
                trimmed[optionKey] = optionValue;
            });
            if (Object.keys(trimmed).length > 0) {
                cleaned[key] = trimmed;
            }
        });
        next.seriesOptions = Object.keys(cleaned).length > 0 ? cleaned : null;
    }
    return next;
}

function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value.filter((entry) => entry !== undefined && entry !== null && entry !== "");
    }
    if (value === undefined || value === null || value === "") {
        return [];
    }
    return [value];
}

function nextDynamicRowId(rows = []) {
    let maxIndex = 0;
    normalizeArray(rows).forEach((row) => {
        const match = /^row_(\d+)$/.exec(String(row?.id || "").trim());
        if (!match) {
            return;
        }
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > maxIndex) {
            maxIndex = value;
        }
    });
    return `row_${maxIndex + 1}`;
}

function resolveDynamicGroupLayout(config = {}, activeGroupIds = []) {
    const active = Array.isArray(activeGroupIds) ? activeGroupIds : [];
    const layout = config?.dynamicGroupLayout;
    if (!layout || typeof layout !== "object") {
        return {
            fullWidthIds: [],
            columnRows: [active],
        };
    }
    const fullWidthIds = normalizeArray(layout.fullWidthIds)
        .map((entry) => String(entry || "").trim())
        .filter((entry) => active.includes(entry));
    const used = new Set(fullWidthIds);
    const columnRows = normalizeArray(layout.columnRows)
        .map((row) => normalizeArray(row).map((entry) => String(entry || "").trim()).filter((entry) => active.includes(entry) && !used.has(entry)))
        .filter((row) => row.length > 0);
    columnRows.forEach((row) => row.forEach((entry) => used.add(entry)));
    const remaining = active.filter((entry) => !used.has(entry));
    if (remaining.length > 0) {
        columnRows.push(remaining);
    }
    return {
        fullWidthIds,
        columnRows: columnRows.length > 0 ? columnRows : [active.filter((entry) => !fullWidthIds.includes(entry))],
    };
}

function resolveDynamicFilterFamilies(config = {}) {
    return normalizeArray(config?.dynamicFilterFamilies).map((entry, index) => ({
        id: String(entry?.id || "").trim(),
        label: String(entry?.label || entry?.id || "").trim(),
        description: String(entry?.description || "").trim(),
        includeFilterIds: normalizeArray(entry?.includeFilterIds).map((value) => String(value || "").trim()).filter(Boolean),
        excludeFilterIds: normalizeArray(entry?.excludeFilterIds).map((value) => String(value || "").trim()).filter(Boolean),
        order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : index,
    })).filter((entry) => entry.id && (entry.includeFilterIds.length > 0 || entry.excludeFilterIds.length > 0))
      .sort((left, right) => left.order - right.order);
}

export default function ReportBuilder({ container, context }) {
    useSignals();
    const config = useMemo(() => getBuilderConfig(container), [container]);
    const filterPresentation = String(
        config?.filterPresentation
        || config?.layout?.filterPresentation
        || ""
    ).trim().toLowerCase();
    const useFilterRail = filterPresentation === "rail-left";
    const useFilterDrawer = filterPresentation === "drawer-left";
    const builderContext = container?.dataSourceRef && typeof context?.Context === "function"
        ? context.Context(container.dataSourceRef)
        : context;
    const stateKey = useMemo(() => getBuilderStateKey(container), [container]);
    const stateStorageScope = useMemo(() => resolveReportBuilderStateStorageScope({
        stateKey,
        windowId: builderContext?.identity?.windowId,
        dataSourceRef: builderContext?.identity?.dataSourceRef || container?.dataSourceRef,
        containerId: container?.id,
    }), [builderContext?.identity?.dataSourceRef, builderContext?.identity?.windowId, container?.dataSourceRef, container?.id, stateKey]);
    const legacyStateStorageScopes = useMemo(() => resolveLegacyReportBuilderStateStorageScopes({
        stateKey,
        stateStorageScope,
    }), [stateKey, stateStorageScope]);
    const legacyChartPresetScopes = useMemo(() => resolveLegacyReportBuilderStateStorageScopes({
        stateKey,
        stateStorageScope,
    }), [stateKey, stateStorageScope]);
    const windowFormSignal = builderContext?.signals?.windowForm;
    const windowFormValue = windowFormSignal?.value || {};
    const persistedState = resolveKey(windowFormValue || {}, stateKey);
    const locallyStoredState = useMemo(
        () => loadStoredReportBuilderState(stateStorageScope, legacyStateStorageScopes),
        [legacyStateStorageScopes, stateStorageScope],
    );
    const effectivePersistedState = useMemo(() => {
        return resolveEffectiveReportBuilderState(persistedState, locallyStoredState);
    }, [locallyStoredState, persistedState]);
    const currentPrefillSignature = prefillSignature(windowFormValue);
    const state = useMemo(() => mergeReportBuilderState(config, effectivePersistedState), [config, effectivePersistedState]);
    const requestFingerprintRef = useRef("");
    const lastManualRunFingerprintRef = useRef("");
    const lastAutoCollapsedRunSequenceRef = useRef(0);
    const lastAutoAppliedChartCycleRef = useRef("");
    const seededDefaultsRef = useRef(false);
    const appliedPrefillSignatureRef = useRef("");
    const hydrationFingerprintRef = useRef("");
    const storedStateHydrationFingerprintRef = useRef("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [chartDialogOpen, setChartDialogOpen] = useState(false);
    const [chartDraft, setChartDraft] = useState(null);
    const [chartQueryState, setChartQueryState] = useState({
        fingerprint: "",
        rows: [],
        loading: false,
        error: null,
    });
    const [storedChartPresets, setStoredChartPresets] = useState([]);
    const [selectedQuickChartOption, setSelectedQuickChartOption] = useState("");
    const [chartApplyFeedback, setChartApplyFeedback] = useState(null);
    const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
    const [manualRunSequence, setManualRunSequence] = useState(0);
    const [pendingScrollRowId, setPendingScrollRowId] = useState("");
    const builderRootRef = useRef(null);
    const leftRailRef = useRef(null);
    const [builderWidth, setBuilderWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 0));
    const [compactSheetOpen, setCompactSheetOpen] = useState(false);
    const [compactSheetTab, setCompactSheetTab] = useState("scope");
    const [compactChartSheetOpen, setCompactChartSheetOpen] = useState(false);

    const compactBreakpoint = useMemo(() => {
        const raw = Number(config?.layout?.compactBreakpoint || config?.compactBreakpoint || 820);
        return Number.isFinite(raw) && raw > 0 ? raw : 820;
    }, [config]);
    const compactMode = builderWidth > 0 && builderWidth <= compactBreakpoint;

    const { collection = [], loading, error } = useDataSourceState(builderContext);
    const locale = context?.locale || "en-US";
    const collectionInfo = builderContext?.signals?.collectionInfo?.value || {};
    const computedCollection = useMemo(
        () => applyReportBuilderComputedMeasures(collection, config),
        [collection, config],
    );
    const chartQueryCollection = useMemo(
        () => applyReportBuilderComputedMeasures(chartQueryState.rows, config),
        [chartQueryState.rows, config],
    );
    const replaceWindowFormBuilderState = React.useCallback((baseValues = {}, nextValue = null) => (
        replaceReportBuilderWindowState(baseValues, stateKey, nextValue)
    ), [stateKey]);

    const persistState = React.useCallback((next) => {
        const normalized = sanitizeReportBuilderState(config, next);
        persistStoredReportBuilderState(stateStorageScope, normalized, legacyStateStorageScopes);
        const currentWindowPersisted = resolveKey(windowFormSignal?.peek?.() || {}, stateKey);
        if (shouldPersistReportBuilderWindowState(currentWindowPersisted, normalized) === false) {
            return;
        }
        if (windowFormSignal) {
            windowFormSignal.value = replaceWindowFormBuilderState(windowFormSignal.peek?.() || {}, normalized);
            return;
        }
        const currentWindowForm = builderContext?.handlers?.dataSource?.getWindowFormData?.() || {};
        builderContext?.handlers?.dataSource?.setWindowFormData?.({
            values: replaceWindowFormBuilderState(currentWindowForm, normalized),
            replace: true,
            bumpPrefillRevision: false,
        });
    }, [builderContext, config, legacyStateStorageScopes, replaceWindowFormBuilderState, stateKey, stateStorageScope, windowFormSignal]);

    useEffect(() => {
        const node = builderRootRef.current;
        if (!node) {
            return;
        }
        const updateWidth = () => {
            const nextWidth = Number(node.clientWidth || 0) || (typeof window !== "undefined" ? window.innerWidth : 0);
            setBuilderWidth((current) => (current === nextWidth ? current : nextWidth));
        };
        updateWidth();
        if (typeof ResizeObserver === "undefined") {
            return;
        }
        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (compactMode) {
            setFiltersDrawerOpen(false);
            setSettingsOpen(false);
            return;
        }
        setCompactSheetOpen(false);
        setCompactChartSheetOpen(false);
    }, [compactMode]);

    const resolveLookup = React.useCallback((group, filterDef, rowId = "") => (
        resolveReportBuilderLookupDescriptor(builderContext, config, state, group, filterDef, rowId)
    ), [builderContext, config, state]);
    const currentRequest = useMemo(
        () => applyReportBuilderRequestHook(builderContext, config, state, buildReportBuilderRequest(config, state)),
        [builderContext, config, state],
    );
    const currentRequestFingerprint = useMemo(
        () => JSON.stringify(currentRequest),
        [currentRequest],
    );
    const chartDataPolicy = useMemo(
        () => getReportBuilderChartDataPolicy(config),
        [config],
    );
    const chartQueryRequest = useMemo(
        () => buildReportBuilderChartQueryRequest(currentRequest, chartDataPolicy),
        [chartDataPolicy, currentRequest],
    );
    const chartQueryFingerprint = useMemo(
        () => (chartQueryRequest ? JSON.stringify(chartQueryRequest) : ""),
        [chartQueryRequest],
    );

    useEffect(() => {
        const jobs = buildLookupHydrationJobs(builderContext, config, state, resolveLookup);
        const fingerprint = JSON.stringify(jobs.map((job) => ({
            groupId: job.groupId,
            rowId: job.rowId,
            selectionIndex: job.selectionIndex,
            value: job.value,
            dataSourceRef: job.dataSourceRef,
            resolveInput: job.resolveInput,
        })));
        if (!jobs.length || hydrationFingerprintRef.current === fingerprint) {
            return;
        }
        hydrationFingerprintRef.current = fingerprint;
        let cancelled = false;
        hydrateReportBuilderLookupLabels(builderContext, config, state, resolveLookup)
            .then((next) => {
                if (cancelled || !next) {
                    return;
                }
                persistState(next);
            })
            .catch((error) => {
                console.warn("reportBuilder lookup label hydration failed", error);
            });
        return () => {
            cancelled = true;
        };
    }, [builderContext, config, persistState, resolveLookup, state]);

    useEffect(() => {
        if (seededDefaultsRef.current) {
            return;
        }
        if (hasStoredReportBuilderState(effectivePersistedState)) {
            seededDefaultsRef.current = true;
            return;
        }
        seededDefaultsRef.current = true;
        const defaults = mergeReportBuilderState(config, effectivePersistedState);
        const initialized = mergeReportBuilderState(
            config,
            applyReportBuilderStateHook(
                builderContext,
                config,
                defaults,
                windowFormValue,
            ),
        );
        if (windowFormSignal) {
            windowFormSignal.value = replaceWindowFormBuilderState(windowFormSignal.peek?.() || {}, initialized);
        } else {
            const currentWindowForm = builderContext?.handlers?.dataSource?.getWindowFormData?.() || {};
            builderContext?.handlers?.dataSource?.setWindowFormData?.({
                values: replaceWindowFormBuilderState(currentWindowForm, initialized),
                replace: true,
                bumpPrefillRevision: false,
            });
        }
    }, [builderContext, config, effectivePersistedState, replaceWindowFormBuilderState, stateKey, windowFormSignal, windowFormValue]);

    useEffect(() => {
        if (!shouldHydrateStoredReportBuilderWindowState(persistedState, locallyStoredState)) {
            return;
        }
        const normalizedState = sanitizeReportBuilderState(config, state);
        const hydrationFingerprint = JSON.stringify(normalizedState);
        if (!hydrationFingerprint || storedStateHydrationFingerprintRef.current === hydrationFingerprint) {
            return;
        }
        storedStateHydrationFingerprintRef.current = hydrationFingerprint;
        if (shouldPersistReportBuilderWindowState(persistedState, normalizedState) === false) {
            return;
        }
        persistState(normalizedState);
    }, [config, locallyStoredState, persistState, persistedState, state]);

    useEffect(() => {
        if (!currentPrefillSignature || appliedPrefillSignatureRef.current === currentPrefillSignature) {
            return;
        }
        const next = mergeReportBuilderState(
            config,
            applyReportBuilderStateHook(
                builderContext,
                config,
                state,
                windowFormValue,
            ),
        );
        if (JSON.stringify(next) === JSON.stringify(state)) {
            appliedPrefillSignatureRef.current = currentPrefillSignature;
            return;
        }
        persistState(next);
    }, [builderContext, config, currentPrefillSignature, persistState, state, windowFormValue]);

    useEffect(() => {
        if (!currentRequestFingerprint || requestFingerprintRef.current === currentRequestFingerprint) {
            return;
        }
        if (shouldDeferReportBuilderRequestForPrefill({
            currentPrefillSignature,
            appliedPrefillSignature: appliedPrefillSignatureRef.current,
        })) {
            return;
        }
        requestFingerprintRef.current = currentRequestFingerprint;
        const inputSignal = builderContext?.signals?.input;
        const shouldFetch = config.request?.autoFetch !== false && canAutoFetchReportBuilder(config, state);
        if (inputSignal) {
            const previous = inputSignal.peek?.() || {};
            inputSignal.value = {
                ...previous,
                parameters: currentRequest,
                fetch: shouldFetch,
            };
            return;
        }
        builderContext?.handlers?.dataSource?.setInputParameters?.(currentRequest);
        if (shouldFetch) {
            builderContext?.handlers?.dataSource?.fetchCollection?.();
        }
    }, [builderContext, config.request?.autoFetch, currentPrefillSignature, currentRequest, currentRequestFingerprint, state]);

    useEffect(() => {
        if (!pendingScrollRowId) {
            return;
        }
        const root = builderRootRef.current;
        if (!root) {
            return;
        }
        const target = root.querySelector(`[data-report-builder-row-id="${pendingScrollRowId}"]`);
        if (!target) {
            return;
        }
        requestAnimationFrame(() => {
            target.scrollIntoView({ block: "end", inline: "nearest", behavior: "auto" });
            const rootRect = root.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            if (targetRect.bottom > rootRect.bottom) {
                root.scrollTop += (targetRect.bottom - rootRect.bottom) + 12;
            }
            setPendingScrollRowId("");
        });
    }, [pendingScrollRowId, state.dynamicGroups]);

    const measures = useMemo(() => getSelectableReportBuilderMeasures(config), [config]);
    const measureSections = useMemo(() => resolveMeasureSections(config, measures), [config, measures]);
    const dimensions = useMemo(() => getVisibleReportBuilderDimensions(config), [config]);
    const selectedDimensionIds = useMemo(
        () => new Set(normalizeArray(state.selectedDimensions).map((entry) => String(entry || "").trim()).filter(Boolean)),
        [state.selectedDimensions],
    );
    const selectedDimensionDefs = useMemo(
        () => dimensions.filter((dimension) => selectedDimensionIds.has(String(dimension?.id || "").trim())),
        [dimensions, selectedDimensionIds],
    );
    const availableDimensionDefs = useMemo(
        () => dimensions.filter((dimension) => !selectedDimensionIds.has(String(dimension?.id || "").trim())),
        [dimensions, selectedDimensionIds],
    );
    const staticFilters = Array.isArray(config.staticFilters) ? config.staticFilters : [];
    const dynamicFilterGroups = Array.isArray(config.dynamicFilterGroups) ? config.dynamicFilterGroups : [];
    const dynamicFilterFamilies = useMemo(() => resolveDynamicFilterFamilies(config), [config]);
    const familyMode = dynamicFilterFamilies.length > 0;
    const hiddenDynamicGroupIds = useMemo(
        () => new Set(normalizeArray(config.hiddenDynamicGroupIds).map((entry) => String(entry || "").trim()).filter(Boolean)),
        [config],
    );
    const pinnedDynamicGroupIds = useMemo(
        () => normalizeArray(config.pinnedDynamicGroupIds).map((entry) => String(entry || "").trim()).filter(Boolean),
        [config],
    );
    const showFilterCategoryBar = config.showFilterCategoryBar !== false;
    const lookupExtension = useMemo(() => getLookupExtensionConfig(config), [config]);
    const explicitChartMode = isExplicitReportBuilderChartMode(config);
    const viewModes = Array.isArray(config?.result?.viewModes) && config.result.viewModes.length > 0
        ? config.result.viewModes
        : ["chart", "table"];
    const orderFields = Array.isArray(config?.result?.orderFields || config?.orderFields)
        ? (config?.result?.orderFields || config?.orderFields)
        : [];
    const pageSizeOptions = Array.isArray(config?.result?.pageSizeOptions) && config.result.pageSizeOptions.length > 0
        ? config.result.pageSizeOptions
        : [25, 50, 100];

    const selectedColumns = useMemo(() => buildReportBuilderColumns(config, state), [config, state]);
    const chartFields = useMemo(() => buildReportBuilderChartFields(config, state), [config, state]);
    const chartDimensions = useMemo(() => chartFields.filter((entry) => entry.kind === "dimension"), [chartFields]);
    const chartMeasures = useMemo(() => chartFields.filter((entry) => entry.kind === "measure"), [chartFields]);
    const supportedChartTypes = useMemo(() => getReportBuilderSupportedChartTypes(config), [config]);
    const quickPresetPolicy = useMemo(() => getReportBuilderQuickPresetPolicy(config), [config]);
    const resultPanePosition = useMemo(() => getReportBuilderResultPanePosition(config), [config]);
    const defaultChartSpecs = useMemo(() => buildReportBuilderDefaultChartSpecs(config, state), [config, state]);
    const chartSpecValidation = useMemo(
        () => validateReportBuilderChartSpec(config, state.chartSpec, chartFields),
        [config, state.chartSpec, chartFields],
    );
    const hasValidChartSpec = !!state.chartSpec && chartSpecValidation.valid;
    const hasStaleChartSpec = !!state.chartSpec && isReportBuilderChartSpecStale(config, state.chartSpec, chartFields);
    const settingsHash = useMemo(() => buildReportBuilderSettingsHash(state), [state.selectedDimensions, state.selectedMeasures]);
    const chartContainer = useMemo(
        () => {
            const collectionForChart = resolveReportBuilderChartCollection({
                computedCollection,
                chartCollection: chartQueryCollection,
                policy: chartDataPolicy,
            });
            return explicitChartMode && hasValidChartSpec
                ? buildExplicitReportBuilderChartContainer({ ...container, collection: collectionForChart }, config, state, state.chartSpec)
                : buildChartContainer({ ...container, collection: collectionForChart }, config, state);
        },
        [chartDataPolicy, chartQueryCollection, computedCollection, container, config, explicitChartMode, hasValidChartSpec, state],
    );
    const chartRenderKey = useMemo(() => JSON.stringify({
        explicitChartMode,
        chartSpec: explicitChartMode ? normalizeReportBuilderChartSpec(state.chartSpec) : null,
        selectedDimensions: state.selectedDimensions,
        selectedMeasures: state.selectedMeasures,
        primaryMeasure: state.primaryMeasure,
        groupBy: state.groupBy,
        chartType: chartContainer?.chart?.type || "",
        xDataKey: chartContainer?.chart?.xAxis?.dataKey || "",
        seriesNameKey: chartContainer?.chart?.series?.nameKey || "",
        seriesValueKey: chartContainer?.chart?.series?.valueKey || "",
        seriesValues: Array.isArray(chartContainer?.chart?.series?.values)
            ? chartContainer.chart.series.values.map((entry) => ({
                value: entry?.value || "",
                type: entry?.type || "",
                axis: entry?.axis || "",
                stackId: entry?.stackId || "",
            }))
            : [],
    }), [
        chartContainer?.chart?.series?.nameKey,
        chartContainer?.chart?.series?.valueKey,
        chartContainer?.chart?.type,
        chartContainer?.chart?.xAxis?.dataKey,
        chartContainer?.chart?.series?.values,
        explicitChartMode,
        state.chartSpec,
        state.groupBy,
        state.primaryMeasure,
        state.selectedDimensions,
        state.selectedMeasures,
    ]);
    const hasMore = collectionInfo?.hasMore ?? (Array.isArray(collection) && collection.length >= state.pageSize);
    const readiness = useMemo(() => resolveReportBuilderReadiness(config, state), [config, state]);
    const canRunReport = readiness.canRun;
    const requiredStaticFilters = useMemo(() => staticFilters.filter((filter) => filter?.required), [staticFilters]);
    const optionalStaticFilters = useMemo(() => staticFilters.filter((filter) => !filter?.required), [staticFilters]);
    const inlineToolbarRequiredFilters = useMemo(
        () => requiredStaticFilters.filter((filter) => String(filter?.presentation || "").trim() === "inlineToolbar"),
        [requiredStaticFilters],
    );
    const panelRequiredStaticFilters = useMemo(
        () => requiredStaticFilters.filter((filter) => String(filter?.presentation || "").trim() !== "inlineToolbar"),
        [requiredStaticFilters],
    );
    const compactRequiredStaticFilters = useMemo(() => {
        const seen = new Set();
        return [...inlineToolbarRequiredFilters, ...panelRequiredStaticFilters].filter((filter) => {
            const key = String(filter?.id || filter?.field || "").trim();
            if (!key || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }, [inlineToolbarRequiredFilters, panelRequiredStaticFilters]);
    const [filterPanels, setFilterPanels] = useState({ common: true, advanced: false });
    const [activeOptionalFilterKeys, setActiveOptionalFilterKeys] = useState([]);
    const [activeDynamicGroupIds, setActiveDynamicGroupIds] = useState([]);
    const [activeDynamicFamilyIds, setActiveDynamicFamilyIds] = useState([]);
    const [dimensionsCollapsed, setDimensionsCollapsed] = useState(false);
    const activeStaticFilterCount = useMemo(() => (
        staticFilters.reduce((count, filter) => {
            const key = String(filter.id || filter.field || "").trim();
            return key && hasConfiguredFilterValue(filter, state?.staticFilters?.[key]) ? count + 1 : count;
        }, 0)
    ), [staticFilters, state]);
    const activeDynamicFilterCount = useMemo(() => (
        dynamicFilterGroups.reduce((count, group) => {
            if (hiddenDynamicGroupIds.has(group.id)) {
                return count;
            }
            return count + (state?.dynamicGroups?.[group.id] || []).filter((row) => Array.isArray(row.selections) && row.selections.length > 0).length;
        }, 0)
    ), [dynamicFilterGroups, hiddenDynamicGroupIds, state]);
    const visibleActiveDynamicGroupIds = useMemo(
        () => activeDynamicGroupIds.filter((groupId) => !hiddenDynamicGroupIds.has(groupId)),
        [activeDynamicGroupIds, hiddenDynamicGroupIds],
    );
    const dynamicGroupLayout = useMemo(
        () => resolveDynamicGroupLayout(config, visibleActiveDynamicGroupIds),
        [config, visibleActiveDynamicGroupIds],
    );
    const notices = useMemo(() => resolveReportBuilderNotices(config, state), [config, state]);
    const familyConfiguredCount = React.useCallback((family) => {
        const includeRows = state?.dynamicGroups?.include || [];
        const excludeRows = state?.dynamicGroups?.exclude || [];
        const includeCount = includeRows.filter((row) => family.includeFilterIds.includes(String(row?.filterId || "").trim()) && Array.isArray(row.selections) && row.selections.length > 0).length;
        const excludeCount = excludeRows.filter((row) => family.excludeFilterIds.includes(String(row?.filterId || "").trim()) && Array.isArray(row.selections) && row.selections.length > 0).length;
        return includeCount + excludeCount;
    }, [state]);
    const hasFilterDrawerContent = notices.length > 0
        || requiredStaticFilters.length > 0
        || optionalStaticFilters.length > 0
        || dynamicFilterGroups.length > 0
        || dynamicFilterFamilies.length > 0;
    const totalActiveFilterCount = activeStaticFilterCount + activeDynamicFilterCount;
    const renderFilterCategoryControls = () => (
        <>
            {showFilterCategoryBar && !familyMode && (optionalStaticFilters.length > 0 || dynamicFilterGroups.filter((group) => !hiddenDynamicGroupIds.has(group.id)).length > 0) ? (
                <div className="forge-report-builder__filter-category-scroll">
                    <div className="forge-report-builder__filter-category-bar" aria-label="Filter categories">
                        {optionalStaticFilters.map((filter) => {
                            const filterKey = String(filter.id || filter.field || "").trim();
                            const active = activeOptionalFilterKeys.includes(filterKey);
                            const configuredCount = countConfiguredFilterValue(filter, state?.staticFilters?.[filterKey]);
                            const stateLabel = filterCategoryStateLabel({ active, configuredCount });
                            const categoryLabel = filter.label || filter.id;
                            return (
                                <button
                                    key={filterKey}
                                    type="button"
                                    className={[
                                        "forge-report-builder__category-chip",
                                        active ? "is-active" : "is-inactive",
                                        configuredCount > 0 ? "has-configured-state" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => toggleOptionalFilterCategory(filterKey)}
                                    aria-pressed={active}
                                    aria-label={filterCategoryTitle(categoryLabel, { active, configuredCount })}
                                    title={filterCategoryTitle(categoryLabel, { active, configuredCount })}
                                >
                                    <span className="forge-report-builder__category-chip-icon">
                                        <Icon icon={filterCategoryIcon(filter)} size={12} />
                                    </span>
                                    <span className="forge-report-builder__category-chip-label">{categoryLabel}</span>
                                    {configuredCount > 0 ? (
                                        <span className="forge-report-builder__category-chip-count">{configuredCount}</span>
                                    ) : (
                                        <span className="forge-report-builder__category-chip-state">{stateLabel}</span>
                                    )}
                                </button>
                            );
                        })}
                        {dynamicFilterGroups.filter((group) => !hiddenDynamicGroupIds.has(group.id)).map((group) => {
                            const active = activeDynamicGroupIds.includes(group.id);
                            const configuredCount = countConfiguredDynamicSelections(state?.dynamicGroups?.[group.id] || []);
                            const stateLabel = filterCategoryStateLabel({ active, configuredCount });
                            const categoryLabel = group.label || group.id;
                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    className={[
                                        "forge-report-builder__category-chip",
                                        active ? "is-active" : "is-inactive",
                                        configuredCount > 0 ? "has-configured-state" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => toggleDynamicGroupCategory(group.id)}
                                    aria-pressed={active}
                                    aria-label={filterCategoryTitle(categoryLabel, { active, configuredCount })}
                                    title={filterCategoryTitle(categoryLabel, { active, configuredCount })}
                                >
                                    <span className="forge-report-builder__category-chip-icon">
                                        <Icon icon={filterCategoryIcon(group)} size={12} />
                                    </span>
                                    <span className="forge-report-builder__category-chip-label">{categoryLabel}</span>
                                    {configuredCount > 0 ? (
                                        <span className="forge-report-builder__category-chip-count">{configuredCount}</span>
                                    ) : (
                                        <span className="forge-report-builder__category-chip-state">{stateLabel}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
            {showFilterCategoryBar && familyMode ? (
                <div className="forge-report-builder__filter-category-scroll">
                    <div className="forge-report-builder__filter-category-bar" aria-label="Filter categories">
                        {optionalStaticFilters.map((filter) => {
                            const filterKey = String(filter.id || filter.field || "").trim();
                            const active = activeOptionalFilterKeys.includes(filterKey);
                            const configuredCount = countConfiguredFilterValue(filter, state?.staticFilters?.[filterKey]);
                            const stateLabel = filterCategoryStateLabel({ active, configuredCount });
                            const categoryLabel = filter.label || filter.id;
                            return (
                                <button
                                    key={filterKey}
                                    type="button"
                                    className={[
                                        "forge-report-builder__category-chip",
                                        active ? "is-active" : "is-inactive",
                                        configuredCount > 0 ? "has-configured-state" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => toggleOptionalFilterCategory(filterKey)}
                                    aria-pressed={active}
                                    aria-label={filterCategoryTitle(categoryLabel, { active, configuredCount })}
                                    title={filterCategoryTitle(categoryLabel, { active, configuredCount })}
                                >
                                    <span className="forge-report-builder__category-chip-icon">
                                        <Icon icon={filterCategoryIcon(filter)} size={12} />
                                    </span>
                                    <span className="forge-report-builder__category-chip-label">{categoryLabel}</span>
                                    {configuredCount > 0 ? (
                                        <span className="forge-report-builder__category-chip-count">{configuredCount}</span>
                                    ) : (
                                        <span className="forge-report-builder__category-chip-state">{stateLabel}</span>
                                    )}
                                </button>
                            );
                        })}
                        {dynamicFilterFamilies.map((family) => {
                            const active = activeDynamicFamilyIds.includes(family.id);
                            const configuredCount = familyConfiguredCount(family);
                            const stateLabel = filterCategoryStateLabel({ active, configuredCount });
                            return (
                                <button
                                    key={family.id}
                                    type="button"
                                    className={[
                                        "forge-report-builder__category-chip",
                                        active ? "is-active" : "is-inactive",
                                        configuredCount > 0 ? "has-configured-state" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => setActiveDynamicFamilyIds((current) => current.includes(family.id) ? current.filter((entry) => entry !== family.id) : [...current, family.id])}
                                    aria-pressed={active}
                                    aria-label={filterCategoryTitle(family.label, { active, configuredCount })}
                                    title={filterCategoryTitle(family.label, { active, configuredCount })}
                                >
                                    <span className="forge-report-builder__category-chip-icon">
                                        <Icon icon={filterCategoryIcon(family)} size={12} />
                                    </span>
                                    <span className="forge-report-builder__category-chip-label">{family.label}</span>
                                    {configuredCount > 0 ? (
                                        <span className="forge-report-builder__category-chip-count">{configuredCount}</span>
                                    ) : (
                                        <span className="forge-report-builder__category-chip-state">{stateLabel}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </>
    );

    const renderFilterBody = ({ includeRequiredStaticFilters = true } = {}) => (
        <>
            {notices.length > 0 ? (
                <div className="forge-report-builder__notices">
                    {notices.map((notice) => (
                        <section key={notice.id} className={`forge-report-builder__notice forge-report-builder__notice--${notice.level}`}>
                            {notice.title ? <div className="forge-report-builder__notice-title">{notice.title}</div> : null}
                            {notice.description ? <div className="forge-report-builder__notice-description">{notice.description}</div> : null}
                            <div className="forge-report-builder__notice-items">
                                {notice.items.map((item) => (
                                    <span key={`${notice.id}_${item}`} className="forge-report-builder__notice-chip">{item}</span>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : null}
            {includeRequiredStaticFilters ? (
                <div className="forge-report-builder__bottom-grid forge-report-builder__bottom-grid--static">
                    {panelRequiredStaticFilters.map((filter) => {
                        const filterKey = String(filter.id || filter.field || "").trim();
                        const currentValue = state?.staticFilters?.[filterKey];
                        return (
                            <StaticFilterSection
                                key={filterKey}
                                filter={filter}
                                context={builderContext}
                                value={currentValue}
                                onToggle={(optionValue) => toggleStaticFilter(filter, optionValue)}
                                onDateRange={(edge, value) => setDateRangeValue(filter, edge, value)}
                            />
                        );
                    })}
                </div>
            ) : null}
            {optionalStaticFilters
                .filter((filter) => activeOptionalFilterKeys.includes(String(filter.id || filter.field || "").trim()))
                .map((filter) => {
                    const filterKey = String(filter.id || filter.field || "").trim();
                    const currentValue = state?.staticFilters?.[filterKey];
                    return (
                        <div key={`row-${filterKey}`} className="forge-report-builder__optional-filter-row">
                            <StaticFilterSection
                                key={filterKey}
                                filter={filter}
                                context={builderContext}
                                value={currentValue}
                                onToggle={(optionValue) => toggleStaticFilter(filter, optionValue)}
                                onDateRange={(edge, value) => setDateRangeValue(filter, edge, value)}
                            />
                        </div>
                    );
                })}
            {!familyMode && visibleActiveDynamicGroupIds.length > 0 ? (
                <div className="forge-report-builder__bottom-grid forge-report-builder__bottom-grid--dynamic">
                    {dynamicGroupLayout.fullWidthIds.map((groupId) => (
                        <div key={`full_${groupId}`} className="forge-report-builder__dynamic-group-full">
                            {renderDynamicGroup(groupId)}
                        </div>
                    ))}
                    {dynamicGroupLayout.columnRows.map((row, rowIndex) => (
                        <div key={`row_${rowIndex}`} className="forge-report-builder__dynamic-group-row">
                            {row.map((groupId) => (
                                <div key={groupId} className="forge-report-builder__dynamic-group-column">
                                    {renderDynamicGroup(groupId)}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ) : null}
            {familyMode && (showFilterCategoryBar ? activeDynamicFamilyIds.length > 0 : dynamicFilterFamilies.length > 0) ? (
                <div className="forge-report-builder__family-grid">
                    {dynamicFilterFamilies
                        .filter((family) => !showFilterCategoryBar || activeDynamicFamilyIds.includes(family.id))
                        .map((family) => renderDynamicFamily(family))}
                </div>
            ) : null}
        </>
    );

    const renderFilterRailControls = () => (
        <aside className="forge-report-builder__bottom forge-report-builder__bottom--rail" aria-label="Filters">
            <section className="forge-report-builder__bottom-group forge-report-builder__bottom-group--static" aria-label="Filters">
                <div className="forge-report-builder__bottom-header">
                    <div className="forge-report-builder__bottom-label">Filters</div>
                    <div className="forge-report-builder__bottom-header-actions">
                        <button type="button" className="forge-report-builder__bottom-toggle" onClick={() => toggleFilterPanel("common")}>
                            <span>{totalActiveFilterCount} active</span>
                            <span>{filterPanels.common ? "Hide Body" : "Show Body"}</span>
                        </button>
                    </div>
                </div>
                {renderFilterCategoryControls()}
            </section>
        </aside>
    );

    const renderFiltersPanel = () => (
        <aside className={[
            "forge-report-builder__bottom",
            useFilterDrawer ? "forge-report-builder__bottom--drawer" : "",
        ].filter(Boolean).join(" ")} aria-label={useFilterDrawer ? "Filters drawer" : "Filters"}>
            <section className="forge-report-builder__bottom-group forge-report-builder__bottom-group--static" aria-label="Filters">
                <div className="forge-report-builder__bottom-header">
                    <div>
                        <div className="forge-report-builder__bottom-label">Filters</div>
                        <div className="forge-report-builder__bottom-description">
                            Refine scope and targeting without covering the result table.
                        </div>
                    </div>
                    <div className="forge-report-builder__bottom-header-actions">
                        <button type="button" className="forge-report-builder__bottom-toggle" onClick={() => toggleFilterPanel("common")}>
                            <span>{totalActiveFilterCount} active</span>
                            <span>{filterPanels.common ? "Hide Body" : "Show Body"}</span>
                        </button>
                        {useFilterDrawer ? (
                            <button type="button" className="forge-report-builder__bottom-toggle" onClick={() => setFiltersDrawerOpen(false)}>
                                <span>Close</span>
                            </button>
                        ) : null}
                    </div>
                </div>
                {renderFilterCategoryControls()}
                {!useFilterRail && filterPanels.common ? renderFilterBody() : null}
            </section>
        </aside>
    );

    useEffect(() => {
        const nextOptional = optionalStaticFilters
            .filter((filter) => {
                const key = String(filter.id || filter.field || "").trim();
                return key && hasConfiguredFilterValue(filter, state?.staticFilters?.[key]);
            })
            .map((filter) => String(filter.id || filter.field || "").trim())
            .filter(Boolean);
        setActiveOptionalFilterKeys((current) => {
            const currentSorted = [...current].sort();
            const nextSorted = [...nextOptional].sort();
            return JSON.stringify(currentSorted) === JSON.stringify(nextSorted) ? current : nextOptional;
        });
    }, [optionalStaticFilters, state]);

    useEffect(() => {
        if (!familyMode) {
            return;
        }
        const configuredFamilies = dynamicFilterFamilies
            .filter((family) => familyConfiguredCount(family) > 0)
            .map((family) => family.id);
        setActiveDynamicFamilyIds((current) => {
            const validCurrent = current.filter((familyId) => dynamicFilterFamilies.some((family) => family.id === familyId));
            const nextFamilies = Array.from(new Set([...validCurrent, ...configuredFamilies]));
            const currentSorted = [...validCurrent].sort();
            const nextSorted = [...nextFamilies].sort();
            return JSON.stringify(currentSorted) === JSON.stringify(nextSorted) ? current : nextFamilies;
        });
    }, [dynamicFilterFamilies, familyConfiguredCount, familyMode]);

    useEffect(() => {
        const nextGroups = dynamicFilterGroups
            .filter((group) => !hiddenDynamicGroupIds.has(group.id))
            .filter((group) => pinnedDynamicGroupIds.includes(group.id) || (Array.isArray(state?.dynamicGroups?.[group.id]) && state.dynamicGroups[group.id].length > 0))
            .map((group) => String(group.id || "").trim())
            .filter(Boolean);
        setActiveDynamicGroupIds((current) => {
            const currentSorted = [...current].sort();
            const nextSorted = [...nextGroups].sort();
            return JSON.stringify(currentSorted) === JSON.stringify(nextSorted) ? current : nextGroups;
        });
    }, [dynamicFilterGroups, hiddenDynamicGroupIds, pinnedDynamicGroupIds, state]);
    const renderStaticFilterSection = (filter) => {
        const filterKey = String(filter.id || filter.field || "").trim();
        const currentValue = state?.staticFilters?.[filterKey];
        return (
            <StaticFilterSection
                key={filterKey}
                filter={filter}
                context={builderContext}
                value={currentValue}
                onToggle={(optionValue) => toggleStaticFilter(filter, optionValue)}
                onDateRange={(edge, value) => setDateRangeValue(filter, edge, value)}
            />
        );
    };

    const renderSettingsControls = () => (
        <>
            {config.groupBy?.options?.length ? (
                <div className="forge-report-builder__control-cluster">
                    <label>Break down by</label>
                    <select
                        className="forge-report-builder-select"
                        value={state.groupBy || ""}
                        onChange={(event) => setGroupBy(event.target.value)}
                    >
                        <option value="">None</option>
                        {config.groupBy.options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label || option.value}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}
            {orderFields.length > 0 ? (
                <div className="forge-report-builder__control-cluster">
                    <label>Order by</label>
                    <select
                        className="forge-report-builder-select"
                        value={state.orderField || ""}
                        onChange={(event) => setOrderField(event.target.value)}
                    >
                        {orderFields.map((field) => (
                            <option key={field.value || field.field} value={field.value || field.field}>
                                {field.label || field.value || field.field}
                            </option>
                        ))}
                    </select>
                    <select
                        className="forge-report-builder-select"
                        value={state.orderDir || "desc"}
                        onChange={(event) => setOrderDir(event.target.value)}
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
            ) : null}
            <div className="forge-report-builder__control-cluster">
                <label>Page size</label>
                <select
                    className="forge-report-builder-select"
                    value={state.pageSize}
                    onChange={(event) => setPageSize(event.target.value)}
                >
                    {pageSizeOptions.map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                </select>
            </div>
        </>
    );

    const renderMeasureSections = () => (
        <div className="forge-report-builder__measure-sections">
            {measureSections.map((section) => (
                <div key={section.id} className="forge-report-builder__measure-section">
                    {section.label ? (
                        <div className="forge-report-builder__measure-section-label">{section.label}</div>
                    ) : null}
                    <div className="forge-report-builder__measure-row">
                        {section.measures.map((measure) => {
                            const active = state.selectedMeasures.includes(measure.id);
                            const primary = state.primaryMeasure === measure.id;
                            return (
                                <button
                                    key={measure.id}
                                    type="button"
                                    className={[
                                        "forge-report-builder__measure-pill",
                                        active ? "is-active" : "",
                                        primary ? "is-primary" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => (active ? setPrimaryMeasure(measure.id) : toggleMeasure(measure.id))}
                                    onDoubleClick={() => setPrimaryMeasure(measure.id)}
                                >
                                    <span className={active ? "forge-report-builder__selector-box is-active" : "forge-report-builder__selector-box"} onClick={(event) => {
                                        event.stopPropagation();
                                        toggleMeasure(measure.id);
                                    }}>{active ? "✓" : ""}</span>
                                    <span>{measure.label || measure.id}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderMeasuresPanel = () => (
        <section className="forge-report-builder__panel">
            <div className="forge-report-builder__panel-headerline forge-report-builder__panel-headerline--compact">
                <div className="forge-report-builder__panel-title">Measures</div>
                <div className="forge-report-builder__panel-badge">
                    {state.selectedMeasures.length} selected
                </div>
            </div>
            {renderMeasureSections()}
        </section>
    );

    const renderBreakdownPanel = ({ collapsible = true } = {}) => (
        <section className="forge-report-builder__panel">
            <div className="forge-report-builder__panel-headerline forge-report-builder__panel-headerline--compact">
                <div className="forge-report-builder__panel-title">Breakdowns</div>
                {collapsible ? (
                    <button
                        type="button"
                        className="forge-report-builder__panel-toggle"
                        onClick={() => setDimensionsCollapsed((current) => !current)}
                        aria-expanded={!dimensionsCollapsed}
                    >
                        {dimensionsCollapsed ? "Show" : "Hide"}
                    </button>
                ) : null}
            </div>
            {(!collapsible || !dimensionsCollapsed) ? (
                <div className="forge-report-builder__dimension-picker">
                    <select
                        className="forge-report-builder-select forge-report-builder-select--add"
                        value=""
                        onChange={(event) => {
                            addDimension(event.target.value);
                            event.target.value = "";
                        }}
                        disabled={availableDimensionDefs.length === 0}
                    >
                        <option value="">{availableDimensionDefs.length === 0 ? "All breakdowns added" : "Add breakdown..."}</option>
                        {availableDimensionDefs.map((dimension) => (
                            <option key={dimension.id} value={dimension.id}>
                                {dimension.label || dimension.id}
                            </option>
                        ))}
                    </select>
                    {selectedDimensionDefs.length > 0 ? (
                        <div className="forge-report-builder__dimension-selected" aria-label="Selected breakdowns">
                            {selectedDimensionDefs.map((dimension) => {
                                const removable = selectedDimensionDefs.length > 1;
                                return (
                                    <button
                                        key={dimension.id}
                                        type="button"
                                        className="forge-report-builder__dimension-pill"
                                        onClick={() => removeDimension(dimension.id)}
                                        disabled={!removable}
                                        title={removable ? `Remove ${dimension.label || dimension.id}` : dimension.label || dimension.id}
                                    >
                                        <span>{dimension.label || dimension.id}</span>
                                        {removable ? <span aria-hidden="true">×</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );

    const renderCompactHeader = () => (
        <div className="forge-report-builder__compact-summary">
            <div className="forge-report-builder__compact-summary-topline">
                <div className="forge-report-builder__compact-summary-copy">
                    <div className="forge-report-builder__shelf-label">{container.title || config.title || "Report Builder"}</div>
                    <div className="forge-report-builder__compact-summary-status">{compactStatusText}</div>
                </div>
                {actionModel.compact.showHeaderViewToggle ? (
                    <div className="forge-report-builder__view-toggle forge-report-builder__view-toggle--compact">
                        {resultViewModes.map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                className={state.viewMode === mode ? "is-active" : ""}
                                onClick={() => setViewMode(mode)}
                            >
                                <Icon icon={mode === "table" ? "th" : "timeline-line-chart"} size={12} />
                                {mode}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
            {compactSummaryItems.length > 0 ? (
                <div className="forge-report-builder__compact-summary-chips" aria-label="Current report summary">
                    {compactSummaryItems.map((item) => (
                        <span key={item} className="forge-report-builder__compact-summary-chip">{item}</span>
                    ))}
                </div>
            ) : null}
            {chartApplyFeedback?.message ? (
                <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${chartApplyFeedback.level || "warning"}`}>
                    {chartApplyFeedback.message}
                </div>
            ) : null}
        </div>
    );

    const renderCompactSetupSheet = () => {
        if (!compactMode || !compactSheetOpen) {
            return null;
        }
        return (
            <div className="forge-report-builder__compact-sheet-backdrop" onClick={closeCompactSheet}>
                <div
                    className="forge-report-builder__compact-sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Report builder setup"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="forge-report-builder__compact-sheet-header">
                        <div>
                            <div className="forge-report-builder__shelf-label">Setup</div>
                            <div className="forge-report-builder__compact-sheet-title">{container.title || config.title || "Report Builder"}</div>
                        </div>
                        <button type="button" className="forge-report-builder__panel-toggle" onClick={closeCompactSheet}>
                            Close
                        </button>
                    </div>
                    <div className="forge-report-builder__compact-sheet-tabs">
                        <ReportBuilderCompactSheetTab active={compactSheetTab === "scope"} icon="calendar" label="Scope" onClick={() => setCompactSheetTab("scope")} />
                        <ReportBuilderCompactSheetTab active={compactSheetTab === "data"} icon="database" label="Data" onClick={() => setCompactSheetTab("data")} />
                        <ReportBuilderCompactSheetTab active={compactSheetTab === "filters"} icon="filter" label="Filters" onClick={() => setCompactSheetTab("filters")} />
                    </div>
                    <div className="forge-report-builder__compact-sheet-body">
                        {compactSheetTab === "scope" ? (
                            <div className="forge-report-builder__compact-panel-stack">
                                {compactRequiredStaticFilters.map((filter) => renderStaticFilterSection(filter))}
                                <section className="forge-report-builder__panel forge-report-builder__panel--bottom">
                                    <div className="forge-report-builder__panel-headerline">
                                        <div className="forge-report-builder__panel-title">Options</div>
                                    </div>
                                    <div className="forge-report-builder__compact-control-grid">
                                        {renderSettingsControls()}
                                    </div>
                                </section>
                            </div>
                        ) : null}
                        {compactSheetTab === "data" ? (
                            <div className="forge-report-builder__compact-panel-stack">
                                <section className="forge-report-builder__panel forge-report-builder__panel--bottom">
                                    <div className="forge-report-builder__panel-headerline">
                                        <div className="forge-report-builder__panel-title">Measures</div>
                                    </div>
                                    {renderMeasureSections()}
                                </section>
                                {renderBreakdownPanel({ collapsible: false })}
                            </div>
                        ) : null}
                        {compactSheetTab === "filters" ? (
                            <div className="forge-report-builder__compact-panel-stack">
                                <section className="forge-report-builder__bottom-group forge-report-builder__bottom-group--static" aria-label="Filters">
                                    <div className="forge-report-builder__bottom-header">
                                        <div>
                                            <div className="forge-report-builder__bottom-label">Filters</div>
                                            <div className="forge-report-builder__bottom-description">
                                                Refine optional filters and targeting while keeping the current result in view.
                                            </div>
                                        </div>
                                    </div>
                                    {renderFilterCategoryControls()}
                                    {renderFilterBody({ includeRequiredStaticFilters: false })}
                                </section>
                            </div>
                        ) : null}
                    </div>
                    <div className="forge-report-builder__compact-sheet-footer">
                        <Button small outlined onClick={closeCompactSheet}>Done</Button>
                        <Button
                            small
                            intent="primary"
                            icon="play"
                            className="forge-report-builder__run-button"
                            disabled={!canRunReport || loading}
                            onClick={() => {
                                closeCompactSheet();
                                runReport();
                            }}
                        >
                            {loading ? "Running" : "Run"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderCompactChartSheet = () => {
        if (!compactMode || !compactChartSheetOpen) {
            return null;
        }
        return (
            <div className="forge-report-builder__compact-sheet-backdrop" onClick={closeCompactChartSheet}>
                <div
                    className="forge-report-builder__compact-sheet forge-report-builder__compact-sheet--chart"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Chart actions"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="forge-report-builder__compact-sheet-header">
                        <div>
                            <div className="forge-report-builder__shelf-label">Chart</div>
                            <div className="forge-report-builder__compact-sheet-title">
                                {hasValidChartSpec ? (state.chartSpec?.title || "Chart") : "Create or apply a chart"}
                            </div>
                        </div>
                        <button type="button" className="forge-report-builder__panel-toggle" onClick={closeCompactChartSheet}>
                            Close
                        </button>
                    </div>
                    <div className="forge-report-builder__compact-sheet-body forge-report-builder__compact-sheet-body--chart">
                        {actionModel.compact.chartSheet.showQuickChartActions ? (
                            <ReportBuilderChartQuickActions
                                canCreate={canCreateChart}
                                showCreateButton={!hasValidChartSpec}
                                onCreate={() => {
                                    closeCompactChartSheet();
                                    openChartDialog(state.chartSpec);
                                }}
                                quickOptions={quickChartOptions}
                                usePortal={false}
                                onSelectQuickOption={(value) => {
                                    setSelectedQuickChartOption(value);
                                    setChartApplyFeedback(null);
                                    if (value) {
                                        applyQuickChart(value);
                                        closeCompactChartSheet();
                                    }
                                }}
                            />
                        ) : null}
                        {actionModel.compact.chartSheet.showEditChart || actionModel.compact.chartSheet.showRemoveChart ? (
                            <div className="forge-report-builder__compact-chart-actions">
                                {actionModel.compact.chartSheet.showEditChart ? (
                                    <Button small outlined icon="edit" onClick={() => {
                                        closeCompactChartSheet();
                                        openChartDialog(state.chartSpec);
                                    }}>
                                        Edit Chart
                                    </Button>
                                ) : null}
                                {actionModel.compact.chartSheet.showRemoveChart ? (
                                    <Button small minimal intent="danger" icon="trash" onClick={removeChart}>
                                        Remove Chart
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                        {actionModel.compact.chartSheet.showViewToggle || actionModel.compact.chartSheet.showExport ? (
                            <div className="forge-report-builder__compact-chart-actions">
                                {actionModel.compact.chartSheet.showViewToggle ? resultViewModes.map((mode) => (
                                    <Button
                                        key={mode}
                                        small
                                        outlined={state.viewMode !== mode}
                                        intent={state.viewMode === mode ? "primary" : "none"}
                                        icon={mode === "table" ? "th" : "timeline-line-chart"}
                                        onClick={() => setViewMode(mode)}
                                    >
                                        {mode}
                                    </Button>
                                )) : null}
                                {actionModel.compact.chartSheet.showExport ? (
                                    <Button small outlined icon="download" disabled={!canShowResults} onClick={downloadCsv}>
                                        Export
                                    </Button>
                                ) : null}
                            </div>
                        ) : actionModel.compact.chartSheet.showEmptyState ? (
                            <div className="forge-report-builder__empty forge-report-builder__empty--compact">
                                Run the report to preview chart output.
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    };

    const renderCompactBottomBar = () => {
        if (!compactMode) {
            return null;
        }
        return (
            <div className="forge-report-builder__compact-action-bar" aria-label="Report builder actions">
                {compactBottomBarActions.map((action) => (
                    <button
                        key={action.id}
                        type="button"
                        className={[
                            "forge-report-builder__compact-action",
                            action.tone === "primary" ? "forge-report-builder__compact-action--primary" : "",
                        ].filter(Boolean).join(" ")}
                        disabled={action.disabled}
                        onClick={action.onClick}
                    >
                        <Icon icon={action.icon} size={14} />
                        <span>{action.label}</span>
                    </button>
                ))}
            </div>
        );
    };

    const dispatchReportRequest = React.useCallback((nextState, { forceFetch = false, markManual = false } = {}) => {
        const request = applyReportBuilderRequestHook(
            builderContext,
            config,
            nextState,
            buildReportBuilderRequest(config, nextState),
        );
        const fingerprint = JSON.stringify(request);
        requestFingerprintRef.current = fingerprint;
        if (markManual) {
            lastManualRunFingerprintRef.current = fingerprint;
        }
        const inputSignal = builderContext?.signals?.input;
        if (inputSignal) {
            const previous = inputSignal.peek?.() || {};
            inputSignal.value = {
                ...previous,
                parameters: request,
                fetch: forceFetch || config.request?.autoFetch !== false,
            };
            return { request, fingerprint };
        }
        builderContext?.handlers?.dataSource?.setInputParameters?.(request);
        if (forceFetch || config.request?.autoFetch !== false) {
            builderContext?.handlers?.dataSource?.fetchCollection?.();
        }
        return { request, fingerprint };
    }, [builderContext, config]);

    const runReport = React.useCallback(() => {
        setManualRunSequence((current) => current + 1);
        setChartApplyFeedback(null);
        dispatchReportRequest(state, { forceFetch: true, markManual: true });
    }, [dispatchReportRequest, state]);
    const hasRows = Array.isArray(computedCollection) && computedCollection.length > 0;
    const canShowResults = canRunReport && hasRows;
    const canCreateChart = chartDimensions.length > 0 && chartMeasures.length > 0 && supportedChartTypes.length > 0;
    const compatiblePreviousChartPresets = useMemo(
        () => storedChartPresets.filter((preset) => (
            String(preset?.settingsHash || "").trim() === settingsHash
            && validateReportBuilderChartSpec(config, preset?.chartSpec, chartFields).valid
        )),
        [chartFields, config, settingsHash, storedChartPresets],
    );
    const quickChartOptions = useMemo(() => {
        const defaults = defaultChartSpecs.map((entry, index) => {
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
            return {
                value: `default:${index}`,
                label: `${entry.title} (${entry.type})${dependencyHint ? ` —${dependencyHint}` : ""}`,
                kind: "default",
                group: String(entry.group || "").trim() || "Presets",
                spec: entry,
                prepared,
            };
        });
        const previous = compatiblePreviousChartPresets.map((entry, index) => ({
            value: `previous:${index}`,
            label: `${entry.title} (Previous)`,
            kind: "previous",
            group: "Previous",
            spec: entry.chartSpec,
        }));
        return [...defaults, ...previous];
    }, [compatiblePreviousChartPresets, config, defaultChartSpecs, quickPresetPolicy.autoFetchOnSelect, quickPresetPolicy.autoProvisionMissingDimensions, quickPresetPolicy.selectionPolicy, state]);
    const hasCompletedCurrentRun = canRunReport
        && !loading
        && !error
        && lastManualRunFingerprintRef.current !== ""
        && lastManualRunFingerprintRef.current === currentRequestFingerprint;
    const autoChartCycleKey = hasCompletedCurrentRun
        ? `${currentRequestFingerprint}::${manualRunSequence}`
        : "";

    useEffect(() => {
        if (!shouldAutoCollapseReportBuilderFilters({
            canShowResults,
            hasCompletedCurrentRun,
            manualRunSequence,
            collapsedRunSequence: lastAutoCollapsedRunSequenceRef.current,
        })) {
            return;
        }
        lastAutoCollapsedRunSequenceRef.current = manualRunSequence;
        setFilterPanels((current) => (
            current.common ? { ...current, common: false } : current
        ));
        setFiltersDrawerOpen(false);
    }, [canShowResults, hasCompletedCurrentRun, manualRunSequence]);

    useEffect(() => {
        if (!explicitChartMode || state.chartSpec || !autoChartCycleKey) {
            return;
        }
        if (lastAutoAppliedChartCycleRef.current === autoChartCycleKey) {
            return;
        }
        const prepared = prepareReportBuilderAutoChartApplication(config, state);
        lastAutoAppliedChartCycleRef.current = autoChartCycleKey;
        if (!prepared?.nextState) {
            return;
        }
        persistState(prepared.nextState);
        setChartApplyFeedback(null);
    }, [
        autoChartCycleKey,
        config,
        explicitChartMode,
        persistState,
        state,
    ]);

    useEffect(() => {
        setStoredChartPresets(loadStoredChartPresets(stateStorageScope, legacyChartPresetScopes));
    }, [legacyChartPresetScopes, stateStorageScope]);

    const compactStatusText = useMemo(() => resolveCompactStatusText({
        loading,
        error,
        canShowResults,
        explicitChartMode,
        hasValidChartSpec,
        viewMode: state.viewMode,
        chartTitle: state.chartSpec?.title || "",
        rowCount: computedCollection.length,
        canRunReport,
        readinessReason: readiness.reason,
    }), [canRunReport, canShowResults, computedCollection.length, error, explicitChartMode, hasValidChartSpec, loading, readiness.reason, state.chartSpec, state.viewMode]);

    const compactSummaryItems = useMemo(() => resolveCompactSummaryItems({
        requiredStaticFilters: compactRequiredStaticFilters,
        staticFilters: state.staticFilters,
        selectedMeasures: state.selectedMeasures,
        selectedDimensions: state.selectedDimensions,
        totalActiveFilterCount,
        hasValidChartSpec,
        canShowResults,
        viewMode: state.viewMode,
    }), [canShowResults, compactRequiredStaticFilters, hasValidChartSpec, state.selectedDimensions, state.selectedMeasures, state.staticFilters, state.viewMode, totalActiveFilterCount]);

    const showingChartView = !loading && !error && canShowResults && (
        (explicitChartMode && hasValidChartSpec && state.viewMode === "chart")
        || (!explicitChartMode && state.viewMode !== "table")
    );

    const showPagination = !showingChartView;

    const desktopResultTitle = useMemo(() => {
        if (showingChartView) {
            const chartTitle = String(state.chartSpec?.title || "").trim();
            if (chartTitle) {
                return chartTitle;
            }
            const typeLabel = chartTypeLabel(state.chartSpec?.type || "");
            return typeLabel ? `${typeLabel} chart` : "Chart results";
        }
        if (canShowResults) {
            return "Table results";
        }
        return "Report results";
    }, [canShowResults, showingChartView, state.chartSpec]);

    const desktopResultDescription = useMemo(() => {
        if (loading) {
            return "Refreshing the current scope and preparing the latest results.";
        }
        if (error) {
            return "The current result payload could not be rendered. Adjust the inputs or run again.";
        }
        if (showingChartView) {
            return chartDataPolicy.mode === "fullQuery"
                ? "Chart-first view for the active scope using the full query result set. Switch to the table when you need to inspect individual rows."
                : "Chart-first view for the active scope. Switch to the table when you need to inspect individual rows.";
        }
        if (canShowResults) {
            return "Table view for the active scope. Use chart actions to switch to a curated visual read of the same data.";
        }
        if (canRunReport) {
            return "Run the current scope to preview results and unlock chart actions.";
        }
        if (readiness.reason === "scope") {
            return "Choose the required scope before running the report.";
        }
        return "Complete the required filters before running the report.";
    }, [canRunReport, canShowResults, chartDataPolicy.mode, error, loading, readiness.reason, showingChartView]);

    const desktopResultMetaItems = useMemo(() => {
        const items = [];
        if (showingChartView && state.chartSpec?.type) {
            const typeLabel = chartTypeLabel(state.chartSpec.type);
            if (typeLabel) {
                items.push(typeLabel);
            }
        }
        if (state.selectedMeasures.length > 0) {
            items.push(`${state.selectedMeasures.length} measure${state.selectedMeasures.length === 1 ? "" : "s"}`);
        }
        if (state.selectedDimensions.length > 0) {
            items.push(`${state.selectedDimensions.length} breakdown${state.selectedDimensions.length === 1 ? "" : "s"}`);
        }
        if (totalActiveFilterCount > 0) {
            items.push(`${totalActiveFilterCount} filter${totalActiveFilterCount === 1 ? "" : "s"}`);
        }
        if (canShowResults && computedCollection.length > 0) {
            items.push(`${computedCollection.length} page row${computedCollection.length === 1 ? "" : "s"}`);
        }
        return items;
    }, [canShowResults, computedCollection.length, showingChartView, state.chartSpec, state.selectedDimensions.length, state.selectedMeasures.length, totalActiveFilterCount]);

    useEffect(() => {
        if (chartDataPolicy.mode !== "fullQuery") {
            setChartQueryState((current) => (
                current.fingerprint || current.rows.length > 0 || current.error
                    ? { fingerprint: "", rows: [], loading: false, error: null }
                    : current
            ));
            return;
        }
        if (shouldDeferReportBuilderRequestForPrefill({
            currentPrefillSignature,
            appliedPrefillSignature: appliedPrefillSignatureRef.current,
        })) {
            return;
        }
        if (!showingChartView || !chartQueryRequest || !chartQueryFingerprint) {
            return;
        }
        const fetchRecords = builderContext?.handlers?.dataSource?.fetchRecords;
        if (typeof fetchRecords !== "function") {
            setChartQueryState({
                fingerprint: chartQueryFingerprint,
                rows: [],
                loading: false,
                error: new Error("Chart data fetch is unavailable for full-query mode."),
            });
            return;
        }
        let cancelled = false;
        setChartQueryState((current) => ({
            fingerprint: chartQueryFingerprint,
            rows: current.fingerprint === chartQueryFingerprint ? current.rows : [],
            loading: true,
            error: null,
        }));
        fetchRecords({ parameters: chartQueryRequest })
            .then((body) => {
                if (cancelled) {
                    return;
                }
                setChartQueryState({
                    fingerprint: chartQueryFingerprint,
                    rows: Array.isArray(body?.rows) ? body.rows : [],
                    loading: false,
                    error: null,
                });
            })
            .catch((fetchError) => {
                if (cancelled) {
                    return;
                }
                setChartQueryState((current) => ({
                    fingerprint: chartQueryFingerprint,
                    rows: current.fingerprint === chartQueryFingerprint ? current.rows : [],
                    loading: false,
                    error: fetchError,
                }));
            });
        return () => {
            cancelled = true;
        };
    }, [builderContext, chartDataPolicy.mode, chartQueryFingerprint, chartQueryRequest, currentPrefillSignature, manualRunSequence, showingChartView]);

    const chartRenderCollection = useMemo(
        () => resolveReportBuilderChartCollection({
            computedCollection,
            chartCollection: chartQueryCollection,
            policy: chartDataPolicy,
        }),
        [chartDataPolicy, chartQueryCollection, computedCollection],
    );
    const exportCollection = useMemo(
        () => resolveReportBuilderExportCollection({
            computedCollection,
            chartCollection: chartQueryCollection,
            policy: chartDataPolicy,
            showingChartView,
        }),
        [chartDataPolicy, chartQueryCollection, computedCollection, showingChartView],
    );

    const activeResultLoading = loading
        || (chartDataPolicy.mode === "fullQuery" && showingChartView && chartQueryState.loading && chartRenderCollection.length === 0);
    const activeResultError = error
        || (chartDataPolicy.mode === "fullQuery" && showingChartView ? chartQueryState.error : null);
    const reportBuilderStateMarker = useMemo(() => {
        if (activeResultLoading) {
            return "loading";
        }
        if (activeResultError) {
            return "error";
        }
        if (!canShowResults) {
            return canRunReport ? "ready" : "needs-input";
        }
        return showingChartView ? "chart" : "table";
    }, [activeResultError, activeResultLoading, canRunReport, canShowResults, showingChartView]);

    const downloadCsv = React.useCallback(() => {
        if (!Array.isArray(selectedColumns) || selectedColumns.length === 0 || !Array.isArray(exportCollection) || exportCollection.length === 0) {
            return;
        }
        const lines = [selectedColumns.map((column) => escapeCsvCell(column.label || column.key)).join(",")];
        exportCollection.forEach((row) => {
            lines.push(selectedColumns.map((column) => {
                const raw = resolveReportBuilderCellValue(row, column);
                return escapeCsvCell(column.kind === "measure"
                    ? formatDashboardValue(raw, column.format, locale)
                    : raw);
            }).join(","));
        });
        const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `${String(container?.id || "report-builder").trim() || "report-builder"}-${ts}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [container?.id, exportCollection, locale, selectedColumns]);

    const openCompactSheet = React.useCallback((tab = "scope") => {
        setCompactChartSheetOpen(false);
        setCompactSheetTab(tab);
        setCompactSheetOpen(true);
    }, []);

    const closeCompactSheet = React.useCallback(() => {
        setCompactSheetOpen(false);
    }, []);

    const closeCompactChartSheet = React.useCallback(() => {
        setCompactChartSheetOpen(false);
    }, []);

    const toggleMeasure = (measureId) => {
        const id = String(measureId || "").trim();
        if (!id) return;
        const current = Array.isArray(state.selectedMeasures) ? state.selectedMeasures : [];
        const has = current.includes(id);
        const nextMeasures = has ? current.filter((entry) => entry !== id) : [...current, id];
        const ensuredMeasures = nextMeasures.length > 0 ? nextMeasures : [id];
        persistState({
            ...state,
            selectedMeasures: ensuredMeasures,
            primaryMeasure: state.primaryMeasure && ensuredMeasures.includes(state.primaryMeasure)
                ? state.primaryMeasure
                : ensuredMeasures[0],
        });
    };

    const setPrimaryMeasure = (measureId) => {
        const id = String(measureId || "").trim();
        if (!id) return;
        const nextMeasures = state.selectedMeasures.includes(id)
            ? state.selectedMeasures
            : [...state.selectedMeasures, id];
        persistState({
            ...state,
            selectedMeasures: nextMeasures,
            primaryMeasure: id,
        });
    };

    const toggleDimension = (dimensionId) => {
        const id = String(dimensionId || "").trim();
        if (!id) return;
        const current = Array.isArray(state.selectedDimensions) ? state.selectedDimensions : [];
        const has = current.includes(id);
        const nextDimensions = has ? current.filter((entry) => entry !== id) : [...current, id];
        persistState({
            ...state,
            selectedDimensions: nextDimensions.length > 0 ? nextDimensions : [id],
        });
    };

    const addDimension = (dimensionId) => {
        const id = String(dimensionId || "").trim();
        if (!id) return;
        const current = Array.isArray(state.selectedDimensions) ? state.selectedDimensions : [];
        if (current.includes(id)) {
            return;
        }
        persistState({
            ...state,
            selectedDimensions: [...current, id],
        });
    };

    const removeDimension = (dimensionId) => {
        const id = String(dimensionId || "").trim();
        if (!id) return;
        const current = Array.isArray(state.selectedDimensions) ? state.selectedDimensions : [];
        if (current.length <= 1) {
            return;
        }
        const nextDimensions = current.filter((entry) => entry !== id);
        persistState({
            ...state,
            selectedDimensions: nextDimensions.length > 0 ? nextDimensions : current,
        });
    };

    const setViewMode = (viewMode) => {
        if (explicitChartMode && viewMode === "chart" && !hasValidChartSpec) {
            return;
        }
        persistState({
            ...state,
            viewMode,
        });
    };

    const saveChartPreset = React.useCallback((chartSpec, options = {}) => {
        const normalized = normalizeReportBuilderChartSpec(chartSpec);
        if (!normalized) {
            return;
        }
        const presetSettingsHash = String(options?.settingsHash || settingsHash || "").trim();
        const nextPresets = upsertChartPreset(storedChartPresets, {
            title: String(normalized.title || "Saved chart").trim() || "Saved chart",
            settingsHash: presetSettingsHash,
            chartSpec: normalized,
            updatedAt: Date.now(),
        });
        setStoredChartPresets(nextPresets);
        persistStoredChartPresets(stateStorageScope, nextPresets, legacyChartPresetScopes);
    }, [legacyChartPresetScopes, settingsHash, stateStorageScope, storedChartPresets]);

    const applyChartSpec = React.useCallback((nextChartSpec, { savePreset = true } = {}) => {
        const normalized = normalizeReportBuilderChartSpec(nextChartSpec);
        const validation = validateReportBuilderChartSpec(config, normalized, chartFields);
        if (!normalized || !validation.valid) {
            return false;
        }
        persistState({
            ...state,
            chartSpec: normalized,
            viewMode: "chart",
        });
        setChartApplyFeedback(null);
        if (savePreset) {
            saveChartPreset(normalized);
        }
        return true;
    }, [chartFields, config, persistState, saveChartPreset, state]);

    const removeChart = React.useCallback(() => {
        persistState({
            ...state,
            chartSpec: null,
            viewMode: "table",
        });
        setChartApplyFeedback(null);
    }, [persistState, state]);

    const actionModel = useMemo(() => buildReportBuilderActionModel({
        viewModes,
        explicitChartMode,
        hasValidChartSpec,
        canShowResults,
        canRunReport,
        loading,
    }), [canRunReport, canShowResults, explicitChartMode, hasValidChartSpec, loading, viewModes]);

    const resultViewModes = actionModel.resultModes;

    const desktopResultOverflowActions = useMemo(() => (
        actionModel.desktop.overflowActionIds.map((actionId) => {
            if (actionId === "removeChart") {
                return {
                    text: "Remove chart",
                    icon: "trash",
                    intent: "danger",
                    onClick: removeChart,
                };
            }
            return null;
        }).filter(Boolean)
    ), [actionModel.desktop.overflowActionIds, removeChart]);

    const openChartDialog = React.useCallback((seed = null) => {
        const nextDraft = buildDefaultReportBuilderChartSpec(config, state, seed || {}, {
            suggestSeriesField: true,
        });
        if (!nextDraft) {
            return;
        }
        setChartApplyFeedback(null);
        setChartDraft(nextDraft);
        setChartDialogOpen(true);
    }, [config, state]);

    const applyQuickChart = React.useCallback((quickOptionValue = "") => {
        const optionValue = String(quickOptionValue || selectedQuickChartOption || "").trim();
        if (!optionValue) {
            return;
        }
        const next = quickChartOptions.find((entry) => entry.value === optionValue);
        if (!next?.spec) {
            setSelectedQuickChartOption("");
            return;
        }
        if (next.kind !== "default") {
            applyChartSpec(next.spec);
            setSelectedQuickChartOption("");
            return;
        }
        const selectionPolicy = String(next.spec?.selectionPolicy || quickPresetPolicy.selectionPolicy || "").trim().toLowerCase() === "replace"
            ? "replace"
            : "merge";
        const prepared = next.prepared || prepareReportBuilderChartApplication(config, state, next.spec, {
            autoProvisionMissingDimensions: quickPresetPolicy.autoProvisionMissingDimensions,
            forceAutoFetch: quickPresetPolicy.autoFetchOnSelect,
            selectionPolicy,
        });
        if (!prepared.canApply) {
            setChartApplyFeedback({
                level: prepared.reason === "missingDimensions" ? "warning" : "danger",
                message: prepared.message || "This chart could not be applied.",
            });
            setSelectedQuickChartOption("");
            return;
        }
        persistState(prepared.nextState);
        if (prepared.shouldFetch) {
            dispatchReportRequest(prepared.nextState, { forceFetch: true });
        }
        const changedParts = [];
        if (prepared.measureSelectionChanged || prepared.primaryMeasureChanged) {
            changedParts.push("measures");
        }
        if (prepared.dimensionSelectionChanged) {
            changedParts.push("breakdowns");
        }
        const changedText = changedParts.length > 0 ? changedParts.join(" and ") : "chart settings";
        setChartApplyFeedback(prepared.selectionChanged
            ? {
                level: "info",
                message: prepared.shouldFetch
                    ? `Applied this preset's required ${changedText}. Refreshing results.`
                    : prepared.requiresManualRun
                        ? `Applied this preset's required ${changedText}. Run to refresh results.`
                        : `Applied this preset's required ${changedText}.`,
                action: prepared.requiresManualRun ? "runReport" : "",
            }
            : null);
        saveChartPreset(prepared.normalizedChartSpec, {
            settingsHash: buildReportBuilderSettingsHash(prepared.nextState),
        });
        setSelectedQuickChartOption("");
    }, [applyChartSpec, config, dispatchReportRequest, persistState, quickChartOptions, quickPresetPolicy.autoFetchOnSelect, quickPresetPolicy.autoProvisionMissingDimensions, quickPresetPolicy.selectionPolicy, saveChartPreset, selectedQuickChartOption, state]);

    const runCompactPrimaryAction = React.useCallback(() => {
        closeCompactSheet();
        closeCompactChartSheet();
        runReport();
    }, [closeCompactChartSheet, closeCompactSheet, runReport]);

    const compactBottomBarActions = useMemo(() => (
        actionModel.compact.bottomBar.map((action) => {
            switch (action.id) {
                case "setup":
                    return {
                        ...action,
                        onClick: () => openCompactSheet("scope"),
                    };
                case "chart":
                    return {
                        ...action,
                        onClick: () => setCompactChartSheetOpen(true),
                    };
                case "run":
                    return {
                        ...action,
                        onClick: runCompactPrimaryAction,
                    };
                default:
                    return null;
            }
        }).filter(Boolean)
    ), [actionModel.compact.bottomBar, openCompactSheet, runCompactPrimaryAction]);

    const chartDraftValidation = useMemo(
        () => validateReportBuilderChartSpec(config, chartDraft, chartFields),
        [chartDraft, chartFields, config],
    );

    const toggleFilterPanel = (key) => {
        setFilterPanels((current) => ({
            ...current,
            [key]: !current[key],
        }));
    };

    const toggleOptionalFilterCategory = (filterKey) => {
        setActiveOptionalFilterKeys((current) => (
            current.includes(filterKey)
                ? current.filter((entry) => entry !== filterKey)
                : [...current, filterKey]
        ));
    };

    const toggleDynamicGroupCategory = (groupId) => {
        const nextIsActive = !activeDynamicGroupIds.includes(groupId);
        setActiveDynamicGroupIds((current) => (
            current.includes(groupId)
                ? current.filter((entry) => entry !== groupId)
                : [...current, groupId]
        ));
        if (!nextIsActive) {
            return;
        }
        const group = dynamicFilterGroups.find((entry) => entry?.id === groupId);
        if (!group) {
            return;
        }
        const existingRows = state?.dynamicGroups?.[groupId] || [];
        if (Array.isArray(existingRows) && existingRows.length > 0) {
            return;
        }
        persistState(addDynamicFilterRow(state, group));
    };

    const setGroupBy = (value) => {
        persistState({
            ...state,
            groupBy: value,
            page: 1,
        });
    };

    const setOrderField = (value) => {
        persistState({
            ...state,
            orderField: value,
            page: 1,
        });
    };

    const setOrderDir = (value) => {
        persistState({
            ...state,
            orderDir: value,
            page: 1,
        });
    };

    const setPageSize = (value) => {
        const pageSize = Math.max(1, Number(value) || 1);
        persistState({
            ...state,
            pageSize,
            page: 1,
        });
    };

    const goToPage = (page) => {
        persistState({
            ...state,
            page: Math.max(1, Number(page) || 1),
        });
    };

    const toggleStaticFilter = (filter, optionValue) => {
        const key = String(filter.id || filter.field || "").trim();
        if (!key) return;
        const current = state?.staticFilters?.[key];
        let nextValue;
        if (filter.multiple) {
            const list = Array.isArray(current) ? current : [];
            nextValue = list.includes(optionValue)
                ? list.filter((entry) => entry !== optionValue)
                : [...list, optionValue];
        } else {
            nextValue = current === optionValue ? "" : optionValue;
        }
        persistState({
            ...state,
            staticFilters: {
                ...(state.staticFilters || {}),
                [key]: nextValue,
            },
            page: 1,
        });
    };

    const setDateRangeValue = (filter, edge, value) => {
        const key = String(filter.id || filter.field || "").trim();
        if (!key) return;
        const previous = state?.staticFilters?.[key] && typeof state.staticFilters[key] === "object"
            ? state.staticFilters[key]
            : {};
        persistState({
            ...state,
            staticFilters: {
                ...(state.staticFilters || {}),
                [key]: {
                    ...previous,
                    [edge]: value || "",
                },
            },
            page: 1,
        });
    };

    const addRow = (group) => {
        const groupId = String(group?.id || "").trim();
        if (groupId) {
            setPendingScrollRowId(nextDynamicRowId(state?.dynamicGroups?.[groupId]));
        }
        persistState(addDynamicFilterRow(state, group));
    };

    const changeDynamicFilterType = (group, rowId, filterId) => {
        persistState(updateDynamicFilterRow(state, group, rowId, {
            filterId,
            selections: [],
        }));
    };

    const removeDynamicSelection = (group, rowId, index) => {
        const rows = (state?.dynamicGroups?.[group.id] || []).map((row) => {
            if (row.id !== rowId) return row;
            return {
                ...row,
                selections: (row.selections || []).filter((_, selectionIndex) => selectionIndex !== index),
            };
        });
        persistState({
            ...state,
            dynamicGroups: {
                ...(state.dynamicGroups || {}),
                [group.id]: rows,
            },
        });
    };

    const removeRow = (group, rowId) => {
        persistState(removeDynamicFilterRow(state, group, rowId));
    };

    const renderDynamicGroup = (groupId) => {
        const group = dynamicFilterGroups.find((entry) => entry?.id === groupId);
        if (!group) {
            return null;
        }
        return (
            <DynamicFilterGroup
                key={group.id}
                group={group}
                rows={state?.dynamicGroups?.[group.id] || []}
                resolveLookup={resolveLookup}
                onAddRow={() => addRow(group)}
                onChangeFilter={(rowId, filterId) => changeDynamicFilterType(group, rowId, filterId)}
                onPick={(rowId, filterDef, lookup) => pickDynamicSelection(group, rowId, filterDef, lookup)}
                onAddManualSelection={(rowId, filterDef, rawValue) => addManualDynamicSelection(group, rowId, filterDef, rawValue)}
                onRemoveSelection={(rowId, index) => removeDynamicSelection(group, rowId, index)}
                onToggleEnabled={(rowId) => toggleDynamicRowEnabled(group, rowId)}
                onRemoveRow={(rowId) => removeRow(group, rowId)}
            />
        );
    };

    const renderDynamicSubgroup = (groupId, filterIds, label) => {
        const group = dynamicFilterGroups.find((entry) => entry?.id === groupId);
        if (!group) {
            return null;
        }
        const subgroup = {
            ...group,
            label,
            filters: (group.filters || []).filter((entry) => filterIds.includes(String(entry?.id || "").trim())),
        };
        if (!subgroup.filters.length) {
            return null;
        }
        return (
            <DynamicFilterGroup
                key={`${groupId}_${label}`}
                group={subgroup}
                rows={(state?.dynamicGroups?.[groupId] || []).filter((row) => filterIds.includes(String(row?.filterId || "").trim()))}
                resolveLookup={resolveLookup}
                onAddRow={() => addRow(subgroup)}
                onChangeFilter={(rowId, filterId) => changeDynamicFilterType(subgroup, rowId, filterId)}
                onPick={(rowId, filterDef, lookup) => pickDynamicSelection(subgroup, rowId, filterDef, lookup)}
                onAddManualSelection={(rowId, filterDef, rawValue) => addManualDynamicSelection(subgroup, rowId, filterDef, rawValue)}
                onRemoveSelection={(rowId, index) => removeDynamicSelection(subgroup, rowId, index)}
                onToggleEnabled={(rowId) => toggleDynamicRowEnabled(subgroup, rowId)}
                onRemoveRow={(rowId) => removeRow(subgroup, rowId)}
            />
        );
    };

    const getDirectionalSubgroup = (direction, family) => {
        const base = dynamicFilterGroups.find((entry) => String(entry?.id || "").trim() === direction);
        if (!base) {
            return null;
        }
        const filterIds = direction === "include" ? family.includeFilterIds : family.excludeFilterIds;
        return {
            ...base,
            id: direction,
            filters: (base.filters || []).filter((entry) => filterIds.includes(String(entry?.id || "").trim())),
        };
    };

    const persistDirectionalRows = (nextState, subgroup, rows) => ({
        ...nextState,
        dynamicGroups: {
            ...(nextState.dynamicGroups || {}),
            [subgroup.id]: normalizeDynamicGroupRows(rows, subgroup),
        },
    });

    const addFamilyRow = (family) => {
        const options = buildDynamicFamilyOptions(family, dynamicFilterGroups);
        const firstOption = options.find((entry) => entry.includeFilter || entry.excludeFilter);
        if (!firstOption) {
            return;
        }
        const direction = firstOption.includeFilter ? "include" : "exclude";
        const subgroup = getDirectionalSubgroup(direction, family);
        if (!subgroup) {
            return;
        }
        setPendingScrollRowId(nextDynamicRowId(state?.dynamicGroups?.[subgroup.id]));
        persistState(addDynamicFilterRow(state, subgroup));
    };

    const moveFamilyRow = (family, rowId, fromDirection, toDirection, optionKey, patch = {}) => {
        const sourceGroup = getDirectionalSubgroup(fromDirection, family);
        const targetGroup = getDirectionalSubgroup(toDirection, family);
        if (!sourceGroup || !targetGroup) {
            return;
        }
        const option = buildDynamicFamilyOptions(family, dynamicFilterGroups).find((entry) => entry.key === optionKey);
        const targetFilter = toDirection === "include" ? option?.includeFilter : option?.excludeFilter;
        if (!targetFilter) {
            return;
        }
        const sourceRows = normalizeArray(state?.dynamicGroups?.[fromDirection]);
        const targetRows = normalizeArray(state?.dynamicGroups?.[toDirection]);
        const currentRow = sourceRows.find((row) => String(row?.id || "").trim() === rowId);
        if (!currentRow) {
            return;
        }
        const nextSourceRows = sourceRows.filter((row) => String(row?.id || "").trim() !== rowId);
        const movedRow = {
            ...currentRow,
            ...patch,
            filterId: String(targetFilter.id || "").trim(),
        };
        const nextState = persistDirectionalRows(
            persistDirectionalRows(state, sourceGroup, nextSourceRows),
            targetGroup,
            [...targetRows, movedRow],
        );
        persistState(nextState);
    };

    const changeFamilyFilterType = (family, rowId, direction, optionKey) => {
        const option = buildDynamicFamilyOptions(family, dynamicFilterGroups).find((entry) => entry.key === optionKey);
        if (!option) {
            return;
        }
        const targetDirection = direction === "include"
            ? (option.includeFilter ? "include" : option.excludeFilter ? "exclude" : direction)
            : (option.excludeFilter ? "exclude" : option.includeFilter ? "include" : direction);
        if (targetDirection !== direction) {
            moveFamilyRow(family, rowId, direction, targetDirection, optionKey, { selections: [] });
            return;
        }
        const subgroup = getDirectionalSubgroup(direction, family);
        const targetFilter = direction === "include" ? option.includeFilter : option.excludeFilter;
        if (!subgroup || !targetFilter) {
            return;
        }
        persistState(updateDynamicFilterRow(state, subgroup, rowId, {
            filterId: String(targetFilter.id || "").trim(),
            selections: [],
        }));
    };

    const changeFamilyDirection = (family, rowId, currentDirection, optionKey, nextDirection) => {
        if (currentDirection === nextDirection) {
            return;
        }
        moveFamilyRow(family, rowId, currentDirection, nextDirection, optionKey);
    };

    const renderDynamicFamily = (family) => (
        <section key={family.id} className="forge-report-builder__family-group">
            {!config.unifiedFamilyRows ? (
                <div className="forge-report-builder__family-group-header">
                    <div>
                        <h4>{family.label}</h4>
                        {family.description ? <p>{family.description}</p> : null}
                    </div>
                </div>
            ) : null}
            {config.unifiedFamilyRows ? (
                <DynamicFamilyGroup
                    family={family}
                    rows={buildDynamicFamilyRows(state, family, dynamicFilterGroups)}
                    options={buildDynamicFamilyOptions(family, dynamicFilterGroups)}
                    resolveLookup={resolveLookup}
                    onAddRow={() => addFamilyRow(family)}
                    onChangeFilter={(rowId, direction, optionKey) => changeFamilyFilterType(family, rowId, direction, optionKey)}
                    onChangeDirection={(rowId, direction, optionKey, nextDirection) => changeFamilyDirection(family, rowId, direction, optionKey, nextDirection)}
                    onPick={(rowId, direction, filterDef, lookup) => pickDynamicSelection(getDirectionalSubgroup(direction, family), rowId, filterDef, lookup)}
                    onAddManualSelection={(rowId, direction, filterDef, rawValue) => addManualDynamicSelection(getDirectionalSubgroup(direction, family), rowId, filterDef, rawValue)}
                    onRemoveSelection={(rowId, direction, index) => removeDynamicSelection(getDirectionalSubgroup(direction, family), rowId, index)}
                    onToggleEnabled={(rowId, direction) => toggleDynamicRowEnabled(getDirectionalSubgroup(direction, family), rowId)}
                    onRemoveRow={(rowId, direction) => removeRow(getDirectionalSubgroup(direction, family), rowId)}
                />
            ) : (
                <div className="forge-report-builder__family-group-grid">
                    <div className="forge-report-builder__family-group-column">
                        {renderDynamicSubgroup("include", family.includeFilterIds, "Include")}
                    </div>
                    <div className="forge-report-builder__family-group-column">
                        {renderDynamicSubgroup("exclude", family.excludeFilterIds, "Exclude")}
                    </div>
                </div>
            )}
        </section>
    );

    const addManualDynamicSelection = (group, rowId, filterDef, rawValue) => {
        const selection = projectManualSelection(filterDef, rawValue);
        if (!selection) {
            return false;
        }
        const rows = (state?.dynamicGroups?.[group.id] || []).map((row) => {
            if (row.id !== rowId) return row;
            const currentSelections = Array.isArray(row.selections) ? row.selections : [];
            const nextSelections = filterDef.multiple === false
                ? [selection]
                : [
                    ...currentSelections.filter((entry) => entry.value !== selection.value),
                    selection,
                ];
            return {
                ...row,
                selections: nextSelections,
            };
        });
        persistState({
            ...state,
            dynamicGroups: {
                ...(state.dynamicGroups || {}),
                [group.id]: rows,
            },
        });
        return true;
    };

    const toggleDynamicRowEnabled = (group, rowId) => {
        const rows = (state?.dynamicGroups?.[group.id] || []).map((row) => {
            if (row.id !== rowId) return row;
            return {
                ...row,
                enabled: row?.enabled === false,
            };
        });
        persistState({
            ...state,
            dynamicGroups: {
                ...(state.dynamicGroups || {}),
                [group.id]: rows,
            },
        });
    };

    const pickDynamicSelection = async (group, rowId, filterDef, lookup = null) => {
        const descriptor = lookup || resolveLookup(group, filterDef, rowId);
        const dialogId = descriptor?.dialogId || filterDef?.dialogId || filterDef?.lookup?.dialogId;
        if (!dialogId) {
            return;
        }
        try {
            const payload = await builderContext?.handlers?.window?.openDialog?.({
                execution: {
                    args: [dialogId, { awaitResult: true, multiple: descriptor?.multiple ?? (filterDef?.multiple !== false) }],
                },
                parameters: descriptor?.parameters && typeof descriptor.parameters === "object" ? descriptor.parameters : undefined,
                context: builderContext,
            });
            const selections = projectLookupSelections(filterDef, payload);
            if (selections.length === 0) return;
            const rows = (state?.dynamicGroups?.[group.id] || []).map((row) => {
                if (row.id !== rowId) return row;
                const currentSelections = Array.isArray(row.selections) ? row.selections : [];
                const nextSelections = filterDef.multiple === false
                    ? [selections[0]]
                    : [
                        ...currentSelections.filter(
                            (entry) => !selections.some((selection) => entry.value === selection.value),
                        ),
                        ...selections,
                    ];
                return {
                    ...row,
                    selections: nextSelections,
                };
            });
            persistState({
                ...state,
                dynamicGroups: {
                    ...(state.dynamicGroups || {}),
                    [group.id]: rows,
                },
            });
        } catch (e) {
            console.error("reportBuilder lookup failed", e);
        }
    };

    return (
        <div className={[
            "forge-report-builder",
            compactMode ? "forge-report-builder--compact" : "",
            compactSheetOpen || compactChartSheetOpen ? "forge-report-builder--compact-overlay-open" : "",
            useFilterDrawer ? "forge-report-builder--filters-drawer" : "",
            resultPanePosition === "left" ? "forge-report-builder--result-left" : "",
        ].filter(Boolean).join(" ")}
        ref={builderRootRef}
        data-report-builder-state={reportBuilderStateMarker}
        data-report-builder-view-mode={String(state.viewMode || "").trim() || "table"}
        data-report-builder-chart-title={String(state.chartSpec?.title || "").trim()}
        data-report-builder-chart-type={String(state.chartSpec?.type || "").trim()}
        data-report-builder-compact={compactMode ? "true" : "false"}>
            <div className="forge-report-builder__top">
                {compactMode ? renderCompactHeader() : (
                    <div className="forge-report-builder__shelf">
                        <div className="forge-report-builder__topline">
                            <div className="forge-report-builder__toolbar forge-report-builder__toolbar--inline">
                                <div className="forge-report-builder__toolbar-group forge-report-builder__toolbar-group--execute">
                                    <div className="forge-report-builder__settings-anchor">
                                        <button
                                            type="button"
                                            className="forge-report-builder__toolbar-button forge-report-builder__toolbar-button--icon"
                                            aria-label="Performance metrics settings"
                                            title="Report settings"
                                            aria-expanded={settingsOpen}
                                            onClick={() => setSettingsOpen((current) => !current)}
                                        >
                                            <Icon icon="cog" size={14} />
                                        </button>
                                        {settingsOpen ? (
                                            <div className="forge-report-builder__settings-popover">
                                                {renderSettingsControls()}
                                            </div>
                                        ) : null}
                                    </div>
                                    <Button
                                        small
                                        intent="primary"
                                        icon="play"
                                        className="forge-report-builder__run-button"
                                        disabled={!canRunReport || loading}
                                        onClick={runReport}
                                    >
                                        Run
                                    </Button>
                                    <Button
                                        small
                                        outlined
                                        icon="download"
                                        disabled={!canShowResults}
                                        onClick={downloadCsv}
                                    >
                                        Export
                                    </Button>
                                </div>
                                {inlineToolbarRequiredFilters.length > 0 ? (
                                    <div className="forge-report-builder__toolbar-divider" aria-hidden="true" />
                                ) : null}
                                {inlineToolbarRequiredFilters.length > 0 ? (
                                    <div className="forge-report-builder__toolbar-group forge-report-builder__toolbar-group--scope">
                                        {inlineToolbarRequiredFilters.map((filter) => {
                                            const filterKey = String(filter.id || filter.field || "").trim();
                                            const currentValue = state?.staticFilters?.[filterKey];
                                            return (
                                                <InlineStaticFilterControl
                                                    key={`inline_${filterKey}`}
                                                    filter={filter}
                                                    value={currentValue}
                                                    onToggle={(optionValue) => toggleStaticFilter(filter, optionValue)}
                                                    onDateRange={(edge, value) => setDateRangeValue(filter, edge, value)}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : null}
                                {hasFilterDrawerContent && useFilterDrawer ? (
                                    <Button
                                        small
                                        outlined
                                        icon="filter"
                                        onClick={() => setFiltersDrawerOpen((current) => !current)}
                                    >
                                        {filtersDrawerOpen ? `Hide Filters${totalActiveFilterCount > 0 ? ` (${totalActiveFilterCount})` : ""}` : `Filters${totalActiveFilterCount > 0 ? ` (${totalActiveFilterCount})` : ""}`}
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="forge-report-builder__body">
                {!compactMode ? (
                    <aside className="forge-report-builder__left" ref={leftRailRef}>
                        {renderMeasuresPanel()}
                        {renderBreakdownPanel()}
                        {useFilterRail ? renderFilterRailControls() : null}
                        {!compactMode && useFilterRail && filterPanels.common ? (
                            <section className="forge-report-builder__inline-filter-body" aria-label="Active filters">
                                {renderFilterBody()}
                            </section>
                        ) : null}
                        {useFilterDrawer && filtersDrawerOpen ? renderFiltersPanel() : null}
                    </aside>
                ) : null}

                <main className="forge-report-builder__center">
                    {!compactMode && config.showResultHeader !== false && config?.result?.showResultHeader !== false ? (
                        <div className="forge-report-builder__result-header">
                            <div className="forge-report-builder__result-header-copy">
                                <div className="forge-report-builder__result-header-eyebrow">Results</div>
                                <h3>{desktopResultTitle}</h3>
                                <p>{desktopResultDescription}</p>
                                {desktopResultMetaItems.length > 0 ? (
                                    <div className="forge-report-builder__result-meta" aria-label="Current result summary">
                                        {desktopResultMetaItems.map((item) => (
                                            <span key={item} className="forge-report-builder__result-meta-chip">{item}</span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                {actionModel.desktop.showQuickChartActions ? (
                                    <ReportBuilderChartQuickActions
                                        canCreate={canCreateChart}
                                        showCreateButton={!hasValidChartSpec}
                                        onCreate={() => openChartDialog(state.chartSpec)}
                                        quickOptions={quickChartOptions}
                                        onSelectQuickOption={(value) => {
                                            setSelectedQuickChartOption(value);
                                            setChartApplyFeedback(null);
                                            if (value) {
                                                applyQuickChart(value);
                                            }
                                        }}
                                    />
                                ) : null}
                                {actionModel.desktop.showEditChart ? (
                                    <Button small outlined icon="edit" onClick={() => openChartDialog(state.chartSpec)}>
                                        Edit Chart
                                    </Button>
                                ) : null}
                                <div className="forge-report-builder__view-toggle">
                                    {resultViewModes.map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            className={state.viewMode === mode ? "is-active" : ""}
                                            onClick={() => setViewMode(mode)}
                                            disabled={explicitChartMode && mode === "chart" && !hasValidChartSpec}
                                        >
                                            <Icon icon={mode === "table" ? "th" : "timeline-line-chart"} size={12} />
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                                <ReportBuilderOverflowActions actions={desktopResultOverflowActions} />
                            </div>
                        </div>
                    ) : null}
                    {chartApplyFeedback?.message ? (
                        <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${chartApplyFeedback.level || "warning"}`}>
                            <span>{chartApplyFeedback.message}</span>
                            {chartApplyFeedback.action === "runReport" ? (
                                <Button small minimal onClick={runReport}>Run now</Button>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="forge-report-builder__result-frame">
                        {activeResultLoading ? (
                            <ReportBuilderResultState
                                icon="refresh"
                                eyebrow="Loading"
                                title="Refreshing report data"
                                description="Preparing the latest result set for the current scope."
                            />
                        ) : null}
                        {activeResultError ? (
                            <ReportBuilderResultState
                                tone="error"
                                icon="warning-sign"
                                eyebrow="Result error"
                                title="We couldn't render these results"
                                description={renderReportBuilderError(activeResultError)}
                                actionLabel={canRunReport ? "Run again" : ""}
                                onAction={canRunReport ? runReport : undefined}
                            />
                        ) : null}
                        {!activeResultLoading && !activeResultError && !canShowResults ? (
                            <ReportBuilderResultState
                                icon={canRunReport ? (hasCompletedCurrentRun ? "search-around" : "play") : "filter-list"}
                                eyebrow={canRunReport ? (hasCompletedCurrentRun ? "No rows returned" : "Ready to run") : "Scope required"}
                                title={canRunReport
                                    ? (hasCompletedCurrentRun ? "No rows matched the current scope" : "Run the report to preview results")
                                    : readiness.reason === "scope"
                                        ? "Choose the required scope"
                                        : "Complete the required filters"}
                                description={canRunReport
                                    ? (hasCompletedCurrentRun
                                        ? "Try widening the date range or adjusting the selected scope and filters."
                                        : "Run the current setup to unlock table and chart analysis.")
                                    : readiness.reason === "scope"
                                        ? "Select an advertiser, campaign, ad order, or audience before running the report."
                                        : "Set the remaining required filters before running the report."}
                                actionLabel={canRunReport && !hasCompletedCurrentRun ? "Run report" : ""}
                                onAction={canRunReport && !hasCompletedCurrentRun ? runReport : undefined}
                            />
                        ) : null}
                        {!activeResultLoading && !activeResultError && canShowResults && (
                            (explicitChartMode && hasValidChartSpec && state.viewMode === "chart")
                            || (!explicitChartMode && state.viewMode !== "table")
                        ) ? (
                            <div className="forge-report-builder__chart-wrap">
                                <Chart key={chartRenderKey} container={chartContainer} context={builderContext} embedded />
                            </div>
                        ) : null}
                        {!activeResultLoading && !activeResultError && canShowResults && (
                            !explicitChartMode
                                ? state.viewMode === "table"
                                : (!hasValidChartSpec || hasStaleChartSpec || state.viewMode === "table")
                        ) ? (
                            <div className="forge-report-builder__table-wrap">
                                <table className="forge-report-builder__table">
                                    <thead>
                                        <tr>
                                            {selectedColumns.map((column) => (
                                                <th key={column.key} style={{ textAlign: column.align || "left" }}>
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(computedCollection || []).map((row, index) => (
                                            <tr key={index}>
                                                {selectedColumns.map((column) => {
                                                    const value = resolveReportBuilderCellValue(row, column);
                                                    return (
                                                        <td key={`${index}_${column.key}`} style={{ textAlign: column.align || "left" }}>
                                                            {column.kind === "measure"
                                                                ? formatDashboardValue(value, column.format, locale)
                                                                : String(value ?? "-")}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                        {!activeResultLoading && !activeResultError && canShowResults && explicitChartMode && (!hasValidChartSpec || hasStaleChartSpec) ? (
                            <ReportBuilderResultState
                                tone={hasStaleChartSpec ? "warning" : "neutral"}
                                icon={hasStaleChartSpec ? "warning-sign" : "timeline-line-chart"}
                                eyebrow={hasStaleChartSpec ? "Chart needs attention" : "Chart not configured"}
                                title={hasStaleChartSpec ? "The current chart no longer matches this table" : "Build a chart from the current table"}
                                description={hasStaleChartSpec
                                    ? (chartSpecValidation.errors || []).map((entry) => chartErrorMessage(entry, { dimensions: chartDimensions, measures: chartMeasures })).join(" ")
                                    : (compactMode
                                        ? "Use Chart in the bottom bar to build a chart from the current table."
                                        : "Use the result header actions to create or apply a curated chart from the current table.")}
                                actionLabel={!compactMode && canCreateChart ? (hasStaleChartSpec ? "Edit chart" : "Create chart") : ""}
                                onAction={!compactMode && canCreateChart
                                    ? () => openChartDialog(state.chartSpec)
                                    : undefined}
                            />
                        ) : null}
                    </div>

                    {showPagination ? (
                        <div className="forge-report-builder__pagination">
                            <span>Page {state.page}</span>
                            <div className="forge-report-builder__pagination-actions">
                                <Button small outlined disabled={state.page <= 1} onClick={() => goToPage(state.page - 1)}>
                                    Previous
                                </Button>
                                <Button small outlined disabled={!hasMore} onClick={() => goToPage(state.page + 1)}>
                                    Next
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {renderCompactBottomBar()}
                </main>
            </div>

            {!compactMode && !useFilterDrawer && !useFilterRail ? renderFiltersPanel() : null}
            {renderCompactSetupSheet()}
            {renderCompactChartSheet()}
            <ReportBuilderChartDialog
                isOpen={chartDialogOpen}
                onClose={() => setChartDialogOpen(false)}
                draft={chartDraft}
                onDraftChange={(nextDraft) => setChartDraft(normalizeReportBuilderChartSpec(nextDraft))}
                onApply={() => {
                    if (applyChartSpec(chartDraft)) {
                        setChartDialogOpen(false);
                    }
                }}
                supportedTypes={supportedChartTypes}
                dimensions={chartDimensions}
                measures={chartMeasures}
                validation={chartDraftValidation}
                sanitizeDraftPatch={sanitizeChartDraftPatch}
                renderChartError={chartErrorMessage}
            />
        </div>
    );
}
