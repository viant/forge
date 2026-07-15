import React, { useEffect, useMemo, useState } from "react";
import { Button, Dialog, Icon, Menu, MenuDivider, MenuItem, Popover } from "@blueprintjs/core";
import { useSignals } from "@preact/signals-react/runtime";

import LookupSelectionInput from "../lookup/LookupSelectionInput.jsx";
import MarkdownEditor from "../MarkdownEditor.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveReportDatasetRefResolution } from "../../reporting/reportDatasetRefModel.js";
import { resolveKey } from "../../utils/selector.js";
import { REPORT_BUILDER_TABLE_CALC_FUNCTIONS } from "./reportBuilderCalculatedFieldAuthoring.js";
import {
    parseReportBuilderBadgeRuleRows,
    rebindReportBuilderDocumentBlockDraft,
    resolveReportBuilderBadgeRuleRows,
    serializeReportBuilderBadgeRuleRows,
} from "./reportBuilderDocumentBlocks.js";
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
import { placeReportBuilderTableColumnKeyRelative } from "./reportBuilderTableColumnOrder.js";

const REPORT_BUILDER_TABLE_DND_MIME = "application/x-forge-report-builder-table";
const REPORT_BUILDER_FILTER_GROUP_DND_MIME = "application/x-forge-report-builder-filter-group";
const PER_SERIES_DATALABEL_CHOICES = ["auto", "always", "none"];
const PER_SERIES_POINT_COLOR_CHOICES = ["series", "bySign"];

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeFieldOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const value = String(option?.value || option?.key || option?.id || "").trim();
            if (!value || seen.has(value)) {
                return null;
            }
            seen.add(value);
            return {
                value,
                label: String(option?.label || value).trim() || value,
                ...(String(option?.rawId || "").trim() ? { rawId: String(option.rawId).trim() } : {}),
                ...(String(option?.format || "").trim() ? { format: String(option.format).trim() } : {}),
                ...(String(option?.description || "").trim() ? { description: String(option.description).trim() } : {}),
                ...(String(option?.category || "").trim() ? { category: String(option.category).trim() } : {}),
                ...(String(option?.definitionRef || "").trim() ? { definitionRef: String(option.definitionRef).trim() } : {}),
                ...(String(option?.semanticRef || "").trim() ? { semanticRef: String(option.semanticRef).trim() } : {}),
                ...(option?.governance && typeof option.governance === "object" && !Array.isArray(option.governance)
                    ? { governance: JSON.parse(JSON.stringify(option.governance)) }
                    : {}),
            };
        })
        .filter(Boolean);
}

function normalizeTableColumnOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const key = String(option?.key || option?.value || option?.id || "").trim();
            if (!key || seen.has(key)) {
                return null;
            }
            seen.add(key);
            return {
                key,
                ...(String(option?.sourceKey || "").trim() ? { sourceKey: String(option.sourceKey).trim() } : {}),
                ...(String(option?.displayKey || option?.displayPath || "").trim()
                    ? { displayKey: String(option?.displayKey || option?.displayPath).trim() }
                    : {}),
                ...(option?.displayValueMap && typeof option.displayValueMap === "object" && !Array.isArray(option.displayValueMap)
                    ? { displayValueMap: JSON.parse(JSON.stringify(option.displayValueMap)) }
                    : {}),
                ...(String(option?.rawId || "").trim() ? { rawId: String(option.rawId).trim() } : {}),
                label: String(option?.label || key).trim() || key,
                kind: String(option?.kind || "").trim(),
                ...(option?.selected === true ? { selected: true } : {}),
                ...(String(option?.format || "").trim() ? { format: String(option.format).trim() } : {}),
                ...(String(option?.description || "").trim() ? { description: String(option.description).trim() } : {}),
                ...(String(option?.category || "").trim() ? { category: String(option.category).trim() } : {}),
                ...(String(option?.definitionRef || "").trim() ? { definitionRef: String(option.definitionRef).trim() } : {}),
                ...(String(option?.semanticRef || "").trim() ? { semanticRef: String(option.semanticRef).trim() } : {}),
                ...(option?.governance && typeof option.governance === "object" && !Array.isArray(option.governance)
                    ? { governance: JSON.parse(JSON.stringify(option.governance)) }
                    : {}),
            };
        })
        .filter(Boolean);
}

function normalizeScopeParamOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const value = String((option?.value ?? option?.id) || "").trim();
            if (!value || seen.has(value)) {
                return null;
            }
            seen.add(value);
            return {
                value,
                label: String(option?.label || value).trim() || value,
                ...(String(option?.description || "").trim() ? { description: String(option.description).trim() } : {}),
                kind: String(option?.kind || "value").trim() || "value",
                required: option?.required === true,
            };
        })
        .filter(Boolean);
}

function normalizeFilterBarGroupOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const value = String((option?.value ?? option?.id) || "").trim();
            if (!value || seen.has(value)) {
                return null;
            }
            seen.add(value);
            return {
                value,
                label: String(option?.label || value).trim() || value,
                kind: String(option?.kind || "group").trim() || "group",
                ...(String(option?.description || "").trim() ? { description: String(option.description).trim() } : {}),
                required: option?.required === true,
            };
        })
        .filter(Boolean);
}

function resolveDialogScopeParamOptions(selectedDatasetRef = "primary", selectedDatasetOption = null, scopeParamOptions = []) {
    const normalizedDatasetRef = String(selectedDatasetRef || "primary").trim() || "primary";
    if (selectedDatasetOption) {
        const datasetScopedOptions = normalizeScopeParamOptions(selectedDatasetOption?.scopeParamOptions);
        if (datasetScopedOptions.length > 0) {
            return datasetScopedOptions;
        }
    }
    return normalizedDatasetRef === "primary"
        ? normalizeScopeParamOptions(scopeParamOptions)
        : [];
}

function resolveDialogFilterBarGroupOptions(selectedDatasetRef = "primary", selectedDatasetOption = null, scopeParamOptions = [], filterBarGroupOptions = []) {
    const normalizedDatasetRef = String(selectedDatasetRef || "primary").trim() || "primary";
    if (selectedDatasetOption) {
        const datasetScopedOptions = normalizeFilterBarGroupOptions(selectedDatasetOption?.filterBarGroupOptions);
        if (datasetScopedOptions.length > 0) {
            return datasetScopedOptions;
        }
    }
    if (normalizedDatasetRef !== "primary") {
        return normalizeScopeParamOptions(scopeParamOptions).map((option) => ({
            value: option.value,
            label: option.label,
            kind: "scopeParam",
            ...(option.description ? { description: option.description } : {}),
            required: option.required === true,
        }));
    }
    const normalizedPrimaryGroups = normalizeFilterBarGroupOptions(filterBarGroupOptions);
    if (normalizedPrimaryGroups.length > 0) {
        return normalizedPrimaryGroups;
    }
    return normalizeScopeParamOptions(scopeParamOptions).map((option) => ({
        value: option.value,
        label: option.label,
        kind: "scopeParam",
        ...(option.description ? { description: option.description } : {}),
        required: option.required === true,
    }));
}

function normalizeFilterBarBlockMode(value = "") {
    const normalized = String(value || "").trim().toLowerCase();
    return ["baseline", "unified"].includes(normalized) ? normalized : "baseline";
}

function normalizeFilterBarBlockPlacement(value = "") {
    const normalized = String(value || "").trim().toLowerCase();
    return ["inherit", "inline", "rail-left", "hidden"].includes(normalized) ? normalized : "inherit";
}

function parseReportBuilderTableDragPayload(event = null) {
    const dataTransfer = event?.dataTransfer;
    if (!dataTransfer) {
        return null;
    }
    const rawPayload = dataTransfer.getData(REPORT_BUILDER_TABLE_DND_MIME)
        || dataTransfer.getData("text/plain")
        || "";
    if (!rawPayload) {
        return null;
    }
    try {
        const parsed = JSON.parse(rawPayload);
        const columnKey = String(parsed?.columnKey || "").trim();
        const dragKind = String(parsed?.dragKind || "").trim();
        if (!columnKey || !dragKind) {
            return null;
        }
        return {
            columnKey,
            dragKind,
        };
    } catch (_) {
        return null;
    }
}

function parseReportBuilderFilterGroupDragPayload(event = null) {
    const dataTransfer = event?.dataTransfer;
    if (!dataTransfer) {
        return null;
    }
    const rawPayload = dataTransfer.getData(REPORT_BUILDER_FILTER_GROUP_DND_MIME)
        || dataTransfer.getData("text/plain")
        || "";
    if (!rawPayload) {
        return null;
    }
    try {
        const parsed = JSON.parse(rawPayload);
        const groupId = String(parsed?.groupId || "").trim();
        if (!groupId) {
            return null;
        }
        return { groupId };
    } catch (_) {
        return null;
    }
}

export function normalizeDialogDatasetOptions(options = [], requestedDatasetRef = "") {
    const baseOptions = Array.isArray(options)
        ? options
            .map((option) => {
                const value = String(option?.value || "").trim();
                if (!value) {
                    return null;
                }
                const columnOptions = normalizeTableColumnOptions(option?.columnOptions);
                const valueFieldOptions = normalizeFieldOptions(option?.valueFieldOptions);
                const secondaryFieldOptions = normalizeFieldOptions(option?.secondaryFieldOptions);
                const scopeParamOptions = normalizeScopeParamOptions(option?.scopeParamOptions);
                const columnCount = columnOptions.length;
                const measureCount = columnOptions.filter((entry) => entry.kind === "measure").length;
                const dimensionCount = columnOptions.filter((entry) => entry.kind === "dimension").length;
                return {
                    value,
                    label: String(option?.label || value).trim() || value,
                    description: String(option?.description || "").trim(),
                    kindLabel: String(option?.kindLabel || "").trim(),
                    columnOptions,
                    valueFieldOptions,
                    secondaryFieldOptions,
                    scopeParamOptions,
                    ...(option?.scope && typeof option.scope === "object" && !Array.isArray(option.scope)
                        ? { scope: cloneValue(option.scope) }
                        : {}),
                    ...(option?.source && typeof option.source === "object" && !Array.isArray(option.source)
                        ? { source: cloneValue(option.source) }
                        : {}),
                    ...(option?.resultContract && typeof option.resultContract === "object" && !Array.isArray(option.resultContract)
                        ? { resultContract: cloneValue(option.resultContract) }
                        : {}),
                    ...(option?.capabilities && typeof option.capabilities === "object" && !Array.isArray(option.capabilities)
                        ? { capabilities: cloneValue(option.capabilities) }
                        : {}),
                    columnCount,
                    measureCount,
                    dimensionCount,
                    missing: false,
                };
            })
            .filter(Boolean)
        : [];
    const normalizedRequestedDatasetRef = String(requestedDatasetRef || "").trim();
    if (
        normalizedRequestedDatasetRef
        && baseOptions.length > 0
        && !baseOptions.some((option) => option.value === normalizedRequestedDatasetRef)
    ) {
        return [
            {
                value: normalizedRequestedDatasetRef,
                label: `Missing source (${normalizedRequestedDatasetRef})`,
                description: "This authored block is bound to a data source that is no longer available. Choose another source or re-import the missing static dataset.",
                kindLabel: "Missing",
                columnOptions: [],
                valueFieldOptions: [],
                secondaryFieldOptions: [],
                scopeParamOptions: [],
                columnCount: 0,
                measureCount: 0,
                dimensionCount: 0,
                missing: true,
            },
            ...baseOptions,
        ];
    }
    return baseOptions;
}

function resolveDialogDatasetRef(preferredDatasetRef = "", datasetOptions = []) {
    return resolveReportDatasetRefResolution({
        preferredDatasetRef,
        availableDatasetRefs: (Array.isArray(datasetOptions) ? datasetOptions : [])
            .map((option) => normalizeString(option?.value))
            .filter(Boolean),
        fallbackDatasetRef: "primary",
    }).datasetRef;
}

function buildDatasetExecutionSummary(selectedOption = null) {
    const option = selectedOption && typeof selectedOption === "object" && !Array.isArray(selectedOption)
        ? selectedOption
        : null;
    if (!option) {
        return null;
    }
    const source = option?.source && typeof option.source === "object" && !Array.isArray(option.source)
        ? option.source
        : null;
    const resultContract = option?.resultContract && typeof option.resultContract === "object" && !Array.isArray(option.resultContract)
        ? option.resultContract
        : null;
    const capabilities = option?.capabilities && typeof option.capabilities === "object" && !Array.isArray(option.capabilities)
        ? option.capabilities
        : null;
    const scope = option?.scope && typeof option.scope === "object" && !Array.isArray(option.scope)
        ? option.scope
        : null;
    const request = option?.request && typeof option.request === "object" && !Array.isArray(option.request)
        ? option.request
        : null;
    const requestSummary = request
        ? [
            Object.keys(request?.dimensions || {}).length > 0 ? `${Object.keys(request.dimensions).length} dimensions` : "",
            Object.keys(request?.measures || {}).length > 0 ? `${Object.keys(request.measures).length} measures` : "",
            Object.keys(request?.filters || {}).length > 0 ? `${Object.keys(request.filters).length} filters` : "",
        ].map((entry) => String(entry || "").trim()).filter(Boolean).join(" • ")
        : "";
    if (!requestSummary) {
        return null;
    }
    return { requestSummary };
}

