import React, { useEffect, useMemo } from "react";
import { Button, Dialog, Icon, Menu, MenuDivider, MenuItem, Popover } from "@blueprintjs/core";
import { useSignals } from "@preact/signals-react/runtime";

import LookupSelectionInput from "../lookup/LookupSelectionInput.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey } from "../../utils/selector.js";
import { REPORT_BUILDER_TABLE_CALC_FUNCTIONS } from "./reportBuilderCalculatedFieldAuthoring.js";
import { summarizeReportBuilderSemanticDiagnostics } from "./reportBuilderSemantic.js";
import { buildSemanticFieldGovernanceChipViewModels } from "./semanticFieldGovernanceView.js";
import {
    chartFamilyForType,
    chartFamilyHelperText,
    chartTypeLabel,
    PER_SERIES_TYPE_CHOICES,
    SINGLE_MEASURE_CATEGORY_TYPES,
    supportsStackForSeries,
} from "./reportBuilderChartRules.js";

export function buildFilterCategoryChipViewModel({
    label = "",
    active = false,
    configuredCount = 0,
    issue = null,
    providerDiagnostics = [],
} = {}) {
    const normalizedLabel = String(label || "").trim();
    const issueMessage = String(issue?.message || "").trim();
    const providerDiagnosticsSummary = Array.isArray(providerDiagnostics) && providerDiagnostics.length > 0
        ? summarizeReportBuilderSemanticDiagnostics(providerDiagnostics)
        : "";
    const diagnosticSummary = issueMessage || providerDiagnosticsSummary;
    const stateLabel = configuredCount > 0 ? String(configuredCount) : (active ? "Shown" : "Add");
    const title = [
        normalizedLabel,
        configuredCount > 0 ? `${configuredCount} configured` : "",
        active ? "shown" : "available",
        diagnosticSummary,
    ].filter(Boolean).join(" • ");
    return {
        className: [
            "forge-report-builder__category-chip",
            active ? "is-active" : "is-inactive",
            configuredCount > 0 ? "has-configured-state" : "",
            issueMessage ? "is-semantic-invalid" : "",
            providerDiagnosticsSummary ? "is-semantic-provider-invalid" : "",
        ].filter(Boolean).join(" "),
        title,
        stateLabel,
        diagnosticSummary,
    };
}

