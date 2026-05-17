import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon } from "@blueprintjs/core";
import { useSignals } from "@preact/signals-react/runtime";

import Chart from "../Chart.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { mergeWindowFormValues } from "../../hooks/dataSource.js";
import { resolveKey, setSelector } from "../../utils/selector.js";
import { formatDashboardValue } from "./dashboardUtils.js";
import {
    applyReportBuilderComputedMeasures,
    addDynamicFilterRow,
    buildReportBuilderColumns,
    buildReportBuilderDefaultState,
    buildReportBuilderRequest,
    canAutoFetchReportBuilder,
    getSelectableReportBuilderMeasures,
    getVisibleReportBuilderDimensions,
    mergeReportBuilderState,
    projectLookupSelections,
    removeDynamicFilterRow,
    resolveReportBuilderMeasure,
    resolveReportBuilderReadiness,
    sanitizeReportBuilderState,
    updateDynamicFilterRow,
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

export function resolveReportBuilderHookHandler(builderContext, handlerName = "") {
    const directName = String(handlerName || "").trim();
    if (!directName || !builderContext?.lookupHandler) {
        return null;
    }
    try {
        return builderContext.lookupHandler(directName);
    } catch (error) {
        const namespace = String(builderContext?.metadata?.namespace || "").trim();
        const namespacedName = namespace && !directName.startsWith(`${namespace}.`)
            ? `${namespace}.${directName}`
            : "";
        if (!namespacedName) {
            throw error;
        }
        return builderContext.lookupHandler(namespacedName);
    }
}

function applyRequestHook(builderContext, config = {}, state = {}, request = {}) {
    const handlerName = String(config?.hooks?.buildRequest || "").trim();
    if (!handlerName || !builderContext?.lookupHandler) {
        return request;
    }
    try {
        const handler = resolveReportBuilderHookHandler(builderContext, handlerName);
        const result = handler({
            context: builderContext,
            request,
            state,
            config,
        });
        return (result && typeof result === "object") ? result : request;
    } catch (error) {
        console.error("reportBuilder request hook failed", error);
        return request;
    }
}

export function applyReportBuilderStateHook(builderContext, config = {}, state = {}, windowForm = {}) {
    const handlerName = String(config?.hooks?.initializeState || "").trim();
    if (!handlerName || !builderContext?.lookupHandler) {
        return state;
    }
    try {
        const handler = resolveReportBuilderHookHandler(builderContext, handlerName);
        const result = handler({
            context: builderContext,
            state,
            config,
            windowForm,
        });
        return (result && typeof result === "object") ? result : state;
    } catch (error) {
        console.error("reportBuilder state hook failed", error);
        return state;
    }
}

function prefillSignature(windowForm = {}) {
    const prefill = windowForm?.prefill;
    if (!prefill || typeof prefill !== "object" || Array.isArray(prefill)) {
        return "";
    }
    return JSON.stringify(prefill);
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
    return Array.from(grouped.values())
        .filter((section) => Array.isArray(section.measures) && section.measures.length > 0)
        .sort((left, right) => {
            if (left.order !== right.order) {
                return left.order - right.order;
            }
            return String(left.label || left.id).localeCompare(String(right.label || right.id));
        });
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

function filterCategoryIcon(categoryId = "") {
    switch (String(categoryId || "").trim()) {
        case "channelIds":
            return "layers";
        case "scope":
            return "target";
        case "inventory":
            return "box";
        case "targeting":
            return "diagram-tree";
        default:
            return "filter";
    }
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
        nameKey: groupDimension?.key || groupDimension?.id,
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
                dataKey: xDimension?.key || xDimension?.id || "eventDate",
                tickFormat: xDimension?.tickFormat,
            },
            yAxis: {
                format: primaryMeasure?.format,
            },
            series: !preferDirectSeries && groupDimension ? groupedSeries : directSeries,
        },
    };
}

function FilterChip({ label, onRemove }) {
    return (
        <span className="forge-report-builder-filter-chip">
            {label}
            <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>
                ×
            </button>
        </span>
    );
}