function ReportBuilderDatasetPicker({
    label = "Data source",
    datasetOptions = [],
    selectedDatasetRef = "",
    onSelect = null,
    error = false,
}) {
    const normalizedOptions = Array.isArray(datasetOptions) ? datasetOptions : [];
    if (normalizedOptions.length === 0) {
        return null;
    }
    const selectedOption = normalizedOptions.find((option) => option.value === String(selectedDatasetRef || "").trim()) || normalizedOptions[0] || null;
    const interactive = typeof onSelect === "function";
    return (
        <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
            <span>{label}</span>
            <label className="forge-report-builder__dialog-source-select-wrap">
                <select
                    aria-label={label}
                    className={[
                        "forge-report-builder-select",
                        selectedOption?.missing || error ? "is-invalid" : "",
                    ].filter(Boolean).join(" ")}
                    value={selectedOption?.value || ""}
                    onChange={(event) => onSelect?.(event.target.value)}
                    disabled={!interactive || normalizedOptions.length <= 1}
                >
                    {normalizedOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
            {selectedOption?.missing && selectedOption?.description ? (
                <div className="forge-report-builder__quick-option-description">
                    {selectedOption.description}
                </div>
            ) : null}
            {error ? (
                <div className="forge-report-builder__chart-error">Choose an available source for this block.</div>
            ) : null}
        </div>
    );
}

export function buildReportBuilderFieldMetadataSummary(option = null) {
    const normalizedOption = option && typeof option === "object" && !Array.isArray(option)
        ? option
        : null;
    if (!normalizedOption) {
        return null;
    }
    const label = String(normalizedOption?.label || normalizedOption?.value || normalizedOption?.key || "").trim();
    const rawId = String(normalizedOption?.rawId || "").trim();
    const description = String(normalizedOption?.description || "").trim();
    const category = String(normalizedOption?.category || "").trim();
    const definitionRef = String(normalizedOption?.definitionRef || "").trim();
    const semanticRef = String(normalizedOption?.semanticRef || "").trim();
    const format = String(normalizedOption?.format || "").trim();
    const governance = normalizedOption?.governance && typeof normalizedOption.governance === "object" && !Array.isArray(normalizedOption.governance)
        ? normalizedOption.governance
        : {};
    const governanceLabels = buildSemanticFieldGovernanceChipViewModels(governance)
        .map((chip) => String(chip?.label || "").trim())
        .filter(Boolean);
    const chips = [
        category,
        format ? `Format ${format}` : "",
        ...governanceLabels,
    ].filter(Boolean);
    if (!description && !rawId && !definitionRef && !semanticRef && chips.length === 0) {
        return null;
    }
    return {
        label,
        rawId,
        description,
        definitionRef,
        semanticRef,
        chips,
    };
}

function normalizeBadgeItemLabelMode(value = "", { hasExplicitLabel = false } = {}) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "manual" || normalized === "field") {
        return normalized;
    }
    return hasExplicitLabel ? "manual" : "field";
}

export function applyReportBuilderBadgeItemFieldSelection(item = {}, nextValueField = "", fieldOptions = []) {
    const normalizedItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    const normalizedValueField = String(nextValueField || "").trim();
    const matchedOption = normalizeTableColumnOptions(fieldOptions).find((option) => option.key === normalizedValueField) || null;
    const labelMode = normalizeBadgeItemLabelMode(normalizedItem?.labelMode, {
        hasExplicitLabel: !!String(normalizedItem?.label || "").trim(),
    });
    return {
        ...normalizedItem,
        valueField: normalizedValueField,
        format: matchedOption?.format || "",
        ...(labelMode === "field"
            ? { label: matchedOption?.label || "" }
            : {}),
        labelMode,
    };
}