export function ReportBuilderInlineNotice({
    notice = null,
    onAction = null,
    children = null,
}) {
    const normalizedNotice = notice && typeof notice === "object" && !Array.isArray(notice)
        ? notice
        : null;
    const message = String(normalizedNotice?.message || "").trim();
    const hasChildren = children !== null && children !== undefined && children !== false;
    if (!message && !hasChildren) {
        return null;
    }
    const actionLabel = String(normalizedNotice?.actionLabel || "").trim();
    const hasAction = !!actionLabel && typeof onAction === "function";
    return (
        <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${String(normalizedNotice?.level || "info").trim() || "info"}`}>
            {message ? <span>{message}</span> : null}
            {children}
            {hasAction ? (
                <div className="forge-report-builder__result-header-actions" style={{ marginTop: 8 }}>
                    <Button
                        small
                        minimal
                        onClick={onAction}
                    >
                        {actionLabel}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

export function ReportBuilderInspectorNotice({
    level = "info",
    ariaLabel = "",
    metaChips = [],
    children = null,
    actions = null,
    content = "",
    contentStyle = null,
}) {
    const normalizedContent = String(content || "");
    const normalizedMetaChips = (Array.isArray(metaChips) ? metaChips : []).filter(Boolean);
    const normalizedLevel = String(level || "info").trim() || "info";
    const resolvedContentStyle = contentStyle && typeof contentStyle === "object" && !Array.isArray(contentStyle)
        ? contentStyle
        : {};
    return (
        <ReportBuilderInlineNotice
            notice={{
                level: normalizedLevel,
                message: "",
            }}
        >
            {normalizedMetaChips.length > 0 ? (
                <div className="forge-report-builder__result-meta" aria-label={String(ariaLabel || "").trim() || undefined} style={{ marginBottom: 10 }}>
                    {normalizedMetaChips.map((chip) => (
                        <span key={chip} className="forge-report-builder__result-meta-chip">{chip}</span>
                    ))}
                </div>
            ) : null}
            {children}
            {actions ? (
                <div className="forge-report-builder__result-header-actions" style={{ marginBottom: 10 }}>
                    {actions}
                </div>
            ) : null}
            <pre
                className="forge-report-builder__saved-artifact-json"
                style={{
                    margin: 0,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #d7e2ee",
                    background: "#fbfdff",
                    color: "#294256",
                    fontSize: 11,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    overflow: "auto",
                    maxHeight: 320,
                    ...resolvedContentStyle,
                }}
            >
                {normalizedContent}
            </pre>
        </ReportBuilderInlineNotice>
    );
}

export function ReportBuilderSummaryNotice({
    level = "info",
    label = "",
    value = "",
    subtitle = "",
    description = "",
    supplemental = null,
    children = null,
    footer = null,
}) {
    const normalizedLabel = String(label || "").trim();
    const normalizedValue = String(value || "").trim();
    const normalizedSubtitle = String(subtitle || "").trim();
    const normalizedDescription = String(description || "").trim();
    const hasContent = normalizedLabel || normalizedValue || normalizedSubtitle || normalizedDescription || supplemental || children || footer;
    if (!hasContent) {
        return null;
    }
    return (
        <ReportBuilderInlineNotice
            notice={{
                level: String(level || "info").trim() || "info",
                message: "",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {normalizedLabel || normalizedValue ? (
                    <span>
                        {normalizedLabel ? <strong>{normalizedLabel}:</strong> : null}
                        {normalizedLabel && normalizedValue ? " " : ""}
                        {normalizedValue || null}
                    </span>
                ) : null}
                {normalizedSubtitle ? (
                    <span>{normalizedSubtitle}</span>
                ) : null}
                {normalizedDescription ? (
                    <span>{normalizedDescription}</span>
                ) : null}
                {supplemental}
            </div>
            {children}
            {footer}
        </ReportBuilderInlineNotice>
    );
}

export function ReportBuilderSemanticBindingChips({
    bindingState = null,
    marginTop = 0,
    marginBottom = 0,
}) {
    const chips = Array.isArray(bindingState?.semanticBindingChips)
        ? bindingState.semanticBindingChips.filter(Boolean)
        : (Array.isArray(bindingState?.chips) ? bindingState.chips.filter(Boolean) : []);
    if (chips.length === 0) {
        return null;
    }
    const title = String(bindingState?.semanticBindingTitle || "").trim();
    return (
        <div style={{ display: "grid", gap: 8, marginTop, marginBottom }}>
            {title ? (
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
                    {title}
                </div>
            ) : null}
            <div
                className="forge-report-builder__result-meta"
                aria-label={bindingState?.semanticBindingTitle || bindingState?.title || "Semantic binding"}
            >
                {chips.map((chip) => (
                    <span key={chip} className="forge-report-builder__result-meta-chip">{chip}</span>
                ))}
            </div>
        </div>
    );
}

export function ReportBuilderSemanticFieldGroups({
    bindingState = null,
    marginTop = 0,
    marginBottom = 0,
}) {
    const fieldGroups = Array.isArray(bindingState?.semanticBindingFieldGroups)
        ? bindingState.semanticBindingFieldGroups
        : (Array.isArray(bindingState?.fieldGroups) ? bindingState.fieldGroups : []);
    if (fieldGroups.length === 0) {
        return null;
    }
    return (
        <div style={{ display: "grid", gap: 12, marginTop, marginBottom }}>
            {fieldGroups.map((group) => {
                const groupId = String(group?.id || group?.title || "").trim();
                const groupTitle = String(group?.title || group?.id || "").trim();
                const fields = Array.isArray(group?.fields) ? group.fields : [];
                if (!groupId || !groupTitle || fields.length === 0) {
                    return null;
                }
                return (
                    <div key={groupId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
                            {groupTitle}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                            {fields.map((field, index) => {
                                const label = String(field?.label || field?.id || "").trim();
                                const rawId = String(field?.rawId || "").trim();
                                const description = String(field?.description || "").trim();
                                const category = String(field?.category || "").trim();
                                const definitionRef = String(field?.definitionRef || "").trim();
                                const governance = field?.governance && typeof field.governance === "object" && !Array.isArray(field.governance)
                                    ? field.governance
                                    : {};
                                const classification = String(governance.classification || "").trim();
                                const governanceLabels = buildSemanticFieldGovernanceChipViewModels(governance)
                                    .map((chip) => String(chip?.label || "").trim())
                                    .filter(Boolean);
                                const metadataChips = [
                                    category,
                                    classification,
                                    ...governanceLabels,
                                ].filter(Boolean);
                                if (!label) {
                                    return null;
                                }
                                return (
                                    <div
                                        key={`${groupId}:${String(field?.id || field?.rawId || label).trim()}:${index}`}
                                        style={{
                                            border: "1px solid #d7e2ee",
                                            borderRadius: 10,
                                            background: "#fbfdff",
                                            padding: "10px 12px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                                        }}
                                    >
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#183247" }}>{label}</div>
                                        {metadataChips.length > 0 ? (
                                            <div className="forge-report-builder__result-meta" aria-label={`${label} metadata`}>
                                                {metadataChips.map((chip) => (
                                                    <span key={`${label}:${chip}`} className="forge-report-builder__result-meta-chip">{chip}</span>
                                                ))}
                                            </div>
                                        ) : null}
                                        {rawId ? (
                                            <div style={{ fontSize: 11, color: "#486579", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                                {rawId}
                                            </div>
                                        ) : null}
                                        {definitionRef ? (
                                            <div style={{ fontSize: 11, color: "#486579", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: 1.45 }}>
                                                {definitionRef}
                                            </div>
                                        ) : null}
                                        {description ? (
                                            <div style={{ fontSize: 11, lineHeight: 1.45, color: "#486579" }}>
                                                {description}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function ReportBuilderScopeSummary({
    summaryState = null,
    marginTop = 0,
    marginBottom = 0,
}) {
    const items = Array.isArray(summaryState?.scopeSummaryItems) ? summaryState.scopeSummaryItems : [];
    const title = String(summaryState?.scopeSummaryTitle || "Report Scope").trim();
    if (items.length === 0 || !title) {
        return null;
    }
    return (
        <div style={{ display: "grid", gap: 8, marginTop, marginBottom }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
                {title}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
                {items.map((item) => (
                    <div
                        key={String(item?.id || item?.label || "").trim()}
                        style={{
                            border: "1px solid #d7e2ee",
                            borderRadius: 10,
                            background: "#fbfdff",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#183247" }}>{String(item?.label || item?.id || "").trim()}</div>
                        {String(item?.description || "").trim() ? (
                            <div style={{ fontSize: 11, lineHeight: 1.45, color: "#5f6b7c" }}>{String(item?.description || "").trim()}</div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ReportBuilderArtifactEntryCard({
    entry = null,
    renderSemanticBindingChips = null,
    renderSemanticBindingFieldGroups = null,
    renderScopeSummaryItems = null,
    renderReopenSourceResolution = null,
    renderAuthoredDocumentProgress = null,
    onActivate = null,
    onRemove = null,
}) {
    const normalizedEntry = entry && typeof entry === "object" && !Array.isArray(entry)
        ? entry
        : null;
    const title = String(normalizedEntry?.title || "").trim();
    if (!normalizedEntry || !title) {
        return null;
    }
    return (
        <div
            style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid #d7e2ee",
                background: normalizedEntry.active ? "#eef6ff" : "#f8fbff",
                maxWidth: 420,
            }}
        >
            <span style={{ fontSize: 12, color: "#183247", fontWeight: 600 }}>
                {title}
            </span>
            {normalizedEntry.notice && typeof normalizedEntry.notice === "object" && !Array.isArray(normalizedEntry.notice)
                ? <ReportBuilderInlineNotice notice={normalizedEntry.notice} />
                : null}
            {typeof renderSemanticBindingChips === "function"
                ? renderSemanticBindingChips(normalizedEntry)
                : null}
            {Array.isArray(normalizedEntry.semanticBindingFieldGroups) && normalizedEntry.semanticBindingFieldGroups.length > 0 && typeof renderSemanticBindingFieldGroups === "function"
                ? renderSemanticBindingFieldGroups(normalizedEntry, { marginTop: 2 })
                : null}
            {typeof renderScopeSummaryItems === "function"
                ? renderScopeSummaryItems(normalizedEntry, { marginTop: 2 })
                : null}
            {typeof renderReopenSourceResolution === "function"
                ? renderReopenSourceResolution(normalizedEntry, { marginTop: 2 })
                : null}
            {typeof renderAuthoredDocumentProgress === "function"
                ? renderAuthoredDocumentProgress(normalizedEntry, { marginTop: 2 })
                : null}
            <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
                {(Array.isArray(normalizedEntry.metaChips) ? normalizedEntry.metaChips : []).map((chip) => (
                    <span key={`${normalizedEntry.id || title}:${chip}`} className="forge-report-builder__result-meta-chip">{chip}</span>
                ))}
            </div>
            <div className="forge-report-builder__result-header-actions">
                {normalizedEntry.activateLabel && typeof onActivate === "function" ? (
                    <Button
                        small
                        minimal
                        onClick={onActivate}
                    >
                        Use
                    </Button>
                ) : null}
                {typeof onRemove === "function" ? (
                    <Button
                        small
                        minimal
                        onClick={onRemove}
                    >
                        Remove
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

export function ReportBuilderPreparedArtifactCard({
    artifact = null,
    actions = [],
}) {
    const normalizedArtifact = artifact && typeof artifact === "object" && !Array.isArray(artifact)
        ? artifact
        : null;
    const normalizedTitle = String(normalizedArtifact?.title || "").trim();
    if (!normalizedArtifact || !normalizedTitle) {
        return null;
    }
    const normalizedActions = (Array.isArray(actions) ? actions : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
            id: String(entry.id || entry.label || "").trim(),
            label: String(entry.label || "").trim(),
            disabled: !!entry.disabled,
            onClick: typeof entry.onClick === "function" ? entry.onClick : null,
        }))
        .filter((entry) => entry.id && entry.label && entry.onClick);
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #d7e2ee",
                background: "#f8fbff",
                minWidth: 220,
                maxWidth: 340,
                flex: "1 1 240px",
            }}
        >
            {String(normalizedArtifact?.label || "").trim() ? (
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
                    {String(normalizedArtifact.label || "").trim()}
                </div>
            ) : null}
            <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#183247" }}>
                    {normalizedTitle}
                </div>
                {String(normalizedArtifact?.subtitle || "").trim() ? (
                    <div style={{ fontSize: 12, color: "#486579" }}>
                        {String(normalizedArtifact.subtitle || "").trim()}
                    </div>
                ) : null}
                {String(normalizedArtifact?.description || "").trim() ? (
                    <div style={{ fontSize: 11, lineHeight: 1.45, color: "#5f6b7c" }}>
                        {String(normalizedArtifact.description || "").trim()}
                    </div>
                ) : null}
            </div>
            {normalizedArtifact.notice && typeof normalizedArtifact.notice === "object" && !Array.isArray(normalizedArtifact.notice) ? (
                <ReportBuilderInlineNotice notice={normalizedArtifact.notice} />
            ) : null}
            {(Array.isArray(normalizedArtifact?.metaChips) ? normalizedArtifact.metaChips : []).length > 0 ? (
                <div className="forge-report-builder__result-meta">
                    {(normalizedArtifact.metaChips || []).map((chip) => (
                        <span key={`${normalizedArtifact.id || normalizedTitle}:${chip}`} className="forge-report-builder__result-meta-chip">{chip}</span>
                    ))}
                </div>
            ) : null}
            {normalizedActions.length > 0 ? (
                <div className="forge-report-builder__result-header-actions">
                    {normalizedActions.map((action) => (
                        <Button
                            key={action.id}
                            small
                            minimal
                            disabled={action.disabled}
                            onClick={action.onClick}
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            ) : null}
        </div>
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

const CALCULATED_FIELD_DATA_TYPES = [
    { value: "number", label: "Number" },
    { value: "string", label: "String" },
    { value: "boolean", label: "Boolean" },
];

const CALCULATED_FIELD_FORMATS = [
    { value: "", label: "Default" },
    { value: "number", label: "Number" },
    { value: "compactNumber", label: "Compact number" },
    { value: "currency", label: "Currency" },
    { value: "percent", label: "Percent" },
];

export function ReportBuilderCalculatedFieldDialog({
    isOpen = false,
    onClose,
    draft = null,
    onDraftChange,
    onApply,
    validation = { valid: false, errors: [] },
    availableFields = [],
    isEditing = false,
}) {
    const errors = Array.isArray(validation?.errors) ? validation.errors : [];
    const errorByField = new Map();
    errors.forEach((entry) => {
        const field = String(entry?.field || "").trim();
        if (!field || errorByField.has(field)) {
            return;
        }
        errorByField.set(field, entry);
    });

    const setDraftPatch = (patch = {}) => {
        if (typeof onDraftChange !== "function") {
            return;
        }
        onDraftChange({
            ...(draft || {}),
            ...(patch || {}),
        });
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? "Edit Calculated Field" : "Add Calculated Field"}
            style={{ width: "min(760px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                <div className="forge-report-builder__chart-dialog-grid">
                    <label className="forge-report-builder__chart-field">
                        <span>Field ID</span>
                        <input
                            type="text"
                            name="calculatedFieldId"
                            disabled={isEditing}
                            className={errorByField.has("id") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.id || ""}
                            onChange={(event) => setDraftPatch({ id: event.target.value, key: event.target.value })}
                            placeholder="projectedLift"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Label</span>
                        <input
                            type="text"
                            name="calculatedFieldLabel"
                            className={errorByField.has("label") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.label || ""}
                            onChange={(event) => setDraftPatch({ label: event.target.value })}
                            placeholder="Projected Lift"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Data type</span>
                        <select
                            name="calculatedFieldDataType"
                            className={errorByField.has("dataType") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.dataType || "number"}
                            onChange={(event) => setDraftPatch({ dataType: event.target.value })}
                        >
                            {CALCULATED_FIELD_DATA_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Format</span>
                        <select
                            name="calculatedFieldFormat"
                            className="forge-report-builder-select"
                            value={draft?.format || ""}
                            onChange={(event) => setDraftPatch({ format: event.target.value })}
                        >
                            {CALCULATED_FIELD_FORMATS.map((option) => (
                                <option key={option.value || "default"} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Expression</span>
                        <textarea
                            name="calculatedFieldExpr"
                            className={errorByField.has("expr") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                            value={draft?.expr || ""}
                            onChange={(event) => setDraftPatch({ expr: event.target.value })}
                            placeholder="if(impressions = 0, null, round((clicks / impressions) * 100, 2))"
                            rows={4}
                        />
                    </label>
                </div>
                <div className="forge-report-builder__calculated-field-hint">
                    <strong>Supported:</strong> arithmetic, comparisons, <code>and/or/not</code>, <code>if</code>, <code>case</code>, <code>coalesce</code>, <code>isNull</code>, <code>nullIf</code>, <code>abs</code>, <code>round</code>, <code>floor</code>, <code>ceil</code>, <code>min/max</code>, <code>least/greatest</code>, <code>concat</code>, <code>lower</code>, <code>upper</code>.
                </div>
                <div className="forge-report-builder__calculated-field-reference-list">
                    <div className="forge-report-builder__calculated-field-reference-header">
                        Available field IDs
                    </div>
                    <div className="forge-report-builder__calculated-field-reference-items">
                        {availableFields.length === 0 ? (
                            <span className="forge-report-builder__calculated-field-reference-empty">No fields available.</span>
                        ) : availableFields.map((field) => (
                            <span key={`${field.kind}:${field.id}`} className="forge-report-builder__calculated-field-reference-chip">
                                <strong>{field.id}</strong>
                                <span>{field.label}</span>
                            </span>
                        ))}
                    </div>
                </div>
                {errors.length > 0 ? (
                    <div className="forge-report-builder__chart-errors">
                        {errors.map((entry, index) => (
                            <div key={`${entry.field}_${entry.code}_${index}`} className="forge-report-builder__chart-error">
                                {entry.message}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="forge-report-builder__chart-dialog-actions">
                <Button outlined onClick={onClose}>Cancel</Button>
                <Button intent="primary" onClick={onApply} disabled={!validation?.valid}>
                    {isEditing ? "Apply Changes" : "Add Field"}
                </Button>
            </div>
        </Dialog>
    );
}

export function ReportBuilderTableCalculationDialog({
    isOpen = false,
    onClose,
    draft = null,
    onDraftChange,
    onApply,
    validation = { valid: false, errors: [] },
    fieldOptions = { sourceFields: [], orderFields: [], partitionDimensions: [] },
    isEditing = false,
}) {
    const errors = Array.isArray(validation?.errors) ? validation.errors : [];
    const errorByField = new Map();
    errors.forEach((entry) => {
        const field = String(entry?.field || "").trim();
        if (!field || errorByField.has(field)) {
            return;
        }
        errorByField.set(field, entry);
    });
    const setDraftPatch = (patch = {}) => {
        if (typeof onDraftChange !== "function") {
            return;
        }
        onDraftChange({
            ...(draft || {}),
            ...(patch || {}),
        });
    };
    const functionId = String(draft?.functionId || "").trim();
    const functionMeta = REPORT_BUILDER_TABLE_CALC_FUNCTIONS.find((entry) => entry.value === functionId) || null;
    const partitionBy = Array.isArray(draft?.partitionBy)
        ? draft.partitionBy.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const togglePartitionDimension = (dimensionId = "") => {
        const nextId = String(dimensionId || "").trim();
        if (!nextId) {
            return;
        }
        const nextValues = partitionBy.includes(nextId)
            ? partitionBy.filter((entry) => entry !== nextId)
            : [...partitionBy, nextId];
        setDraftPatch({ partitionBy: nextValues });
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? "Edit Table Calculation" : "Add Table Calculation"}
            style={{ width: "min(760px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                <div className="forge-report-builder__chart-dialog-grid">
                    <label className="forge-report-builder__chart-field">
                        <span>Field ID</span>
                        <input
                            name="tableCalcId"
                            type="text"
                            disabled={isEditing}
                            className={errorByField.has("id") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.id || ""}
                            onChange={(event) => setDraftPatch({ id: event.target.value, key: event.target.value })}
                            placeholder="runningAvails"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Label</span>
                        <input
                            name="tableCalcLabel"
                            type="text"
                            className={errorByField.has("label") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.label || ""}
                            onChange={(event) => setDraftPatch({ label: event.target.value })}
                            placeholder="Running Avails"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Function</span>
                        <select
                            name="tableCalcFunction"
                            className={errorByField.has("functionId") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={functionId}
                            onChange={(event) => setDraftPatch({ functionId: event.target.value })}
                        >
                            <option value="">Select…</option>
                            {REPORT_BUILDER_TABLE_CALC_FUNCTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Format</span>
                        <select
                            name="tableCalcFormat"
                            className="forge-report-builder-select"
                            value={draft?.format || ""}
                            onChange={(event) => setDraftPatch({ format: event.target.value })}
                        >
                            {CALCULATED_FIELD_FORMATS.map((option) => (
                                <option key={option.value || "default"} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Source Field</span>
                        <select
                            name="tableCalcSourceField"
                            className={errorByField.has("sourceField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.sourceField || ""}
                            onChange={(event) => setDraftPatch({ sourceField: event.target.value })}
                        >
                            <option value="">Select…</option>
                            {(fieldOptions?.sourceFields || []).map((entry) => (
                                <option key={entry.id} value={entry.id}>{entry.label}</option>
                            ))}
                        </select>
                    </label>
                    {functionMeta?.requiresOrder ? (
                        <label className="forge-report-builder__chart-field">
                            <span>Order By</span>
                            <select
                                name="tableCalcOrderByField"
                                className={errorByField.has("orderByField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                value={draft?.orderByField || ""}
                                onChange={(event) => setDraftPatch({ orderByField: event.target.value })}
                            >
                                <option value="">Select…</option>
                                {(fieldOptions?.orderFields || []).map((entry) => (
                                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    {functionMeta?.requiresOrder || functionMeta?.supportsRankDirection ? (
                        <label className="forge-report-builder__chart-field">
                            <span>{functionId === "rank" ? "Rank Direction" : "Order Direction"}</span>
                            <select
                                name="tableCalcOrderDir"
                                className="forge-report-builder-select"
                                value={draft?.orderDir || (functionId === "rank" ? "desc" : "asc")}
                                onChange={(event) => setDraftPatch({ orderDir: event.target.value })}
                            >
                                <option value="asc">Ascending</option>
                                <option value="desc">Descending</option>
                            </select>
                        </label>
                    ) : null}
                    {functionMeta?.supportsTieBreaker ? (
                        <label className="forge-report-builder__chart-field">
                            <span>Tie-breaker</span>
                            <select
                                name="tableCalcTieBreakerField"
                                className={errorByField.has("tieBreakerField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                value={draft?.tieBreakerField || ""}
                                onChange={(event) => setDraftPatch({ tieBreakerField: event.target.value })}
                            >
                                <option value="">None</option>
                                {(fieldOptions?.orderFields || []).map((entry) => (
                                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    {functionMeta?.requiresWindowSize ? (
                        <label className="forge-report-builder__chart-field">
                            <span>Window Size</span>
                            <input
                                type="number"
                                name="tableCalcWindowSize"
                                min="1"
                                className={errorByField.has("windowSize") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                value={draft?.windowSize || ""}
                                onChange={(event) => setDraftPatch({ windowSize: event.target.value })}
                                placeholder="3"
                            />
                        </label>
                    ) : null}
                    {functionMeta?.supportsDecimals ? (
                        <label className="forge-report-builder__chart-field">
                            <span>Decimals</span>
                            <input
                                type="number"
                                name="tableCalcDecimals"
                                min="0"
                                className={errorByField.has("decimals") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                value={draft?.decimals || ""}
                                onChange={(event) => setDraftPatch({ decimals: event.target.value })}
                                placeholder={functionId === "percentOfTotal" ? "1" : "2"}
                            />
                        </label>
                    ) : null}
                    <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Partition By</span>
                        <div className={errorByField.has("partitionBy") ? "forge-report-builder__chart-measure-chips is-invalid" : "forge-report-builder__chart-measure-chips"}>
                            {(fieldOptions?.partitionDimensions || []).length === 0 ? (
                                <div className="forge-report-builder__chart-empty-hint">No dimensions available.</div>
                            ) : (fieldOptions?.partitionDimensions || []).map((entry) => {
                                const active = partitionBy.includes(entry.id);
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        className={[
                                            "forge-report-builder__chart-measure-chip",
                                            active ? "is-active" : "",
                                        ].filter(Boolean).join(" ")}
                                        onClick={() => togglePartitionDimension(entry.id)}
                                    >
                                        <span className={active ? "forge-report-builder__selector-box is-active" : "forge-report-builder__selector-box"}>
                                            {active ? "✓" : ""}
                                        </span>
                                        <span>{entry.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="forge-report-builder__calculated-field-hint">
                    <strong>Supported:</strong> percent of total, running total, rank, delta from previous, and moving average over the current result grid only.
                </div>
                {errors.length > 0 ? (
                    <div className="forge-report-builder__chart-errors">
                        {errors.map((entry, index) => (
                            <div key={`${entry.field}_${entry.code}_${index}`} className="forge-report-builder__chart-error">
                                {entry.message}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="forge-report-builder__chart-dialog-actions">
                <Button outlined onClick={onClose}>Cancel</Button>
                <Button intent="primary" onClick={onApply} disabled={!validation?.valid}>
                    {isEditing ? "Apply Changes" : "Add Table Calculation"}
                </Button>
            </div>
        </Dialog>
    );
}

export function ReportBuilderDocumentBlockDialog({
    isOpen = false,
    onClose,
    draft = null,
    onDraftChange,
    onApply,
    validation = { valid: false, errors: [] },
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    tableColumnOptions = [],
    scopeParamOptions = [],
    isEditing = false,
}) {
    const refinementBarActionOptions = [
        { value: "remove", label: "Remove individual refinements" },
        { value: "clearAll", label: "Clear all refinements" },
        { value: "undo", label: "Undo refinement changes" },
        { value: "redo", label: "Redo refinement changes" },
    ];
    const geoAggregateOptions = [
        { value: "sum", label: "Sum" },
        { value: "avg", label: "Average" },
        { value: "min", label: "Minimum" },
        { value: "max", label: "Maximum" },
        { value: "first", label: "First value" },
    ];
    const geoShapeOptions = [
        { value: "us-states", label: "US states" },
        { value: "us-state-tiles", label: "US state tiles" },
    ];
    const errors = Array.isArray(validation?.errors) ? validation.errors : [];
    const errorByField = new Map();
    errors.forEach((entry) => {
        const field = String(entry?.field || "").trim();
        if (!field || errorByField.has(field)) {
            return;
        }
        errorByField.set(field, entry);
    });
    const normalizedKind = String(draft?.kind || "markdownBlock").trim() || "markdownBlock";
    const isFilterBarBlock = normalizedKind === "filterBarBlock";
    const isRefinementBarBlock = normalizedKind === "refinementBarBlock";
    const isGeoMapBlock = normalizedKind === "geoMapBlock";
    const isKpiBlock = normalizedKind === "kpiBlock";
    const isTableBlock = normalizedKind === "tableBlock";
    const geo = draft?.geo && typeof draft.geo === "object" && !Array.isArray(draft.geo)
        ? draft.geo
        : {};
    const geoMetric = geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)
        ? geo.metric
        : {};
    const geoDimensionOptions = tableColumnOptions.filter((option) => String(option?.kind || "").trim() === "dimension");
    const geoMetricOptions = tableColumnOptions.filter((option) => String(option?.kind || "").trim() === "measure");
    const setDraftPatch = (patch = {}) => {
        if (typeof onDraftChange !== "function") {
            return;
        }
        onDraftChange({
            ...(draft || {}),
            ...(patch || {}),
        });
    };
    const applyValueField = (value = "") => {
        const normalizedValue = String(value || "").trim();
        const matched = (Array.isArray(valueFieldOptions) ? valueFieldOptions : [])
            .find((option) => String(option?.value || "").trim() === normalizedValue);
        setDraftPatch({
            valueField: normalizedValue,
            valueLabel: matched?.label || normalizedValue,
        });
    };
    const applySecondaryField = (value = "") => {
        const normalizedValue = String(value || "").trim();
        const matched = (Array.isArray(secondaryFieldOptions) ? secondaryFieldOptions : [])
            .find((option) => String(option?.value || "").trim() === normalizedValue);
        setDraftPatch({
            secondaryField: normalizedValue,
            secondaryLabel: normalizedValue ? (matched?.label || normalizedValue) : "",
        });
    };
    const selectedColumnKeys = Array.isArray(draft?.columnKeys)
        ? draft.columnKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const selectedParamIds = Array.isArray(draft?.paramIds)
        ? draft.paramIds.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const selectedRefinementActionKinds = Array.isArray(draft?.actionKinds)
        ? draft.actionKinds.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const columnVisualKinds = draft?.columnVisualKinds && typeof draft.columnVisualKinds === "object" && !Array.isArray(draft.columnVisualKinds)
        ? draft.columnVisualKinds
        : {};
    const columnVisualRuleTexts = draft?.columnVisualRuleTexts && typeof draft.columnVisualRuleTexts === "object" && !Array.isArray(draft.columnVisualRuleTexts)
        ? draft.columnVisualRuleTexts
        : {};
    const toggleColumnKey = (columnKey = "") => {
        const normalizedColumnKey = String(columnKey || "").trim();
        if (!normalizedColumnKey) {
            return;
        }
        const nextKeys = selectedColumnKeys.includes(normalizedColumnKey)
            ? selectedColumnKeys.filter((entry) => entry !== normalizedColumnKey)
            : [...selectedColumnKeys, normalizedColumnKey];
        setDraftPatch({ columnKeys: nextKeys });
    };
    const toggleScopeParam = (paramId = "") => {
        const normalizedParamId = String(paramId || "").trim();
        if (!normalizedParamId) {
            return;
        }
        const nextParamIds = selectedParamIds.includes(normalizedParamId)
            ? selectedParamIds.filter((entry) => entry !== normalizedParamId)
            : [...selectedParamIds, normalizedParamId];
        setDraftPatch({ paramIds: nextParamIds });
    };
    const toggleRefinementActionKind = (actionKind = "") => {
        const normalizedActionKind = String(actionKind || "").trim();
        if (!normalizedActionKind) {
            return;
        }
        const nextActionKinds = selectedRefinementActionKinds.includes(normalizedActionKind)
            ? selectedRefinementActionKinds.filter((entry) => entry !== normalizedActionKind)
            : [...selectedRefinementActionKinds, normalizedActionKind];
        setDraftPatch({ actionKinds: nextActionKinds });
    };
    const setColumnVisualKind = (columnKey = "", visualKind = "") => {
        const normalizedColumnKey = String(columnKey || "").trim();
        if (!normalizedColumnKey) {
            return;
        }
        const nextVisualKinds = {
            ...columnVisualKinds,
        };
        const normalizedVisualKind = String(visualKind || "").trim();
        if (!normalizedVisualKind) {
            delete nextVisualKinds[normalizedColumnKey];
        } else {
            nextVisualKinds[normalizedColumnKey] = normalizedVisualKind;
        }
        setDraftPatch({ columnVisualKinds: nextVisualKinds });
    };
    const setColumnVisualRuleText = (columnKey = "", rulesText = "") => {
        const normalizedColumnKey = String(columnKey || "").trim();
        if (!normalizedColumnKey) {
            return;
        }
        const nextRuleTexts = {
            ...columnVisualRuleTexts,
        };
        const normalizedRulesText = String(rulesText || "");
        if (!normalizedRulesText.trim()) {
            delete nextRuleTexts[normalizedColumnKey];
        } else {
            nextRuleTexts[normalizedColumnKey] = normalizedRulesText;
        }
        setDraftPatch({ columnVisualRuleTexts: nextRuleTexts });
    };
    const setGeoPatch = (patch = {}) => {
        const nextGeo = {
            ...(geo || {}),
            ...(patch || {}),
        };
        setDraftPatch({ geo: nextGeo });
    };
    const setGeoMetricPatch = (patch = {}) => {
        setGeoPatch({
            metric: {
                ...(geoMetric || {}),
                ...(patch || {}),
            },
        });
    };
    const applyGeoMetricField = (value = "") => {
        const normalizedValue = String(value || "").trim();
        const matched = geoMetricOptions.find((option) => String(option?.key || "").trim() === normalizedValue);
        setGeoMetricPatch({
            key: normalizedValue,
            label: matched?.label || normalizedValue,
            format: matched?.format === "compactNumber" ? "compact" : matched?.format || undefined,
        });
    };
    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing
                ? (isFilterBarBlock
                    ? "Edit Filter Bar Block"
                    : isRefinementBarBlock
                        ? "Edit Refinement Bar Block"
                        : isGeoMapBlock
                            ? "Edit Geo Map Block"
                        : isKpiBlock
                            ? "Edit KPI Block"
                            : isTableBlock
                                ? "Edit Table Block"
                                : "Edit Narrative Block")
                : (isFilterBarBlock
                    ? "Add Filter Bar Block"
                    : isRefinementBarBlock
                        ? "Add Refinement Bar Block"
                        : isGeoMapBlock
                            ? "Add Geo Map Block"
                        : isKpiBlock
                            ? "Add KPI Block"
                            : isTableBlock
                                ? "Add Table Block"
                                : "Add Narrative Block")}
            style={{ width: "min(720px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                <div className="forge-report-builder__chart-dialog-grid">
                    <label className="forge-report-builder__chart-field">
                        <span>Block type</span>
                        <input
                            type="text"
                            disabled
                            className="forge-report-builder-select"
                            value={isFilterBarBlock
                                ? "Filter bar"
                                : isRefinementBarBlock
                                    ? "Refinement bar"
                                    : isGeoMapBlock
                                        ? "Geo map"
                                    : isKpiBlock
                                        ? "KPI"
                                        : isTableBlock
                                            ? "Table"
                                            : "Narrative"}
                            readOnly
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Title</span>
                        <input
                            type="text"
                            className={errorByField.has("title") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.title || ""}
                            onChange={(event) => setDraftPatch({ title: event.target.value })}
                            placeholder={isFilterBarBlock
                                ? "Report Scope"
                                : isRefinementBarBlock
                                    ? "Active Refinements"
                                    : isGeoMapBlock
                                        ? "Geo Map"
                                    : isKpiBlock
                                        ? "Headline KPI"
                                        : isTableBlock
                                            ? "Detail Table"
                                            : "Narrative"}
                        />
                    </label>
                    {isFilterBarBlock ? (
                        <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                            <span>Shared scope parameters</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {scopeParamOptions.length === 0 ? (
                                    <span style={{ fontSize: 12, color: "#5f6b7c" }}>No shared scope parameters are configured in the current builder.</span>
                                ) : scopeParamOptions.map((option) => {
                                    const selected = selectedParamIds.includes(option.value);
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className={[
                                                "forge-report-builder__dimension-pill",
                                                selected ? "is-active" : "",
                                            ].filter(Boolean).join(" ")}
                                            onClick={() => toggleScopeParam(option.value)}
                                            style={{ cursor: "pointer", width: "fit-content" }}
                                        >
                                            <span className="forge-report-builder__pill-copy">
                                                <span className="forge-report-builder__pill-text">{option.label}</span>
                                                {option.description ? (
                                                    <span className="forge-report-builder__quick-option-description">
                                                        {option.description}
                                                    </span>
                                                ) : null}
                                            </span>
                                            {option.required ? <span className="forge-report-builder__result-meta-chip">Required</span> : null}
                                            {selected ? <span aria-hidden="true">✓</span> : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : isRefinementBarBlock ? (
                        <>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Available actions</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {refinementBarActionOptions.map((option) => {
                                        const selected = selectedRefinementActionKinds.includes(option.value);
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={[
                                                    "forge-report-builder__dimension-pill",
                                                    selected ? "is-active" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => toggleRefinementActionKind(option.value)}
                                                style={{ cursor: "pointer", width: "fit-content" }}
                                            >
                                                <span className="forge-report-builder__pill-copy">
                                                    <span className="forge-report-builder__pill-text">{option.label}</span>
                                                </span>
                                                {selected ? <span aria-hidden="true">✓</span> : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Empty state label</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.emptyLabel || ""}
                                    onChange={(event) => setDraftPatch({ emptyLabel: event.target.value })}
                                    placeholder="No active refinements"
                                />
                            </label>
                        </>
                    ) : isGeoMapBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field">
                                <span>Shape</span>
                                <select
                                    className={errorByField.has("geo.shape") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={geo?.shape || "us-states"}
                                    onChange={(event) => setGeoPatch({ shape: event.target.value })}
                                >
                                    {geoShapeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Key field</span>
                                <select
                                    className={errorByField.has("geo.key") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={geo?.key || ""}
                                    onChange={(event) => setGeoPatch({ key: event.target.value })}
                                >
                                    <option value="">{geoDimensionOptions.length === 0 ? "No available breakdowns" : "Select breakdown..."}</option>
                                    {geoDimensionOptions.map((option) => (
                                        <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Label field</span>
                                <select
                                    className={errorByField.has("geo.labelKey") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={geo?.labelKey || ""}
                                    onChange={(event) => setGeoPatch({ labelKey: event.target.value || undefined })}
                                >
                                    <option value="">Use key</option>
                                    {geoDimensionOptions.map((option) => (
                                        <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Metric</span>
                                <select
                                    className={errorByField.has("geo.metric.key") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={geoMetric?.key || ""}
                                    onChange={(event) => applyGeoMetricField(event.target.value)}
                                >
                                    <option value="">{geoMetricOptions.length === 0 ? "No available measures" : "Select measure..."}</option>
                                    {geoMetricOptions.map((option) => (
                                        <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Metric label</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={geoMetric?.label || ""}
                                    onChange={(event) => setGeoMetricPatch({ label: event.target.value })}
                                    placeholder="Available Impressions"
                                />
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Aggregate</span>
                                <select
                                    className={errorByField.has("geo.aggregate") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={geo?.aggregate || "sum"}
                                    onChange={(event) => setGeoPatch({ aggregate: event.target.value })}
                                >
                                    {geoAggregateOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </>
                    ) : isKpiBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field">
                                <span>Value field</span>
                                <select
                                    className={errorByField.has("valueField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={draft?.valueField || ""}
                                    onChange={(event) => applyValueField(event.target.value)}
                                >
                                    <option value="">{valueFieldOptions.length === 0 ? "No available measures" : "Select measure..."}</option>
                                    {valueFieldOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Value label</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.valueLabel || ""}
                                    onChange={(event) => setDraftPatch({ valueLabel: event.target.value })}
                                    placeholder="Available Impressions"
                                />
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Secondary field</span>
                                <select
                                    className={errorByField.has("secondaryField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={draft?.secondaryField || ""}
                                    onChange={(event) => applySecondaryField(event.target.value)}
                                >
                                    <option value="">None</option>
                                    {secondaryFieldOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Secondary label</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.secondaryLabel || ""}
                                    onChange={(event) => setDraftPatch({ secondaryLabel: event.target.value })}
                                    placeholder="Channel"
                                    disabled={!draft?.secondaryField}
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Highlights the current lead KPI for this report."
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Empty state label</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.emptyLabel || ""}
                                    onChange={(event) => setDraftPatch({ emptyLabel: event.target.value })}
                                    placeholder="No KPI value available."
                                />
                            </label>
                        </>
                    ) : isTableBlock ? (
                        <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                            <span>Columns</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {tableColumnOptions.length === 0 ? (
                                    <span style={{ fontSize: 12, color: "#5f6b7c" }}>No available breakdowns or measures are configured for this builder.</span>
                                ) : tableColumnOptions.map((option) => {
                                    const selected = selectedColumnKeys.includes(option.key);
                                    const optionKind = String(option.kind || "").trim();
                                    const canShowDataBar = optionKind === "measure";
                                    const canShowBadge = optionKind === "dimension";
                                    const canShowTone = optionKind === "dimension";
                                    const visualKind = String(columnVisualKinds[option.key] || "");
                                    return (
                                        <div key={option.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                            <button
                                                type="button"
                                                className={[
                                                    "forge-report-builder__dimension-pill",
                                                    selected ? "is-active" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => toggleColumnKey(option.key)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <span className="forge-report-builder__pill-copy">
                                                    <span className="forge-report-builder__pill-text">{option.label}</span>
                                                </span>
                                                {selected ? <span aria-hidden="true">✓</span> : null}
                                            </button>
                                            {selected && (canShowDataBar || canShowBadge || canShowTone) ? (
                                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#486579" }}>
                                                    <span>Visual</span>
                                                    <select
                                                        aria-label={`Visual for ${option.label}`}
                                                        className="forge-report-builder-select"
                                                        value={visualKind}
                                                        onChange={(event) => setColumnVisualKind(option.key, event.target.value)}
                                                    >
                                                        <option value="">None</option>
                                                        {canShowDataBar ? <option value="dataBar">Data bar</option> : null}
                                                        {canShowBadge ? <option value="badge">Badge</option> : null}
                                                        {canShowTone ? <option value="tone">Tone</option> : null}
                                                    </select>
                                                </label>
                                            ) : null}
                                            {selected && (visualKind === "badge" || visualKind === "tone") ? (
                                                <label style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                                                    <span style={{ fontSize: 12, color: "#486579" }}>{visualKind === "tone" ? "Tone rules" : "Badge rules"}</span>
                                                    <textarea
                                                        aria-label={`${visualKind === "tone" ? "Tone" : "Badge"} rules for ${option.label}`}
                                                        className={errorByField.has("columnVisualRuleTexts") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                                        value={String(columnVisualRuleTexts[option.key] || "")}
                                                        onChange={(event) => setColumnVisualRuleText(option.key, event.target.value)}
                                                        rows={4}
                                                        placeholder={'[\n  { "value": "Display", "tone": "info", "label": "Display" }\n]'}
                                                    />
                                                </label>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                            <span>Markdown</span>
                            <textarea
                                className={errorByField.has("markdown") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                value={draft?.markdown || ""}
                                onChange={(event) => setDraftPatch({ markdown: event.target.value })}
                                placeholder={"## Narrative\nAdd authored report context."}
                                rows={5}
                            />
                        </label>
                    )}
                </div>
                <div className="forge-report-builder__calculated-field-hint">
                    {isFilterBarBlock
                        ? <><strong>Filter bar blocks</strong> project the current shared scope parameters into the authored report contract and runtime preview.</>
                        : isRefinementBarBlock
                            ? <><strong>Refinement bar blocks</strong> expose the current drill and keep/exclude trail using the authored report runtime contract.</>
                            : isGeoMapBlock
                                ? <><strong>Geo map blocks</strong> project one available breakdown and one available measure into the authored report geo contract and runtime preview.</>
                        : isKpiBlock
                        ? <><strong>KPI blocks</strong> bind to the current available measures and optional available breakdowns.</>
                        : isTableBlock
                            ? <><strong>Table blocks</strong> project the current available breakdowns and measures into an authored comparison table. Available measure columns can opt into a generic data bar visual.</>
                        : <><strong>Narrative blocks</strong> travel through the same authored ReportDocument, ReportSpec, and ReportFill pipeline as the primary builder content.</>}
                </div>
                {errors.length > 0 ? (
                    <div className="forge-report-builder__chart-errors">
                        {errors.map((entry, index) => (
                            <div key={`${entry.field}_${entry.code}_${index}`} className="forge-report-builder__chart-error">
                                {entry.message}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="forge-report-builder__chart-dialog-actions">
                <Button outlined onClick={onClose}>Cancel</Button>
                <Button intent="primary" onClick={onApply} disabled={!validation?.valid}>
                    {isEditing ? "Apply Changes" : "Add Block"}
                </Button>
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
    buttonLabel = "Quick chart",
    buttonIcon = "timeline-line-chart",
    usePortal = true,
}) {
    if (!canCreate && quickOptions.length === 0) {
        return null;
    }
    const groupedOptions = quickOptions.reduce((acc, option) => {
        const group = String(option?.group || "").trim() || "Other";
        if (!acc[group]) {
            acc[group] = {
                description: "",
                options: [],
            };
        }
        if (!acc[group].description) {
            acc[group].description = String(option?.groupDescription || "").trim();
        }
        acc[group].options.push(option);
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
                            {Object.entries(groupedOptions).map(([group, grouped], groupIndex) => (
                                <React.Fragment key={group}>
                                    {groupIndex > 0 ? <MenuDivider title={group} /> : null}
                                    {groupIndex === 0 ? <MenuDivider title={group} /> : null}
                                    {grouped.description ? (
                                        <div className="forge-report-builder__quick-group-description">
                                            {grouped.description}
                                        </div>
                                    ) : null}
                                    {grouped.options.map((option) => {
                                        const hasPresetMetadata = !!option.eyebrow || (Array.isArray(option.metaItems) && option.metaItems.length > 0);
                                        return (
                                            <MenuItem
                                                key={option.value}
                                                text={(
                                                    <div
                                                        className={[
                                                            "forge-report-builder__quick-option",
                                                            option.kind === "table" ? "forge-report-builder__quick-option--table" : "",
                                                            hasPresetMetadata ? "forge-report-builder__quick-option--featured" : "",
                                                            option.accentTone ? `forge-report-builder__quick-option--${option.accentTone}` : "",
                                                        ].filter(Boolean).join(" ")}
                                                    >
                                                        {option.eyebrow ? (
                                                            <div className="forge-report-builder__quick-option-eyebrow">{option.eyebrow}</div>
                                                        ) : null}
                                                        <div className="forge-report-builder__quick-option-title">{option.label}</div>
                                                        {option.description ? (
                                                            <div className="forge-report-builder__quick-option-description">{option.description}</div>
                                                        ) : null}
                                                        {Array.isArray(option.metaItems) && option.metaItems.length > 0 ? (
                                                            <div className="forge-report-builder__quick-option-highlights">
                                                                {option.metaItems.map((item) => (
                                                                    <span key={item} className="forge-report-builder__quick-option-highlight">{item}</span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )}
                                                onClick={() => onSelectQuickOption(option.value)}
                                            />
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </Menu>
                    )}
                >
                    <Button
                        small
                        className="forge-report-builder__chart-action-button forge-report-builder__chart-action-button--quick"
                        icon={buttonIcon}
                        rightIcon="caret-down"
                    >
                        {buttonLabel}
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
    animated = false,
}) {
    return (
        <div className={[
            "forge-report-builder__result-state",
            tone ? `forge-report-builder__result-state--${tone}` : "",
            animated ? "is-animated" : "",
        ].filter(Boolean).join(" ")}>
            <div
                className={[
                    "forge-report-builder__result-state-icon",
                    animated ? "is-animated" : "",
                ].filter(Boolean).join(" ")}
                aria-hidden="true"
            >
                <span className="forge-report-builder__result-state-icon-glyph">
                    <Icon icon={icon} size={16} />
                </span>
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

export function InlineStaticFilterControl({
    filter,
    value,
    onToggle,
    onDateRange,
    issue = null,
    providerDiagnostics = [],
}) {
    if (!filter) {
        return null;
    }
    const options = Array.isArray(filter.options) ? filter.options : [];
    const activeValues = filter.multiple
        ? (Array.isArray(value) ? value : [])
        : (value == null || value === "" ? [] : [value]);
    const description = String(filter?.description || "").trim();
    const providerDiagnosticsSummary = providerDiagnostics.length > 0
        ? summarizeReportBuilderSemanticDiagnostics(providerDiagnostics)
        : "";
    const semanticNotice = issue?.message || providerDiagnosticsSummary;
    const title = [semanticNotice, description, String(filter?.label || filter?.id || "").trim()]
        .filter(Boolean)
        .join(" — ") || undefined;
    const rootClassName = [
        "forge-report-builder__inline-filter-control",
        filter.type === "dateRange" ? "forge-report-builder__inline-filter-control--date-range" : "",
        issue ? "is-semantic-invalid" : "",
        providerDiagnosticsSummary ? "is-semantic-provider-invalid" : "",
    ].filter(Boolean).join(" ");

    if (filter.type === "dateRange") {
        return (
            <div className={rootClassName} title={title}>
                <div className="forge-report-builder__inline-filter-row">
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
                {description ? <div className="forge-report-builder__inline-filter-description">{description}</div> : null}
                {semanticNotice ? (
                    <div className={`forge-report-builder__inline-filter-description ${issue ? "forge-report-builder__inline-filter-description--danger" : "forge-report-builder__inline-filter-description--warning"}`}>
                        {semanticNotice}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className={rootClassName} title={title}>
            <div className="forge-report-builder__inline-filter-row">
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
            {description ? <div className="forge-report-builder__inline-filter-description">{description}</div> : null}
            {semanticNotice ? (
                <div className={`forge-report-builder__inline-filter-description ${issue ? "forge-report-builder__inline-filter-description--danger" : "forge-report-builder__inline-filter-description--warning"}`}>
                    {semanticNotice}
                </div>
            ) : null}
        </div>
    );
}

export function StaticFilterSection({
    filter,
    context,
    value,
    onToggle,
    onDateRange,
    issue = null,
    providerDiagnostics = [],
}) {
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
    const description = String(filter?.description || "").trim();
    const providerDiagnosticsSummary = Array.isArray(providerDiagnostics) && providerDiagnostics.length > 0
        ? summarizeReportBuilderSemanticDiagnostics(providerDiagnostics)
        : "";
    const semanticNotice = issue?.message || providerDiagnosticsSummary;
    const panelTitle = [semanticNotice, description, String(filter?.label || filter?.id || "").trim()]
        .filter(Boolean)
        .join(" — ") || undefined;

    if (filter.type === "dateRange") {
        return (
            <section className={[
                "forge-report-builder__panel",
                "forge-report-builder__panel--bottom",
                "forge-report-builder__panel--date-range",
                filter.required ? "forge-report-builder__panel--required" : "",
                issue ? "is-semantic-invalid" : "",
                providerDiagnosticsSummary ? "is-semantic-provider-invalid" : "",
            ].filter(Boolean).join(" ")} title={panelTitle}>
                <div className="forge-report-builder__panel-headerline">
                    <div className="forge-report-builder__panel-title">{filter.label || filter.id}</div>
                </div>
                {description ? <div className="forge-report-builder__bottom-description">{description}</div> : null}
                {semanticNotice ? (
                    <div className={`forge-report-builder__bottom-description ${issue ? "forge-report-builder__bottom-description--danger" : "forge-report-builder__bottom-description--warning"}`}>
                        {semanticNotice}
                    </div>
                ) : null}
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
            issue ? "is-semantic-invalid" : "",
            providerDiagnosticsSummary ? "is-semantic-provider-invalid" : "",
        ].filter(Boolean).join(" ")} title={panelTitle}>
            <div className="forge-report-builder__panel-headerline">
                <div className="forge-report-builder__panel-title">{filter.label || filter.id}</div>
            </div>
            {description ? <div className="forge-report-builder__bottom-description">{description}</div> : null}
            {semanticNotice ? (
                <div className={`forge-report-builder__bottom-description ${issue ? "forge-report-builder__bottom-description--danger" : "forge-report-builder__bottom-description--warning"}`}>
                    {semanticNotice}
                </div>
            ) : null}
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
