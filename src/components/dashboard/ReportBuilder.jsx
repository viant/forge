import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, Icon } from "@blueprintjs/core";
import { useSignals } from "@preact/signals-react/runtime";

import Chart from "../Chart.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { mergeWindowFormValues } from "../../hooks/dataSource.js";
import { resolveKey, setSelector } from "../../utils/selector.js";
import { formatDashboardValue } from "./dashboardUtils.js";
import {
    applyReportBuilderComputedMeasures,
    addDynamicFilterRow,
    buildDefaultReportBuilderChartSpec,
    buildExplicitReportBuilderChartContainer,
    buildReportBuilderChartFields,
    buildReportBuilderColumns,
    buildReportBuilderDefaultChartSpecs,
    buildReportBuilderDefaultState,
    buildReportBuilderRequest,
    buildReportBuilderSettingsHash,
    canAutoFetchReportBuilder,
    getReportBuilderResultPanePosition,
    getSelectableReportBuilderMeasures,
    getReportBuilderSupportedChartTypes,
    getVisibleReportBuilderDimensions,
    isExplicitReportBuilderChartMode,
    isReportBuilderChartSpecStale,
    mergeReportBuilderState,
    normalizeReportBuilderChartSpec,
    projectManualSelection,
    projectLookupSelections,
    removeDynamicFilterRow,
    resolveReportBuilderDimensionDisplayKey,
    resolveReportBuilderMeasure,
    resolveReportBuilderReadiness,
    sanitizeReportBuilderState,
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

export function resolveReportBuilderNotices(config = {}, state = {}) {
    const notices = Array.isArray(config?.notices) ? config.notices : [];
    return notices.map((notice) => {
        const sourcePath = String(notice?.sourcePath || "").trim();
        const rawValue = sourcePath ? resolveKey(state, sourcePath) : undefined;
        const items = Array.isArray(rawValue)
            ? rawValue.filter((entry) => entry !== undefined && entry !== null && entry !== "").map((entry) => String(entry))
            : [];
        return {
            id: String(notice?.id || "").trim(),
            level: String(notice?.level || "info").trim().toLowerCase() || "info",
            title: String(notice?.title || "").trim(),
            description: String(notice?.description || "").trim(),
            items,
        };
    }).filter((notice) => notice.id && notice.items.length > 0);
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

export function resolveReportBuilderLookupDescriptor(builderContext, config = {}, state = {}, group = {}, filterDef = {}, rowId = "") {
    const base = filterDef?.lookup && typeof filterDef.lookup === "object"
        ? { ...filterDef.lookup }
        : {};
    const handlerName = String(base?.hook || config?.hooks?.resolveLookup || "").trim();
    if (!handlerName || !builderContext?.lookupHandler) {
        return base;
    }
    try {
        const handler = resolveReportBuilderHookHandler(builderContext, handlerName);
        const resolved = handler({
            context: builderContext,
            config,
            state,
            group,
            filterDef,
            rowId,
        });
        if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
            return base;
        }
        return {
            ...base,
            ...resolved,
        };
    } catch (error) {
        console.error("reportBuilder lookup hook failed", error);
        return base;
    }
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
                dataKey: resolveReportBuilderDimensionDisplayKey(xDimension) || "eventDate",
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

function loadStoredChartPresets(storageScope = "") {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(chartPresetStorageKey(storageScope));
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function persistStoredChartPresets(storageScope = "", presets = []) {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(chartPresetStorageKey(storageScope), JSON.stringify(presets));
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

function chartErrorMessage(error = {}) {
    switch (String(error?.code || "").trim()) {
        case "missingField":
            return `${error.field} is no longer available in the current table.`;
        case "wrongKind":
            return `${error.field} has the wrong field type for this chart.`;
        case "duplicateField":
            return `${error.field} duplicates another chart field.`;
        case "unsupportedType":
            return `This chart type is not supported by the current renderer.`;
        case "empty":
            return `${error.field} requires at least one selection.`;
        case "missing":
        default:
            return `Chart settings are incomplete.`;
    }
}

function ReportBuilderChartDialog({
    isOpen = false,
    onClose,
    draft,
    onChange,
    onApply,
    supportedTypes = [],
    dimensions = [],
    measures = [],
    validation = { valid: false, errors: [] },
}) {
    const errorSet = new Set((validation?.errors || []).map((entry) => String(entry?.field || "").trim()));
    const selectedXField = String(draft?.xField || "").trim();
    const availableSeriesDimensions = dimensions.filter((entry) => entry.key !== selectedXField);
    const selectedYField = String(Array.isArray(draft?.yFields) ? draft.yFields[0] || "" : "").trim();
    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Create Chart"
            style={{ width: "min(720px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                <div className="forge-report-builder__chart-dialog-grid">
                    <label className="forge-report-builder__chart-field">
                        <span>Title</span>
                        <input
                            type="text"
                            className="forge-report-builder-select"
                            value={draft?.title || ""}
                            onChange={(event) => onChange({ title: event.target.value })}
                            placeholder="Enter chart title"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Chart Type</span>
                        <select
                            className="forge-report-builder-select"
                            value={draft?.type || supportedTypes[0] || "line"}
                            onChange={(event) => onChange({ type: event.target.value })}
                        >
                            {supportedTypes.map((entry) => (
                                <option key={entry} value={entry}>{entry}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>X-axis</span>
                        <select
                            className={errorSet.has("xField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={selectedXField}
                            onChange={(event) => onChange({ xField: event.target.value })}
                        >
                            {dimensions.map((entry) => (
                                <option key={entry.key} value={entry.key}>{entry.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Y-axis</span>
                        <select
                            className={(validation?.errors || []).some((entry) => String(entry?.field || "").startsWith("yFields")) ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={selectedYField}
                            onChange={(event) => onChange({ yFields: [event.target.value] })}
                        >
                            {measures.map((entry) => (
                                <option key={entry.key} value={entry.key}>{entry.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Series / Color</span>
                        <select
                            className={errorSet.has("seriesField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.seriesField || ""}
                            onChange={(event) => onChange({ seriesField: event.target.value || null })}
                        >
                            <option value="">None</option>
                            {availableSeriesDimensions.map((entry) => (
                                <option key={entry.key} value={entry.key}>{entry.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
                {validation?.errors?.length > 0 ? (
                    <div className="forge-report-builder__chart-errors">
                        {validation.errors.map((entry, index) => (
                            <div key={`${entry.field}_${entry.code}_${index}`} className="forge-report-builder__chart-error">
                                {chartErrorMessage(entry)}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="forge-report-builder__chart-dialog-actions">
                <Button outlined onClick={onClose}>Cancel</Button>
                <Button intent="primary" onClick={onApply} disabled={!validation?.valid}>Apply Chart</Button>
            </div>
        </Dialog>
    );
}

function ReportBuilderChartTile({
    title = "Chart",
    description = "",
    canCreate = false,
    onCreate,
    defaultChartSpecs = [],
    onApplyDefault,
    previousChartPresets = [],
    selectedPreviousTitle = "",
    onSelectPrevious,
    onApplyPrevious,
    previousDisabled = true,
    warning = false,
    onRemove,
}) {
    return (
        <section className={warning ? "forge-report-builder__chart-tile is-warning" : "forge-report-builder__chart-tile"}>
            <div className="forge-report-builder__chart-tile-copy">
                <div className="forge-report-builder__chart-tile-eyebrow">{warning ? "Chart needs attention" : "Chart"}</div>
                <h4>{title}</h4>
                {description ? <p>{description}</p> : null}
                <div className="forge-report-builder__chart-tile-helper">
                    Only fields visible in the table can be charted.
                </div>
            </div>
            <div className="forge-report-builder__chart-tile-actions">
                <Button intent="primary" icon="add" disabled={!canCreate} onClick={onCreate}>
                    Create Chart
                </Button>
                {defaultChartSpecs.length > 0 ? (
                    <div className="forge-report-builder__chart-preset-list">
                        {defaultChartSpecs.map((entry) => (
                            <button
                                key={`${entry.title}_${entry.type}_${entry.xField}`}
                                type="button"
                                className="forge-report-builder__chart-preset-button"
                                onClick={() => onApplyDefault(entry)}
                            >
                                <span className="forge-report-builder__chart-preset-title">{entry.title}</span>
                                <span className="forge-report-builder__chart-preset-meta">{entry.type}</span>
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className="forge-report-builder__chart-previous">
                    <select
                        className="forge-report-builder-select"
                        value={selectedPreviousTitle}
                        onChange={(event) => onSelectPrevious(event.target.value)}
                    >
                        <option value="">Previous</option>
                        {previousChartPresets.map((preset) => (
                            <option key={`${preset.title}_${preset.updatedAt}`} value={preset.title}>{preset.title}</option>
                        ))}
                    </select>
                    <Button outlined disabled={previousDisabled} onClick={onApplyPrevious}>
                        Apply
                    </Button>
                </div>
                {warning && onRemove ? (
                    <Button outlined intent="danger" onClick={onRemove}>Remove Chart</Button>
                ) : null}
            </div>
        </section>
    );
}

function ReportBuilderChartQuickActions({
    canCreate = false,
    onCreate,
    quickOptions = [],
    selectedQuickOption = "",
    onSelectQuickOption,
    onApplyQuickOption,
    quickDisabled = true,
}) {
    if (!canCreate && quickOptions.length === 0) {
        return null;
    }
    return (
        <div className="forge-report-builder__chart-quick-actions">
            <Button
                small
                outlined
                icon="add"
                disabled={!canCreate}
                onClick={onCreate}
            >
                Create Chart
            </Button>
            {quickOptions.length > 0 ? (
                <>
                    <select
                        className="forge-report-builder-select forge-report-builder-select--compact"
                        value={selectedQuickOption}
                        onChange={(event) => onSelectQuickOption(event.target.value)}
                    >
                        <option value="">Quick chart…</option>
                        {quickOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <Button small outlined disabled={quickDisabled} onClick={onApplyQuickOption}>
                        Apply
                    </Button>
                </>
            ) : null}
        </div>
    );
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
    resolveLookup,
    onAddRow,
    onChangeFilter,
    onPick,
    onAddManualSelection,
    onRemoveSelection,
    onToggleEnabled,
    onRemoveRow,
}) {
    const filters = Array.isArray(group.filters) ? group.filters : [];
    const [manualDrafts, setManualDrafts] = useState({});

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
                    const lookup = resolveLookup?.(group, selectedFilter, row.id) || null;
                    const placeholder = selectedFilter?.placeholder || selectedFilter?.label || "Select value";
                    const dialogId = lookup?.dialogId || selectedFilter?.dialogId || selectedFilter?.lookup?.dialogId || "";
                    const enabled = row?.enabled !== false;
                    const allowManualEntry = selectedFilter?.manualEntry === true;
                    const manualDraft = manualDrafts[row.id] || "";
                    return (
                        <div key={row.id} className={[
                            "forge-report-builder-dynamic-row",
                            enabled ? "" : "is-disabled",
                        ].filter(Boolean).join(" ")} data-report-builder-row-id={row.id}>
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
                                {dialogId ? (
                                    <Button
                                        small
                                        icon="search-template"
                                        outlined
                                        className="forge-report-builder-lookup-button"
                                        onClick={() => onPick(row.id, selectedFilter, lookup)}
                                    >
                                        {placeholder}
                                    </Button>
                                ) : null}
                                {allowManualEntry ? (
                                    <div className="forge-report-builder-dynamic-row__manual-entry">
                                        <input
                                            type="text"
                                            className="forge-report-builder-select forge-report-builder-manual-input"
                                            value={manualDraft}
                                            placeholder={selectedFilter?.manualPlaceholder || "Enter value"}
                                            onChange={(event) => setManualDrafts((current) => ({
                                                ...current,
                                                [row.id]: event.target.value,
                                            }))}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter") {
                                                    return;
                                                }
                                                event.preventDefault();
                                                const added = onAddManualSelection(row.id, selectedFilter, manualDraft);
                                                if (added) {
                                                    setManualDrafts((current) => ({
                                                        ...current,
                                                        [row.id]: "",
                                                    }));
                                                }
                                            }}
                                        />
                                        <Button
                                            small
                                            outlined
                                            icon="plus"
                                            onClick={() => {
                                                const added = onAddManualSelection(row.id, selectedFilter, manualDraft);
                                                if (added) {
                                                    setManualDrafts((current) => ({
                                                        ...current,
                                                        [row.id]: "",
                                                    }));
                                                }
                                            }}
                                        >
                                            Add value
                                        </Button>
                                    </div>
                                ) : null}
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
                                    className={[
                                        "forge-report-builder-row-toggle",
                                        enabled ? "is-enabled" : "is-disabled",
                                    ].join(" ")}
                                    onClick={() => onToggleEnabled(row.id)}
                                    aria-pressed={enabled}
                                    title={enabled ? "Filter is active" : "Filter is off"}
                                >
                                    <Icon icon={enabled ? "eye-open" : "eye-off"} size={12} />
                                    <span>{enabled ? "On" : "Off"}</span>
                                </button>
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

function resolveFamilyOptionKey(filterDef = {}, fallbackId = "") {
    const direct = String(filterDef?.targetingFeatureKey || "").trim();
    if (direct) {
        return direct;
    }
    const filterId = String(filterDef?.id || fallbackId || "").trim();
    return filterId.replace(/^(include|exclude)/i, "");
}

function buildDynamicFamilyOptions(family = {}, dynamicFilterGroups = []) {
    const includeGroup = dynamicFilterGroups.find((entry) => String(entry?.id || "").trim() === "include");
    const excludeGroup = dynamicFilterGroups.find((entry) => String(entry?.id || "").trim() === "exclude");
    const includeById = new Map(normalizeArray(includeGroup?.filters).map((entry) => [String(entry?.id || "").trim(), entry]));
    const excludeById = new Map(normalizeArray(excludeGroup?.filters).map((entry) => [String(entry?.id || "").trim(), entry]));
    const optionMap = new Map();

    const register = (direction, filterId) => {
        const keyId = String(filterId || "").trim();
        if (!keyId) return;
        const filterDef = direction === "include" ? includeById.get(keyId) : excludeById.get(keyId);
        if (!filterDef) return;
        const optionKey = resolveFamilyOptionKey(filterDef, keyId);
        const existing = optionMap.get(optionKey) || {
            key: optionKey,
            label: String(filterDef?.label || optionKey).trim(),
            includeFilter: null,
            excludeFilter: null,
        };
        existing[direction === "include" ? "includeFilter" : "excludeFilter"] = filterDef;
        if (!existing.label) {
            existing.label = String(filterDef?.label || optionKey).trim();
        }
        optionMap.set(optionKey, existing);
    };

    normalizeArray(family.includeFilterIds).forEach((filterId) => register("include", filterId));
    normalizeArray(family.excludeFilterIds).forEach((filterId) => register("exclude", filterId));

    return Array.from(optionMap.values());
}

function buildDynamicFamilyRows(state = {}, family = {}, dynamicFilterGroups = []) {
    const options = buildDynamicFamilyOptions(family, dynamicFilterGroups);
    const includeRows = normalizeArray(state?.dynamicGroups?.include).filter((row) => normalizeArray(family.includeFilterIds).includes(String(row?.filterId || "").trim()));
    const excludeRows = normalizeArray(state?.dynamicGroups?.exclude).filter((row) => normalizeArray(family.excludeFilterIds).includes(String(row?.filterId || "").trim()));
    const enrich = (rows, direction) => rows.map((row) => {
        const option = options.find((entry) => {
            const target = direction === "include" ? entry.includeFilter : entry.excludeFilter;
            return String(target?.id || "").trim() === String(row?.filterId || "").trim();
        }) || null;
        return {
            ...row,
            direction,
            optionKey: option?.key || "",
        };
    });
    return [...enrich(includeRows, "include"), ...enrich(excludeRows, "exclude")];
}

function DynamicFamilyGroup({
    family,
    rows,
    options,
    resolveLookup,
    onAddRow,
    onChangeFilter,
    onChangeDirection,
    onPick,
    onAddManualSelection,
    onRemoveSelection,
    onToggleEnabled,
    onRemoveRow,
}) {
    const [manualDrafts, setManualDrafts] = useState({});

    return (
        <section className="forge-report-builder-dynamic-group forge-report-builder-dynamic-group--family">
            <div className="forge-report-builder-dynamic-group__header">
                <div>
                    <h4>{family.label}</h4>
                    {family.description ? <p>{family.description}</p> : null}
                </div>
                <Button small outlined icon="add" onClick={onAddRow}>
                    Add line
                </Button>
            </div>
            <div className="forge-report-builder-dynamic-group__rows">
                {rows.map((row) => {
                    const option = options.find((entry) => entry.key === row.optionKey) || options[0] || null;
                    const selectedFilter = row.direction === "exclude" ? option?.excludeFilter : option?.includeFilter;
                    const fallbackFilter = selectedFilter || option?.includeFilter || option?.excludeFilter || null;
                    const groupRef = { id: row.direction };
                    const lookup = resolveLookup?.(groupRef, fallbackFilter, row.id) || null;
                    const placeholder = fallbackFilter?.placeholder || fallbackFilter?.label || "Select value";
                    const dialogId = lookup?.dialogId || fallbackFilter?.dialogId || fallbackFilter?.lookup?.dialogId || "";
                    const enabled = row?.enabled !== false;
                    const allowManualEntry = fallbackFilter?.manualEntry === true;
                    const manualDraft = manualDrafts[row.id] || "";
                    const canInclude = !!option?.includeFilter;
                    const canExclude = !!option?.excludeFilter;
                    return (
                        <div key={row.id} className={["forge-report-builder-dynamic-row", enabled ? "" : "is-disabled"].filter(Boolean).join(" ")} data-report-builder-row-id={row.id}>
                            <div className="forge-report-builder-dynamic-row__controls">
                                <select
                                    className="forge-report-builder-select"
                                    value={row.optionKey || option?.key || ""}
                                    onChange={(event) => onChangeFilter(row.id, row.direction, event.target.value)}
                                >
                                    {options.map((entry) => (
                                        <option key={entry.key} value={entry.key}>{entry.label}</option>
                                    ))}
                                </select>
                                <div className="forge-report-builder-direction-toggle" role="radiogroup" aria-label="Filter direction">
                                    <button
                                        type="button"
                                        className={["forge-report-builder-direction-toggle__button", row.direction === "include" ? "is-active" : ""].filter(Boolean).join(" ")}
                                        disabled={!canInclude}
                                        onClick={() => onChangeDirection(row.id, row.direction, row.optionKey, "include")}
                                    >
                                        Include
                                    </button>
                                    <button
                                        type="button"
                                        className={["forge-report-builder-direction-toggle__button", row.direction === "exclude" ? "is-active" : ""].filter(Boolean).join(" ")}
                                        disabled={!canExclude}
                                        onClick={() => onChangeDirection(row.id, row.direction, row.optionKey, "exclude")}
                                    >
                                        Exclude
                                    </button>
                                </div>
                                {dialogId ? (
                                    <Button
                                        small
                                        icon="search-template"
                                        outlined
                                        className="forge-report-builder-lookup-button"
                                        onClick={() => onPick(row.id, row.direction, fallbackFilter, lookup)}
                                    >
                                        {placeholder}
                                    </Button>
                                ) : null}
                                {allowManualEntry ? (
                                    <div className="forge-report-builder-dynamic-row__manual-entry">
                                        <input
                                            type="text"
                                            className="forge-report-builder-select forge-report-builder-manual-input"
                                            value={manualDraft}
                                            placeholder={fallbackFilter?.manualPlaceholder || "Enter value"}
                                            onChange={(event) => setManualDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter") return;
                                                event.preventDefault();
                                                const added = onAddManualSelection(row.id, row.direction, fallbackFilter, manualDraft);
                                                if (added) {
                                                    setManualDrafts((current) => ({ ...current, [row.id]: "" }));
                                                }
                                            }}
                                        />
                                        <Button
                                            small
                                            outlined
                                            icon="plus"
                                            onClick={() => {
                                                const added = onAddManualSelection(row.id, row.direction, fallbackFilter, manualDraft);
                                                if (added) {
                                                    setManualDrafts((current) => ({ ...current, [row.id]: "" }));
                                                }
                                            }}
                                        >
                                            Add value
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                            <div className="forge-report-builder-dynamic-row__selection-line">
                                {(row.selections || []).map((selection, index) => (
                                    <FilterChip
                                        key={`${row.id}_${index}_${selection.value}`}
                                        label={selection.label || String(selection.value)}
                                        onRemove={() => onRemoveSelection(row.id, row.direction, index)}
                                    />
                                ))}
                            </div>
                            <div className="forge-report-builder-dynamic-row__actions">
                                <button
                                    type="button"
                                    className={["forge-report-builder-row-toggle", enabled ? "is-enabled" : "is-disabled"].join(" ")}
                                    onClick={() => onToggleEnabled(row.id, row.direction)}
                                    aria-pressed={enabled}
                                >
                                    <Icon icon={enabled ? "eye-open" : "eye-off"} size={12} />
                                    <span>{enabled ? "On" : "Off"}</span>
                                </button>
                                <button
                                    type="button"
                                    className="forge-report-builder-remove-row"
                                    onClick={() => onRemoveRow(row.id, row.direction)}
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
    const windowFormSignal = builderContext?.signals?.windowForm;
    const persistedState = resolveKey(windowFormSignal?.value || {}, stateKey);
    const state = useMemo(() => mergeReportBuilderState(config, persistedState), [config, persistedState]);
    const requestFingerprintRef = useRef("");
    const lastManualRunFingerprintRef = useRef("");
    const seededDefaultsRef = useRef(false);
    const appliedPrefillSignatureRef = useRef("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [chartDialogOpen, setChartDialogOpen] = useState(false);
    const [chartDraft, setChartDraft] = useState(null);
    const [storedChartPresets, setStoredChartPresets] = useState([]);
    const [selectedPreviousChartTitle, setSelectedPreviousChartTitle] = useState("");
    const [selectedQuickChartOption, setSelectedQuickChartOption] = useState("");
    const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
    const [pendingScrollRowId, setPendingScrollRowId] = useState("");
    const builderRootRef = useRef(null);
    const leftRailRef = useRef(null);

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

    const resolveLookup = React.useCallback((group, filterDef, rowId = "") => (
        resolveReportBuilderLookupDescriptor(builderContext, config, state, group, filterDef, rowId)
    ), [builderContext, config, state]);

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
        () => (
            explicitChartMode && hasValidChartSpec
                ? buildExplicitReportBuilderChartContainer({ ...container, collection: computedCollection }, config, state, state.chartSpec)
                : buildChartContainer({ ...container, collection: computedCollection }, config, state)
        ),
        [collection, computedCollection, container, config, explicitChartMode, hasValidChartSpec, state],
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
            {showFilterCategoryBar && familyMode ? (
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
                                    <Icon icon={filterCategoryIcon(family.id)} size={12} />
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
            ) : null}
        </>
    );

    const renderFilterBody = () => (
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
    const downloadCsv = React.useCallback(() => {
        if (!Array.isArray(selectedColumns) || selectedColumns.length === 0 || !Array.isArray(computedCollection) || computedCollection.length === 0) {
            return;
        }
        const lines = [selectedColumns.map((column) => escapeCsvCell(column.label || column.key)).join(",")];
        computedCollection.forEach((row) => {
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
    }, [computedCollection, container?.id, locale, selectedColumns]);
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
        const defaults = defaultChartSpecs.map((entry, index) => ({
            value: `default:${index}`,
            label: `${entry.title} (${entry.type})`,
            kind: "default",
            spec: entry,
        }));
        const previous = compatiblePreviousChartPresets.map((entry, index) => ({
            value: `previous:${index}`,
            label: `${entry.title} (Previous)`,
            kind: "previous",
            spec: entry.chartSpec,
        }));
        return [...defaults, ...previous];
    }, [defaultChartSpecs, compatiblePreviousChartPresets]);
    const hasCompletedCurrentRun = canRunReport
        && !loading
        && !error
        && lastManualRunFingerprintRef.current !== ""
        && lastManualRunFingerprintRef.current === currentRequestFingerprint;

    useEffect(() => {
        setStoredChartPresets(loadStoredChartPresets(stateKey));
    }, [stateKey]);

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
        if (explicitChartMode && viewMode === "chart" && !hasValidChartSpec) {
            return;
        }
        persistState({
            ...state,
            viewMode,
        });
    };

    const saveChartPreset = React.useCallback((chartSpec) => {
        const normalized = normalizeReportBuilderChartSpec(chartSpec);
        if (!normalized) {
            return;
        }
        const nextPresets = upsertChartPreset(storedChartPresets, {
            title: String(normalized.title || "Saved chart").trim() || "Saved chart",
            settingsHash,
            chartSpec: normalized,
            updatedAt: Date.now(),
        });
        setStoredChartPresets(nextPresets);
        persistStoredChartPresets(stateKey, nextPresets);
    }, [settingsHash, stateKey, storedChartPresets]);

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
    }, [persistState, state]);

    const openChartDialog = React.useCallback((seed = null) => {
        const nextDraft = buildDefaultReportBuilderChartSpec(config, state, seed || {});
        if (!nextDraft) {
            return;
        }
        setChartDraft(nextDraft);
        setChartDialogOpen(true);
    }, [config, state]);

    const applyPreviousChart = React.useCallback(() => {
        if (!selectedPreviousChartTitle) {
            return;
        }
        const preset = compatiblePreviousChartPresets.find((entry) => entry.title === selectedPreviousChartTitle);
        if (!preset) {
            return;
        }
        applyChartSpec(preset.chartSpec, { savePreset: false });
    }, [applyChartSpec, compatiblePreviousChartPresets, selectedPreviousChartTitle]);

    const applyQuickChart = React.useCallback(() => {
        if (!selectedQuickChartOption) {
            return;
        }
        const next = quickChartOptions.find((entry) => entry.value === selectedQuickChartOption);
        if (!next?.spec) {
            return;
        }
        applyChartSpec(next.spec);
    }, [applyChartSpec, quickChartOptions, selectedQuickChartOption]);

    useEffect(() => {
        if (!selectedPreviousChartTitle) {
            return;
        }
        if (!compatiblePreviousChartPresets.some((entry) => entry.title === selectedPreviousChartTitle)) {
            setSelectedPreviousChartTitle("");
        }
    }, [compatiblePreviousChartPresets, selectedPreviousChartTitle]);

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
        moveFamilyRow(family, rowId, currentDirection, nextDirection, optionKey, { selections: [] });
    };

    const renderDynamicFamily = (family) => (
        <section key={family.id} className="forge-report-builder__family-group">
            <div className="forge-report-builder__family-group-header">
                <div>
                    <h4>{family.label}</h4>
                    {family.description ? <p>{family.description}</p> : null}
                </div>
            </div>
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
            useFilterDrawer ? "forge-report-builder--filters-drawer" : "",
            resultPanePosition === "left" ? "forge-report-builder--result-left" : "",
        ].filter(Boolean).join(" ")} ref={builderRootRef}>
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
                                CSV
                            </Button>
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
                            {explicitChartMode ? (
                                <>
                                    <ReportBuilderChartQuickActions
                                        canCreate={canCreateChart}
                                        onCreate={() => openChartDialog(state.chartSpec)}
                                        quickOptions={quickChartOptions}
                                        selectedQuickOption={selectedQuickChartOption}
                                        onSelectQuickOption={setSelectedQuickChartOption}
                                        onApplyQuickOption={applyQuickChart}
                                        quickDisabled={!selectedQuickChartOption}
                                    />
                                    {hasValidChartSpec ? (
                                        <>
                                            <Button small outlined icon="edit" onClick={() => openChartDialog(state.chartSpec)}>
                                                Edit Chart
                                            </Button>
                                            <Button small outlined intent="danger" icon="trash" onClick={removeChart}>
                                                Remove Chart
                                            </Button>
                                            <div className="forge-report-builder__view-toggle">
                                                {viewModes.filter((mode) => mode === "table" || mode === "chart").map((mode) => (
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
                                        </>
                                    ) : null}
                                </>
                            ) : (
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
                            )}
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
                <aside className="forge-report-builder__left" ref={leftRailRef}>
                    <section className="forge-report-builder__panel">
                        <div className="forge-report-builder__panel-headerline forge-report-builder__panel-headerline--compact">
                            <div className="forge-report-builder__panel-title">Breakdowns</div>
                            <button
                                type="button"
                                className="forge-report-builder__panel-toggle"
                                onClick={() => setDimensionsCollapsed((current) => !current)}
                                aria-expanded={!dimensionsCollapsed}
                            >
                                {dimensionsCollapsed ? "Show" : "Hide"}
                            </button>
                        </div>
                        {!dimensionsCollapsed ? (
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
                        ) : null}
                    </section>
                    {useFilterRail ? renderFilterRailControls() : null}
                    {useFilterDrawer && filtersDrawerOpen ? renderFiltersPanel() : null}
                </aside>

                <main className="forge-report-builder__center">
                    {config.showResultHeader !== false ? (
                        <div className="forge-report-builder__result-header">
                            <h3>{container.title || config.title || "Report Builder"}</h3>
                        </div>
                    ) : null}

                    <div className="forge-report-builder__result-frame">
                        {loading ? <div className="forge-report-builder__empty">Loading report data…</div> : null}
                        {error ? <div className="forge-report-builder__empty is-error">{renderReportBuilderError(error)}</div> : null}
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
                        {!loading && !error && canShowResults && (
                            (explicitChartMode && hasValidChartSpec && state.viewMode === "chart")
                            || (!explicitChartMode && state.viewMode !== "table")
                        ) ? (
                            <div className="forge-report-builder__chart-wrap">
                                <Chart container={chartContainer} context={builderContext} embedded />
                            </div>
                        ) : null}
                        {!loading && !error && canShowResults && (
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
                        {!loading && !error && canShowResults && explicitChartMode && (!hasValidChartSpec || hasStaleChartSpec) ? (
                            <div className="forge-report-builder__empty forge-report-builder__empty--chart-callout">
                                {hasStaleChartSpec
                                    ? (chartSpecValidation.errors || []).map((entry) => chartErrorMessage(entry)).join(" ")
                                    : "Use Create Chart next to Run to build a chart from the current table."}
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
                    {useFilterRail && filterPanels.common ? (
                        <section className="forge-report-builder__inline-filter-body" aria-label="Active filters">
                            {renderFilterBody()}
                        </section>
                    ) : null}
                </main>
            </div>

            {!useFilterDrawer && !useFilterRail ? renderFiltersPanel() : null}
            <ReportBuilderChartDialog
                isOpen={chartDialogOpen}
                onClose={() => setChartDialogOpen(false)}
                draft={chartDraft}
                onChange={(patch) => setChartDraft((current) => normalizeReportBuilderChartSpec({
                    ...(current || {}),
                    ...patch,
                }))}
                onApply={() => {
                    if (applyChartSpec(chartDraft)) {
                        setChartDialogOpen(false);
                    }
                }}
                supportedTypes={supportedChartTypes}
                dimensions={chartDimensions}
                measures={chartMeasures}
                validation={chartDraftValidation}
            />
        </div>
    );
}