export function resolveReportBuilderBadgeItemFieldLabel(item = {}, fieldOptions = []) {
    const normalizedItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    return applyReportBuilderBadgeItemFieldSelection({
        ...normalizedItem,
        labelMode: "field",
    }, normalizedItem?.valueField || "", fieldOptions);
}

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
        <div
            data-report-builder-semantic-binding="true"
            data-report-builder-semantic-title={title || undefined}
            style={{ display: "grid", gap: 8, marginTop, marginBottom }}
        >
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
    const title = String(summaryState?.scopeSummaryTitle || "Filters").trim();
    const text = String(summaryState?.scopeSummaryText || "").trim();
    if (items.length === 0 || !title) {
        return null;
    }
    return (
        <div
            data-report-builder-scope-summary="true"
            data-report-builder-scope-title={title || undefined}
            style={{ display: "grid", gap: 8, marginTop, marginBottom }}
        >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
                {title}
            </div>
            {text ? (
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "#486579" }}>
                    {text}
                </div>
            ) : null}
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
            ariaLabel: String(entry.ariaLabel || entry.label || "").trim(),
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
                            aria-label={action.ariaLabel}
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
    datasetRef = "primary",
    datasetOptions = [],
    onDatasetRefChange = null,
    onDraftChange,
    onApply,
    supportedTypes = [],
    dimensions = [],
    measures = [],
    validation = { valid: false, errors: [] },
    sanitizeDraftPatch,
    renderChartError,
    dialogTitle = "Create Chart",
    dataSourceLabel = "",
    dataViewLabel = "",
    dataViewDescription = "",
    onAdjustMeasures = null,
    onAdjustBreakdowns = null,
    semanticBindingState = null,
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
    const requestedDatasetRef = String(datasetRef || "").trim();
    const normalizedDatasetOptions = normalizeDialogDatasetOptions(datasetOptions, requestedDatasetRef);
    const selectedDatasetRef = resolveDialogDatasetRef(datasetRef, normalizedDatasetOptions);
    const selectedDatasetOption = normalizedDatasetOptions.find((option) => option.value === selectedDatasetRef) || null;
    const datasetExecutionSummary = buildDatasetExecutionSummary(selectedDatasetOption);
    const [chartFieldSearch, setChartFieldSearch] = useState("");
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
    const normalizedChartFieldSearch = String(chartFieldSearch || "").trim().toLowerCase();
    const visibleDimensions = (Array.isArray(dimensions) ? dimensions : []).filter((entry) => {
        if (!normalizedChartFieldSearch) {
            return true;
        }
        const label = String(entry?.label || entry?.key || "").trim().toLowerCase();
        const key = String(entry?.key || "").trim().toLowerCase();
        return label.includes(normalizedChartFieldSearch) || key.includes(normalizedChartFieldSearch);
    });
    const visibleMeasures = (Array.isArray(measures) ? measures : []).filter((entry) => {
        if (!normalizedChartFieldSearch) {
            return true;
        }
        const label = String(entry?.label || entry?.key || "").trim().toLowerCase();
        const key = String(entry?.key || "").trim().toLowerCase();
        return label.includes(normalizedChartFieldSearch) || key.includes(normalizedChartFieldSearch);
    });
    const selectedMeasureEntries = yFieldList
        .map((measureKey) => (Array.isArray(measures) ? measures : []).find((entry) => entry.key === measureKey) || null)
        .filter(Boolean);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setChartFieldSearch("");
    }, [draft?.title, isOpen, selectedDatasetRef]);

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
            ) : normalizedChartFieldSearch && visibleMeasures.length === 0 ? (
                <div className="forge-report-builder__chart-empty-hint">No measures match the current search.</div>
            ) : null}
            {visibleMeasures.map((entry) => {
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
        const showDataLabels = family === "cartesian" || draftType === "horizontal_bar";
        const showPointColors = family === "cartesian" || draftType === "horizontal_bar";
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
                            {showDataLabels ? <th>Data labels</th> : null}
                            {showPointColors ? <th>Point colors</th> : null}
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
                            const dataLabelsValue = String(option.dataLabels || "").trim();
                            const pointColorModeValue = String(option.pointColorMode || "").trim();
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
                                    {showDataLabels ? (
                                        <td>
                                            <select
                                                className="forge-report-builder-select forge-report-builder-select--compact"
                                                value={dataLabelsValue}
                                                onChange={(event) => setSeriesOption(measureKey, { dataLabels: event.target.value || null })}
                                            >
                                                <option value="">Default</option>
                                                {PER_SERIES_DATALABEL_CHOICES.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option === "auto" ? "Auto" : option === "always" ? "Always" : "Hidden"}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    ) : null}
                                    {showPointColors ? (
                                        <td>
                                            <select
                                                className="forge-report-builder-select forge-report-builder-select--compact"
                                                value={pointColorModeValue}
                                                onChange={(event) => setSeriesOption(measureKey, { pointColorMode: event.target.value || null })}
                                            >
                                                <option value="">Default</option>
                                                {PER_SERIES_POINT_COLOR_CHOICES.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option === "bySign" ? "By sign" : "Series color"}
                                                    </option>
                                                ))}
                                            </select>
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
            title={dialogTitle}
            style={{ width: "min(820px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                {normalizedDatasetOptions.length > 0 || dataSourceLabel || dataViewLabel ? (
                    <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full" style={{ marginBottom: 14 }}>
                        {normalizedDatasetOptions.length > 0 ? (
                            <ReportBuilderDatasetPicker
                                label="Data source"
                                datasetOptions={normalizedDatasetOptions}
                                selectedDatasetRef={selectedDatasetRef}
                                onSelect={onDatasetRefChange}
                                error={errorByField.has("datasetRef")}
                            />
                        ) : dataSourceLabel ? (
                            <div style={{ display: "grid", gap: 6, marginBottom: dataViewLabel ? 12 : 0 }}>
                                <span>Data source</span>
                                <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                    <strong>{dataSourceLabel}</strong>
                                </div>
                            </div>
                        ) : null}
                        {datasetExecutionSummary ? (
                            <div style={{ display: "grid", gap: 6, marginTop: 6, marginBottom: dataViewLabel ? 12 : 0 }}>
                                <span>Source query</span>
                                <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                    {datasetExecutionSummary.requestSummary ? (
                                        <div className="forge-report-builder__quick-option-description">
                                            {datasetExecutionSummary.requestSummary}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                        {dataViewLabel ? (
                            <div style={{ display: "grid", gap: 6 }}>
                                <span>Starter projection</span>
                                <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                    <strong>{dataViewLabel}</strong>
                                    {semanticBindingState ? (
                                        <ReportBuilderSemanticBindingChips
                                            bindingState={semanticBindingState}
                                            marginTop={8}
                                            marginBottom={0}
                                        />
                                    ) : null}
                                    {dataViewDescription ? (
                                        <div className="forge-report-builder__quick-option-description" style={{ marginTop: 6 }}>
                                            {dataViewDescription}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
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
                    <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Search fields</span>
                        <input
                            type="text"
                            className="forge-report-builder-select"
                            value={chartFieldSearch}
                            onChange={(event) => setChartFieldSearch(event.target.value)}
                            placeholder="Filter dimensions and measures"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>{family === "category" ? "Category" : "X-axis"}</span>
                        <select
                            className={errorByField.has("xField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={xFieldValue}
                            onChange={(event) => applyPatch({ xField: event.target.value })}
                        >
                            <option value="">Select…</option>
                            {visibleDimensions.map((entry) => (
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
                                {visibleDimensions.filter((entry) => entry.key !== xFieldValue).map((entry) => (
                                    <option key={entry.key} value={entry.key}>{entry.label}</option>
                                ))}
                            </select>
                        </label>
                    ) : <span />}
                    <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>{isSingleMeasureCategory ? "Measure" : "Measures"}</span>
                        {selectedMeasureEntries.length > 0 ? (
                            <div className="forge-report-builder__dimension-selected" style={{ marginBottom: 8 }}>
                                {selectedMeasureEntries.map((entry) => (
                                    <span key={`selected_${entry.key}`} className="forge-report-builder__result-meta-chip">
                                        {entry.label || entry.key}
                                    </span>
                                ))}
                            </div>
                        ) : null}
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

export function ReportBuilderSourceDialog({
    isOpen = false,
    onClose,
    draft = null,
    onDraftChange,
    onApply,
    errorMessage = "",
    validation = { valid: false, errors: [] },
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
            title="Edit source"
            style={{ width: "min(760px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                <div className="forge-report-builder__chart-dialog-grid">
                    <label className="forge-report-builder__chart-field">
                        <span>Label</span>
                        <input
                            type="text"
                            className={errorByField.has("label") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.label || ""}
                            onChange={(event) => setDraftPatch({ label: event.target.value })}
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Tool</span>
                        <input
                            type="text"
                            className="forge-report-builder-select"
                            value={draft?.toolName || ""}
                            onChange={(event) => setDraftPatch({ toolName: event.target.value })}
                        />
                    </label>
                    <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Description</span>
                        <input
                            type="text"
                            className="forge-report-builder-select"
                            value={draft?.description || ""}
                            onChange={(event) => setDraftPatch({ description: event.target.value })}
                        />
                    </label>
                    <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Request JSON</span>
                        <textarea
                            className={errorByField.has("requestText") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                            rows={6}
                            value={draft?.requestText || ""}
                            onChange={(event) => setDraftPatch({ requestText: event.target.value })}
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Result shape</span>
                        <select
                            className={errorByField.has("resultShape") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.resultShape || "rowSet"}
                            onChange={(event) => setDraftPatch({ resultShape: event.target.value })}
                        >
                            <option value="rowSet">Row set</option>
                            <option value="singleRow">Single row</option>
                        </select>
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Has-more path</span>
                        <input
                            type="text"
                            className={errorByField.has("resultHasMorePath") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.resultHasMorePath || ""}
                            onChange={(event) => setDraftPatch({ resultHasMorePath: event.target.value })}
                            placeholder="page.hasMore"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Row path</span>
                        <input
                            type="text"
                            className={errorByField.has("resultRowPath") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.resultRowPath || ""}
                            onChange={(event) => setDraftPatch({ resultRowPath: event.target.value })}
                            placeholder="payload.records"
                        />
                    </label>
                </div>
                {errors.length > 0 ? (
                    <div className="forge-report-builder__chart-errors">
                        {errors.map((entry, index) => (
                            <div key={`${entry.field || "source"}_${index}`} className="forge-report-builder__chart-error">{entry.message}</div>
                        ))}
                    </div>
                ) : null}
                {normalizeString(errorMessage) ? (
                    <div className="forge-report-builder__chart-errors">
                        <div className="forge-report-builder__chart-error">{normalizeString(errorMessage)}</div>
                    </div>
                ) : null}
            </div>
            <div className="forge-report-builder__chart-dialog-actions">
                <Button outlined onClick={onClose}>Cancel</Button>
                <Button intent="primary" onClick={onApply} disabled={!validation?.valid}>Apply Source</Button>
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
    datasetOptions = [],
    projectionOptions = [],
    scopeParamOptions = [],
    filterBarGroupOptions = [],
    childBlockOptions = [],
    sectionOptions = [],
    isEditing = false,
    dataViewLabel = "",
    dataViewDescription = "",
    onAdjustMeasures = null,
    onAdjustBreakdowns = null,
    semanticBindingState = null,
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
    const isCollectionBlock = normalizedKind === "collectionBlock";
    const isSectionBlock = normalizedKind === "sectionBlock";
    const isCompositeBlock = normalizedKind === "compositeBlock";
    const isTabGroupBlock = normalizedKind === "tabGroupBlock";
    const isStepperBlock = normalizedKind === "stepperBlock";
    const isInfoPanelBlock = normalizedKind === "infoPanelBlock";
    const isCalloutBlock = normalizedKind === "calloutBlock";
    const isKanbanBlock = normalizedKind === "kanbanBlock";
    const isTimelineBlock = normalizedKind === "timelineBlock";
    const isBadgesBlock = normalizedKind === "badgesBlock";
    const isTableBlock = normalizedKind === "tableBlock";
    const isMarkdownBlock = normalizedKind === "markdownBlock";
    const supportsDatasetBinding = isFilterBarBlock || isGeoMapBlock || isKpiBlock || isCollectionBlock || isBadgesBlock || isTableBlock || isMarkdownBlock;
    const geo = draft?.geo && typeof draft.geo === "object" && !Array.isArray(draft.geo)
        ? draft.geo
        : {};
    const geoMetric = geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)
        ? geo.metric
        : {};
    const normalizedBaseTableColumnOptions = normalizeTableColumnOptions(tableColumnOptions);
    const normalizedBaseValueFieldOptions = normalizeFieldOptions(valueFieldOptions);
    const normalizedBaseSecondaryFieldOptions = normalizeFieldOptions(secondaryFieldOptions);
    const normalizedBaseFilterBarGroupOptions = normalizeFilterBarGroupOptions(filterBarGroupOptions);
    const normalizedChildBlockOptions = normalizeFieldOptions(childBlockOptions);
    const normalizedSectionOptions = normalizeFieldOptions(sectionOptions);
    const setDraftPatch = (patch = {}) => {
        if (typeof onDraftChange !== "function") {
            return;
        }
        onDraftChange({
            ...(draft || {}),
            ...(patch || {}),
        });
    };
    const selectedTabSectionIds = Array.isArray(draft?.sectionIds)
        ? draft.sectionIds.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const selectedCompositeChildBlockIds = Array.isArray(draft?.childBlockIds)
        ? draft.childBlockIds.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const toggleCompositeChildBlockId = (blockId = "") => {
        const normalizedBlockId = String(blockId || "").trim();
        if (!normalizedBlockId) {
            return;
        }
        const nextChildBlockIds = selectedCompositeChildBlockIds.includes(normalizedBlockId)
            ? selectedCompositeChildBlockIds.filter((entry) => entry !== normalizedBlockId)
            : [...selectedCompositeChildBlockIds, normalizedBlockId];
        setDraftPatch({ childBlockIds: nextChildBlockIds });
    };
    const moveCompositeChildBlockId = (blockId = "", direction = 0) => {
        const normalizedBlockId = String(blockId || "").trim();
        const normalizedDirection = Number(direction) || 0;
        if (!normalizedBlockId || !normalizedDirection) {
            return;
        }
        const currentIndex = selectedCompositeChildBlockIds.indexOf(normalizedBlockId);
        const nextIndex = currentIndex + normalizedDirection;
        if (currentIndex === -1 || nextIndex < 0 || nextIndex >= selectedCompositeChildBlockIds.length) {
            return;
        }
        const nextChildBlockIds = [...selectedCompositeChildBlockIds];
        nextChildBlockIds[currentIndex] = selectedCompositeChildBlockIds[nextIndex];
        nextChildBlockIds[nextIndex] = selectedCompositeChildBlockIds[currentIndex];
        setDraftPatch({ childBlockIds: nextChildBlockIds });
    };
    const toggleTabSectionId = (sectionId = "") => {
        const normalizedSectionId = String(sectionId || "").trim();
        if (!normalizedSectionId) {
            return;
        }
        const nextSectionIds = selectedTabSectionIds.includes(normalizedSectionId)
            ? selectedTabSectionIds.filter((entry) => entry !== normalizedSectionId)
            : [...selectedTabSectionIds, normalizedSectionId];
        const nextDefaultSectionId = nextSectionIds.includes(String(draft?.defaultSectionId || "").trim())
            ? String(draft?.defaultSectionId || "").trim()
            : String(nextSectionIds[0] || "").trim();
        setDraftPatch({
            sectionIds: nextSectionIds,
            defaultSectionId: nextDefaultSectionId,
        });
    };
    const applyValueField = (value = "") => {
        const normalizedValue = String(value || "").trim();
        const matched = normalizedValueFieldOptions
            .find((option) => String(option?.value || "").trim() === normalizedValue);
        setDraftPatch({
            valueField: normalizedValue,
            valueLabel: matched?.label || normalizedValue,
        });
    };
    const applySecondaryField = (value = "") => {
        const normalizedValue = String(value || "").trim();
        const matched = normalizedSecondaryFieldOptions
            .find((option) => String(option?.value || "").trim() === normalizedValue);
        setDraftPatch({
            secondaryField: normalizedValue,
            secondaryLabel: normalizedValue ? (matched?.label || normalizedValue) : "",
        });
    };
    const selectedColumnKeys = Array.isArray(draft?.columnKeys)
        ? draft.columnKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const selectedColumnKeySet = new Set(selectedColumnKeys);
    const selectedRefinementActionKinds = Array.isArray(draft?.actionKinds)
        ? draft.actionKinds.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const badgeItems = Array.isArray(draft?.items)
        ? draft.items
            .filter((item) => item && typeof item === "object" && !Array.isArray(item))
            .map((item, index) => ({
                id: String(item?.id || `badge_${index + 1}`).trim() || `badge_${index + 1}`,
                label: String(item?.label || "").trim(),
                value: String(item?.value || "").trim(),
                valueField: String(item?.valueField || "").trim(),
                format: String(item?.format || "").trim(),
                labelMode: normalizeBadgeItemLabelMode(item?.labelMode, {
                    hasExplicitLabel: !!String(item?.label || "").trim(),
                }),
                rulesText: String(item?.rulesText || "").trim(),
                rules: resolveReportBuilderBadgeRuleRows(item),
                tone: String(item?.tone || "info").trim() || "info",
            }))
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
        if (selectedColumnKeySet.has(normalizedColumnKey)) {
            setDraftPatch({ columnKeys: selectedColumnKeys.filter((key) => key !== normalizedColumnKey) });
            return;
        }
        setDraftPatch({ columnKeys: [...selectedColumnKeys, normalizedColumnKey] });
    };
    const moveColumnKey = (columnKey = "", direction = 0) => {
        const normalizedColumnKey = String(columnKey || "").trim();
        const normalizedDirection = Number(direction) || 0;
        if (!normalizedColumnKey || !normalizedDirection) {
            return;
        }
        const currentIndex = selectedColumnKeys.indexOf(normalizedColumnKey);
        const nextIndex = currentIndex + normalizedDirection;
        if (currentIndex === -1 || nextIndex < 0 || nextIndex >= selectedColumnKeys.length) {
            return;
        }
        const nextColumnKeys = [...selectedColumnKeys];
        nextColumnKeys[currentIndex] = selectedColumnKeys[nextIndex];
        nextColumnKeys[nextIndex] = selectedColumnKeys[currentIndex];
        setDraftPatch({ columnKeys: nextColumnKeys });
    };
    const placeColumnKeyRelative = (columnKey = "", targetKey = "", placement = "before") => {
        const normalizedColumnKey = String(columnKey || "").trim();
        const normalizedTargetKey = String(targetKey || "").trim();
        const normalizedPlacement = String(placement || "").trim().toLowerCase() === "after"
            ? "after"
            : "before";
        if (!normalizedColumnKey) {
            return;
        }
        const nextColumnKeys = placeReportBuilderTableColumnKeyRelative(
            selectedColumnKeys,
            normalizedColumnKey,
            normalizedTargetKey,
            normalizedPlacement,
        );
        if (nextColumnKeys.join("::") !== selectedColumnKeys.join("::")) {
            setDraftPatch({ columnKeys: nextColumnKeys });
        }
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
    const setBadgeItems = (nextItems = []) => {
        setDraftPatch({
            items: (Array.isArray(nextItems) ? nextItems : [])
                .filter((item) => item && typeof item === "object" && !Array.isArray(item))
                .map((item, index) => ({
                    id: String(item?.id || `badge_${index + 1}`).trim() || `badge_${index + 1}`,
                    label: String(item?.label || "").trim(),
                    value: String(item?.value || "").trim(),
                    valueField: String(item?.valueField || "").trim(),
                    format: String(item?.format || "").trim(),
                    labelMode: normalizeBadgeItemLabelMode(item?.labelMode, {
                        hasExplicitLabel: !!String(item?.label || "").trim(),
                    }),
                    rulesText: String(item?.rulesText || "").trim(),
                    tone: String(item?.tone || "info").trim() || "info",
                })),
        });
    };
    const updateBadgeItem = (itemId = "", patch = {}) => {
        const normalizedItemId = String(itemId || "").trim();
        if (!normalizedItemId) {
            return;
        }
        setBadgeItems(badgeItems.map((item) => (
            item.id === normalizedItemId
                ? {
                    ...item,
                    ...(patch || {}),
                }
                : item
        )));
    };
    const setBadgeItemRules = (itemId = "", nextRules = []) => {
        const normalizedItemId = String(itemId || "").trim();
        if (!normalizedItemId) {
            return;
        }
        const normalizedRules = resolveReportBuilderBadgeRuleRows({ rules: nextRules });
        updateBadgeItem(normalizedItemId, {
            rules: normalizedRules,
            rulesText: serializeReportBuilderBadgeRuleRows(normalizedRules),
        });
    };
    const addBadgeRule = (itemId = "") => {
        const normalizedItemId = String(itemId || "").trim();
        const item = badgeItems.find((entry) => entry.id === normalizedItemId) || null;
        const nextRules = [
            ...(Array.isArray(item?.rules) ? item.rules : []),
            { value: "", label: "", tone: "info" },
        ];
        setBadgeItemRules(normalizedItemId, nextRules);
    };
    const updateBadgeRule = (itemId = "", ruleIndex = 0, patch = {}) => {
        const normalizedItemId = String(itemId || "").trim();
        const item = badgeItems.find((entry) => entry.id === normalizedItemId) || null;
        const nextRules = (Array.isArray(item?.rules) ? item.rules : []).map((rule, index) => (
            index === ruleIndex
                ? {
                    ...rule,
                    ...(patch || {}),
                }
                : rule
        ));
        setBadgeItemRules(normalizedItemId, nextRules);
    };
    const removeBadgeRule = (itemId = "", ruleIndex = 0) => {
        const normalizedItemId = String(itemId || "").trim();
        const item = badgeItems.find((entry) => entry.id === normalizedItemId) || null;
        const nextRules = (Array.isArray(item?.rules) ? item.rules : []).filter((_, index) => index !== ruleIndex);
        setBadgeItemRules(normalizedItemId, nextRules);
    };
    const addBadgeItem = () => {
        setBadgeItems([
            ...badgeItems,
            {
                id: `badge_${badgeItems.length + 1}`,
                label: "",
                value: "",
                valueField: "",
                format: "",
                labelMode: "field",
                rulesText: "",
                tone: "info",
            },
        ]);
    };
    const removeBadgeItem = (itemId = "") => {
        const normalizedItemId = String(itemId || "").trim();
        if (!normalizedItemId) {
            return;
        }
        setBadgeItems(badgeItems.filter((item) => item.id !== normalizedItemId));
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
    const requestedDatasetRef = String(draft?.datasetRef || "").trim();
    const normalizedDatasetOptions = normalizeDialogDatasetOptions(datasetOptions, requestedDatasetRef);
    const normalizedProjectionOptions = Array.isArray(projectionOptions)
        ? projectionOptions
            .map((option) => {
                const value = String(option?.value || "").trim();
                const label = String(option?.label || value).trim();
                const columnKeys = Array.isArray(option?.columnKeys)
                    ? option.columnKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
                    : [];
                if (!value || !label || columnKeys.length === 0) {
                    return null;
                }
                return {
                    value,
                    label,
                    description: String(option?.description || "").trim(),
                    columnKeys,
                };
            })
            .filter(Boolean)
        : [];
    const namedProjectionOptions = normalizedProjectionOptions.filter((option) => option.value !== "__current__");
    const selectedDatasetRef = resolveDialogDatasetRef(draft?.datasetRef, normalizedDatasetOptions);
    const selectedDatasetOption = normalizedDatasetOptions.find((option) => option.value === selectedDatasetRef) || null;
    const datasetExecutionSummary = buildDatasetExecutionSummary(selectedDatasetOption);
    const usesPrimaryDataset = selectedDatasetRef === "primary";
    const datasetTableColumnOptions = Array.isArray(selectedDatasetOption?.columnOptions) && selectedDatasetOption.columnOptions.length > 0
        ? selectedDatasetOption.columnOptions
        : normalizedBaseTableColumnOptions;
    const normalizedValueFieldOptions = Array.isArray(selectedDatasetOption?.valueFieldOptions) && selectedDatasetOption.valueFieldOptions.length > 0
        ? selectedDatasetOption.valueFieldOptions
        : normalizedBaseValueFieldOptions;
    const normalizedSecondaryFieldOptions = Array.isArray(selectedDatasetOption?.secondaryFieldOptions) && selectedDatasetOption.secondaryFieldOptions.length > 0
        ? selectedDatasetOption.secondaryFieldOptions
        : normalizedBaseSecondaryFieldOptions;
    const normalizedScopeParamOptions = resolveDialogScopeParamOptions(
        selectedDatasetRef,
        selectedDatasetOption,
        scopeParamOptions,
    );
    const normalizedFilterBarGroupOptions = resolveDialogFilterBarGroupOptions(
        selectedDatasetRef,
        selectedDatasetOption,
        scopeParamOptions,
        normalizedBaseFilterBarGroupOptions,
    );
    const geoDimensionOptions = datasetTableColumnOptions.filter((option) => String(option?.kind || "").trim() === "dimension");
    const geoMetricOptions = datasetTableColumnOptions.filter((option) => String(option?.kind || "").trim() === "measure");
    const tableBreakdownOptions = datasetTableColumnOptions.filter((option) => String(option?.kind || "").trim() === "dimension");
    const tableMeasureOptions = datasetTableColumnOptions.filter((option) => String(option?.kind || "").trim() === "measure");
    const supportsSharedDataViewHandoff = (isGeoMapBlock || isKpiBlock || isCollectionBlock) && usesPrimaryDataset;
    const unifiedTableFieldOptions = [...tableBreakdownOptions, ...tableMeasureOptions];
    const selectedTableColumnOptions = selectedColumnKeys
        .map((columnKey) => unifiedTableFieldOptions.find((option) => option.key === columnKey))
        .filter(Boolean);
    const starterSelectionColumnKeys = (() => {
        const selectedDefaults = datasetTableColumnOptions
            .filter((option) => option?.selected === true)
            .map((option) => String(option?.key || "").trim())
            .filter(Boolean);
        return selectedDefaults.length > 0
            ? selectedDefaults
            : datasetTableColumnOptions
                .map((option) => String(option?.key || "").trim())
                .filter(Boolean);
    })();
    const matchesProjectionKeys = (projectionColumnKeys = [], currentColumnKeys = []) => {
        const normalizedProjectionKeys = Array.isArray(projectionColumnKeys)
            ? projectionColumnKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
            : [];
        const normalizedCurrentKeys = Array.isArray(currentColumnKeys)
            ? currentColumnKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
            : [];
        if (normalizedProjectionKeys.length !== normalizedCurrentKeys.length) {
            return false;
        }
        const projectionKeySet = new Set(normalizedProjectionKeys);
        return normalizedCurrentKeys.every((key) => projectionKeySet.has(key));
    };
    const matchedProjectionOption = usesPrimaryDataset ? (normalizedProjectionOptions.find((option) => (
        matchesProjectionKeys(option.columnKeys, selectedColumnKeys)
    )) || null) : null;
    const filterBarMode = normalizeFilterBarBlockMode(draft?.mode || "");
    const filterBarPlacement = normalizeFilterBarBlockPlacement(draft?.placement || "") || "inherit";
    const effectiveFilterBarGroupOptions = filterBarMode === "baseline"
        ? normalizedFilterBarGroupOptions.filter((option) => option.kind === "scopeParam")
        : normalizedFilterBarGroupOptions;
    const selectedFilterBarVisibleGroups = Array.isArray(draft?.visibleGroups)
        ? draft.visibleGroups.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const selectedFilterBarGroupOrder = Array.isArray(draft?.groupOrder)
        ? draft.groupOrder.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
    const selectedFilterBarCollapsedGroups = new Set(
        Array.isArray(draft?.collapsedGroups)
            ? draft.collapsedGroups.map((entry) => String(entry || "").trim()).filter(Boolean)
            : [],
    );
    const filterBarGroupOptionIndex = new Map(normalizedFilterBarGroupOptions.map((option) => [option.value, option]));
    const orderedVisibleFilterBarGroups = selectedFilterBarGroupOrder
        .filter((groupId) => selectedFilterBarVisibleGroups.includes(groupId))
        .map((groupId) => filterBarGroupOptionIndex.get(groupId) || null)
        .filter(Boolean);
    const remainingVisibleFilterBarGroups = selectedFilterBarVisibleGroups
        .filter((groupId) => !selectedFilterBarGroupOrder.includes(groupId))
        .map((groupId) => filterBarGroupOptionIndex.get(groupId) || null)
        .filter(Boolean);
    const visibleFilterBarGroupOptions = [...orderedVisibleFilterBarGroups, ...remainingVisibleFilterBarGroups];
    const availableFilterBarGroupOptions = effectiveFilterBarGroupOptions.filter((option) => !selectedFilterBarVisibleGroups.includes(option.value));
    const [draggingFilterBarGroupId, setDraggingFilterBarGroupId] = useState("");
    const applyFilterBarSelection = (nextVisibleGroups = [], nextCollapsedGroups = []) => {
        const visibleGroups = nextVisibleGroups.map((entry) => String(entry || "").trim()).filter(Boolean);
        const collapsedGroups = nextCollapsedGroups.map((entry) => String(entry || "").trim()).filter(Boolean).filter((groupId) => visibleGroups.includes(groupId));
        const paramIds = visibleGroups.filter((groupId) => filterBarGroupOptionIndex.get(groupId)?.kind === "scopeParam");
        setDraftPatch({
            visibleGroups,
            groupOrder: [...visibleGroups],
            collapsedGroups,
            paramIds,
        });
    };
    const addFilterBarGroup = (groupId = "") => {
        const normalizedGroupId = String(groupId || "").trim();
        if (!normalizedGroupId || selectedFilterBarVisibleGroups.includes(normalizedGroupId)) {
            return;
        }
        applyFilterBarSelection([...selectedFilterBarVisibleGroups, normalizedGroupId], Array.from(selectedFilterBarCollapsedGroups));
    };
    const removeFilterBarGroup = (groupId = "") => {
        const normalizedGroupId = String(groupId || "").trim();
        if (!normalizedGroupId) {
            return;
        }
        applyFilterBarSelection(
            selectedFilterBarVisibleGroups.filter((entry) => entry !== normalizedGroupId),
            Array.from(selectedFilterBarCollapsedGroups).filter((entry) => entry !== normalizedGroupId),
        );
    };
    const toggleCollapsedFilterBarGroup = (groupId = "") => {
        const normalizedGroupId = String(groupId || "").trim();
        if (!normalizedGroupId || !selectedFilterBarVisibleGroups.includes(normalizedGroupId)) {
            return;
        }
        const nextCollapsed = selectedFilterBarCollapsedGroups.has(normalizedGroupId)
            ? Array.from(selectedFilterBarCollapsedGroups).filter((entry) => entry !== normalizedGroupId)
            : [...Array.from(selectedFilterBarCollapsedGroups), normalizedGroupId];
        applyFilterBarSelection(selectedFilterBarVisibleGroups, nextCollapsed);
    };
    const moveFilterBarGroupRelative = (groupId = "", targetGroupId = "", placement = "before") => {
        const normalizedGroupId = String(groupId || "").trim();
        const normalizedTargetGroupId = String(targetGroupId || "").trim();
        if (!normalizedGroupId || !normalizedTargetGroupId || normalizedGroupId === normalizedTargetGroupId) {
            return;
        }
        const base = selectedFilterBarVisibleGroups.filter((entry) => entry !== normalizedGroupId);
        const targetIndex = base.indexOf(normalizedTargetGroupId);
        if (targetIndex === -1) {
            return;
        }
        const insertIndex = String(placement || "").trim().toLowerCase() === "after"
            ? targetIndex + 1
            : targetIndex;
        base.splice(insertIndex, 0, normalizedGroupId);
        applyFilterBarSelection(base, Array.from(selectedFilterBarCollapsedGroups));
    };
    const kpiPresentationMode = ["body", "both"].includes(String(draft?.presentationMode || "").trim().toLowerCase())
        ? String(draft.presentationMode).trim().toLowerCase()
        : "card";
    const buildDefaultKpiBodyTemplate = () => {
        const primaryLabel = normalizeString(draft?.valueLabel || draft?.valueField || "Value") || "Value";
        const secondaryLabel = normalizeString(draft?.secondaryLabel || draft?.secondaryField);
        return [
            `**${primaryLabel}:** \${value}`,
            ...(secondaryLabel ? [`**${secondaryLabel}:** \${secondaryValue}`] : []),
        ].join("\n");
    };
    const applyKpiPresentationMode = (value = "card") => {
        const normalizedMode = ["body", "both"].includes(String(value || "").trim().toLowerCase())
            ? String(value).trim().toLowerCase()
            : "card";
        setDraftPatch({
            presentationMode: normalizedMode,
            ...(normalizedMode !== "card" && !String(draft?.bodyTemplate || "").trim()
                ? { bodyTemplate: buildDefaultKpiBodyTemplate() }
                : {}),
        });
    };
    const [tableFieldSearch, setTableFieldSearch] = useState("");
    const [openColumnSettingsColumnKey, setOpenColumnSettingsColumnKey] = useState("");
    const [draggingTableColumnKey, setDraggingTableColumnKey] = useState("");
    const [tableDropTarget, setTableDropTarget] = useState({
        targetKey: "",
        placement: "",
        zone: "",
    });
    useEffect(() => {
        if (!isOpen || !isTableBlock) {
            return;
        }
        setTableFieldSearch("");
        setOpenColumnSettingsColumnKey("");
        setDraggingTableColumnKey("");
        setTableDropTarget({
            targetKey: "",
            placement: "",
            zone: "",
        });
    }, [draft?.id, isOpen, isTableBlock, selectedDatasetRef]);
    const applyProjectionOption = (value = "") => {
        const normalizedValue = String(value || "").trim();
        const matched = normalizedProjectionOptions.find((option) => option.value === normalizedValue) || null;
        if (!matched) {
            return;
        }
        setDraftPatch({ columnKeys: matched.columnKeys });
    };
    const applyCurrentSelection = () => {
        if (starterSelectionColumnKeys.length === 0) {
            return;
        }
        setDraftPatch({ columnKeys: starterSelectionColumnKeys });
    };
    const normalizedTableFieldSearch = String(tableFieldSearch || "").trim().toLowerCase();
    const applyDatasetSelection = (nextDatasetValue = "") => {
        const normalizedDatasetValue = String(nextDatasetValue || "").trim();
        const targetDatasetOption = normalizedDatasetOptions.find((option) => option.value === normalizedDatasetValue) || null;
        const nextDraft = rebindReportBuilderDocumentBlockDraft(draft, {
            datasetRef: normalizedDatasetValue,
            datasetOptions: normalizedDatasetOptions,
            valueFieldOptions: Array.isArray(targetDatasetOption?.valueFieldOptions) ? targetDatasetOption.valueFieldOptions : [],
            secondaryFieldOptions: Array.isArray(targetDatasetOption?.secondaryFieldOptions) ? targetDatasetOption.secondaryFieldOptions : [],
            tableColumnOptions: Array.isArray(targetDatasetOption?.columnOptions) ? targetDatasetOption.columnOptions : [],
            scopeParamOptions: Array.isArray(targetDatasetOption?.scopeParamOptions) ? targetDatasetOption.scopeParamOptions : [],
            filterBarGroupOptions: Array.isArray(targetDatasetOption?.filterBarGroupOptions) ? targetDatasetOption.filterBarGroupOptions : normalizedBaseFilterBarGroupOptions,
        });
        if (typeof onDraftChange === "function" && nextDraft) {
            onDraftChange(nextDraft);
        }
    };
    const filterProjectionFieldOptions = (options = []) => (Array.isArray(options) ? options : []).filter((option) => {
        if (!normalizedTableFieldSearch) {
            return true;
        }
        const label = String(option?.label || option?.key || "").trim().toLowerCase();
        const key = String(option?.key || "").trim().toLowerCase();
        return label.includes(normalizedTableFieldSearch) || key.includes(normalizedTableFieldSearch);
    });
    const startTableDrag = (event, columnKey = "", dragKind = "palette") => {
        const normalizedColumnKey = String(columnKey || "").trim();
        const normalizedDragKind = String(dragKind || "").trim() || "palette";
        if (!normalizedColumnKey || !event?.dataTransfer) {
            return;
        }
        const payload = JSON.stringify({
            columnKey: normalizedColumnKey,
            dragKind: normalizedDragKind,
        });
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(REPORT_BUILDER_TABLE_DND_MIME, payload);
        event.dataTransfer.setData("text/plain", payload);
        setDraggingTableColumnKey(normalizedColumnKey);
    };
    const clearTableDragState = () => {
        setDraggingTableColumnKey("");
        setTableDropTarget({
            targetKey: "",
            placement: "",
            zone: "",
        });
    };
    // dataTransfer payloads are unreadable during dragover, so recognize table
    // drags by the advertised MIME type or the locally tracked drag source.
    const isTableDragEvent = (event) => Array.from(event?.dataTransfer?.types || []).includes(REPORT_BUILDER_TABLE_DND_MIME)
        || !!draggingTableColumnKey;
    const handleTableCanvasDragOver = (event) => {
        if (!isTableDragEvent(event)) {
            return;
        }
        event.preventDefault();
        if (event?.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
        setTableDropTarget((current) => (
            current.zone === "canvas" && !current.targetKey
                ? current
                : { targetKey: "", placement: "after", zone: "canvas" }
        ));
    };
    const handleTableCanvasDragLeave = (event) => {
        if (event?.currentTarget?.contains?.(event?.relatedTarget)) {
            return;
        }
        setTableDropTarget((current) => (
            current.zone
                ? { targetKey: "", placement: "", zone: "" }
                : current
        ));
    };
    const updateTableHeaderDropTarget = (event, targetKey = "") => {
        const normalizedTargetKey = String(targetKey || "").trim();
        if (!normalizedTargetKey || !isTableDragEvent(event)) {
            return "";
        }
        event.preventDefault();
        event.stopPropagation();
        if (event?.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
        const bounds = event.currentTarget?.getBoundingClientRect?.();
        const placement = bounds && Number.isFinite(bounds.left) && Number.isFinite(bounds.width)
            ? ((event.clientX - bounds.left) > (bounds.width / 2) ? "after" : "before")
            : "before";
        setTableDropTarget({
            targetKey: normalizedTargetKey,
            placement,
            zone: "header",
        });
        return placement;
    };
    const handleTableHeaderDrop = (event, targetKey = "") => {
        const placement = updateTableHeaderDropTarget(event, targetKey) || tableDropTarget.placement || "before";
        const payload = parseReportBuilderTableDragPayload(event);
        event.preventDefault();
        event.stopPropagation();
        if (!payload?.columnKey) {
            clearTableDragState();
            return;
        }
        if (payload.columnKey === String(targetKey || "").trim()) {
            clearTableDragState();
            return;
        }
        placeColumnKeyRelative(payload.columnKey, targetKey, placement);
        clearTableDragState();
    };
    const handleTableCanvasDrop = (event) => {
        event.preventDefault();
        const payload = parseReportBuilderTableDragPayload(event);
        if (!payload?.columnKey) {
            clearTableDragState();
            return;
        }
        placeColumnKeyRelative(payload.columnKey, "", "after");
        clearTableDragState();
    };
    const visibleUnifiedTableFieldOptions = filterProjectionFieldOptions(unifiedTableFieldOptions);
    const resolveTableFieldMarker = (option = {}) => {
        if (option?.calculated === true) {
            return { kind: "calculated", icon: "function", title: "Calculated field" };
        }
        const normalizedKind = String(option?.kind || "").trim();
        if (normalizedKind === "dimension") {
            return { kind: "dimension", icon: "tag", title: "Dimension field" };
        }
        if (normalizedKind === "measure") {
            return { kind: "measure", icon: "numerical", title: "Measure field" };
        }
        return { kind: "field", icon: "one-column", title: "Field" };
    };
    const resolveBadgeFieldOption = (valueField = "") => {
        const normalizedValueField = String(valueField || "").trim();
        if (!normalizedValueField) {
            return null;
        }
        return datasetTableColumnOptions.find((option) => option.key === normalizedValueField) || null;
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
                            : isSectionBlock
                                ? "Edit Section Block"
                            : isCompositeBlock
                                ? "Edit Grouped Panel Block"
                            : isTabGroupBlock
                                ? "Edit Section Tabs Block"
                            : isStepperBlock
                                ? "Edit Process Block"
                            : isInfoPanelBlock
                                ? "Edit Info Panel Block"
                            : isCalloutBlock
                                ? "Edit Callout Block"
                            : isKanbanBlock
                                ? "Edit Pipeline Block"
                            : isTimelineBlock
                                ? "Edit Timeline Block"
                            : isCollectionBlock
                                ? "Edit Collection Block"
                            : isBadgesBlock
                                ? "Edit Pills Block"
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
                            : isSectionBlock
                                ? "Add Section Block"
                            : isCompositeBlock
                                ? "Add Grouped Panel Block"
                            : isTabGroupBlock
                                ? "Add Section Tabs Block"
                            : isStepperBlock
                                ? "Add Process Block"
                            : isInfoPanelBlock
                                ? "Add Info Panel Block"
                            : isCalloutBlock
                                ? "Add Callout Block"
                            : isKanbanBlock
                                ? "Add Pipeline Block"
                            : isTimelineBlock
                                ? "Add Timeline Block"
                            : isCollectionBlock
                                ? "Add Collection Block"
                            : isBadgesBlock
                                ? "Add Pills Block"
                            : isTableBlock
                                ? "Add Table Block"
                                : "Add Narrative Block")}
            style={{ width: "min(860px, calc(100vw - 48px))" }}
        >
            <div className="forge-report-builder__chart-dialog">
                <div className="forge-report-builder__chart-dialog-grid">
                    <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Title</span>
                        <input
                            type="text"
                            className={errorByField.has("title") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                            value={draft?.title || ""}
                            onChange={(event) => setDraftPatch({ title: event.target.value })}
                            placeholder={isFilterBarBlock
                                ? "Filters"
                                : isRefinementBarBlock
                                    ? "Active Refinements"
                                    : isGeoMapBlock
                                        ? "Geo Map"
                                        : isKpiBlock
                                            ? "Headline KPI"
                                            : isSectionBlock
                                                ? "Section"
                                            : isCompositeBlock
                                                ? "Grouped Panel"
                                            : isTabGroupBlock
                                                ? "Sections"
                                            : isStepperBlock
                                                ? "Process"
                                                : isInfoPanelBlock
                                                    ? "Info Panel"
                                                    : isCalloutBlock
                                                        ? "Callout"
                                                    : isKanbanBlock
                                                        ? "Pipeline"
                                                        : isTimelineBlock
                                                            ? "Timeline"
                                        : isCollectionBlock
                                            ? "Collection"
                                        : isBadgesBlock
                                            ? "Status Pills"
                                        : isTableBlock
                                            ? "Detail Table"
                                            : "Narrative"}
                        />
                    </label>
                    {supportsDatasetBinding ? (
                        normalizedDatasetOptions.length > 0 ? (
                            <ReportBuilderDatasetPicker
                                label="Data source"
                                datasetOptions={normalizedDatasetOptions}
                                selectedDatasetRef={selectedDatasetRef}
                                onSelect={applyDatasetSelection}
                                error={errorByField.has("datasetRef")}
                            />
                        ) : null
                    ) : null}
                    {supportsDatasetBinding && datasetExecutionSummary ? (
                        <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                            <span>Source query</span>
                            <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                {datasetExecutionSummary.requestSummary ? (
                                    <div className="forge-report-builder__quick-option-description">
                                        {datasetExecutionSummary.requestSummary}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    {supportsSharedDataViewHandoff && dataViewLabel ? (
                        <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                            <span>Starter projection</span>
                            <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                <strong>{dataViewLabel}</strong>
                                {semanticBindingState ? (
                                    <ReportBuilderSemanticBindingChips
                                        bindingState={semanticBindingState}
                                        marginTop={8}
                                        marginBottom={0}
                                    />
                                ) : null}
                                {dataViewDescription ? (
                                    <div className="forge-report-builder__quick-option-description" style={{ marginTop: 6 }}>
                                        {dataViewDescription}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    {isFilterBarBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field">
                                <span>Mode</span>
                                <select
                                    className={errorByField.has("mode") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={filterBarMode}
                                    onChange={(event) => {
                                        const nextMode = normalizeFilterBarBlockMode(event.target.value);
                                        const nextVisibleGroups = nextMode === "baseline"
                                            ? selectedFilterBarVisibleGroups.filter((groupId) => filterBarGroupOptionIndex.get(groupId)?.kind === "scopeParam")
                                            : (selectedFilterBarVisibleGroups.length > 0
                                                ? selectedFilterBarVisibleGroups
                                                : normalizedFilterBarGroupOptions.map((option) => option.value));
                                        const nextCollapsedGroups = Array.from(selectedFilterBarCollapsedGroups).filter((groupId) => nextVisibleGroups.includes(groupId));
                                        const nextParamIds = nextVisibleGroups.filter((groupId) => filterBarGroupOptionIndex.get(groupId)?.kind === "scopeParam");
                                        setDraftPatch({
                                            mode: nextMode,
                                            visibleGroups: nextVisibleGroups,
                                            groupOrder: nextVisibleGroups,
                                            collapsedGroups: nextCollapsedGroups,
                                            paramIds: nextParamIds,
                                        });
                                    }}
                                >
                                    <option value="baseline">Baseline</option>
                                    <option value="unified">Unified</option>
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Placement</span>
                                <select
                                    className={errorByField.has("placement") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={filterBarPlacement}
                                    onChange={(event) => setDraftPatch({ placement: normalizeFilterBarBlockPlacement(event.target.value) })}
                                >
                                    <option value="inherit">Inherit workspace</option>
                                    <option value="inline">Inline</option>
                                    <option value="rail-left">Left rail</option>
                                    <option value="hidden">Hidden</option>
                                </select>
                            </label>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Visible groups</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {visibleFilterBarGroupOptions.length > 0 ? (
                                        <div style={{ display: "grid", gap: 8 }}>
                                            {visibleFilterBarGroupOptions.map((option) => (
                                                <div
                                                    key={option.value}
                                                    draggable
                                                    onDragStart={(event) => {
                                                        const payload = JSON.stringify({ groupId: option.value });
                                                        event.dataTransfer.effectAllowed = "move";
                                                        event.dataTransfer.setData(REPORT_BUILDER_FILTER_GROUP_DND_MIME, payload);
                                                        event.dataTransfer.setData("text/plain", payload);
                                                        setDraggingFilterBarGroupId(option.value);
                                                    }}
                                                    onDragEnd={() => setDraggingFilterBarGroupId("")}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        if (event.dataTransfer) {
                                                            event.dataTransfer.dropEffect = "move";
                                                        }
                                                    }}
                                                    onDrop={(event) => {
                                                        event.preventDefault();
                                                        const payload = parseReportBuilderFilterGroupDragPayload(event);
                                                        if (!payload?.groupId) {
                                                            setDraggingFilterBarGroupId("");
                                                            return;
                                                        }
                                                        moveFilterBarGroupRelative(payload.groupId, option.value, "before");
                                                        setDraggingFilterBarGroupId("");
                                                    }}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                        padding: "10px 12px",
                                                        borderRadius: 12,
                                                        border: draggingFilterBarGroupId === option.value ? "1px solid #93c5fd" : "1px solid #d7e2ee",
                                                        background: draggingFilterBarGroupId === option.value ? "#eef6ff" : "#fbfdff",
                                                    }}
                                                >
                                                    <span style={{ cursor: "grab", color: "#738694", fontSize: 14 }} aria-label={`Drag ${option.label}`}>⋮⋮</span>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 auto" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                            <strong style={{ color: "#183247", fontSize: 12 }}>{option.label}</strong>
                                                            <span className="forge-report-builder__result-meta-chip">{option.kind === "scopeParam" ? "Baseline" : "Unified"}</span>
                                                            {option.required ? <span className="forge-report-builder__result-meta-chip">Required</span> : null}
                                                        </div>
                                                        {option.description ? (
                                                            <span style={{ fontSize: 11, lineHeight: 1.45, color: "#5f6b7c" }}>{option.description}</span>
                                                        ) : null}
                                                    </div>
                                                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#486579" }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!selectedFilterBarCollapsedGroups.has(option.value)}
                                                            onChange={() => toggleCollapsedFilterBarGroup(option.value)}
                                                        />
                                                        Expanded
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="forge-report-builder__table-canvas-icon-btn"
                                                        aria-label={`Remove ${option.label}`}
                                                        onClick={() => removeFilterBarGroup(option.value)}
                                                    >
                                                        <Icon icon="cross" size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: 12, color: "#5f6b7c" }}>
                                            No visible groups selected yet.
                                        </span>
                                    )}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <span style={{ fontSize: 12, color: "#486579" }}>Available groups</span>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            {availableFilterBarGroupOptions.length === 0 ? (
                                                <span style={{ fontSize: 12, color: "#5f6b7c" }}>No additional groups available.</span>
                                            ) : availableFilterBarGroupOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className="forge-report-builder__dimension-pill"
                                                    onClick={() => addFilterBarGroup(option.value)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <span className="forge-report-builder__pill-copy">
                                                        <span className="forge-report-builder__pill-text">{option.label}</span>
                                                    </span>
                                                    <span aria-hidden="true">+</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
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
                    ) : isStepperBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Outline the purpose of this process."
                                />
                            </label>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Steps</span>
                                <div style={{ display: "grid", gap: 10 }}>
                                    {(Array.isArray(draft?.steps) ? draft.steps : []).map((step, index) => (
                                        <div
                                            key={step?.id || `step_${index + 1}`}
                                            style={{
                                                border: "1px solid #d7e2ee",
                                                borderRadius: 12,
                                                padding: 12,
                                                display: "grid",
                                                gap: 8,
                                                background: "#fbfdff",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                <strong style={{ color: "#183247", fontSize: 12 }}>Step {index + 1}</strong>
                                                <Button
                                                    small
                                                    minimal
                                                    icon="trash"
                                                    disabled={(Array.isArray(draft?.steps) ? draft.steps : []).length <= 1}
                                                    onClick={() => {
                                                        const nextSteps = (Array.isArray(draft?.steps) ? draft.steps : []).filter((_, itemIndex) => itemIndex !== index);
                                                        setDraftPatch({ steps: nextSteps });
                                                    }}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                className="forge-report-builder-select"
                                                value={step?.title || ""}
                                                onChange={(event) => {
                                                    const nextSteps = (Array.isArray(draft?.steps) ? draft.steps : []).map((entry, itemIndex) => itemIndex === index
                                                        ? { ...entry, title: event.target.value }
                                                        : entry);
                                                    setDraftPatch({ steps: nextSteps });
                                                }}
                                                placeholder="Step title"
                                            />
                                            <textarea
                                                className="forge-report-builder__calculated-field-textarea"
                                                value={step?.body || ""}
                                                onChange={(event) => {
                                                    const nextSteps = (Array.isArray(draft?.steps) ? draft.steps : []).map((entry, itemIndex) => itemIndex === index
                                                        ? { ...entry, body: event.target.value }
                                                        : entry);
                                                    setDraftPatch({ steps: nextSteps });
                                                }}
                                                placeholder="Describe what happens in this step."
                                                rows={3}
                                            />
                                        </div>
                                    ))}
                                    <Button
                                        small
                                        outlined
                                        icon="add"
                                        onClick={() => {
                                            const nextSteps = [
                                                ...((Array.isArray(draft?.steps) ? draft.steps : [])),
                                                {
                                                    id: `step_${(Array.isArray(draft?.steps) ? draft.steps.length : 0) + 1}`,
                                                    title: "",
                                                    body: "",
                                                    tone: "",
                                                },
                                            ];
                                            setDraftPatch({ steps: nextSteps });
                                        }}
                                    >
                                        Add step
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : isTimelineBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Summarize what this timeline tracks."
                                />
                            </label>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Events</span>
                                <div style={{ display: "grid", gap: 10 }}>
                                    {(Array.isArray(draft?.events) ? draft.events : []).map((event, eventIndex) => (
                                        <div
                                            key={event?.id || `event_${eventIndex + 1}`}
                                            style={{
                                                border: "1px solid #d7e2ee",
                                                borderRadius: 12,
                                                padding: 12,
                                                display: "grid",
                                                gap: 8,
                                                background: "#fbfdff",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                <strong style={{ color: "#183247", fontSize: 12 }}>Event {eventIndex + 1}</strong>
                                                <Button
                                                    small
                                                    minimal
                                                    icon="trash"
                                                    disabled={(Array.isArray(draft?.events) ? draft.events : []).length <= 1}
                                                    onClick={() => {
                                                        const nextEvents = (Array.isArray(draft?.events) ? draft.events : []).filter((_, itemIndex) => itemIndex !== eventIndex);
                                                        setDraftPatch({ events: nextEvents });
                                                    }}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                className="forge-report-builder-select"
                                                value={event?.date || ""}
                                                onChange={(evt) => {
                                                    const nextEvents = (Array.isArray(draft?.events) ? draft.events : []).map((entry, itemIndex) => itemIndex === eventIndex
                                                        ? { ...entry, date: evt.target.value }
                                                        : entry);
                                                    setDraftPatch({ events: nextEvents });
                                                }}
                                                placeholder="Date / marker"
                                            />
                                            <input
                                                type="text"
                                                className="forge-report-builder-select"
                                                value={event?.badge || ""}
                                                onChange={(evt) => {
                                                    const nextEvents = (Array.isArray(draft?.events) ? draft.events : []).map((entry, itemIndex) => itemIndex === eventIndex
                                                        ? { ...entry, badge: evt.target.value }
                                                        : entry);
                                                    setDraftPatch({ events: nextEvents });
                                                }}
                                                placeholder="Badge"
                                            />
                                            <input
                                                type="text"
                                                className="forge-report-builder-select"
                                                value={event?.title || ""}
                                                onChange={(evt) => {
                                                    const nextEvents = (Array.isArray(draft?.events) ? draft.events : []).map((entry, itemIndex) => itemIndex === eventIndex
                                                        ? { ...entry, title: evt.target.value }
                                                        : entry);
                                                    setDraftPatch({ events: nextEvents });
                                                }}
                                                placeholder="Event title"
                                            />
                                            <textarea
                                                className="forge-report-builder__calculated-field-textarea"
                                                value={event?.body || ""}
                                                onChange={(evt) => {
                                                    const nextEvents = (Array.isArray(draft?.events) ? draft.events : []).map((entry, itemIndex) => itemIndex === eventIndex
                                                        ? { ...entry, body: evt.target.value }
                                                        : entry);
                                                    setDraftPatch({ events: nextEvents });
                                                }}
                                                placeholder="Describe this milestone."
                                                rows={3}
                                            />
                                        </div>
                                    ))}
                                    <Button
                                        small
                                        outlined
                                        icon="add"
                                        onClick={() => {
                                            const nextEvents = [
                                                ...((Array.isArray(draft?.events) ? draft.events : [])),
                                                { id: `event_${(Array.isArray(draft?.events) ? draft.events.length : 0) + 1}`, date: "", title: "", body: "", badge: "", tone: "" },
                                            ];
                                            setDraftPatch({ events: nextEvents });
                                        }}
                                    >
                                        Add event
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : isKanbanBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Summarize what this pipeline tracks."
                                />
                            </label>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Lanes</span>
                                <div style={{ display: "grid", gap: 10 }}>
                                    {(Array.isArray(draft?.columns) ? draft.columns : []).map((column, columnIndex) => (
                                        <div
                                            key={column?.id || `column_${columnIndex + 1}`}
                                            style={{
                                                border: "1px solid #d7e2ee",
                                                borderRadius: 12,
                                                padding: 12,
                                                display: "grid",
                                                gap: 8,
                                                background: "#fbfdff",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                <strong style={{ color: "#183247", fontSize: 12 }}>Lane {columnIndex + 1}</strong>
                                                <Button
                                                    small
                                                    minimal
                                                    icon="trash"
                                                    disabled={(Array.isArray(draft?.columns) ? draft.columns : []).length <= 1}
                                                    onClick={() => {
                                                        const nextColumns = (Array.isArray(draft?.columns) ? draft.columns : []).filter((_, itemIndex) => itemIndex !== columnIndex);
                                                        setDraftPatch({ columns: nextColumns });
                                                    }}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                className="forge-report-builder-select"
                                                value={column?.title || ""}
                                                onChange={(event) => {
                                                    const nextColumns = (Array.isArray(draft?.columns) ? draft.columns : []).map((entry, itemIndex) => itemIndex === columnIndex
                                                        ? { ...entry, title: event.target.value }
                                                        : entry);
                                                    setDraftPatch({ columns: nextColumns });
                                                }}
                                                placeholder="Lane title"
                                            />
                                            <div style={{ display: "grid", gap: 8 }}>
                                                {(Array.isArray(column?.cards) ? column.cards : []).map((card, cardIndex) => (
                                                    <div
                                                        key={card?.id || `card_${cardIndex + 1}`}
                                                        style={{
                                                            border: "1px solid #e1e8ef",
                                                            borderRadius: 10,
                                                            padding: 10,
                                                            display: "grid",
                                                            gap: 8,
                                                            background: "#fff",
                                                        }}
                                                    >
                                                        <input
                                                            type="text"
                                                            className="forge-report-builder-select"
                                                            value={card?.badge || ""}
                                                            onChange={(event) => {
                                                                const nextColumns = (Array.isArray(draft?.columns) ? draft.columns : []).map((entry, itemIndex) => itemIndex === columnIndex
                                                                    ? {
                                                                        ...entry,
                                                                        cards: (Array.isArray(entry?.cards) ? entry.cards : []).map((cardEntry, innerIndex) => innerIndex === cardIndex
                                                                            ? { ...cardEntry, badge: event.target.value }
                                                                            : cardEntry),
                                                                    }
                                                                    : entry);
                                                                setDraftPatch({ columns: nextColumns });
                                                            }}
                                                            placeholder="Badge"
                                                        />
                                                        <input
                                                            type="text"
                                                            className="forge-report-builder-select"
                                                            value={card?.title || ""}
                                                            onChange={(event) => {
                                                                const nextColumns = (Array.isArray(draft?.columns) ? draft.columns : []).map((entry, itemIndex) => itemIndex === columnIndex
                                                                    ? {
                                                                        ...entry,
                                                                        cards: (Array.isArray(entry?.cards) ? entry.cards : []).map((cardEntry, innerIndex) => innerIndex === cardIndex
                                                                            ? { ...cardEntry, title: event.target.value }
                                                                            : cardEntry),
                                                                    }
                                                                    : entry);
                                                                setDraftPatch({ columns: nextColumns });
                                                            }}
                                                            placeholder="Card title"
                                                        />
                                                        <textarea
                                                            className="forge-report-builder__calculated-field-textarea"
                                                            value={card?.body || ""}
                                                            onChange={(event) => {
                                                                const nextColumns = (Array.isArray(draft?.columns) ? draft.columns : []).map((entry, itemIndex) => itemIndex === columnIndex
                                                                    ? {
                                                                        ...entry,
                                                                        cards: (Array.isArray(entry?.cards) ? entry.cards : []).map((cardEntry, innerIndex) => innerIndex === cardIndex
                                                                            ? { ...cardEntry, body: event.target.value }
                                                                            : cardEntry),
                                                                    }
                                                                    : entry);
                                                                setDraftPatch({ columns: nextColumns });
                                                            }}
                                                            placeholder="Describe this card."
                                                            rows={3}
                                                        />
                                                    </div>
                                                ))}
                                                <Button
                                                    small
                                                    outlined
                                                    icon="add"
                                                    onClick={() => {
                                                        const nextColumns = (Array.isArray(draft?.columns) ? draft.columns : []).map((entry, itemIndex) => itemIndex === columnIndex
                                                            ? {
                                                                ...entry,
                                                                cards: [
                                                                    ...(Array.isArray(entry?.cards) ? entry.cards : []),
                                                                    { id: `card_${(Array.isArray(entry?.cards) ? entry.cards.length : 0) + 1}`, title: "", body: "", badge: "", tone: "" },
                                                                ],
                                                            }
                                                            : entry);
                                                        setDraftPatch({ columns: nextColumns });
                                                    }}
                                                >
                                                    Add card
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        small
                                        outlined
                                        icon="add"
                                        onClick={() => {
                                            const nextColumns = [
                                                ...((Array.isArray(draft?.columns) ? draft.columns : [])),
                                                { id: `column_${(Array.isArray(draft?.columns) ? draft.columns.length : 0) + 1}`, title: "", tone: "", cards: [{ id: "card_1", title: "", body: "", badge: "", tone: "" }] },
                                            ];
                                            setDraftPatch({ columns: nextColumns });
                                        }}
                                    >
                                        Add lane
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : isInfoPanelBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field">
                                <span>Eyebrow</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.eyebrow || ""}
                                    onChange={(event) => setDraftPatch({ eyebrow: event.target.value })}
                                    placeholder="What is it?"
                                />
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Tone</span>
                                <select
                                    className="forge-report-builder-select"
                                    value={draft?.tone || ""}
                                    onChange={(event) => setDraftPatch({ tone: event.target.value })}
                                >
                                    <option value="">Default</option>
                                    <option value="info">Info</option>
                                    <option value="success">Success</option>
                                    <option value="warning">Warning</option>
                                    <option value="danger">Danger</option>
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Frame the business context for this panel."
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Body</span>
                                <MarkdownEditor
                                    className={errorByField.has("body") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                    value={draft?.body || ""}
                                    onChange={(value) => setDraftPatch({ body: value })}
                                    placeholder={"Explain the concept, context, and next step in reader-friendly language."}
                                    options={{
                                        minHeight: "150px",
                                        textToolbar: true,
                                        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list"],
                                    }}
                                />
                            </label>
                        </>
                    ) : isCalloutBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field">
                                <span>Icon</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.icon || ""}
                                    onChange={(event) => setDraftPatch({ icon: event.target.value })}
                                    placeholder="warning-sign"
                                />
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Tone</span>
                                <select
                                    className="forge-report-builder-select"
                                    value={draft?.tone || ""}
                                    onChange={(event) => setDraftPatch({ tone: event.target.value })}
                                >
                                    <option value="">Info</option>
                                    <option value="success">Success</option>
                                    <option value="warning">Warning</option>
                                    <option value="danger">Danger</option>
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Short framing sentence for the callout."
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Badges</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.badgesText || ""}
                                    onChange={(event) => setDraftPatch({ badgesText: event.target.value })}
                                    placeholder="Launch ready, Executive update"
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Body</span>
                                <MarkdownEditor
                                    className={errorByField.has("body") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                    value={draft?.body || ""}
                                    onChange={(value) => setDraftPatch({ body: value })}
                                    placeholder={"Highlight the business context, risk, or next step in a concise callout."}
                                    options={{
                                        minHeight: "150px",
                                        textToolbar: true,
                                        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list"],
                                    }}
                                />
                            </label>
                        </>
                    ) : isCompositeBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Explain why these blocks belong together."
                                />
                            </label>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Child blocks</span>
                                {normalizedChildBlockOptions.length === 0 ? (
                                    <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                        Add document blocks like narrative, KPI, chart, or table before building a grouped panel.
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {normalizedChildBlockOptions.map((option) => {
                                            const checked = selectedCompositeChildBlockIds.includes(option.value);
                                            return (
                                                <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#314154" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleCompositeChildBlockId(option.value)}
                                                    />
                                                    <span>{option.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                {errorByField.has("childBlockIds") ? (
                                    <div className="forge-report-builder__field-error">
                                        {errorByField.get("childBlockIds")?.message || "Select at least one child block."}
                                    </div>
                                ) : null}
                            </div>
                            {selectedCompositeChildBlockIds.length > 0 ? (
                                <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                    <span>Child order</span>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {selectedCompositeChildBlockIds.map((blockId, index) => {
                                            const option = normalizedChildBlockOptions.find((entry) => entry.value === blockId);
                                            return (
                                                <div key={blockId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", border: "1px solid #d9e2ec", borderRadius: 10, background: "#fbfdff" }}>
                                                    <span style={{ fontSize: 13, color: "#314154" }}>{option?.label || blockId}</span>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button type="button" className="forge-report-builder-button forge-report-builder-button--secondary" onClick={() => moveCompositeChildBlockId(blockId, -1)} disabled={index === 0}>Up</button>
                                                        <button type="button" className="forge-report-builder-button forge-report-builder-button--secondary" onClick={() => moveCompositeChildBlockId(blockId, 1)} disabled={index === selectedCompositeChildBlockIds.length - 1}>Down</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : isTabGroupBlock ? (
                        <>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Sections</span>
                                {normalizedSectionOptions.length === 0 ? (
                                    <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                        Add at least one section block before authoring section tabs.
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {normalizedSectionOptions.map((option) => {
                                            const checked = selectedTabSectionIds.includes(option.value);
                                            return (
                                                <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#314154" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleTabSectionId(option.value)}
                                                    />
                                                    <span>{option.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                {errorByField.has("sectionIds") ? (
                                    <div className="forge-report-builder__field-error">
                                        {errorByField.get("sectionIds")?.message || "Select at least one section."}
                                    </div>
                                ) : null}
                            </div>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Default section</span>
                                <select
                                    className="forge-report-builder-select"
                                    value={draft?.defaultSectionId || ""}
                                    onChange={(event) => setDraftPatch({ defaultSectionId: event.target.value })}
                                >
                                    <option value="">{selectedTabSectionIds.length === 0 ? "Select sections first" : "Choose default section"}</option>
                                    {normalizedSectionOptions
                                        .filter((option) => selectedTabSectionIds.includes(option.value))
                                        .map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                </select>
                            </label>
                        </>
                    ) : isSectionBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Navigation label</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.navigationLabel || ""}
                                    onChange={(event) => setDraftPatch({ navigationLabel: event.target.value })}
                                    placeholder="Overview"
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Subtitle</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.subtitle || ""}
                                    onChange={(event) => setDraftPatch({ subtitle: event.target.value })}
                                    placeholder="A focused section subtitle."
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Explain the purpose of this section."
                                />
                            </label>
                        </>
                    ) : isCollectionBlock ? (
                        <>
                            <label className="forge-report-builder__chart-field">
                                <span>Title field</span>
                                <select
                                    className={errorByField.has("itemTitleField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={draft?.itemTitleField || ""}
                                    onChange={(event) => setDraftPatch({
                                        itemTitleField: event.target.value,
                                        itemTitleLabel: normalizedSecondaryFieldOptions.find((option) => option.value === event.target.value)?.label || event.target.value,
                                    })}
                                >
                                    <option value="">{normalizedSecondaryFieldOptions.length === 0 ? "No available breakdowns" : "Select field..."}</option>
                                    {normalizedSecondaryFieldOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Value field</span>
                                <select
                                    className={errorByField.has("valueField") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                    value={draft?.valueField || ""}
                                    onChange={(event) => applyValueField(event.target.value)}
                                >
                                    <option value="">None</option>
                                    {normalizedValueFieldOptions.map((option) => (
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
                                    {normalizedSecondaryFieldOptions.map((option) => (
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
                            <label className="forge-report-builder__chart-field">
                                <span>Layout</span>
                                <select
                                    className="forge-report-builder-select"
                                    value={String(draft?.layout || "").trim().toLowerCase() === "list" ? "list" : "grid"}
                                    onChange={(event) => setDraftPatch({ layout: event.target.value })}
                                >
                                    <option value="grid">Grid</option>
                                    <option value="list">List</option>
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Grid columns</span>
                                <select
                                    className="forge-report-builder-select"
                                    value={String(draft?.columns || 2)}
                                    onChange={(event) => setDraftPatch({ columns: Number(event.target.value) || 2 })}
                                >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Rows</span>
                                <input
                                    type="number"
                                    min="1"
                                    className="forge-report-builder-select"
                                    value={draft?.rowLimit || 6}
                                    onChange={(event) => setDraftPatch({ rowLimit: Number(event.target.value) || 1 })}
                                />
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Body format</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value="Markdown"
                                    disabled
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Body template</span>
                                <MarkdownEditor
                                    className={errorByField.has("bodyTemplate") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                    value={draft?.bodyTemplate || ""}
                                    onChange={(value) => setDraftPatch({ bodyTemplate: value })}
                                    placeholder={"Render each repeated item using macros like ${value}, ${secondaryValue}, or ${row.fieldName}."}
                                    options={{
                                        minHeight: "150px",
                                        textToolbar: true,
                                        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list"],
                                    }}
                                />
                                <span style={{ fontSize: 12, lineHeight: 1.45, color: "#5f6b7c" }}>
                                    Available macros: {"${value}"}, {"${valueLabel}"}, {"${secondaryValue}"}, {"${secondaryLabel}"}, {"${row.fieldName}"}, {"${dataset.label}"}, {"${primary.avails}"}, {"${fmt.compact(row.avails)}"}, {"${fmt.currency(row.ecpm)}"}, and {"${fmt.percent(row.winRate)}"}.
                                </span>
                                <Button
                                    small
                                    minimal
                                    icon="refresh"
                                    onClick={() => {
                                        if (!String(draft?.bodyTemplate || "").trim()) {
                                            setDraftPatch({ bodyTemplate: buildDefaultCollectionBodyTemplate() });
                                        }
                                    }}
                                >
                                    Seed template
                                </Button>
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Description</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.description || ""}
                                    onChange={(event) => setDraftPatch({ description: event.target.value })}
                                    placeholder="Highlights the leading rows from this dataset."
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Empty state label</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value={draft?.emptyLabel || ""}
                                    onChange={(event) => setDraftPatch({ emptyLabel: event.target.value })}
                                    placeholder="No collection items available."
                                />
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
                                    <option value="">{normalizedValueFieldOptions.length === 0 ? "No available measures" : "Select measure..."}</option>
                                    {normalizedValueFieldOptions.map((option) => (
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
                                    {normalizedSecondaryFieldOptions.map((option) => (
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
                            <label className="forge-report-builder__chart-field">
                                <span>Resolved row</span>
                                <select
                                    className="forge-report-builder-select"
                                    value={normalizeString(draft?.rowSelector).toLowerCase() === "maxbyvalue"
                                        ? "maxbyvalue"
                                        : normalizeString(draft?.rowSelector).toLowerCase() === "minbyvalue"
                                            ? "minbyvalue"
                                            : "firstRow"}
                                    onChange={(event) => setDraftPatch({ rowSelector: event.target.value, bodyFormat: "markdown" })}
                                >
                                    <option value="firstRow">Leading row (current sort/order)</option>
                                    <option value="maxbyvalue">Highest value field</option>
                                    <option value="minbyvalue">Lowest value field</option>
                                </select>
                            </label>
                            <label className="forge-report-builder__chart-field">
                                <span>Body format</span>
                                <input
                                    type="text"
                                    className="forge-report-builder-select"
                                    value="Markdown"
                                    disabled
                                />
                            </label>
                            <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Presentation</span>
                                <select
                                    className="forge-report-builder-select"
                                    value={kpiPresentationMode}
                                    onChange={(event) => applyKpiPresentationMode(event.target.value)}
                                >
                                    <option value="card">Card only (current KPI style)</option>
                                    <option value="body">Body only (narrative KPI)</option>
                                    <option value="both">Card and body</option>
                                </select>
                                <span style={{ fontSize: 12, lineHeight: 1.45, color: "#5f6b7c" }}>
                                    Card mode keeps the familiar KPI tile. Body modes add a Markdown note resolved from the same KPI fields.
                                </span>
                            </label>
                            {kpiPresentationMode !== "card" ? (
                                <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                    <span>Body template</span>
                                    <MarkdownEditor
                                        className={errorByField.has("bodyTemplate") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                        value={draft?.bodyTemplate || ""}
                                        onChange={(value) => setDraftPatch({ bodyTemplate: value })}
                                        placeholder={"Summarize the KPI using macros like ${value}, ${secondaryValue}, or ${row.fieldName}."}
                                        options={{
                                            minHeight: "150px",
                                            textToolbar: true,
                                            toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list"],
                                        }}
                                    />
                                    <span style={{ fontSize: 12, lineHeight: 1.45, color: "#5f6b7c" }}>
                                        Available macros: {"${value}"}, {"${valueLabel}"}, {"${secondaryValue}"}, {"${secondaryLabel}"}, {"${row.fieldName}"}, {"${dataset.label}"}, {"${primary.avails}"}, {"${forecasting_cube_report.avails}"}, {"${fmt.compact(row.avails)}"}, {"${fmt.currency(row.ecpm)}"}, {"${fmt.percent(row.winRate)}"}, and {"${format(row.fieldName,currency})"}.
                                    </span>
                                </label>
                            ) : null}
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
                    ) : isBadgesBlock ? (
                        <>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                                    <span>Pills</span>
                                    <Button small minimal icon="add" onClick={addBadgeItem}>
                                        Add pill
                                    </Button>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {badgeItems.length === 0 ? (
                                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning">
                                            Add at least one pill for this block.
                                        </div>
                                    ) : badgeItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(120px, 0.6fr) minmax(160px, 0.7fr) auto",
                                                gap: 10,
                                                alignItems: "end",
                                                padding: "12px",
                                                border: "1px solid #d7e2ee",
                                                borderRadius: 12,
                                                background: "#fbfdff",
                                            }}
                                        >
                                            <label style={{ display: "grid", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "#486579" }}>Label</span>
                                                <input
                                                    type="text"
                                                    className={errorByField.has("items") ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                                    value={item.label}
                                                    onChange={(event) => updateBadgeItem(item.id, {
                                                        label: event.target.value,
                                                        labelMode: "manual",
                                                    })}
                                                    placeholder={item.valueField && item.labelMode === "field"
                                                        ? "Uses selected field label"
                                                        : `Pill ${index + 1}`}
                                                />
                                            </label>
                                            <label style={{ display: "grid", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "#486579" }}>Field</span>
                                                <select
                                                    className={errorByField.has(`items.${index}.valueField`) ? "forge-report-builder-select is-invalid" : "forge-report-builder-select"}
                                                    value={item.valueField}
                                                    onChange={(event) => updateBadgeItem(
                                                        item.id,
                                                        applyReportBuilderBadgeItemFieldSelection(item, event.target.value, datasetTableColumnOptions),
                                                    )}
                                                >
                                                    <option value="">Static value</option>
                                                    {datasetTableColumnOptions.map((option) => (
                                                        <option key={option.key} value={option.key}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            {item.valueField ? (
                                                <div style={{ display: "grid", gap: 6 }}>
                                                    <span style={{ fontSize: 12, color: "#486579" }}>Label source</span>
                                                    <Button
                                                        small
                                                        minimal
                                                        onClick={() => updateBadgeItem(item.id, resolveReportBuilderBadgeItemFieldLabel(item, datasetTableColumnOptions))}
                                                    >
                                                        {item.labelMode === "field" ? "Using field label" : "Use field label"}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div />
                                            )}
                                            <label style={{ display: "grid", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "#486579" }}>Value</span>
                                                <input
                                                    type="text"
                                                    className="forge-report-builder-select"
                                                    value={item.value}
                                                    onChange={(event) => updateBadgeItem(item.id, { value: event.target.value })}
                                                    placeholder={item.valueField ? "Fallback when no row is available" : "Optional"}
                                                />
                                            </label>
                                            {item.format ? (
                                                <div style={{ display: "grid", gap: 6 }}>
                                                    <span style={{ fontSize: 12, color: "#486579" }}>Format</span>
                                                    <div className="forge-report-builder__result-meta-chip">{item.format}</div>
                                                </div>
                                            ) : (
                                                <div />
                                            )}
                                            <label style={{ display: "grid", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "#486579" }}>Tone</span>
                                                <select
                                                    className="forge-report-builder-select"
                                                    value={item.tone}
                                                    onChange={(event) => updateBadgeItem(item.id, { tone: event.target.value })}
                                                >
                                                    <option value="neutral">Neutral</option>
                                                    <option value="info">Info</option>
                                                    <option value="success">Success</option>
                                                    <option value="warning">Warning</option>
                                                    <option value="danger">Danger</option>
                                                </select>
                                            </label>
                                            <Button
                                                small
                                                minimal
                                                intent="danger"
                                                icon="trash"
                                                aria-label={`Remove pill ${index + 1}`}
                                                onClick={() => removeBadgeItem(item.id)}
                                            />
                                            {item.valueField ? (
                                                <div style={{ display: "grid", gap: 8, gridColumn: "1 / -1" }}>
                                                    {(() => {
                                                        const fieldSummary = buildReportBuilderFieldMetadataSummary(resolveBadgeFieldOption(item.valueField));
                                                        if (!fieldSummary) {
                                                            return null;
                                                        }
                                                        return (
                                                            <div
                                                                style={{
                                                                    border: "1px solid #d7e2ee",
                                                                    borderRadius: 10,
                                                                    background: "#fbfdff",
                                                                    padding: "10px 12px",
                                                                    display: "grid",
                                                                    gap: 6,
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#183247" }}>
                                                                    {fieldSummary.label}
                                                                </div>
                                                                {fieldSummary.chips.length > 0 ? (
                                                                    <div className="forge-report-builder__result-meta" aria-label={`${fieldSummary.label} semantic metadata`}>
                                                                        {fieldSummary.chips.map((chip) => (
                                                                            <span key={`${fieldSummary.label}:${chip}`} className="forge-report-builder__result-meta-chip">{chip}</span>
                                                                        ))}
                                                                    </div>
                                                                ) : null}
                                                                {fieldSummary.rawId ? (
                                                                    <div style={{ fontSize: 11, color: "#486579", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                                                        {fieldSummary.rawId}
                                                                    </div>
                                                                ) : null}
                                                                {fieldSummary.semanticRef ? (
                                                                    <div style={{ fontSize: 11, color: "#486579", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                                                        {fieldSummary.semanticRef}
                                                                    </div>
                                                                ) : null}
                                                                {fieldSummary.definitionRef ? (
                                                                    <div style={{ fontSize: 11, color: "#486579", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: 1.45 }}>
                                                                        {fieldSummary.definitionRef}
                                                                    </div>
                                                                ) : null}
                                                                {fieldSummary.description ? (
                                                                    <div style={{ fontSize: 11, lineHeight: 1.45, color: "#486579" }}>
                                                                        {fieldSummary.description}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })()}
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                                        <span style={{ fontSize: 12, color: "#486579", fontWeight: 600 }}>Display rules</span>
                                                        <Button
                                                            small
                                                            minimal
                                                            icon="add"
                                                            onClick={() => addBadgeRule(item.id)}
                                                        >
                                                            Add rule
                                                        </Button>
                                                    </div>
                                                    {errorByField.has(`items.${index}.rulesText`) ? (
                                                        <div className="forge-report-builder__chart-error">
                                                            {errorByField.get(`items.${index}.rulesText`)?.message}
                                                        </div>
                                                    ) : null}
                                                    {Array.isArray(item.rules) && item.rules.length > 0 ? (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                            {item.rules.map((rule, ruleIndex) => (
                                                                <div
                                                                    key={`${item.id}_rule_${ruleIndex}`}
                                                                    style={{
                                                                        display: "grid",
                                                                        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(160px, 0.7fr) auto",
                                                                        gap: 10,
                                                                        alignItems: "end",
                                                                        padding: "10px",
                                                                        border: "1px solid #d7e2ee",
                                                                        borderRadius: 10,
                                                                        background: "#ffffff",
                                                                    }}
                                                                >
                                                                    <label style={{ display: "grid", gap: 6 }}>
                                                                        <span style={{ fontSize: 12, color: "#486579" }}>Match value</span>
                                                                        <input
                                                                            type="text"
                                                                            className="forge-report-builder-select"
                                                                            value={String(rule?.value ?? "")}
                                                                            onChange={(event) => updateBadgeRule(item.id, ruleIndex, { value: event.target.value })}
                                                                            placeholder="AE"
                                                                        />
                                                                    </label>
                                                                    <label style={{ display: "grid", gap: 6 }}>
                                                                        <span style={{ fontSize: 12, color: "#486579" }}>Display label</span>
                                                                        <input
                                                                            type="text"
                                                                            className="forge-report-builder-select"
                                                                            value={String(rule?.label || "")}
                                                                            onChange={(event) => updateBadgeRule(item.id, ruleIndex, { label: event.target.value })}
                                                                            placeholder="United Arab Emirates"
                                                                        />
                                                                    </label>
                                                                    <label style={{ display: "grid", gap: 6 }}>
                                                                        <span style={{ fontSize: 12, color: "#486579" }}>Tone</span>
                                                                        <select
                                                                            className="forge-report-builder-select"
                                                                            value={String(rule?.tone || "info")}
                                                                            onChange={(event) => updateBadgeRule(item.id, ruleIndex, { tone: event.target.value })}
                                                                        >
                                                                            <option value="neutral">Neutral</option>
                                                                            <option value="info">Info</option>
                                                                            <option value="success">Success</option>
                                                                            <option value="warning">Warning</option>
                                                                            <option value="danger">Danger</option>
                                                                        </select>
                                                                    </label>
                                                                    <Button
                                                                        small
                                                                        minimal
                                                                        intent="danger"
                                                                        icon="trash"
                                                                        aria-label={`Remove rule ${ruleIndex + 1}`}
                                                                        onClick={() => removeBadgeRule(item.id, ruleIndex)}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                                            Add a rule only when a raw field value should map to a friendlier label or tone.
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : isTableBlock ? (
                        <>
                            {selectedDatasetOption?.kindLabel === "missing" || (!usesPrimaryDataset && selectedDatasetOption?.label) ? (
                                <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                    <span>Table projection</span>
                                    <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                                        {selectedDatasetOption?.kindLabel === "missing"
                                            ? selectedDatasetOption.description
                                            : `Build this table from ${selectedDatasetOption.label}.`}
                                    </div>
                                </div>
                            ) : null}
                            {usesPrimaryDataset && namedProjectionOptions.length > 0 ? (
                                <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                    <span>Table projection</span>
                                    {normalizedProjectionOptions.length > 1 ? (
                                        <label style={{ display: "grid", gap: 6 }}>
                                            <span style={{ fontSize: 12, color: "#486579" }}>Starter projection</span>
                                            <select
                                                className="forge-report-builder-select"
                                                value={matchedProjectionOption?.value || "__custom__"}
                                                onChange={(event) => applyProjectionOption(event.target.value)}
                                            >
                                                {matchedProjectionOption?.value === "__current__" ? (
                                                    <option value="__current__">Current builder selection</option>
                                                ) : null}
                                                {!matchedProjectionOption ? (
                                                    <option value="__custom__">Current builder selection</option>
                                                ) : null}
                                                {namedProjectionOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                            {matchedProjectionOption?.description ? (
                                                <span className="forge-report-builder__quick-option-description">{matchedProjectionOption.description}</span>
                                            ) : null}
                                        </label>
                                    ) : matchedProjectionOption?.description ? (
                                        <div className="forge-report-builder__quick-option-description">
                                            {matchedProjectionOption.description}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Table columns</span>
                                <label className="forge-report-builder__table-field-search">
                                    <Icon icon="search" size={12} />
                                    <input
                                        type="text"
                                        aria-label="Search fields"
                                        value={tableFieldSearch}
                                        onChange={(event) => setTableFieldSearch(event.target.value)}
                                        placeholder="Filter fields"
                                    />
                                </label>
                                <div className="forge-report-builder__table-field-list" role="listbox" aria-label="Available fields">
                                    {unifiedTableFieldOptions.length === 0 ? (
                                        <span className="forge-report-builder__chart-empty-hint">No fields are available for this source.</span>
                                    ) : visibleUnifiedTableFieldOptions.length === 0 ? (
                                        <span className="forge-report-builder__chart-empty-hint">No fields match the current search.</span>
                                    ) : (
                                        visibleUnifiedTableFieldOptions.map((option) => {
                                            const selected = selectedColumnKeySet.has(option.key);
                                            const marker = resolveTableFieldMarker(option);
                                            return (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    role="option"
                                                    draggable
                                                    aria-selected={selected}
                                                    data-testid="report-builder-table-field-row"
                                                    data-field-key={option.key}
                                                    className={[
                                                        "forge-report-builder__table-field-row",
                                                        draggingTableColumnKey === option.key ? "is-dragging" : "",
                                                        selected ? "is-selected" : "",
                                                    ].filter(Boolean).join(" ")}
                                                    onDragStart={(event) => startTableDrag(event, option.key, "palette")}
                                                    onDragEnd={clearTableDragState}
                                                    onClick={() => toggleColumnKey(option.key)}
                                                >
                                                    <span
                                                        className={`forge-report-builder__table-field-marker forge-report-builder__table-field-marker--${marker.kind}`}
                                                        title={marker.title}
                                                        aria-label={marker.title}
                                                    >
                                                        <Icon icon={marker.icon} size={12} aria-hidden="true" />
                                                    </span>
                                                    <span className="forge-report-builder__table-field-label">{option.label}</span>
                                                    {selected ? <Icon icon="tick" size={12} /> : null}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                                {selectedTableColumnOptions.length === 0 && starterSelectionColumnKeys.length > 0 ? (
                                    <div className="forge-report-builder__result-header-actions">
                                        <Button small minimal onClick={applyCurrentSelection}>
                                            Apply current fields
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                                <span>Table layout</span>
                                {selectedTableColumnOptions.length === 0 ? (
                                    <div
                                        className={[
                                            "forge-report-builder__table-canvas",
                                            draggingTableColumnKey ? "is-drag-active" : "",
                                            tableDropTarget.zone === "canvas" ? "is-drop-target" : "",
                                        ].filter(Boolean).join(" ")}
                                        data-testid="report-builder-table-canvas-empty"
                                        onDragOver={handleTableCanvasDragOver}
                                        onDragLeave={handleTableCanvasDragLeave}
                                        onDrop={handleTableCanvasDrop}
                                    >
                                        <span className="forge-report-builder__chart-empty-hint">No columns selected yet. Drag fields here or choose fields above to build this table.</span>
                                    </div>
                                ) : (
                                    <div
                                        className={[
                                            "forge-report-builder__table-canvas",
                                            draggingTableColumnKey ? "is-drag-active" : "",
                                            tableDropTarget.zone === "canvas" ? "is-drop-target" : "",
                                        ].filter(Boolean).join(" ")}
                                        data-testid="report-builder-table-canvas"
                                        onDragOver={handleTableCanvasDragOver}
                                        onDragLeave={handleTableCanvasDragLeave}
                                        onDrop={handleTableCanvasDrop}
                                    >
                                        <table>
                                            <thead>
                                                <tr>
                                                    {selectedTableColumnOptions.map((option, index) => {
                                                        const marker = resolveTableFieldMarker(option);
                                                        const hasVisual = !!String(columnVisualKinds[option.key] || "").trim();
                                                        const isDropTarget = tableDropTarget.zone === "header" && tableDropTarget.targetKey === option.key;
                                                        return (
                                                            <th
                                                                key={option.key}
                                                                draggable
                                                                data-testid="report-builder-table-header"
                                                                data-field-key={option.key}
                                                                className={[
                                                                    "forge-report-builder__table-canvas-head",
                                                                    `forge-report-builder__table-canvas-head--${marker.kind}`,
                                                                    draggingTableColumnKey === option.key ? "is-dragging" : "",
                                                                    isDropTarget ? `is-drop-${tableDropTarget.placement || "before"}` : "",
                                                                ].filter(Boolean).join(" ")}
                                                                onDragStart={(event) => startTableDrag(event, option.key, "header")}
                                                                onDragEnd={clearTableDragState}
                                                                onDragOver={(event) => updateTableHeaderDropTarget(event, option.key)}
                                                                onDrop={(event) => handleTableHeaderDrop(event, option.key)}
                                                            >
                                                                <div className="forge-report-builder__table-canvas-head-controls">
                                                                    <button
                                                                        type="button"
                                                                        className="forge-report-builder__table-canvas-icon-btn"
                                                                        aria-label={`Move ${option.label} left`}
                                                                        disabled={index === 0}
                                                                        onClick={() => moveColumnKey(option.key, -1)}
                                                                    >
                                                                        <Icon icon="chevron-left" size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="forge-report-builder__table-canvas-icon-btn"
                                                                        aria-label={`Move ${option.label} right`}
                                                                        disabled={index === selectedTableColumnOptions.length - 1}
                                                                        onClick={() => moveColumnKey(option.key, 1)}
                                                                    >
                                                                        <Icon icon="chevron-right" size={12} />
                                                                    </button>
                                                                    <span
                                                                        className={`forge-report-builder__table-field-marker forge-report-builder__table-field-marker--${marker.kind}`}
                                                                        title={marker.title}
                                                                        aria-label={marker.title}
                                                                    >
                                                                        <Icon icon={marker.icon} size={12} aria-hidden="true" />
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className={[
                                                                            "forge-report-builder__table-canvas-icon-btn",
                                                                            hasVisual ? "is-configured" : "",
                                                                        ].filter(Boolean).join(" ")}
                                                                        aria-label={`${option.label} visual settings`}
                                                                        aria-pressed={openColumnSettingsColumnKey === option.key}
                                                                        onClick={() => setOpenColumnSettingsColumnKey((current) => (current === option.key ? "" : option.key))}
                                                                    >
                                                                        <Icon icon="cog" size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="forge-report-builder__table-canvas-icon-btn"
                                                                        aria-label={`Remove ${option.label}`}
                                                                        onClick={() => toggleColumnKey(option.key)}
                                                                    >
                                                                        <Icon icon="cross" size={12} />
                                                                    </button>
                                                                </div>
                                                                <div className="forge-report-builder__table-canvas-head-label">{option.label}</div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    {selectedTableColumnOptions.map((option) => (
                                                        <td key={option.key} className="forge-report-builder__table-canvas-placeholder-cell">—</td>
                                                    ))}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {(() => {
                                    const openColumnSettingsOption = selectedTableColumnOptions.find((option) => option.key === openColumnSettingsColumnKey) || null;
                                    if (!openColumnSettingsOption) {
                                        return null;
                                    }
                                    const optionKind = String(openColumnSettingsOption.kind || "").trim();
                                    const canShowDataBar = optionKind === "measure";
                                    const canShowProgressBar = optionKind === "measure";
                                    const canShowSparkBar = optionKind === "measure";
                                    const canShowShareBar = optionKind === "measure";
                                    const canShowDelta = optionKind === "measure";
                                    const canShowRank = optionKind === "measure";
                                    const canShowBadge = optionKind === "dimension";
                                    const canShowTone = optionKind === "dimension";
                                    const visualKind = String(columnVisualKinds[openColumnSettingsOption.key] || "");
                                    return (
                                        <div className="forge-report-builder__table-column-settings">
                                            <div className="forge-report-builder__table-column-settings-header">
                                                <span>Visual settings — {openColumnSettingsOption.label}</span>
                                                <button
                                                    type="button"
                                                    className="forge-report-builder__table-canvas-icon-btn"
                                                    aria-label="Close column settings"
                                                    onClick={() => setOpenColumnSettingsColumnKey("")}
                                                >
                                                    <Icon icon="cross" size={12} />
                                                </button>
                                            </div>
                                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#486579" }}>
                                                <span>Visual</span>
                                                <select
                                                    aria-label={`Visual for ${openColumnSettingsOption.label}`}
                                                    className="forge-report-builder-select"
                                                    value={visualKind}
                                                    onChange={(event) => setColumnVisualKind(openColumnSettingsOption.key, event.target.value)}
                                                >
                                                    <option value="">None</option>
                                                    {canShowDataBar ? <option value="dataBar">Data bar</option> : null}
                                                    {canShowProgressBar ? <option value="progressBar">Progress bar</option> : null}
                                                    {canShowSparkBar ? <option value="sparkBar">Spark bar</option> : null}
                                                    {canShowShareBar ? <option value="shareBar">Share bar</option> : null}
                                                    {canShowDelta ? <option value="delta">Delta chip</option> : null}
                                                    {canShowRank ? <option value="rank">Rank chip</option> : null}
                                                    {canShowBadge ? <option value="badge">Badge</option> : null}
                                                    {canShowTone ? <option value="tone">Tone</option> : null}
                                                </select>
                                            </label>
                                            {visualKind === "badge" || visualKind === "tone" || visualKind === "shareBar" ? (
                                                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                    <span style={{ fontSize: 12, color: "#486579" }}>
                                                        {visualKind === "tone" ? "Tone rules" : visualKind === "shareBar" ? "Share segments" : "Badge rules"}
                                                    </span>
                                                    <textarea
                                                        aria-label={`${visualKind === "tone" ? "Tone" : visualKind === "shareBar" ? "Share" : "Badge"} rules for ${openColumnSettingsOption.label}`}
                                                        className={errorByField.has("columnVisualRuleTexts") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                                        value={String(columnVisualRuleTexts[openColumnSettingsOption.key] || "")}
                                                        onChange={(event) => setColumnVisualRuleText(openColumnSettingsOption.key, event.target.value)}
                                                        rows={4}
                                                        placeholder={visualKind === "shareBar"
                                                            ? '[\n  { "valueField": "ctvShare", "label": "CTV", "color": "#137cbd" },\n  { "valueField": "displayShare", "label": "Display", "color": "#0f9960" }\n]'
                                                            : '[\n  { "value": "Example", "tone": "info", "label": "Example" }\n]'}
                                                    />
                                                </label>
                                            ) : null}
                                        </div>
                                    );
                                })()}
                            </div>
                        </>
                    ) : (
                        <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                            <span>Narrative</span>
                            <MarkdownEditor
                                className={errorByField.has("markdown") ? "forge-report-builder__calculated-field-textarea is-invalid" : "forge-report-builder__calculated-field-textarea"}
                                value={draft?.markdown || ""}
                                onChange={(value) => setDraftPatch({ markdown: value })}
                                placeholder="Start with the takeaway, context, and next action."
                                options={{
                                    minHeight: "220px",
                                    textToolbar: true,
                                    toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "preview"],
                                }}
                            />
                            <span style={{ fontSize: 12, lineHeight: 1.45, color: "#5f6b7c", marginTop: 6 }}>
                                Narrative blocks can use data macros like {"${primary.avails}"}, {"${forecasting_cube_report.avails}"}, {"${row.fieldName}"} when a data source is selected, and formatter helpers like {"${fmt.compact(primary.avails)}"}.
                            </span>
                        </label>
                    )}
                </div>
                <div className="forge-report-builder__calculated-field-hint">
                    {isFilterBarBlock
                        ? <><strong>Filter bar blocks</strong> project the current report filters into the authored report contract and runtime preview.</>
                        : isRefinementBarBlock
                            ? <><strong>Refinement bar blocks</strong> expose the current drill and keep/exclude trail using the authored report runtime contract.</>
                            : isGeoMapBlock
                                ? <><strong>Geo map blocks</strong> project one available breakdown and one available measure into the authored report geo contract and runtime preview.</>
                        : isKpiBlock
                        ? <><strong>KPI blocks</strong> bind to the current available measures and optional breakdowns, then can add a Markdown body with friendly macros.</>
                        : isBadgesBlock
                            ? <><strong>Pills blocks</strong> surface compact, dashboard-style status chips for labels, values, and short callouts.</>
                        : isTableBlock
                            ? <><strong>Table blocks</strong> define a report-ready table from selected fields, in column order. Use per-column visual settings only when they improve readability.</>
                        : <><strong>Narrative blocks</strong> let authors write reader-facing context without leaving the report flow.</>}
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
    buttonLabel = "Presets",
    buttonIcon = "timeline-line-chart",
    busy = false,
    busyButtonLabel = "",
    busyStatusMessage = "",
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
                    disabled={!canCreate || busy}
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
                        loading={busy}
                        disabled={busy}
                    >
                        {busy ? (busyButtonLabel || "Applying...") : buttonLabel}
                    </Button>
                </Popover>
            ) : null}
            {busyStatusMessage ? (
                <div className="forge-report-builder__quick-action-status" role="status" aria-live="polite">
                    {busyStatusMessage}
                </div>
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
    const buildDefaultCollectionBodyTemplate = () => {
        const primaryLabel = normalizeString(draft?.valueLabel || draft?.valueField || "Value") || "Value";
        const secondaryLabel = normalizeString(draft?.secondaryLabel || draft?.secondaryField);
        return [
            draft?.itemTitleField ? `## \${row.${draft.itemTitleField}}` : "",
            draft?.valueField ? `**${primaryLabel}:** \${value}` : "",
            ...(secondaryLabel ? [`**${secondaryLabel}:** \${secondaryValue}`] : []),
        ].filter(Boolean).join("\n");
    };
