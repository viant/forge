import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon } from "@blueprintjs/core";
import { useSignalEffect } from "@preact/signals-react";

import Chart from "../Chart.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey, setSelector } from "../../utils/selector.js";
import { formatDashboardValue } from "./dashboardUtils.js";
import {
    addDynamicFilterRow,
    buildReportBuilderColumns,
    buildReportBuilderDefaultState,
    buildReportBuilderRequest,
    mergeReportBuilderState,
    projectLookupSelection,
    removeDynamicFilterRow,
    updateDynamicFilterRow,
} from "./reportBuilderUtils.js";

function getBuilderConfig(container = {}) {
    return container.dashboard?.reportBuilder || container.reportBuilder || container.builder || {};
}

function getBuilderStateKey(container = {}) {
    return String(container.stateKey || container.id || "reportBuilder").trim() || "reportBuilder";
}

function measureById(config = {}, id = "") {
    return (config.measures || []).find((entry) => String(entry?.id || "").trim() === String(id || "").trim()) || null;
}

function dimensionById(config = {}, id = "") {
    return (config.dimensions || []).find((entry) => String(entry?.id || "").trim() === String(id || "").trim()) || null;
}

function groupByOption(config = {}, value = "") {
    return (config?.groupBy?.options || []).find((entry) => String(entry?.value || "").trim() === String(value || "").trim()) || null;
}

