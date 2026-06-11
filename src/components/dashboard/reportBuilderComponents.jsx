import React, { useEffect, useMemo } from "react";
import { Button, Dialog, Icon, Menu, MenuDivider, MenuItem, Popover } from "@blueprintjs/core";
import { useSignals } from "@preact/signals-react/runtime";

import LookupSelectionInput from "../lookup/LookupSelectionInput.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey } from "../../utils/selector.js";
import {
    chartFamilyForType,
    chartFamilyHelperText,
    chartTypeLabel,
    PER_SERIES_TYPE_CHOICES,
    SINGLE_MEASURE_CATEGORY_TYPES,
    supportsStackForSeries,
} from "./reportBuilderChartRules.js";

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

export function ReportBuilderChartDialog({
    isOpen = false,
    onClose,
    draft,
    onDraftChange,
    onApply,
    supportedTypes = [],
    dimensions = [],
    measures = [],
    validation = { valid: false, errors: [] },
    sanitizeDraftPatch,
    renderChartError,
}) {
    const errors = Array.isArray(validation?.errors) ? validation.errors : [];
    const errorByField = new Map();
    errors.forEach((entry) => {
        const field = String(entry?.field || "").trim();
        if (!field || errorByField.has(field)) return;
        errorByField.set(field, entry);
    });
    const hasYFieldsError = errors.some((entry) => String(entry?.field || "").startsWith("yFields"));
    const draftType = String(draft?.type || supportedTypes[0] || "line").trim().toLowerCase();
    const family = chartFamilyForType(draftType);
    const isSingleMeasureCategory = SINGLE_MEASURE_CATEGORY_TYPES.has(draftType);
    const xFieldValue = String(draft?.xField || "").trim();
    const yFieldList = Array.isArray(draft?.yFields)
        ? draft.yFields.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const seriesFieldValue = String(draft?.seriesField || "").trim();
    const seriesOptions = draft?.seriesOptions && typeof draft.seriesOptions === "object"
        ? draft.seriesOptions
        : {};
    const seriesFieldAllowed = family === "cartesian";
    const seriesFieldEnabled = seriesFieldAllowed && yFieldList.length <= 1;
    const seriesOptionsVisible = (family === "cartesian" || draftType === "horizontal_bar")
        && yFieldList.length > 1
        && !seriesFieldValue;
    const errorContext = { dimensions, measures };

    const applyPatch = (patch) => {
        const next = sanitizeDraftPatch(draft || {}, patch);
        if (typeof onDraftChange === "function") {
            onDraftChange(next);
        }
    };

    const toggleMeasure = (measureKey) => {
        const key = String(measureKey || "").trim();
        if (!key) return;
        if (isSingleMeasureCategory) {
            applyPatch({ yFields: [key] });
            return;
        }
        const has = yFieldList.includes(key);
        const nextYFields = has ? yFieldList.filter((entry) => entry !== key) : [...yFieldList, key];
        applyPatch({ yFields: nextYFields });
    };

    const setSeriesOption = (measureKey, optionPatch) => {
        const key = String(measureKey || "").trim();
        if (!key) return;
        const previousOptions = draft?.seriesOptions && typeof draft.seriesOptions === "object" && !Array.isArray(draft.seriesOptions)
            ? draft.seriesOptions
            : {};
        const previousEntry = previousOptions[key] && typeof previousOptions[key] === "object" ? previousOptions[key] : {};
        const mergedEntry = { ...previousEntry, ...(optionPatch || {}) };
        Object.keys(mergedEntry).forEach((entryKey) => {
            const value = mergedEntry[entryKey];
            if (value === "" || value === null || value === undefined) {
                delete mergedEntry[entryKey];
            }
        });
        const nextOptions = { ...previousOptions };
        if (Object.keys(mergedEntry).length === 0) {
            delete nextOptions[key];
        } else {
            nextOptions[key] = mergedEntry;
        }
        applyPatch({ seriesOptions: Object.keys(nextOptions).length > 0 ? nextOptions : null });
    };

    const renderMeasureChips = () => (
        <div className={[
            "forge-report-builder__chart-measure-chips",
            hasYFieldsError ? "is-invalid" : "",
        ].filter(Boolean).join(" ")}>
            {measures.length === 0 ? (
                <div className="forge-report-builder__chart-empty-hint">No measures available in the current table.</div>
            ) : null}
            {measures.map((entry) => {
                const active = yFieldList.includes(entry.key);
                return (
                    <button
                        key={entry.key}
                        type="button"
                        className={[
                            "forge-report-builder__chart-measure-chip",
                            active ? "is-active" : "",
                        ].filter(Boolean).join(" ")}
                        onClick={() => toggleMeasure(entry.key)}
                        title={entry.label || entry.key}
                    >
                        <span className={active ? "forge-report-builder__selector-box is-active" : "forge-report-builder__selector-box"}>
                            {active ? "✓" : ""}
                        </span>
                        <span>{entry.label || entry.key}</span>
                    </button>
                );
            })}
        </div>
    );

    const renderSeriesOptionsTable = () => {
        const showRenderAs = family === "cartesian";
        const showAxis = family === "cartesian";
        const showStack = family === "cartesian" || draftType === "horizontal_bar";
        return (
            <div className="forge-report-builder__chart-series-options">
                <div className="forge-report-builder__chart-series-options-header">
                    <span className="forge-report-builder__chart-series-options-title">Per-measure options</span>
                    <span className="forge-report-builder__chart-series-options-hint">
                        Customize how each selected measure renders inside this combo chart.
                    </span>
                </div>
                <table className="forge-report-builder__chart-series-options-table">
                    <thead>
                        <tr>
                            <th>Measure</th>
                            {showRenderAs ? <th>Render as</th> : null}
                            {showAxis ? <th>Axis</th> : null}
                            {showStack ? <th>Stack group</th> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {yFieldList.map((measureKey) => {
                            const measure = measures.find((entry) => entry.key === measureKey);
                            const option = seriesOptions[measureKey] && typeof seriesOptions[measureKey] === "object"
                                ? seriesOptions[measureKey]
                                : {};
                            const seriesType = String(option.type || "").trim();
                            const axisValue = String(option.axis || "").trim();
                            const stackId = typeof option.stackId === "string" ? option.stackId : "";
                            const stackEnabled = showStack && supportsStackForSeries(draftType, seriesType);
                            return (
                                <tr key={measureKey}>
                                    <td>{measure?.label || measureKey}</td>
                                    {showRenderAs ? (
                                        <td>
                                            <select
                                                className="forge-report-builder-select forge-report-builder-select--compact"
                                                value={seriesType}
                                                onChange={(event) => setSeriesOption(measureKey, { type: event.target.value || null })}
                                            >
                                                <option value="">Default ({chartTypeLabel(draftType)})</option>
                                                {PER_SERIES_TYPE_CHOICES.map((option) => (
                                                    <option key={option} value={option}>{chartTypeLabel(option)}</option>
                                                ))}
                                            </select>
                                        </td>
                                    ) : null}
                                    {showAxis ? (
                                        <td>
                                            <select
                                                className="forge-report-builder-select forge-report-builder-select--compact"
                                                value={axisValue || "left"}
                                                onChange={(event) => setSeriesOption(measureKey, { axis: event.target.value })}
                                            >
                                                <option value="left">Left</option>
                                                <option value="right">Right</option>
                                            </select>
                                        </td>
                                    ) : null}
                                    {showStack ? (
                                        <td>
                                            <input
                                                type="text"
                                                disabled={!stackEnabled}
                                                className="forge-report-builder-select forge-report-builder-select--compact"
                                                value={stackId}
                                                placeholder={stackEnabled ? "Optional" : "n/a"}
                                                onChange={(event) => setSeriesOption(measureKey, { stackId: event.target.value })}
                                            />
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Create Chart"
            style={{ width: "min(820px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                <div className="forge-report-builder__chart-dialog-grid">
                    <label className="forge-report-builder__chart-field">
                        <span>Title</span>
                        <input
                            type="text"
                            className="forge-report-builder-select"
                            value={draft?.title || ""}
                            onChange={(event) => applyPatch({ title: event.target.value })}
                            placeholder="Enter chart title"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Chart Type</span>
                        <select
                            className={errorByField.has("type") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draftType}
                            onChange={(event) => applyPatch({ type: event.target.value })}
                        >
                            {supportedTypes.map((entry) => (
                                <option key={entry} value={entry}>{chartTypeLabel(entry)}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>{family === "category" ? "Category" : "X-axis"}</span>
                        <select
                            className={errorByField.has("xField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={xFieldValue}
                            onChange={(event) => applyPatch({ xField: event.target.value })}
                        >
                            <option value="">Select…</option>
                            {dimensions.map((entry) => (
                                <option key={entry.key} value={entry.key}>{entry.label}</option>
                            ))}
                        </select>
                    </label>
                    {seriesFieldAllowed ? (
                        <label className="forge-report-builder__chart-field">
                            <span>Series / Color</span>
                            <select
                                className={errorByField.has("seriesField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                value={seriesFieldValue}
                                onChange={(event) => applyPatch({ seriesField: event.target.value || null })}
                                disabled={!seriesFieldEnabled}
                                title={seriesFieldEnabled ? "" : "Available only when a single measure is selected."}
                            >
                                <option value="">None</option>
                                {dimensions.filter((entry) => entry.key !== xFieldValue).map((entry) => (
                                    <option key={entry.key} value={entry.key}>{entry.label}</option>
                                ))}
                            </select>
                        </label>
                    ) : <span />}
                    <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>{isSingleMeasureCategory ? "Measure" : "Measures"}</span>
                        {renderMeasureChips()}
                    </div>
                </div>
                <p className="forge-report-builder__chart-dialog-hint">{chartFamilyHelperText(draftType)}</p>
                {seriesOptionsVisible ? renderSeriesOptionsTable() : null}
                {errors.length > 0 ? (
                    <div className="forge-report-builder__chart-errors">
                        {errors.map((entry, index) => (
                            <div key={`${entry.field}_${entry.code}_${index}`} className="forge-report-builder__chart-error">
                                {renderChartError(entry, errorContext)}
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

export function ReportBuilderChartQuickActions({
    canCreate = false,
    showCreateButton = true,
    onCreate,
    quickOptions = [],
    onSelectQuickOption,
    usePortal = true,
}) {
    if (!canCreate && quickOptions.length === 0) {
        return null;
    }
    const groupedOptions = quickOptions.reduce((acc, option) => {
        const group = String(option?.group || "").trim() || "Other";
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(option);
        return acc;
    }, {});
    return (
        <div className="forge-report-builder__chart-quick-actions">
            {showCreateButton ? (
                <Button
                    small
                    className="forge-report-builder__chart-action-button forge-report-builder__chart-action-button--create"
                    icon="add"
                    disabled={!canCreate}
                    onClick={onCreate}
                >
                    Create Chart
                </Button>
            ) : null}
            {quickOptions.length > 0 ? (
                <Popover
                    usePortal={usePortal}
                    placement="bottom-start"
                    content={(
                        <Menu className="forge-report-builder__chart-menu">
                            {Object.entries(groupedOptions).map(([group, options], groupIndex) => (
                                <React.Fragment key={group}>
                                    {groupIndex > 0 ? <MenuDivider title={group} /> : null}
                                    {groupIndex === 0 ? <MenuDivider title={group} /> : null}
                                    {options.map((option) => (
                                        <MenuItem
                                            key={option.value}
                                            text={option.label}
                                            onClick={() => onSelectQuickOption(option.value)}
                                        />
                                    ))}
                                </React.Fragment>
                            ))}
                        </Menu>
                    )}
                >
                    <Button
                        small
                        className="forge-report-builder__chart-action-button forge-report-builder__chart-action-button--quick"
                        icon="timeline-line-chart"
                        rightIcon="caret-down"
                    >
                        Quick chart
                    </Button>
                </Popover>
            ) : null}
        </div>
    );
}

export function ReportBuilderOverflowActions({ actions = [], label = "More actions" }) {
    const visibleActions = (actions || []).filter((entry) => entry && typeof entry === "object" && !entry.hidden);
    if (visibleActions.length === 0) {
        return null;
    }
    return (
        <Popover
            placement="bottom-end"
            content={(
                <Menu>
                    {visibleActions.map((action) => (
                        <MenuItem
                            key={action.text}
                            text={action.text}
                            icon={action.icon}
                            intent={action.intent}
                            disabled={action.disabled}
                            onClick={action.onClick}
                        />
                    ))}
                </Menu>
            )}
        >
            <Button
                small
                minimal
                icon="more"
                className="forge-report-builder__overflow-button"
                aria-label={label}
                title={label}
            />
        </Popover>
    );
}

export function ReportBuilderResultState({
    tone = "neutral",
    icon = "panel-table",
    eyebrow = "Result",
    title = "",
    description = "",
    actionLabel = "",
    onAction,
}) {
    return (
        <div className={[
            "forge-report-builder__result-state",
            tone ? `forge-report-builder__result-state--${tone}` : "",
        ].filter(Boolean).join(" ")}>
            <div className="forge-report-builder__result-state-icon" aria-hidden="true">
                <Icon icon={icon} size={16} />
            </div>
            <div className="forge-report-builder__result-state-copy">
                {eyebrow ? <div className="forge-report-builder__result-state-eyebrow">{eyebrow}</div> : null}
                {title ? <h4>{title}</h4> : null}
                {description ? <p>{description}</p> : null}
            </div>
            {actionLabel && typeof onAction === "function" ? (
                <Button small outlined onClick={onAction}>{actionLabel}</Button>
            ) : null}
        </div>
    );
}

export function ReportBuilderCompactSheetTab({ active = false, icon = "panel-table", label = "", onClick }) {
    return (
        <button
            type="button"
            className={[
                "forge-report-builder__compact-tab",
                active ? "is-active" : "",
            ].filter(Boolean).join(" ")}
            onClick={onClick}
        >
            <Icon icon={icon} size={12} />
            <span>{label}</span>
        </button>
    );
}

export function InlineStaticFilterControl({ filter, value, onToggle, onDateRange }) {
    if (!filter) {
        return null;
    }
    const options = Array.isArray(filter.options) ? filter.options : [];
    const activeValues = filter.multiple
        ? (Array.isArray(value) ? value : [])
        : (value == null || value === "" ? [] : [value]);

    if (filter.type === "dateRange") {
        return (
            <div className="forge-report-builder__inline-filter-control forge-report-builder__inline-filter-control--date-range">
                <span className="forge-report-builder__inline-filter-label">{filter.label || filter.id}</span>
                <div className="forge-report-builder__date-range forge-report-builder__date-range--inline">
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
            </div>
        );
    }

    return (
        <div className="forge-report-builder__inline-filter-control">
            <span className="forge-report-builder__inline-filter-label">{filter.label || filter.id}</span>
            <div className={String(filter.presentation || "").trim() === "compactIconRow" ? "forge-report-builder-icon-row forge-report-builder-icon-row--compact" : "forge-report-builder-icon-row"}>
                {options.map((option) => {
                    const active = activeValues.includes(option.value);
                    return (
                        <button
                            key={String(option.value)}
                            type="button"
                            className={[
                                "forge-report-builder-icon-button",
                                String(filter.presentation || "").trim() === "compactIconRow" ? "forge-report-builder-icon-button--compact" : "",
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
        </div>
    );
}

export function StaticFilterSection({ filter, context, value, onToggle, onDateRange }) {
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
            <div className={String(filter.presentation || "").trim() === "compactIconRow" ? "forge-report-builder-icon-row forge-report-builder-icon-row--compact" : "forge-report-builder-icon-row"}>
                {options.map((option) => {
                    const active = activeValues.includes(option.value);
                    return (
                        <button
                            key={String(option.value)}
                            type="button"
                            className={[
                                "forge-report-builder-icon-button",
                                String(filter.presentation || "").trim() === "compactIconRow" ? "forge-report-builder-icon-button--compact" : "",
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

export { LookupSelectionInput };