function collectOptionRows(rows = [], childKeys = ["children", "childNodes"], result = []) {
    (rows || []).forEach((row) => {
        if (!row || typeof row !== "object") return;
        result.push(row);
        childKeys.forEach((key) => {
            const children = row?.[key];
            if (Array.isArray(children) && children.length > 0) {
                collectOptionRows(children, childKeys, result);
            }
        });
    });
    return result;
}

function resolveFilterOptions(filter = {}, collection = []) {
    if (Array.isArray(filter.options) && filter.options.length > 0) {
        return filter.options;
    }
    const childKeys = Array.isArray(filter.optionChildKeys) && filter.optionChildKeys.length > 0
        ? filter.optionChildKeys
        : ["children", "childNodes"];
    const rows = collectOptionRows(collection, childKeys, []);
    return rows
        .map((row) => ({
            value: resolveKey(row, filter.optionValueSelector || filter.valueSelector || filter.optionValueField || "id"),
            label: resolveKey(row, filter.optionLabelSelector || filter.labelSelector || filter.optionLabelField || "name"),
            icon: resolveKey(row, filter.optionIconSelector || filter.optionIconField || "icon"),
        }))
        .filter((entry) => entry.value !== undefined && entry.value !== null && entry.value !== "");
}

function StaticFilterSection({ filter, context, value, onToggle, onDateRange }) {
    useSignals();
    const optionContext = filter.optionsDataSourceRef && typeof context?.Context === "function"
        ? context.Context(filter.optionsDataSourceRef)
        : null;
    const optionCollection = optionContext?.signals?.collection?.value || [];

    useEffect(() => {
        if (!optionContext || filter.autoFetchOptions === false) {
            return;
        }
        optionContext.handlers?.dataSource?.fetchCollection?.();
    }, [optionContext, filter.autoFetchOptions]);

    const options = useMemo(
        () => resolveFilterOptions(filter, optionCollection || []),
        [filter, optionCollection],
    );
    const activeValues = filter.multiple ? (Array.isArray(value) ? value : []) : [value];

    if (filter.type === "dateRange") {
        return (
            <section className={[
                "forge-report-builder__panel",
                "forge-report-builder__panel--bottom",
                "forge-report-builder__panel--date-range",
                filter.required ? "forge-report-builder__panel--required" : "",
            ].filter(Boolean).join(" ")}>
                <div className="forge-report-builder__panel-headerline">
                    <div className="forge-report-builder__panel-title">{filter.label || filter.id}</div>
                    {filter.required ? <span className="forge-report-builder__panel-badge">Required</span> : null}
                </div>
                <div className="forge-report-builder__date-range">
                    <input
                        type="date"
                        value={value?.start || ""}
                        onChange={(event) => onDateRange("start", event.target.value)}
                    />
                    <span>to</span>
                    <input
                        type="date"
                        value={value?.end || ""}
                        onChange={(event) => onDateRange("end", event.target.value)}
                    />
                </div>
            </section>
        );
    }

    return (
        <section className={[
            "forge-report-builder__panel",
            "forge-report-builder__panel--bottom",
            filter.required ? "forge-report-builder__panel--required" : "",
        ].filter(Boolean).join(" ")}>
            <div className="forge-report-builder__panel-headerline">
                <div className="forge-report-builder__panel-title">{filter.label || filter.id}</div>
                {filter.required ? <span className="forge-report-builder__panel-badge">Required</span> : null}
            </div>
            <div className={String(filter.id || "").trim() === "channelIds" ? "forge-report-builder-icon-row forge-report-builder-icon-row--compact" : "forge-report-builder-icon-row"}>
                {options.map((option) => {
                    const active = activeValues.includes(option.value);
                    return (
                        <button
                            key={String(option.value)}
                            type="button"
                            className={[
                                "forge-report-builder-icon-button",
                                String(filter.id || "").trim() === "channelIds" ? "forge-report-builder-icon-button--compact" : "",
                                active ? "is-active" : "",
                            ].filter(Boolean).join(" ")}
                            onClick={() => onToggle(option.value)}
                            title={option.label}
                        >
                            <span className="forge-report-builder-icon-button__icon">
                                {option.icon ? <Icon icon={option.icon} size={18} /> : null}
                            </span>
                            <span className="forge-report-builder-icon-button__label">{option.label}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

function DynamicFilterGroup({
    group,
    rows,
    onAddRow,
    onChangeFilter,
    onPick,
    onRemoveSelection,
    onRemoveRow,
}) {
    const filters = Array.isArray(group.filters) ? group.filters : [];

    return (
        <section className="forge-report-builder-dynamic-group">
            <div className="forge-report-builder-dynamic-group__header">
                <div>
                    <h4>{group.label || group.id}</h4>
                    {group.description ? <p>{group.description}</p> : null}
                </div>
                <Button small outlined icon="add" onClick={onAddRow}>
                    {group.addLabel || "Add line"}
                </Button>
            </div>
            <div className="forge-report-builder-dynamic-group__rows">
                {(rows || []).length === 0 ? (
                    <div className="forge-report-builder-dynamic-group__empty">
                        No filters added yet.
                    </div>
                ) : null}
                {(rows || []).map((row) => {
                    const selectedFilter = filters.find((entry) => String(entry?.id || "").trim() === String(row.filterId || "").trim()) || filters[0] || null;
                    const placeholder = selectedFilter?.placeholder || selectedFilter?.label || "Select value";
                    const dialogId = selectedFilter?.dialogId || selectedFilter?.lookup?.dialogId || "";
                    return (
                        <div key={row.id} className="forge-report-builder-dynamic-row">
                            <div className="forge-report-builder-dynamic-row__controls">
                                <select
                                    className="forge-report-builder-select"
                                    value={row.filterId || ""}
                                    onChange={(event) => onChangeFilter(row.id, event.target.value)}
                                >
                                    {filters.map((entry) => (
                                        <option key={entry.id} value={entry.id}>
                                            {entry.label || entry.id}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    small
                                    icon="search-template"
                                    outlined
                                    onClick={() => onPick(row.id, selectedFilter)}
                                    disabled={!dialogId}
                                >
                                    {placeholder}
                                </Button>
                            </div>
                            <div className="forge-report-builder-dynamic-row__selection-line">
                                {(row.selections || []).map((selection, index) => (
                                    <FilterChip
                                        key={`${row.id}_${index}_${selection.value}`}
                                        label={selection.label || String(selection.value)}
                                        onRemove={() => onRemoveSelection(row.id, index)}
                                    />
                                ))}
                            </div>
                            <div className="forge-report-builder-dynamic-row__actions">
                                <button
                                    type="button"
                                    className="forge-report-builder-remove-row"
                                    onClick={() => onRemoveRow(row.id)}
                                    aria-label="Remove filter row"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default function ReportBuilder({ container, context }) {
    useSignals();
    const config = useMemo(() => getBuilderConfig(container), [container]);
    const builderContext = container?.dataSourceRef && typeof context?.Context === "function"
        ? context.Context(container.dataSourceRef)
        : context;
    const stateKey = useMemo(() => getBuilderStateKey(container), [container]);
    const windowFormSignal = builderContext?.signals?.windowForm;
    const persistedState = resolveKey(windowFormSignal?.value || {}, stateKey);
    const state = useMemo(() => mergeReportBuilderState(config, persistedState), [config, persistedState]);
    const requestFingerprintRef = useRef("");
    const lastManualRunFingerprintRef = useRef("");
    const seededDefaultsRef = useRef(false);
    const appliedPrefillSignatureRef = useRef("");
    const [settingsOpen, setSettingsOpen] = useState(false);

    const { collection = [], loading, error } = useDataSourceState(builderContext);
    const locale = context?.locale || "en-US";
    const collectionInfo = builderContext?.signals?.collectionInfo?.value || {};
    const computedCollection = useMemo(
        () => applyReportBuilderComputedMeasures(collection, config),
        [collection, config],
    );

    const persistState = React.useCallback((next) => {
        const normalized = sanitizeReportBuilderState(config, next);
        const payload = setSelector({}, stateKey, normalized);
        if (windowFormSignal) {
            windowFormSignal.value = mergeWindowFormValues(windowFormSignal.peek?.() || {}, payload);
            return;
        }
        builderContext?.handlers?.dataSource?.setWindowFormData?.({ values: payload });
    }, [builderContext, config, stateKey, windowFormSignal]);

    useEffect(() => {
        if (seededDefaultsRef.current) {
            return;
        }
        const currentPersisted = resolveKey(windowFormSignal?.peek?.() || {}, stateKey);
        if (currentPersisted && typeof currentPersisted === "object" && Object.keys(currentPersisted).length > 0) {
            seededDefaultsRef.current = true;
            return;
        }
        seededDefaultsRef.current = true;
        const defaults = mergeReportBuilderState(config, currentPersisted);
        const initialized = mergeReportBuilderState(
            config,
            applyReportBuilderStateHook(
                builderContext,
                config,
                defaults,
                windowFormSignal?.peek?.() || {},
            ),
        );
        const payload = setSelector({}, stateKey, initialized);
        if (windowFormSignal) {
            windowFormSignal.value = mergeWindowFormValues(windowFormSignal.peek?.() || {}, payload);
        } else {
            builderContext?.handlers?.dataSource?.setWindowFormData?.({ values: payload });
        }
    }, [builderContext, config, stateKey, windowFormSignal]);

    useEffect(() => {
        const currentPersisted = resolveKey(windowFormSignal?.peek?.() || {}, stateKey);
        if (!currentPersisted || typeof currentPersisted !== "object" || Object.keys(currentPersisted).length === 0) {
            return;
        }
        const persistedFingerprint = JSON.stringify(currentPersisted);
        const stateFingerprint = JSON.stringify(state);
        if (persistedFingerprint === stateFingerprint) {
            return;
        }
        persistState(state);
    }, [persistState, state, stateKey, windowFormSignal]);

    useEffect(() => {
        const signature = prefillSignature(windowFormSignal?.peek?.() || {});
        if (!signature || appliedPrefillSignatureRef.current === signature) {
            return;
        }
        const next = mergeReportBuilderState(
            config,
            applyReportBuilderStateHook(
                builderContext,
                config,
                state,
                windowFormSignal?.peek?.() || {},
            ),
        );
        appliedPrefillSignatureRef.current = signature;
        if (JSON.stringify(next) === JSON.stringify(state)) {
            return;
        }
        persistState(next);
    }, [builderContext, config, persistState, state, windowFormSignal]);

    useEffect(() => {
        const request = applyRequestHook(
            builderContext,
            config,
            state,
            buildReportBuilderRequest(config, state),
        );
        const fingerprint = JSON.stringify(request);
        if (!fingerprint || requestFingerprintRef.current === fingerprint) {
            return;
        }
        requestFingerprintRef.current = fingerprint;
        const inputSignal = builderContext?.signals?.input;
        const shouldFetch = config.request?.autoFetch !== false && canAutoFetchReportBuilder(config, state);
        if (inputSignal) {
            const previous = inputSignal.peek?.() || {};
            inputSignal.value = {
                ...previous,
                parameters: request,
                fetch: shouldFetch,
            };
            return;
        }
        builderContext?.handlers?.dataSource?.setInputParameters?.(request);
        if (shouldFetch) {
            builderContext?.handlers?.dataSource?.fetchCollection?.();
        }
    }, [builderContext, config, state]);

    const measures = useMemo(() => getSelectableReportBuilderMeasures(config), [config]);
    const measureSections = useMemo(() => resolveMeasureSections(config, measures), [config, measures]);
    const dimensions = useMemo(() => getVisibleReportBuilderDimensions(config), [config]);
    const staticFilters = Array.isArray(config.staticFilters) ? config.staticFilters : [];
    const dynamicFilterGroups = Array.isArray(config.dynamicFilterGroups) ? config.dynamicFilterGroups : [];
    const lookupExtension = useMemo(() => getLookupExtensionConfig(config), [config]);
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
    const chartContainer = useMemo(
        () => buildChartContainer({ ...container, collection: computedCollection }, config, state),
        [collection, computedCollection, container, config, state],
    );
    const currentRequestFingerprint = useMemo(
        () => JSON.stringify(buildReportBuilderRequest(config, state)),
        [config, state],
    );
    const hasMore = collectionInfo?.hasMore ?? (Array.isArray(collection) && collection.length >= state.pageSize);
    const readiness = useMemo(() => resolveReportBuilderReadiness(config, state), [config, state]);
    const canRunReport = readiness.canRun;
    const requiredStaticFilters = useMemo(() => staticFilters.filter((filter) => filter?.required), [staticFilters]);
    const optionalStaticFilters = useMemo(() => staticFilters.filter((filter) => !filter?.required), [staticFilters]);
    const [filterPanels, setFilterPanels] = useState({ common: true, advanced: false });
    const [activeOptionalFilterKeys, setActiveOptionalFilterKeys] = useState([]);
    const [activeDynamicGroupIds, setActiveDynamicGroupIds] = useState([]);
    const activeStaticFilterCount = useMemo(() => (
        staticFilters.reduce((count, filter) => {
            const key = String(filter.id || filter.field || "").trim();
            return key && hasConfiguredFilterValue(filter, state?.staticFilters?.[key]) ? count + 1 : count;
        }, 0)
    ), [staticFilters, state]);
    const activeDynamicFilterCount = useMemo(() => (
        dynamicFilterGroups.reduce((count, group) => (
            count + (state?.dynamicGroups?.[group.id] || []).filter((row) => Array.isArray(row.selections) && row.selections.length > 0).length
        ), 0)
    ), [dynamicFilterGroups, state]);

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
        const nextGroups = dynamicFilterGroups
            .filter((group) => Array.isArray(state?.dynamicGroups?.[group.id]) && state.dynamicGroups[group.id].length > 0)
            .map((group) => String(group.id || "").trim())
            .filter(Boolean);
        setActiveDynamicGroupIds((current) => {
            const currentSorted = [...current].sort();
            const nextSorted = [...nextGroups].sort();
            return JSON.stringify(currentSorted) === JSON.stringify(nextSorted) ? current : nextGroups;
        });
    }, [dynamicFilterGroups, state]);
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
    const runReport = React.useCallback(() => {
        const request = applyRequestHook(
            builderContext,
            config,
            state,
            buildReportBuilderRequest(config, state),
        );
        const fingerprint = JSON.stringify(request);
        requestFingerprintRef.current = fingerprint;
        lastManualRunFingerprintRef.current = fingerprint;
        const inputSignal = builderContext?.signals?.input;
        if (inputSignal) {
            const previous = inputSignal.peek?.() || {};
            inputSignal.value = {
                ...previous,
                parameters: request,
                fetch: true,
            };
            return;
        }
        builderContext?.handlers?.dataSource?.setInputParameters?.(request);
        builderContext?.handlers?.dataSource?.fetchCollection?.();
    }, [builderContext, config, state]);
    const hasRows = Array.isArray(computedCollection) && computedCollection.length > 0;
    const canShowResults = canRunReport && hasRows;
    const hasCompletedCurrentRun = canRunReport
        && !loading
        && !error
        && lastManualRunFingerprintRef.current !== ""
        && lastManualRunFingerprintRef.current === currentRequestFingerprint;

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

    const setViewMode = (viewMode) => {
        persistState({
            ...state,
            viewMode,
        });
    };

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

    const pickDynamicSelection = async (group, rowId, filterDef) => {
        const dialogId = filterDef?.dialogId || filterDef?.lookup?.dialogId;
        if (!dialogId) {
            return;
        }
        try {
            const payload = await builderContext?.handlers?.window?.openDialog?.({
                execution: {
                    args: [dialogId, { awaitResult: true, multiple: filterDef?.multiple !== false }],
                },
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
        <div className="forge-report-builder">
            <div className="forge-report-builder__top">
                <div className="forge-report-builder__shelf">
                    <div className="forge-report-builder__topline">
                        <div className="forge-report-builder__toolbar forge-report-builder__toolbar--inline">
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
                                    </div>
                                ) : null}
                            </div>
                            <Button
                                small
                                intent="primary"
                                className="forge-report-builder__run-button"
                                disabled={!canRunReport || loading}
                                onClick={runReport}
                            >
                                <Icon icon="flash" size={12} />
                                Run
                            </Button>
                            <div className="forge-report-builder__view-toggle">
                                {viewModes.map((mode) => (
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
                        </div>
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
                    </div>
                </div>
            </div>

            <div className="forge-report-builder__body">
                <aside className="forge-report-builder__left">
                    <section className="forge-report-builder__panel">
                        <div className="forge-report-builder__dimension-list">
                            {dimensions.map((dimension) => {
                                const active = state.selectedDimensions.includes(dimension.id);
                                return (
                                    <button
                                        key={dimension.id}
                                        type="button"
                                        className={active ? "forge-report-builder__dimension-item is-active" : "forge-report-builder__dimension-item"}
                                        onClick={() => toggleDimension(dimension.id)}
                                    >
                                        <span className={active ? "forge-report-builder__selector-box is-active" : "forge-report-builder__selector-box"}>{active ? "✓" : ""}</span>
                                        <span>{dimension.label || dimension.id}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </aside>

                <main className="forge-report-builder__center">
                    <div className="forge-report-builder__result-header">
                        <h3>{container.title || config.title || "Report Builder"}</h3>
                    </div>

                    <div className="forge-report-builder__result-frame">
                        {loading ? <div className="forge-report-builder__empty">Loading report data…</div> : null}
                        {error ? <div className="forge-report-builder__empty is-error">{String(error)}</div> : null}
                        {!loading && !error && !canShowResults ? (
                            <div className="forge-report-builder__empty forge-report-builder__empty--compact">
                                {canRunReport
                                    ? (hasCompletedCurrentRun
                                        ? "No rows returned for the current scope and date range."
                                        : "Run the report to preview results.")
                                    : readiness.reason === "scope"
                                        ? "Choose an advertiser, campaign, ad order, or audience to preview results."
                                        : "Set the required filters to preview results."}
                            </div>
                        ) : null}
                        {!loading && !error && canShowResults && state.viewMode !== "table" ? (
                            <div className="forge-report-builder__chart-wrap">
                                <Chart container={chartContainer} context={builderContext} embedded />
                            </div>
                        ) : null}
                        {!loading && !error && canShowResults && state.viewMode === "table" ? (
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
                                                    const value = resolveKey(row, column.key);
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
                    </div>

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
                </main>
            </div>

            <div className="forge-report-builder__bottom">
                <section className="forge-report-builder__bottom-group forge-report-builder__bottom-group--static" aria-label="Filters">
                    <div className="forge-report-builder__bottom-header">
                        <button type="button" className="forge-report-builder__bottom-toggle" onClick={() => toggleFilterPanel("common")}>
                            <span>{activeStaticFilterCount} active</span>
                            <span>{filterPanels.common ? "Hide" : "Show"}</span>
                        </button>
                    </div>
                    {filterPanels.common ? (
                        <>
                            {(optionalStaticFilters.length > 0 || dynamicFilterGroups.length > 0) ? (
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
                                                    <Icon icon={filterCategoryIcon(filterKey)} size={12} />
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
                                    {dynamicFilterGroups.map((group) => {
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
                                                    <Icon icon={filterCategoryIcon(group.id)} size={12} />
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
                            ) : null}
                            <div className="forge-report-builder__bottom-grid forge-report-builder__bottom-grid--static">
                                {requiredStaticFilters.map((filter) => {
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
                            {activeDynamicGroupIds.length > 0 ? (
                                <div className="forge-report-builder__bottom-grid forge-report-builder__bottom-grid--dynamic">
                                    {dynamicFilterGroups
                                        .filter((group) => activeDynamicGroupIds.includes(group.id))
                                        .map((group) => (
                                            <DynamicFilterGroup
                                                key={group.id}
                                                group={group}
                                                rows={state?.dynamicGroups?.[group.id] || []}
                                                onAddRow={() => addRow(group)}
                                                onChangeFilter={(rowId, filterId) => changeDynamicFilterType(group, rowId, filterId)}
                                                onPick={(rowId, filterDef) => pickDynamicSelection(group, rowId, filterDef)}
                                                onRemoveSelection={(rowId, index) => removeDynamicSelection(group, rowId, index)}
                                                onRemoveRow={(rowId) => removeRow(group, rowId)}
                                            />
                                        ))}
                                </div>
                            ) : null}
                        </>
                    ) : null}
                </section>
            </div>
        </div>
    );
}