function shallowEqualJSON(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
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

    return {
        ...container,
        dataSourceRef: container.dataSourceRef,
        chart: {
            type: config.result?.chartType || "line",
            xAxis: {
                dataKey: xDimension?.key || xDimension?.id || "eventDate",
                tickFormat: xDimension?.tickFormat,
            },
            yAxis: {
                format: primaryMeasure?.format,
            },
            series: groupDimension ? groupedSeries : directSeries,
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
    const optionContext = filter.optionsDataSourceRef && typeof context?.Context === "function"
        ? context.Context(filter.optionsDataSourceRef)
        : null;
    const [optionCollection, setOptionCollection] = useState(() => optionContext?.signals?.collection?.peek?.() || []);

    useSignalEffect(() => {
        if (!optionContext?.signals?.collection) {
            setOptionCollection([]);
            return;
        }
        setOptionCollection(optionContext.signals.collection.value || []);
    });

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
            <section className="forge-report-builder__panel forge-report-builder__panel--bottom">
                <div className="forge-report-builder__panel-title">{filter.label || filter.id}</div>
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
        <section className="forge-report-builder__panel forge-report-builder__panel--bottom">
            <div className="forge-report-builder__panel-title">{filter.label || filter.id}</div>
            <div className="forge-report-builder-icon-row">
                {options.map((option) => {
                    const active = activeValues.includes(option.value);
                    return (
                        <button
                            key={String(option.value)}
                            type="button"
                            className={active ? "forge-report-builder-icon-button is-active" : "forge-report-builder-icon-button"}
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
                            <div className="forge-report-builder-dynamic-row__chips">
                                {(row.selections || []).map((selection, index) => (
                                    <FilterChip
                                        key={`${row.id}_${index}_${selection.value}`}
                                        label={selection.label || String(selection.value)}
                                        onRemove={() => onRemoveSelection(row.id, index)}
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                className="forge-report-builder-remove-row"
                                onClick={() => onRemoveRow(row.id)}
                                aria-label="Remove filter row"
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default function ReportBuilder({ container, context }) {
    const config = useMemo(() => getBuilderConfig(container), [container]);
    const builderContext = container?.dataSourceRef && typeof context?.Context === "function"
        ? context.Context(container.dataSourceRef)
        : context;
    const stateKey = useMemo(() => getBuilderStateKey(container), [container]);
    const windowFormSignal = builderContext?.signals?.windowForm;
    const persistedState = resolveKey(windowFormSignal?.peek?.() || {}, stateKey);
    const [state, setState] = useState(() => mergeReportBuilderState(config, persistedState));
    const requestFingerprintRef = useRef("");

    const { collection = [], loading, error } = useDataSourceState(builderContext);
    const locale = context?.locale || "en-US";
    const [collectionInfo, setCollectionInfo] = useState(builderContext?.signals?.collectionInfo?.peek?.() || {});

    useSignalEffect(() => {
        const nextPersisted = resolveKey(windowFormSignal?.value || {}, stateKey);
        const merged = mergeReportBuilderState(config, nextPersisted);
        setState((current) => (shallowEqualJSON(current, merged) ? current : merged));
    });

    useSignalEffect(() => {
        setCollectionInfo(builderContext?.signals?.collectionInfo?.value || {});
    });

    const persistState = React.useCallback((next) => {
        setState(next);
        const payload = setSelector({}, stateKey, next);
        builderContext?.handlers?.dataSource?.setWindowFormData?.({ values: payload });
    }, [builderContext, stateKey]);

    useEffect(() => {
        const request = buildReportBuilderRequest(config, state);
        const fingerprint = JSON.stringify(request);
        if (!fingerprint || requestFingerprintRef.current === fingerprint) {
            return;
        }
        requestFingerprintRef.current = fingerprint;
        builderContext?.handlers?.dataSource?.setInputParameters?.(request);
        if (config.request?.autoFetch === false) {
            return;
        }
        builderContext?.handlers?.dataSource?.fetchCollection?.();
    }, [builderContext, config, state]);

    const measures = Array.isArray(config.measures) ? config.measures : [];
    const dimensions = Array.isArray(config.dimensions) ? config.dimensions : [];
    const staticFilters = Array.isArray(config.staticFilters) ? config.staticFilters : [];
    const dynamicFilterGroups = Array.isArray(config.dynamicFilterGroups) ? config.dynamicFilterGroups : [];
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
    const chartContainer = useMemo(() => buildChartContainer(container, config, state), [container, config, state]);
    const hasMore = collectionInfo?.hasMore ?? (Array.isArray(collection) && collection.length >= state.pageSize);

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
            const record = await builderContext?.handlers?.window?.openDialog?.({
                execution: {
                    args: [dialogId, { awaitResult: true }],
                },
                context: builderContext,
            });
            if (!record) return;
            const selection = projectLookupSelection(filterDef, record);
            const rows = (state?.dynamicGroups?.[group.id] || []).map((row) => {
                if (row.id !== rowId) return row;
                const currentSelections = Array.isArray(row.selections) ? row.selections : [];
                const nextSelections = filterDef.multiple === false
                    ? [selection]
                    : [...currentSelections.filter((entry) => entry.value !== selection.value), selection];
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
                    <div className="forge-report-builder__shelf-label">Measures</div>
                    <div className="forge-report-builder__measure-row">
                        {measures.map((measure) => {
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
                                    <span className="forge-report-builder__measure-toggle" onClick={(event) => {
                                        event.stopPropagation();
                                        toggleMeasure(measure.id);
                                    }}>
                                        {active ? "✓" : "+"}
                                    </span>
                                    <span>{measure.label || measure.id}</span>
                                    {primary ? <strong>Chart</strong> : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="forge-report-builder__body">
                <aside className="forge-report-builder__left">
                    <section className="forge-report-builder__panel">
                        <div className="forge-report-builder__panel-title">Dimensions</div>
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
                                        <span>{active ? "✓" : "○"}</span>
                                        <span>{dimension.label || dimension.id}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    {config.groupBy?.options?.length ? (
                        <section className="forge-report-builder__panel">
                            <div className="forge-report-builder__panel-title">Group By</div>
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
                        </section>
                    ) : null}
                </aside>

                <main className="forge-report-builder__center">
                    <div className="forge-report-builder__result-header">
                        <div>
                            <h3>{container.title || config.title || "Report Builder"}</h3>
                            <p>{container.subtitle || config.subtitle || "Switch between chart and table while changing measures, dimensions, and lookup-backed filters."}</p>
                        </div>
                        <div className="forge-report-builder__controls">
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
                            <div className="forge-report-builder__view-toggle">
                                {viewModes.map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        className={state.viewMode === mode ? "is-active" : ""}
                                        onClick={() => setViewMode(mode)}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="forge-report-builder__result-frame">
                        {loading ? <div className="forge-report-builder__empty">Loading report data…</div> : null}
                        {error ? <div className="forge-report-builder__empty is-error">{String(error)}</div> : null}
                        {!loading && !error && state.viewMode !== "table" ? (
                            <div className="forge-report-builder__chart-wrap">
                                <Chart container={chartContainer} context={builderContext} embedded />
                            </div>
                        ) : null}
                        {!loading && !error && state.viewMode === "table" ? (
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
                                        {(collection || []).map((row, index) => (
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
                {staticFilters.map((filter) => {
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

                {dynamicFilterGroups.map((group) => (
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
        </div>
    );
}
