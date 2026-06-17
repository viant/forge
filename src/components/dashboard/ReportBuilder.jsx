import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, Menu, MenuDivider, MenuItem, Popover, Tooltip } from "@blueprintjs/core";
import { useSignals } from "@preact/signals-react/runtime";

import Chart from "../Chart.jsx";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey } from "../../utils/selector.js";
import { formatDashboardValue } from "./dashboardUtils.js";
import { buildReportTableRuntimeColumns } from "./reportTableCellVisuals.js";
import { renderDashboardTableCell } from "./dashboardVisualUtils.jsx";
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
    resolveResultIdentityChip,
    resolveCompactStatusText,
    resolveCompactSummaryItems,
    resolveTablePresetTransitionText,
} from "./reportBuilderCompactState.js";
import {
    buildReportBuilderDesktopResultState,
    resolveReportBuilderResultDescription,
    resolveReportBuilderResultMetaItems,
    resolveReportBuilderResultTitle,
} from "./reportBuilderResultIdentity.js";
import {
    buildReportBuilderDesktopResultHeaderState,
} from "./reportBuilderResultHeader.js";
import {
    buildReportBuilderActionModel,
} from "./reportBuilderActionModel.js";
import {
    buildReportBuilderCompactChartSheetState,
} from "./reportBuilderCompactChartSheet.js";
import {
    buildReportBuilderCompactBottomBarActions,
} from "./reportBuilderCompactBottomBar.js";
import {
    buildReportBuilderPresetApplyFeedback,
    resolveCompactChartSheetNotice,
} from "./reportBuilderFeedback.js";
import {
    resolveReportBuilderStateReadiness,
} from "./reportBuilderReadiness.js";
import {
    buildIdleReportBuilderSemanticValidationState,
    resolveReportBuilderSemanticValidationSettledState,
    resolveReportBuilderSemanticValidationStateTransition,
} from "./reportBuilderSemanticValidationState.js";
import ReportRuntime from "./ReportRuntime.jsx";
import {
    buildReportBuilderRuntimePreview,
    buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";
import {
    buildReportBuilderAuthoredCapabilityViewModel,
} from "./reportBuilderAuthoredCapabilities.js";
import {
    resolveReportBuilderRuntimePreviewRowsSource,
} from "./reportBuilderRuntimePreviewSource.js";
import {
    buildReportBuilderCompileDiagnosticsNotice,
    buildReportBuilderEmptyResultState,
    buildReportBuilderRuntimePreviewBlockedState,
    resolveReportBuilderActiveResultState,
} from "./reportBuilderResultFrame.js";
import {
    buildReportBuilderChartPlaceholderState,
    resolveReportBuilderResultVisibility,
} from "./reportBuilderResultVisibility.js";
import {
    buildReportBuilderChartQueryRequest,
    getReportBuilderChartDataPolicy,
    resolveReportBuilderChartCollection,
    resolveReportBuilderExportCollection,
} from "./reportBuilderResultData.js";
import {
    buildRejectedReportBuilderChartQueryState,
    buildResolvedReportBuilderChartQueryState,
    resolveReportBuilderChartQueryStateTransition,
} from "./reportBuilderChartQueryState.js";
import {
    buildReportRuntimePreviewRequestKey,
    useReportRuntimePreviewRows,
} from "./useReportRuntimePreviewRows.js";
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
    ReportBuilderCalculatedFieldDialog,
    ReportBuilderDocumentBlockDialog,
    ReportBuilderTableCalculationDialog,
    ReportBuilderChartDialog,
    ReportBuilderChartQuickActions,
    ReportBuilderCompactSheetTab,
    ReportBuilderOverflowActions,
    ReportBuilderResultState,
    StaticFilterSection,
} from "./reportBuilderComponents.jsx";
import { mergeReportBuilderReopenedConfig } from "./reportBuilderConfigMerge.js";
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
    clearReportBuilderGroupByWhenMissing,
    buildReportBuilderDefaultChartSpecs,
    buildReportBuilderDefaultTablePresets,
    buildReportBuilderQuickViewOptions,
    buildReportBuilderDefaultState,
    applyReportBuilderFilterAliases,
    getReportBuilderQuickPresetPolicy,
    buildReportBuilderRequest,
    buildReportBuilderSettingsHash,
    prepareReportBuilderAutoChartApplication,
    getReportBuilderResultPanePosition,
    getSelectableReportBuilderMeasures,
    getTableCalculationReportBuilderMeasures,
    getReportBuilderSupportedChartTypes,
    getVisibleReportBuilderDimensions,
    isExplicitReportBuilderChartMode,
    isReportBuilderChartSpecStale,
    mergeReportBuilderState,
    normalizeDynamicGroupRows,
    normalizeReportBuilderChartSpec,
    prepareReportBuilderChartApplication,
    prepareReportBuilderTableCalculationApplication,
    prepareReportBuilderTablePresetApplication,
    projectManualSelection,
    projectLookupSelections,
    removeDynamicFilterRow,
    resolveReportBuilderRailFilterState,
    resolveReportBuilderDimensionDisplayKey,
    resolveReportBuilderMeasure,
    sanitizeReportBuilderState,
    shouldAutoCollapseReportBuilderFilters,
    updateDynamicFilterRow,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";
import {
    buildReportBuilderCalculatedFieldConfig,
    buildReportBuilderCalculatedFieldDraft,
    buildReportBuilderCalculatedFieldReferenceOptions,
    buildReportBuilderTableCalculationDraft,
    buildReportBuilderTableCalculationFieldOptions,
    removeReportBuilderLocalCalculatedFieldState,
    removeReportBuilderLocalTableCalculationState,
    upsertReportBuilderLocalCalculatedFieldState,
    upsertReportBuilderLocalTableCalculationDraftState,
    upsertReportBuilderLocalTableCalculationState,
    validateReportBuilderCalculatedFieldDraft,
    validateReportBuilderTableCalculationDraft,
} from "./reportBuilderCalculatedFieldAuthoring.js";
import {
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderDocumentCompileValidation,
    buildReportBuilderDocumentBlockDiagnostics,
    buildReportBuilderDocumentBlockDraft,
    buildReportBuilderDocumentBlockFieldOptions,
    duplicateReportBuilderDocumentBlockState,
    moveReportBuilderDocumentBlockState,
    normalizeReportBuilderDocumentLayoutState,
    removeReportBuilderDocumentBlockState,
    resolveReportBuilderDocumentWidthLabels,
    resizeReportBuilderDocumentBlockState,
    resolveReportBuilderDocumentBlockList,
    summarizeReportBuilderDocumentMarkdown,
    upsertReportBuilderDocumentBlockState,
    validateReportBuilderDocumentBlockDraft,
} from "./reportBuilderDocumentBlocks.js";
import {
    instantiateReportBuilderDocumentTemplate,
    normalizeReportBuilderDocumentTemplates,
} from "./reportBuilderDocumentTemplates.js";
import {
    beginReportBuilderExplorationSession,
    buildReportBuilderExplorationBannerState,
    discardReportBuilderExplorationState,
    keepReportBuilderExplorationState,
    isReportBuilderExplorationActive,
    normalizeReportBuilderExplorationState,
    recordReportBuilderExplorationHistory,
    redoReportBuilderExplorationState,
    undoReportBuilderExplorationState,
} from "./reportBuilderExplorationSession.js";
import {
    buildReportBuilderExplorationArtifact,
    buildReportBuilderExplorationArtifactDownload,
    buildReportBuilderExplorationArtifactInspectorState,
    buildReportBuilderExplorationArtifactSummary,
} from "./reportBuilderExplorationArtifact.js";
import {
    buildReportBuilderSavedReportPayload,
    buildReportBuilderSavedReportPayloadDownload,
    buildReportBuilderSavedReportPayloadInspectorState,
    buildReportBuilderSavedReportPayloadRecord,
    buildReportBuilderSavedReportPayloadSummary,
} from "./reportBuilderSavedReportPayload.js";
import {
    resolveReportBuilderExportHandler,
} from "./reportBuilderExportRequest.js";
import {
    buildReportBuilderSavedReportState,
} from "./reportBuilderSavedReportState.js";
import {
    buildReportBuilderExportFailureNotice,
} from "./reportBuilderExportLifecycle.js";
import {
    useReportBuilderExportExecution,
} from "./useReportBuilderExportExecution.js";
import {
    buildReportBuilderCreateReportDocumentPayload,
    buildReportBuilderCreateReportDocumentPayloadFromBuilderState,
    buildReportBuilderCreateReportDocumentPayloadDownload,
    buildReportBuilderCreateReportDocumentPayloadInspectorState,
    buildReportBuilderCreateReportDocumentPayloadSummary,
} from "./reportBuilderCreateReportDocumentPayload.js";
import {
    buildReportBuilderUpdateReportDocumentExpectedVersionState,
    buildReportBuilderUpdateReportDocumentPayload,
    buildReportBuilderUpdateReportDocumentPayloadFromBuilderState,
    buildReportBuilderUpdateReportDocumentPayloadDownload,
    buildReportBuilderUpdateReportDocumentPayloadInspectorState,
    buildReportBuilderUpdateReportDocumentPayloadSummary,
} from "./reportBuilderUpdateReportDocumentPayload.js";
import {
    buildReportBuilderUpdateReportDocumentConflictDiagnostic,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary,
    buildReportBuilderUpdateReportDocumentConflictVersionState,
} from "./reportBuilderUpdateReportDocumentConflictDiagnostic.js";
import {
    buildReportBuilderDocumentVersionState,
    buildReportBuilderGetReportDocumentResponse,
    buildReportBuilderGetReportDocumentResponseFromBuilderState,
    buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState,
    buildReportBuilderSelectedGetReportDocumentResponse,
    buildReportBuilderGetReportDocumentResponseSummary,
    buildReportBuilderListReportDocumentsEntrySummary,
    buildReportBuilderListReportDocumentsResponse,
    buildReportBuilderListReportDocumentsResponseFromBuilderState,
    buildReportBuilderListReportDocumentsResponseSummary,
    buildReportBuilderReportDocumentReadResponseInspectorState,
    buildReportBuilderReportDocumentReadResponseDownload,
    serializeReportBuilderReportDocumentReadResponse,
} from "./reportBuilderReportDocumentReadResponse.js";
import {
    buildReportBuilderGetReportDocumentRequest,
    buildReportBuilderGetReportDocumentRequestDownload,
    buildReportBuilderGetReportDocumentRequestInspectorState,
    buildReportBuilderGetReportDocumentRequestSummary,
} from "./reportBuilderGetReportDocumentRequest.js";
import {
    applyReportBuilderHydratedDocumentSessionState,
    buildHydratedReportBuilderDocument,
    buildReportBuilderHydratedDocumentSession,
    resolveReportBuilderHydratedDocumentSessionFromState,
    setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction,
    stripReportBuilderHydratedDocumentSessionState,
} from "./reportBuilderHydratedReportDocument.js";
import {
    buildReportBuilderHydratedReportDocumentDiagnostic,
    buildReportBuilderHydratedReportDocumentDiagnosticDownload,
    buildReportBuilderHydratedReportDocumentDiagnosticInspectorState,
    buildReportBuilderHydratedReportDocumentDiagnosticSummary,
    buildReportBuilderListReportDocumentsEntryDiagnostic,
} from "./reportBuilderHydratedReportDocumentDiagnostic.js";
import { resolveReportRuntimeChartSelectionSummary } from "./reportRuntimeChartActionModel.js";
import {
    buildReportBuilderSemanticDiagnosticTargets,
    buildReportBuilderSemanticDiagnosticsNotice,
    buildReportBuilderSemanticFieldValidation,
    buildReportBuilderSemanticGovernanceNotice,
    buildReportBuilderSemanticRuntimeDiagnostics,
    buildReportBuilderSemanticStatus,
    resolveSemanticGovernanceBadges,
    resolveSemanticGovernanceOptionLabel,
    summarizeReportBuilderSemanticDiagnostics,
    semanticFieldTitle,
} from "./reportBuilderSemantic.js";
import { normalizeReportBuilderDrillMetadata } from "../../reporting/reportBuilderDrillMetadata.js";
import { normalizeReportRuntimeInteractionState } from "./reportRuntimeInteractionStateModel.js";
import { useReportRuntimeInteractionState } from "./useReportRuntimeInteractionState.js";
import { useAuthoredRuntimePreviewSurface } from "./useAuthoredRuntimePreviewSurface.js";
import {
    buildReportBuilderSemanticModelReloadKey,
} from "./useReportBuilderSemanticModelState.js";
import { useReportBuilderSemanticRuntimeState } from "./useReportBuilderSemanticRuntimeState.js";

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

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneReportBuilderValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
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

function countEffectiveDynamicSelections(rows = []) {
    return (Array.isArray(rows) ? rows : []).reduce((total, row) => (
        row?.enabled === false
            ? total
            : total + (Array.isArray(row?.selections) ? row.selections.length : 0)
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

function humanizeReportBuilderTableCalculationType(type = "") {
    const normalized = String(type || "").trim().toLowerCase();
    return {
        percentoftotal: "Percent of total",
        deltafromprevious: "Delta from previous",
        runningtotal: "Running total",
        movingaverage: "Moving average",
        rank: "Dense rank",
    }[normalized] || "Table calculation";
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

function renderSemanticGovernanceBadges(field = {}, { compact = false } = {}) {
    const badges = resolveSemanticGovernanceBadges(field);
    if (badges.length === 0) {
        return null;
    }
    return (
        <span className={compact ? "forge-report-builder__pill-badges forge-report-builder__pill-badges--compact" : "forge-report-builder__pill-badges"}>
            {badges.map((badge) => (
                <span key={badge.id} className={`forge-report-builder__pill-badge forge-report-builder__pill-badge--${badge.tone || "neutral"}`}>
                    {badge.label}
                </span>
            ))}
        </span>
    );
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
const REPORT_BUILDER_LEFT_RAIL_WIDTH_PREFIX = "reportBuilder.leftRailWidth";
const DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT = 24;
const MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT = 20;
const MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT = 32;

function clampReportBuilderLeftRailWidthPercent(value = DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT;
    }
    return Math.min(
        MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT,
        Math.max(MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT, numeric),
    );
}

function leftRailWidthStorageKey(storageScope = "") {
    const normalized = String(storageScope || "").trim() || "reportBuilder";
    return `${REPORT_BUILDER_LEFT_RAIL_WIDTH_PREFIX}.${normalized}`;
}

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

function loadStoredReportBuilderLeftRailWidthPercent(storageScope = "", legacyScopes = []) {
    if (typeof window === "undefined" || !window.localStorage) {
        return DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT;
    }
    try {
        const scopes = Array.from(new Set([storageScope, ...(Array.isArray(legacyScopes) ? legacyScopes : [legacyScopes])]
            .map((entry) => String(entry || "").trim())));
        if (scopes.length === 0) {
            scopes.push("");
        }
        for (const scope of scopes) {
            const raw = window.localStorage.getItem(leftRailWidthStorageKey(scope));
            if (!raw) {
                continue;
            }
            const decoded = JSON.parse(raw);
            const parsed = Number(decoded);
            if (decoded !== null && Number.isFinite(parsed) && parsed > 0) {
                return clampReportBuilderLeftRailWidthPercent(parsed);
            }
        }
    } catch (_) {}
    return DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT;
}

function persistStoredReportBuilderLeftRailWidthPercent(storageScope = "", percent = DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT, legacyScopes = []) {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        const normalizedPercent = clampReportBuilderLeftRailWidthPercent(percent);
        window.localStorage.setItem(leftRailWidthStorageKey(storageScope), JSON.stringify(normalizedPercent));
        Array.from(new Set((Array.isArray(legacyScopes) ? legacyScopes : [legacyScopes])
            .map((entry) => String(entry || "").trim())
            .filter((entry) => entry && entry !== String(storageScope || "").trim()))).forEach((scope) => {
            window.localStorage.removeItem(leftRailWidthStorageKey(scope));
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

function reportBuilderDocumentBlockIcon(kind = "") {
    switch (String(kind || "").trim()) {
        case "filterBarBlock":
            return "filter";
        case "refinementBarBlock":
            return "changes";
        case "geoMapBlock":
            return "map";
        case "chartBlock":
            return "timeline-line-chart";
        case "kpiBlock":
            return "dashboard";
        case "tableBlock":
            return "th";
        default:
            return "annotation";
    }
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

function resolveReportDocumentMetadataTitle(state = {}, container = {}, config = {}) {
    return String(
        state?.reportDocumentTitle
        || container?.title
        || config?.title
        || "Report",
    ).trim() || "Report";
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

const AUTHORED_BLOCKS_HINT = "Authored blocks persist through saved payloads, reopened documents, and runtime preview.";

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
    const baseConfig = getBuilderConfig(container);
    const builderContext = container?.dataSourceRef && typeof context?.Context === "function"
        ? context.Context(container.dataSourceRef)
        : context;
    const reportExportHandler = useMemo(
        () => resolveReportBuilderExportHandler(builderContext),
        [builderContext?.handlers?.reportExport],
    );
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
    const hydratedReportDocumentSession = useMemo(
        () => resolveReportBuilderHydratedDocumentSessionFromState(effectivePersistedState),
        [effectivePersistedState],
    );
    const config = useMemo(
        () => mergeReportBuilderReopenedConfig(baseConfig, hydratedReportDocumentSession?.reopenedConfig || null),
        [baseConfig, hydratedReportDocumentSession?.reopenedConfig],
    );
    const filterPresentation = String(
        config?.filterPresentation
        || config?.layout?.filterPresentation
        || ""
    ).trim().toLowerCase();
    const useFilterRail = filterPresentation === "rail-left";
    const useFilterDrawer = filterPresentation === "drawer-left";
    const currentPrefillSignature = prefillSignature(windowFormValue);
    const state = useMemo(() => mergeReportBuilderState(config, effectivePersistedState), [config, effectivePersistedState]);
    const currentBuilderStateRef = useRef(state);
    currentBuilderStateRef.current = state;
    const effectivePersistedStateRef = useRef(effectivePersistedState);
    effectivePersistedStateRef.current = effectivePersistedState;
    const semanticBinding = state?.binding;
    const semanticModelReloadKey = useMemo(
        () => buildReportBuilderSemanticModelReloadKey(hydratedReportDocumentSession),
        [hydratedReportDocumentSession],
    );
    const {
        semanticModelProvider,
        semanticModelState,
        semanticDisplayConfig,
        semanticValidationRequest,
        semanticValidationFingerprint,
        resolvedSemanticSummary,
    } = useReportBuilderSemanticRuntimeState({
        builderContext,
        config,
        state,
        binding: semanticBinding,
        configSemanticModel: config?.semanticModel || null,
        reloadKey: semanticModelReloadKey,
        fallbackSummary: hydratedReportDocumentSession?.reopenedSemanticSummary || null,
        fallbackFingerprint: hydratedReportDocumentSession?.reopenedSemanticFingerprint || "",
    });
    const displayConfig = useMemo(
        () => buildReportBuilderCalculatedFieldConfig(semanticDisplayConfig, state),
        [semanticDisplayConfig, state?.localCalculatedFields, state?.localTableCalculations],
    );
    const resultPanePosition = useMemo(() => getReportBuilderResultPanePosition(displayConfig), [displayConfig]);
    const semanticStatus = useMemo(() => buildReportBuilderSemanticStatus({
        binding: semanticBinding,
        providerAvailable: !!semanticModelProvider,
        loading: semanticModelState.loading,
        error: semanticModelState.error,
        model: semanticModelState.model,
    }), [semanticBinding, semanticModelProvider, semanticModelState.error, semanticModelState.loading, semanticModelState.model]);
    const semanticFieldValidation = useMemo(() => buildReportBuilderSemanticFieldValidation({
        config: displayConfig,
        state,
        binding: semanticBinding,
        model: semanticModelState.model,
    }), [displayConfig, semanticBinding, semanticModelState.model, state]);
    const semanticValidationRequestRef = useRef(semanticValidationRequest);
    semanticValidationRequestRef.current = semanticValidationRequest;
    const [semanticValidationRetrySequence, setSemanticValidationRetrySequence] = useState(0);
    const semanticValidationRequestKey = useMemo(
        () => (semanticValidationFingerprint ? `${semanticValidationFingerprint}::${semanticValidationRetrySequence}` : ""),
        [semanticValidationFingerprint, semanticValidationRetrySequence],
    );
    const [semanticSelectionValidationState, setSemanticSelectionValidationState] = useState(buildIdleReportBuilderSemanticValidationState);
    const semanticSelectionValidationStateRef = useRef(semanticSelectionValidationState);
    semanticSelectionValidationStateRef.current = semanticSelectionValidationState;
    const semanticFieldValidationCanRun = semanticFieldValidation ? semanticFieldValidation.canRun : true;
    useEffect(() => {
        const currentValidationState = semanticSelectionValidationStateRef.current;
        const currentSemanticValidationRequest = semanticValidationRequestRef.current;
        const validationTransition = resolveReportBuilderSemanticValidationStateTransition({
            bindingMode: semanticBinding?.mode,
            providerAvailable: !!semanticModelProvider,
            hasValidationRequest: !!currentSemanticValidationRequest,
            semanticModelState,
            semanticStatusLevel: semanticStatus?.level,
            semanticFieldValidationCanRun,
            currentState: currentValidationState,
            validationFingerprint: semanticValidationFingerprint,
            validationRequestKey: semanticValidationRequestKey,
        });
        if (validationTransition.type === "reset") {
            setSemanticSelectionValidationState(validationTransition.nextState);
            return;
        }
        if (validationTransition.type !== "start") {
            return;
        }
        let cancelled = false;
        setSemanticSelectionValidationState(validationTransition.nextState);
        if (!currentSemanticValidationRequest) {
            return () => {
                cancelled = true;
            };
        }
        semanticModelProvider.validateSelection(
            currentSemanticValidationRequest.modelRef,
            currentSemanticValidationRequest.selection,
        )
            .then((payload) => {
                if (cancelled) {
                    return;
                }
                setSemanticSelectionValidationState((current) => resolveReportBuilderSemanticValidationSettledState({
                    currentState: current,
                    fingerprint: semanticValidationFingerprint,
                    requestKey: semanticValidationRequestKey,
                    payload,
                }));
            })
            .catch((error) => {
                if (cancelled) {
                    return;
                }
                setSemanticSelectionValidationState((current) => resolveReportBuilderSemanticValidationSettledState({
                    currentState: current,
                    fingerprint: semanticValidationFingerprint,
                    requestKey: semanticValidationRequestKey,
                    error,
                }));
            });
        return () => {
            cancelled = true;
        };
    }, [
        semanticBinding?.mode,
        semanticFieldValidationCanRun,
        semanticModelProvider,
        semanticModelState.error,
        semanticModelState.loading,
        semanticStatus?.level,
        semanticValidationFingerprint,
        semanticValidationRequestKey,
    ]);
    const retrySemanticValidation = React.useCallback(() => {
        if (!semanticValidationFingerprint) {
            return;
        }
        setSemanticValidationRetrySequence((current) => current + 1);
    }, [semanticValidationFingerprint]);
    const resolveStateReadiness = React.useCallback((nextState = state) => resolveReportBuilderStateReadiness({
        config: displayConfig,
        state: nextState,
        semanticModelProvider,
        semanticModelState,
        semanticSelectionValidationState,
        semanticRetryAvailable: String(semanticSelectionValidationState?.error || "").trim() !== ""
            && String(semanticSelectionValidationState?.fingerprint || "").trim() === semanticValidationFingerprint,
    }), [displayConfig, semanticModelProvider, semanticModelState, semanticSelectionValidationState, semanticValidationFingerprint, state]);
    const readiness = useMemo(() => resolveStateReadiness(state), [resolveStateReadiness, state]);
    const canRunReport = readiness.canRun;
    const requestFingerprintRef = useRef("");
    const lastManualRunFingerprintRef = useRef("");
    const lastAutoCollapsedRunSequenceRef = useRef(0);
    const lastSeededRailFilterCollapseFingerprintRef = useRef("");
    const lastAutoAppliedChartCycleRef = useRef("");
    const filterOverlayScrollRestoreRef = useRef(0);
    const filterOverlayWasOpenRef = useRef(false);
    const seededDefaultsRef = useRef(false);
    const appliedPrefillSignatureRef = useRef("");
    const hydrationFingerprintRef = useRef("");
    const storedStateHydrationFingerprintRef = useRef("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [chartDialogOpen, setChartDialogOpen] = useState(false);
    const [chartDraft, setChartDraft] = useState(null);
    const [authoredChartBlockDialogOpen, setAuthoredChartBlockDialogOpen] = useState(false);
    const [authoredChartBlockDraft, setAuthoredChartBlockDraft] = useState(null);
    const [editingAuthoredChartBlockId, setEditingAuthoredChartBlockId] = useState("");
    const [calculatedFieldDialogOpen, setCalculatedFieldDialogOpen] = useState(false);
    const [calculatedFieldDraft, setCalculatedFieldDraft] = useState(() => buildReportBuilderCalculatedFieldDraft());
    const [editingCalculatedFieldId, setEditingCalculatedFieldId] = useState("");
    const [documentBlockDialogOpen, setDocumentBlockDialogOpen] = useState(false);
    const [documentBlockDraft, setDocumentBlockDraft] = useState(() => buildReportBuilderDocumentBlockDraft("markdownBlock"));
    const [editingDocumentBlockId, setEditingDocumentBlockId] = useState("");
    const [tableCalculationDialogOpen, setTableCalculationDialogOpen] = useState(false);
    const [tableCalculationDraft, setTableCalculationDraft] = useState(() => buildReportBuilderTableCalculationDraft());
    const [editingTableCalculationId, setEditingTableCalculationId] = useState("");
    const [chartQueryState, setChartQueryState] = useState({
        fingerprint: "",
        rows: [],
        loading: false,
        error: null,
    });
    const [storedChartPresets, setStoredChartPresets] = useState([]);
    const [selectedQuickChartOption, setSelectedQuickChartOption] = useState("");
    const [selectedBuilderChartSelection, setSelectedBuilderChartSelection] = useState(null);
    const [savedExplorationArtifact, setSavedExplorationArtifact] = useState(null);
    const [savedExplorationRuntimeArtifact, setSavedExplorationRuntimeArtifact] = useState(null);
    const [savedExplorationArtifactOpen, setSavedExplorationArtifactOpen] = useState(false);
    const [savedReportPayload, setSavedReportPayload] = useState(null);
    const [savedReportPayloadRecord, setSavedReportPayloadRecord] = useState(null);
    const [savedReportPayloadOpen, setSavedReportPayloadOpen] = useState(false);
    const [createReportDocumentPayload, setCreateReportDocumentPayload] = useState(null);
    const [createReportDocumentPayloadOpen, setCreateReportDocumentPayloadOpen] = useState(false);
    const [reportDocumentVersionDraft, setReportDocumentVersionDraft] = useState("");
    const [getReportDocumentResponse, setGetReportDocumentResponse] = useState(null);
    const [getReportDocumentResponseOpen, setGetReportDocumentResponseOpen] = useState(false);
    const [reopenReportDocumentDiagnostic, setReopenReportDocumentDiagnostic] = useState(null);
    const [reopenReportDocumentDiagnosticOpen, setReopenReportDocumentDiagnosticOpen] = useState(false);
    const [listReportDocumentsResponse, setListReportDocumentsResponse] = useState(null);
    const [listReportDocumentsResponseOpen, setListReportDocumentsResponseOpen] = useState(false);
    const [listReportDocumentsSelectedReportId, setListReportDocumentsSelectedReportId] = useState("");
    const [getReportDocumentRequestPayload, setGetReportDocumentRequestPayload] = useState(null);
    const [getReportDocumentRequestPayloadOpen, setGetReportDocumentRequestPayloadOpen] = useState(false);
    const [updateReportDocumentExpectedVersionDraft, setUpdateReportDocumentExpectedVersionDraft] = useState("");
    const [updateReportDocumentPayload, setUpdateReportDocumentPayload] = useState(null);
    const [updateReportDocumentPayloadOpen, setUpdateReportDocumentPayloadOpen] = useState(false);
    const [updateReportDocumentCurrentVersionDraft, setUpdateReportDocumentCurrentVersionDraft] = useState("");
    const [updateReportDocumentConflictDiagnostic, setUpdateReportDocumentConflictDiagnostic] = useState(null);
    const [updateReportDocumentConflictDiagnosticOpen, setUpdateReportDocumentConflictDiagnosticOpen] = useState(false);
    const [chartApplyFeedback, setChartApplyFeedback] = useState(null);
    const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
    const [manualRunSequence, setManualRunSequence] = useState(0);
    const [pendingScrollRowId, setPendingScrollRowId] = useState("");
    const builderRootRef = useRef(null);
    const leftRailRef = useRef(null);
    const [builderWidth, setBuilderWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 0));
    const [leftRailWidthPercent, setLeftRailWidthPercent] = useState(() => (
        loadStoredReportBuilderLeftRailWidthPercent(stateStorageScope, legacyStateStorageScopes)
    ));
    const [leftRailViewportHeight, setLeftRailViewportHeight] = useState(0);
    const [leftRailResizing, setLeftRailResizing] = useState(false);
    const [leftRailCanScrollDown, setLeftRailCanScrollDown] = useState(false);
    const leftRailResizeCleanupRef = useRef(null);
    const [reportDocumentCollapsed, setReportDocumentCollapsed] = useState(false);
    const [measuresCollapsed, setMeasuresCollapsed] = useState(false);
    const [authoredBlocksCollapsed, setAuthoredBlocksCollapsed] = useState(false);
    const [compactSheetOpen, setCompactSheetOpen] = useState(false);
    const [compactSheetTab, setCompactSheetTab] = useState("scope");
    const [compactChartSheetOpen, setCompactChartSheetOpen] = useState(false);

    const compactBreakpoint = useMemo(() => {
        const raw = Number(config?.layout?.compactBreakpoint || config?.compactBreakpoint || 820);
        return Number.isFinite(raw) && raw > 0 ? raw : 820;
    }, [config]);
    const compactMode = builderWidth > 0 && builderWidth <= compactBreakpoint;
    const measureLeftRailViewportHeight = React.useCallback(() => {
        if (compactMode || typeof window === "undefined") {
            return;
        }
        const node = leftRailRef.current;
        if (!node) {
            return;
        }
        const rect = node.getBoundingClientRect();
        let bottomBoundary = Number(window.innerHeight || 0) || 0;
        let ancestor = node.parentElement;
        while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
            const style = window.getComputedStyle(ancestor);
            const overflowY = String(style.overflowY || "").trim().toLowerCase();
            const overflow = String(style.overflow || "").trim().toLowerCase();
            const clipsViewport = ["auto", "scroll", "hidden", "clip"].includes(overflowY)
                || ["auto", "scroll", "hidden", "clip"].includes(overflow);
            if (clipsViewport) {
                const ancestorRect = ancestor.getBoundingClientRect();
                if (Number.isFinite(ancestorRect.bottom) && ancestorRect.bottom > 0) {
                    bottomBoundary = Math.min(bottomBoundary, ancestorRect.bottom);
                }
            }
            ancestor = ancestor.parentElement;
        }
        const nextHeight = Math.max(0, Math.floor(bottomBoundary - Math.max(0, rect.top) - 20));
        setLeftRailViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    }, [compactMode]);

    const { collection = [], loading, error } = useDataSourceState(builderContext);
    const locale = context?.locale || "en-US";
    const collectionInfo = builderContext?.signals?.collectionInfo?.value || {};
    const computedCollection = useMemo(
        () => applyReportBuilderComputedMeasures(collection, displayConfig),
        [collection, displayConfig],
    );
    const chartQueryCollection = useMemo(
        () => applyReportBuilderComputedMeasures(chartQueryState.rows, displayConfig),
        [chartQueryState.rows, displayConfig],
    );
    const replaceWindowFormBuilderState = React.useCallback((baseValues = {}, nextValue = null) => (
        replaceReportBuilderWindowState(baseValues, stateKey, nextValue)
    ), [stateKey]);

    const persistStateWithConfig = React.useCallback((next, effectiveConfig = config, {
        preserveHydratedSession = true,
        skipExplorationHistory = false,
    } = {}) => {
        const normalized = sanitizeReportBuilderState(effectiveConfig, next);
        const currentBuilderState = currentBuilderStateRef.current || state;
        const nextWithExplorationHistory = skipExplorationHistory
            ? normalizeReportBuilderExplorationState(normalized)
            : recordReportBuilderExplorationHistory(currentBuilderState, normalized);
        const currentWindowPersisted = resolveKey(windowFormSignal?.peek?.() || {}, stateKey);
        const currentHydratedReportDocumentSession = resolveReportBuilderHydratedDocumentSessionFromState(
            currentWindowPersisted || effectivePersistedStateRef.current,
        );
        const nextHydratedSession = resolveReportBuilderHydratedDocumentSessionFromState(nextWithExplorationHistory);
        const nextPersistableState = preserveHydratedSession && !nextHydratedSession && currentHydratedReportDocumentSession
            ? applyReportBuilderHydratedDocumentSessionState(nextWithExplorationHistory, currentHydratedReportDocumentSession)
            : nextWithExplorationHistory;
        persistStoredReportBuilderState(stateStorageScope, nextPersistableState, legacyStateStorageScopes);
        if (shouldPersistReportBuilderWindowState(currentWindowPersisted, nextPersistableState) === false) {
            return;
        }
        if (windowFormSignal) {
            windowFormSignal.value = replaceWindowFormBuilderState(windowFormSignal.peek?.() || {}, nextPersistableState);
            return;
        }
        const currentWindowForm = builderContext?.handlers?.dataSource?.getWindowFormData?.() || {};
        builderContext?.handlers?.dataSource?.setWindowFormData?.({
            values: replaceWindowFormBuilderState(currentWindowForm, nextPersistableState),
            replace: true,
            bumpPrefillRevision: false,
        });
    }, [builderContext, config, legacyStateStorageScopes, replaceWindowFormBuilderState, stateKey, stateStorageScope, windowFormSignal]);
    const persistState = React.useCallback((next, options = {}) => (
        persistStateWithConfig(next, config, options)
    ), [config, persistStateWithConfig]);

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
        setLeftRailWidthPercent(loadStoredReportBuilderLeftRailWidthPercent(stateStorageScope, legacyStateStorageScopes));
    }, [legacyStateStorageScopes, stateStorageScope]);

    useEffect(() => {
        persistStoredReportBuilderLeftRailWidthPercent(stateStorageScope, leftRailWidthPercent, legacyStateStorageScopes);
    }, [leftRailWidthPercent, legacyStateStorageScopes, stateStorageScope]);

    useEffect(() => () => {
        if (typeof leftRailResizeCleanupRef.current === "function") {
            leftRailResizeCleanupRef.current();
            leftRailResizeCleanupRef.current = null;
        }
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

    useEffect(() => {
        if (compactMode || typeof window === "undefined") {
            setLeftRailViewportHeight(0);
            return undefined;
        }
        measureLeftRailViewportHeight();
        const handleWindowChange = () => measureLeftRailViewportHeight();
        window.addEventListener("resize", handleWindowChange);
        window.addEventListener("scroll", handleWindowChange, { passive: true });
        const settleTimers = [
            window.setTimeout(() => measureLeftRailViewportHeight(), 120),
            window.setTimeout(() => measureLeftRailViewportHeight(), 600),
            window.setTimeout(() => measureLeftRailViewportHeight(), 1800),
        ];
        let observer;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => measureLeftRailViewportHeight());
            if (leftRailRef.current) {
                observer.observe(leftRailRef.current);
            }
            if (builderRootRef.current) {
                observer.observe(builderRootRef.current);
            }
        }
        return () => {
            window.removeEventListener("resize", handleWindowChange);
            window.removeEventListener("scroll", handleWindowChange);
            settleTimers.forEach((timerId) => window.clearTimeout(timerId));
            observer?.disconnect();
        };
    }, [compactMode, measureLeftRailViewportHeight]);

    useEffect(() => {
        if (compactMode) {
            setLeftRailCanScrollDown(false);
            return undefined;
        }
        const node = leftRailRef.current;
        if (!node) {
            setLeftRailCanScrollDown(false);
            return undefined;
        }
        const updateScrollState = () => {
            const remaining = Math.max(0, (node.scrollHeight || 0) - (node.clientHeight || 0) - (node.scrollTop || 0));
            setLeftRailCanScrollDown(remaining > 8);
        };
        updateScrollState();
        node.addEventListener("scroll", updateScrollState, { passive: true });
        let observer;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => updateScrollState());
            observer.observe(node);
        }
        return () => {
            node.removeEventListener("scroll", updateScrollState);
            observer?.disconnect();
        };
    }, [authoredBlocksCollapsed, compactMode, measuresCollapsed, reportDocumentCollapsed, leftRailViewportHeight]);

    const resolvedLeftRailWidthPercent = useMemo(
        () => clampReportBuilderLeftRailWidthPercent(leftRailWidthPercent),
        [leftRailWidthPercent],
    );
    const builderRootStyle = useMemo(() => {
        if (compactMode) {
            return undefined;
        }
        return {
            "--forge-report-builder-left-width": `clamp(264px, ${resolvedLeftRailWidthPercent.toFixed(2)}%, 360px)`,
            "--forge-report-builder-left-max-height": leftRailViewportHeight > 0 ? `${leftRailViewportHeight}px` : "calc(100vh - 24px)",
        };
    }, [compactMode, leftRailViewportHeight, resolvedLeftRailWidthPercent]);

    const resetLeftRailWidth = React.useCallback(() => {
        setLeftRailWidthPercent(DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
    }, []);

    const scrollLeftRailToBottom = React.useCallback(() => {
        const node = leftRailRef.current;
        if (!node) {
            return;
        }
        node.scrollTo({
            top: node.scrollHeight,
            behavior: "smooth",
        });
    }, []);

    const startLeftRailResize = React.useCallback((event) => {
        if (compactMode || !builderRootRef.current) {
            return;
        }
        event.preventDefault();
        const rootNode = builderRootRef.current;
        const updateFromClientX = (clientX) => {
            const rect = rootNode.getBoundingClientRect();
            if (!rect.width) {
                return;
            }
            const nextPercent = resultPanePosition === "left"
                ? ((rect.right - clientX) / rect.width) * 100
                : ((clientX - rect.left) / rect.width) * 100;
            setLeftRailWidthPercent(clampReportBuilderLeftRailWidthPercent(nextPercent));
        };
        const handlePointerMove = (moveEvent) => {
            updateFromClientX(moveEvent.clientX);
        };
        const stopDragging = () => {
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("mouseup", stopDragging);
            window.removeEventListener("blur", stopDragging);
            document.body.style.removeProperty("cursor");
            document.body.style.removeProperty("user-select");
            leftRailResizeCleanupRef.current = null;
            setLeftRailResizing(false);
        };
        leftRailResizeCleanupRef.current = stopDragging;
        setLeftRailResizing(true);
        document.body.style.setProperty("cursor", "col-resize");
        document.body.style.setProperty("user-select", "none");
        updateFromClientX(event.clientX);
        window.addEventListener("mousemove", handlePointerMove);
        window.addEventListener("mouseup", stopDragging);
        window.addEventListener("blur", stopDragging);
    }, [compactMode, resultPanePosition]);

    const resolveLookup = React.useCallback((group, filterDef, rowId = "") => (
        resolveReportBuilderLookupDescriptor(builderContext, config, state, group, filterDef, rowId)
    ), [builderContext, config, state]);
    const currentRequest = useMemo(
        () => applyReportBuilderRequestHook(builderContext, semanticDisplayConfig, state, buildReportBuilderRequest(semanticDisplayConfig, state)),
        [builderContext, semanticDisplayConfig, state],
    );
    const currentRequestFingerprint = useMemo(
        () => JSON.stringify(currentRequest),
        [currentRequest],
    );
    const currentRequestShouldFetch = useMemo(
        () => config.request?.autoFetch !== false && resolveStateReadiness(state).canRun,
        [config.request?.autoFetch, resolveStateReadiness, state],
    );
    const currentRequestDispatchFingerprint = useMemo(
        () => `${currentRequestFingerprint}::${currentRequestShouldFetch ? "fetch" : "hold"}`,
        [currentRequestFingerprint, currentRequestShouldFetch],
    );
    const runtimePreviewInteraction = useReportRuntimeInteractionState({
        initialState: hydratedReportDocumentSession?.runtimePreviewInteraction || null,
        resetKey: currentRequestFingerprint,
    });
    const hasCompletedCurrentRun = canRunReport
        && !loading
        && !error
        && lastManualRunFingerprintRef.current !== ""
        && lastManualRunFingerprintRef.current === currentRequestFingerprint;
    const runtimePreviewRefinements = runtimePreviewInteraction.refinements;
    const runtimePreviewDrillTransitions = runtimePreviewInteraction.drillTransitions;
    const runtimePreviewInteractionSnapshot = useMemo(
        () => normalizeReportRuntimeInteractionState({
            refinements: runtimePreviewInteraction.refinements,
            drillTransitions: runtimePreviewInteraction.drillTransitions,
            hostIntent: runtimePreviewInteraction.hostIntent,
            detailDiagnostic: runtimePreviewInteraction.detailDiagnostic,
        }, { allowEmpty: false }),
        [
            runtimePreviewInteraction.detailDiagnostic,
            runtimePreviewInteraction.drillTransitions,
            runtimePreviewInteraction.hostIntent,
            runtimePreviewInteraction.refinements,
        ],
    );
    const runtimePreviewInteractionSnapshotFingerprint = useMemo(
        () => JSON.stringify(runtimePreviewInteractionSnapshot),
        [runtimePreviewInteractionSnapshot],
    );
    const hydratedRuntimePreviewInteractionSnapshot = useMemo(
        () => normalizeReportRuntimeInteractionState(
            hydratedReportDocumentSession?.runtimePreviewInteraction,
            { allowEmpty: false },
        ),
        [hydratedReportDocumentSession?.runtimePreviewInteraction],
    );
    const hydratedRuntimePreviewInteractionFingerprint = useMemo(
        () => JSON.stringify(hydratedRuntimePreviewInteractionSnapshot),
        [hydratedRuntimePreviewInteractionSnapshot],
    );
    const lastHydratedRuntimePreviewInteractionFingerprintRef = useRef(hydratedRuntimePreviewInteractionFingerprint);
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
    const chartQueryRequestKey = useMemo(
        () => (chartQueryFingerprint ? `${chartQueryFingerprint}::${manualRunSequence}` : ""),
        [chartQueryFingerprint, manualRunSequence],
    );
    const runtimePreviewMetadata = useMemo(
        () => normalizeReportBuilderDrillMetadata(displayConfig),
        [displayConfig],
    );
    const runtimePreviewConfig = config?.result?.runtimePreview;
    const runtimePreviewEnabled = useMemo(() => {
        if (typeof runtimePreviewConfig === "boolean") {
            return runtimePreviewConfig;
        }
        if (runtimePreviewConfig && typeof runtimePreviewConfig === "object" && Object.prototype.hasOwnProperty.call(runtimePreviewConfig, "enabled")) {
            return runtimePreviewConfig.enabled !== false;
        }
        return runtimePreviewMetadata.hierarchies.length > 0;
    }, [runtimePreviewConfig, runtimePreviewMetadata.hierarchies.length]);
    const shouldCompileRuntimePreview = runtimePreviewEnabled
        && (canRunReport || readiness.reason === "semantic");

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
        if (!currentRequestFingerprint || requestFingerprintRef.current === currentRequestDispatchFingerprint) {
            return;
        }
        if (shouldDeferReportBuilderRequestForPrefill({
            currentPrefillSignature,
            appliedPrefillSignature: appliedPrefillSignatureRef.current,
        })) {
            return;
        }
        requestFingerprintRef.current = currentRequestDispatchFingerprint;
        const inputSignal = builderContext?.signals?.input;
        if (inputSignal) {
            const previous = inputSignal.peek?.() || {};
            inputSignal.value = {
                ...previous,
                parameters: currentRequest,
                fetch: currentRequestShouldFetch,
            };
            return;
        }
        builderContext?.handlers?.dataSource?.setInputParameters?.(currentRequest);
        if (currentRequestShouldFetch) {
            builderContext?.handlers?.dataSource?.fetchCollection?.();
        }
    }, [builderContext, currentPrefillSignature, currentRequest, currentRequestDispatchFingerprint, currentRequestFingerprint, currentRequestShouldFetch, state]);

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

    const measures = useMemo(() => getSelectableReportBuilderMeasures(displayConfig), [displayConfig]);
    const tableCalculationMeasures = useMemo(() => getTableCalculationReportBuilderMeasures(displayConfig), [displayConfig]);
    const measureSections = useMemo(() => resolveMeasureSections(displayConfig, measures), [displayConfig, measures]);
    const calculatedFieldReferenceOptions = useMemo(
        () => buildReportBuilderCalculatedFieldReferenceOptions(displayConfig, { editingId: editingCalculatedFieldId }),
        [displayConfig, editingCalculatedFieldId],
    );
    const tableCalculationFieldOptions = useMemo(
        () => buildReportBuilderTableCalculationFieldOptions(displayConfig, { editingId: editingTableCalculationId }),
        [displayConfig, editingTableCalculationId],
    );
    const dimensions = useMemo(() => getVisibleReportBuilderDimensions(displayConfig), [displayConfig]);
    const selectedDimensionIds = useMemo(
        () => new Set(normalizeArray(state.selectedDimensions).map((entry) => String(entry || "").trim()).filter(Boolean)),
        [state.selectedDimensions],
    );
    const selectedDimensionDefs = useMemo(
        () => dimensions.filter((dimension) => selectedDimensionIds.has(String(dimension?.id || "").trim())),
        [dimensions, selectedDimensionIds],
    );
    const selectedMeasureDefs = useMemo(() => {
        const selectedMeasureIds = new Set(
            normalizeArray(state.selectedMeasures).map((entry) => String(entry || "").trim()).filter(Boolean),
        );
        return measures.filter((measure) => selectedMeasureIds.has(String(measure?.id || "").trim()));
    }, [measures, state.selectedMeasures]);
    const availableDimensionDefs = useMemo(
        () => dimensions.filter((dimension) => !selectedDimensionIds.has(String(dimension?.id || "").trim())),
        [dimensions, selectedDimensionIds],
    );
    const authoredDocumentBlocks = useMemo(
        () => resolveReportBuilderDocumentBlockList(state),
        [state.reportDocumentBlocks, state.reportDocumentLayout],
    );
    const authoredDocumentLayout = useMemo(
        () => normalizeReportBuilderDocumentLayoutState(state?.reportDocumentLayout, authoredDocumentBlocks),
        [authoredDocumentBlocks, state?.reportDocumentLayout],
    );
    const authoredDocumentLayoutItemIndex = useMemo(
        () => new Map(
            (Array.isArray(authoredDocumentLayout?.items) ? authoredDocumentLayout.items : [])
                .map((item) => [String(item?.blockId || "").trim(), item])
                .filter(([blockId]) => !!blockId),
        ),
        [authoredDocumentLayout],
    );
    const authoredDocumentFieldOptions = useMemo(
        () => buildReportBuilderDocumentBlockFieldOptions({
            config: displayConfig,
            state,
        }),
        [displayConfig, state],
    );
    const authoredKpiValueFieldOptions = authoredDocumentFieldOptions.valueFieldOptions || [];
    const authoredKpiSecondaryFieldOptions = authoredDocumentFieldOptions.secondaryFieldOptions || [];
    const authoredScopeParamOptions = authoredDocumentFieldOptions.scopeParamOptions || [];
    const authoredTableColumnOptions = authoredDocumentFieldOptions.tableColumnOptions || [];
    const authoredChartFieldOptions = authoredDocumentFieldOptions.chartFieldOptions || [];
    const authoredChartConfig = authoredDocumentFieldOptions.chartConfig || displayConfig;
    const authoredChartState = authoredDocumentFieldOptions.chartState || state;
    const reportDocumentTemplates = useMemo(
        () => normalizeReportBuilderDocumentTemplates(displayConfig?.reportDocumentTemplates),
        [displayConfig?.reportDocumentTemplates],
    );
    const chartFields = useMemo(() => buildReportBuilderChartFields(displayConfig, state), [displayConfig, state]);
    const authoredDocumentBlockDiagnostics = useMemo(
        () => buildReportBuilderDocumentBlockDiagnostics(authoredDocumentBlocks, {
            valueFieldOptions: authoredKpiValueFieldOptions,
            secondaryFieldOptions: authoredKpiSecondaryFieldOptions,
            tableColumnOptions: authoredTableColumnOptions,
            scopeParamOptions: authoredScopeParamOptions,
            chartConfig: authoredChartConfig,
            chartFieldOptions: authoredChartFieldOptions,
        }),
        [authoredChartConfig, authoredChartFieldOptions, authoredDocumentBlocks, authoredKpiSecondaryFieldOptions, authoredKpiValueFieldOptions, authoredScopeParamOptions, authoredTableColumnOptions],
    );
    const authoredDocumentCompileValidation = useMemo(
        () => buildReportBuilderDocumentCompileValidation(authoredDocumentBlockDiagnostics),
        [authoredDocumentBlockDiagnostics],
    );
    const semanticMeasureIssuesById = semanticFieldValidation?.measureIssuesById || {};
    const semanticDimensionIssuesById = semanticFieldValidation?.dimensionIssuesById || {};
    const semanticSelectedIssues = Array.isArray(semanticFieldValidation?.selectedIssues) ? semanticFieldValidation.selectedIssues : [];
    const semanticDiagnosticsNotice = useMemo(() => buildReportBuilderSemanticDiagnosticsNotice({
        validationState: semanticSelectionValidationState,
    }), [semanticSelectionValidationState]);
    const semanticGovernanceNotice = useMemo(() => buildReportBuilderSemanticGovernanceNotice({
        config: displayConfig,
        state,
        binding: semanticBinding,
    }), [displayConfig, semanticBinding, state]);
    const runtimePreviewSemanticDiagnostics = useMemo(() => buildReportBuilderSemanticRuntimeDiagnostics({
        binding: semanticBinding,
        semanticStatus,
        semanticDiagnosticsNotice,
        semanticGovernanceNotice,
        semanticFieldValidation,
    }), [semanticBinding, semanticDiagnosticsNotice, semanticFieldValidation, semanticGovernanceNotice, semanticStatus]);
    const reopenedRuntimePreviewDiagnostics = useMemo(
        () => (Array.isArray(hydratedReportDocumentSession?.reopenedCompileState?.diagnostics)
            ? hydratedReportDocumentSession.reopenedCompileState.diagnostics
            : []),
        [hydratedReportDocumentSession?.reopenedCompileState?.diagnostics],
    );
    const runtimePreviewArtifactDiagnostics = useMemo(
        () => [
            ...runtimePreviewSemanticDiagnostics,
            ...reopenedRuntimePreviewDiagnostics,
        ],
        [reopenedRuntimePreviewDiagnostics, runtimePreviewSemanticDiagnostics],
    );
    const semanticDiagnosticTargets = useMemo(() => buildReportBuilderSemanticDiagnosticTargets({
        config: displayConfig,
        state,
        binding: semanticBinding,
        diagnostics: semanticSelectionValidationState.diagnostics,
    }), [displayConfig, semanticBinding, semanticSelectionValidationState.diagnostics, state]);
    const semanticProviderMeasureDiagnosticsById = semanticDiagnosticTargets.measureDiagnosticsById || {};
    const semanticProviderDimensionDiagnosticsById = semanticDiagnosticTargets.dimensionDiagnosticsById || {};
    const documentBlockDraftValidation = useMemo(
        () => validateReportBuilderDocumentBlockDraft(documentBlockDraft, {
            valueFieldOptions: authoredKpiValueFieldOptions,
            secondaryFieldOptions: authoredKpiSecondaryFieldOptions,
            tableColumnOptions: authoredTableColumnOptions,
            scopeParamOptions: authoredScopeParamOptions,
            chartConfig: authoredChartConfig,
            chartFieldOptions: authoredChartFieldOptions,
        }),
        [authoredChartConfig, authoredChartFieldOptions, authoredKpiSecondaryFieldOptions, authoredKpiValueFieldOptions, authoredScopeParamOptions, authoredTableColumnOptions, documentBlockDraft],
    );
    const authoredChartBlockDraftValidation = useMemo(
        () => validateReportBuilderDocumentBlockDraft(authoredChartBlockDraft, {
            chartConfig: authoredChartConfig,
            chartFieldOptions: authoredChartFieldOptions,
        }),
        [authoredChartBlockDraft, authoredChartConfig, authoredChartFieldOptions],
    );
    const quickTableCalculationOptions = useMemo(() => (
        tableCalculationMeasures
            .map((measure) => {
                const prepared = prepareReportBuilderTableCalculationApplication(displayConfig, state, measure?.id, {
                    forceAutoFetch: true,
                    switchToTable: true,
                });
                const breakdownHint = prepared.requiredDimensionLabels.length > 0
                    ? (prepared.requiresDimensionProvision
                        ? `Adds ${prepared.requiredDimensionLabels.join(", ")}`
                        : `Uses ${prepared.requiredDimensionLabels.join(", ")}`)
                    : "";
                return {
                    id: String(measure?.id || "").trim(),
                    label: String(measure?.label || measure?.id || "").trim(),
                    eyebrow: humanizeReportBuilderTableCalculationType(measure?.compute?.type),
                    description: breakdownHint || "Adds a local table calculation to the current result grid.",
                    prepared,
                };
            })
            .filter((entry) => {
                const selectedMeasures = Array.isArray(state?.selectedMeasures) ? state.selectedMeasures : [];
                return entry.id && !selectedMeasures.includes(entry.id);
            })
    ), [displayConfig, state, tableCalculationMeasures]);
    const semanticProviderGroupByDiagnostics = Array.isArray(semanticDiagnosticTargets.groupByDiagnostics)
        ? semanticDiagnosticTargets.groupByDiagnostics
        : [];
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

    const selectedColumns = useMemo(() => buildReportBuilderColumns(displayConfig, state), [displayConfig, state]);
    const runtimeTableColumns = useMemo(
        () => buildReportTableRuntimeColumns(selectedColumns, computedCollection || []),
        [computedCollection, selectedColumns],
    );
    const chartDimensions = useMemo(() => chartFields.filter((entry) => entry.kind === "dimension"), [chartFields]);
    const chartMeasures = useMemo(() => chartFields.filter((entry) => entry.kind === "measure"), [chartFields]);
    const authoredChartDimensions = useMemo(() => authoredChartFieldOptions.filter((entry) => entry.kind === "dimension"), [authoredChartFieldOptions]);
    const authoredChartMeasures = useMemo(() => authoredChartFieldOptions.filter((entry) => entry.kind === "measure"), [authoredChartFieldOptions]);
    const supportedChartTypes = useMemo(() => getReportBuilderSupportedChartTypes(displayConfig), [displayConfig]);
    const quickPresetPolicy = useMemo(() => getReportBuilderQuickPresetPolicy(displayConfig), [displayConfig]);
    const defaultChartSpecs = useMemo(() => buildReportBuilderDefaultChartSpecs(displayConfig, state), [displayConfig, state]);
    const defaultTablePresets = useMemo(() => buildReportBuilderDefaultTablePresets(displayConfig, state), [displayConfig, state]);
    const hasTableQuickPresets = defaultTablePresets.length > 0;
    const activeTablePreset = state?.activeTablePreset && typeof state.activeTablePreset === "object" ? state.activeTablePreset : null;
    const lastTablePreset = state?.lastTablePreset && typeof state.lastTablePreset === "object" ? state.lastTablePreset : null;
    const modifiedTablePreset = !activeTablePreset && lastTablePreset ? lastTablePreset : null;
    const chartSpecValidation = useMemo(
        () => validateReportBuilderChartSpec(displayConfig, state.chartSpec, chartFields),
        [displayConfig, state.chartSpec, chartFields],
    );
    const hasValidChartSpec = !!state.chartSpec && chartSpecValidation.valid;
    const hasStaleChartSpec = !!state.chartSpec && isReportBuilderChartSpecStale(config, state.chartSpec, chartFields);
    const settingsHash = useMemo(() => buildReportBuilderSettingsHash(state), [state.binding, state.localCalculatedFields, state.localTableCalculations, state.selectedDimensions, state.selectedMeasures]);
    const chartContainer = useMemo(
        () => {
            const collectionForChart = resolveReportBuilderChartCollection({
                computedCollection,
                chartCollection: chartQueryCollection,
                policy: chartDataPolicy,
                chartQueryLoading: chartQueryState.loading,
            });
            return explicitChartMode && hasValidChartSpec
                ? buildExplicitReportBuilderChartContainer({ ...container, collection: collectionForChart }, displayConfig, state, state.chartSpec)
                : buildChartContainer({ ...container, collection: collectionForChart }, displayConfig, state);
        },
        [chartDataPolicy, chartQueryCollection, computedCollection, container, displayConfig, explicitChartMode, hasValidChartSpec, state],
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
    const notices = useMemo(() => {
        const resolved = resolveReportBuilderNotices(config, state);
        return semanticGovernanceNotice
            ? [semanticGovernanceNotice, ...resolved]
            : resolved;
    }, [config, semanticGovernanceNotice, state]);
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
        <aside
            className={[
                "forge-report-builder__bottom",
                "forge-report-builder__bottom--rail",
                railFilterState.showRailCategories ? "" : "forge-report-builder__bottom--rail-launcher",
            ].filter(Boolean).join(" ")}
            aria-label="Filters"
        >
            <section
                className={[
                    "forge-report-builder__bottom-group",
                    "forge-report-builder__bottom-group--static",
                    railFilterState.showRailCategories ? "" : "forge-report-builder__bottom-group--launcher",
                ].filter(Boolean).join(" ")}
                aria-labelledby="report-builder-filters-rail-heading"
            >
                <div className="forge-report-builder__bottom-header">
                    <h3 id="report-builder-filters-rail-heading" className="forge-report-builder__bottom-label forge-report-builder__bottom-label--featured">Filters</h3>
                    <div className="forge-report-builder__bottom-header-actions">
                        <button
                            type="button"
                            className="forge-report-builder__bottom-toggle"
                            aria-expanded={railFilterState.panelOpen}
                            onClick={() => toggleFilterPanel("common")}
                        >
                            <span>{totalActiveFilterCount} active</span>
                            <span>{railFilterState.panelOpen ? "Hide Filters" : "Open Filters"}</span>
                        </button>
                    </div>
                </div>
                {railFilterState.showRailCategories ? (
                    <div className="forge-report-builder__bottom-body forge-report-builder__bottom-body--launcher">
                        {renderFilterCategoryControls()}
                    </div>
                ) : null}
            </section>
        </aside>
    );

    const renderFiltersPanel = ({ forceBody = false, showCloseAction = false, overlay = false, onClose = null } = {}) => (
        <aside className={[
            "forge-report-builder__bottom",
            useFilterDrawer ? "forge-report-builder__bottom--drawer" : "",
            overlay ? "forge-report-builder__bottom--overlay" : "",
        ].filter(Boolean).join(" ")} aria-label={overlay ? "Filters panel" : (useFilterDrawer ? "Filters drawer" : "Filters")}>
            <section
                className="forge-report-builder__bottom-group forge-report-builder__bottom-group--static"
                aria-labelledby={overlay ? "report-builder-filters-overlay-heading" : "report-builder-filters-panel-heading"}
            >
                <div className="forge-report-builder__bottom-header">
                    <div>
                        <h3
                            id={overlay ? "report-builder-filters-overlay-heading" : "report-builder-filters-panel-heading"}
                            className="forge-report-builder__bottom-label forge-report-builder__bottom-label--featured"
                        >
                            Filters
                        </h3>
                        <div className="forge-report-builder__bottom-description">
                            Refine scope and targeting without covering the result table.
                        </div>
                    </div>
                    <div className="forge-report-builder__bottom-header-actions">
                        <button
                            type="button"
                            className="forge-report-builder__bottom-toggle"
                            aria-expanded={useFilterRail ? railFilterState.panelOpen : filterPanels.common}
                            onClick={() => toggleFilterPanel("common")}
                        >
                            <span>{totalActiveFilterCount} active</span>
                            <span>{useFilterRail ? (railFilterState.panelOpen ? "Hide Filters" : "Show Filters") : (filterPanels.common ? "Hide Body" : "Show Body")}</span>
                        </button>
                        {useFilterDrawer || showCloseAction ? (
                            <button type="button" className="forge-report-builder__bottom-toggle" onClick={() => (typeof onClose === "function" ? onClose() : setFiltersDrawerOpen(false))}>
                                <span>Close</span>
                            </button>
                        ) : null}
                    </div>
                </div>
                <div className="forge-report-builder__bottom-body">
                    {renderFilterCategoryControls()}
                    {filterPanels.common && (!useFilterRail || forceBody) ? renderFilterBody() : null}
                </div>
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
            {displayConfig.groupBy?.options?.length ? (
                <div className={[
                    "forge-report-builder__control-cluster",
                    semanticProviderGroupByDiagnostics.length > 0 ? "is-semantic-provider-invalid" : "",
                ].filter(Boolean).join(" ")}>
                    <label>Break down by</label>
                    <select
                        className="forge-report-builder-select"
                        value={state.groupBy || ""}
                        onChange={(event) => setGroupBy(event.target.value)}
                    >
                        <option value="">None</option>
                        {displayConfig.groupBy.options.map((option) => {
                            const dimensionId = String(option?.dimensionId || option?.value || "").trim();
                            const issue = semanticDimensionIssuesById[dimensionId] || null;
                            const dimension = dimensionById(displayConfig, dimensionId);
                            const label = resolveSemanticGovernanceOptionLabel(option.label || option.value, dimension || option);
                            return (
                                <option
                                    key={option.value}
                                    value={option.value}
                                    disabled={!!issue && state.groupBy !== option.value}
                                    title={[issue?.message, semanticFieldTitle(dimension || option)].filter(Boolean).join(" — ") || undefined}
                                >
                                    {issue ? `${label} (Unavailable in semantic mode)` : label}
                                </option>
                            );
                        })}
                    </select>
                    {semanticProviderGroupByDiagnostics.length > 0 ? (
                        <div className="forge-report-builder__control-cluster-help forge-report-builder__control-cluster-help--danger">
                            {summarizeReportBuilderSemanticDiagnostics(semanticProviderGroupByDiagnostics)}
                        </div>
                    ) : null}
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
                            const measureId = String(measure?.id || "").trim();
                            const active = state.selectedMeasures.includes(measure.id);
                            const primary = state.primaryMeasure === measure.id;
                            const issue = semanticMeasureIssuesById[measureId] || null;
                            const authoringEditable = measure?.authoringEditable === true;
                            const authoringKind = String(measure?.authoringKind || "").trim();
                            const providerDiagnostics = semanticProviderMeasureDiagnosticsById[measureId] || [];
                            const title = [
                                providerDiagnostics.length > 0 ? summarizeReportBuilderSemanticDiagnostics(providerDiagnostics) : "",
                                issue?.message,
                                semanticFieldTitle(measure),
                            ].filter(Boolean).join(" — ") || undefined;
                            return (
                                <div key={measure.id} className="forge-report-builder__measure-pill-group">
                                    <button
                                        type="button"
                                        className={[
                                            "forge-report-builder__measure-pill",
                                            active ? "is-active" : "",
                                            primary ? "is-primary" : "",
                                            issue ? "is-semantic-invalid" : "",
                                            providerDiagnostics.length > 0 ? "is-semantic-provider-invalid" : "",
                                        ].filter(Boolean).join(" ")}
                                        onClick={() => {
                                            if (active) {
                                                if (!issue) {
                                                    setPrimaryMeasure(measure.id);
                                                }
                                                return;
                                            }
                                            if (!issue) {
                                                toggleMeasure(measure.id);
                                            }
                                        }}
                                        onDoubleClick={() => {
                                            if (!issue) {
                                                setPrimaryMeasure(measure.id);
                                            }
                                        }}
                                        disabled={!active && !!issue}
                                        title={title}
                                    >
                                        <span className={active ? "forge-report-builder__selector-box is-active" : "forge-report-builder__selector-box"} onClick={(event) => {
                                            event.stopPropagation();
                                            if (!active && issue) {
                                                return;
                                            }
                                            toggleMeasure(measure.id);
                                        }}>{active ? "✓" : ""}</span>
                                        <span className="forge-report-builder__pill-copy">
                                            <span className="forge-report-builder__pill-text">{measure.label || measure.id}</span>
                                            {renderSemanticGovernanceBadges(measure)}
                                        </span>
                                    </button>
                                    {authoringEditable ? (
                                        <Popover
                                            usePortal={!compactMode}
                                            placement="bottom-end"
                                            content={(
                                                <Menu className="forge-report-builder__chart-menu">
                                                    {authoringKind === "rowCalc" ? (
                                                        <MenuItem icon="edit" text="Edit formula" onClick={() => openCalculatedFieldDialog(measure)} />
                                                    ) : null}
                                                    {authoringKind === "tableCalc" ? (
                                                        <MenuItem icon="edit" text="Edit table calculation" onClick={() => openTableCalculationDialog(measure)} />
                                                    ) : null}
                                                    <MenuItem
                                                        icon="trash"
                                                        intent="danger"
                                                        text={authoringKind === "tableCalc" ? "Delete table calculation" : "Delete formula"}
                                                        onClick={() => {
                                                            if (authoringKind === "tableCalc") {
                                                                removeTableCalculation(measure.id);
                                                                return;
                                                            }
                                                            removeCalculatedField(measure.id);
                                                        }}
                                                    />
                                                </Menu>
                                            )}
                                        >
                                            <button
                                                type="button"
                                                className="forge-report-builder__measure-pill-action"
                                                title={`Manage ${measure.label || measure.id}`}
                                            >
                                                <Icon icon="more" size={12} />
                                            </button>
                                        </Popover>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderMeasuresPanel = () => (
        <section className="forge-report-builder__panel" aria-labelledby="report-builder-measures-heading">
            <div className="forge-report-builder__panel-headerline forge-report-builder__panel-headerline--compact">
                <h3 id="report-builder-measures-heading" className="forge-report-builder__panel-title forge-report-builder__panel-title--featured">Measures</h3>
                <div className="forge-report-builder__panel-header-actions">
                    <div className="forge-report-builder__panel-badge">
                        {state.selectedMeasures.length} selected
                    </div>
                    {!measuresCollapsed ? (
                        <>
                            <Button small outlined icon="add" onClick={() => openCalculatedFieldDialog()}>
                                Add calculated
                            </Button>
                            <Button small outlined icon="add" onClick={() => openTableCalculationDialog()}>
                                Add table calc
                            </Button>
                            {quickTableCalculationOptions.length > 0 ? (
                                <Popover
                                    usePortal={!compactMode}
                                    placement="bottom-end"
                                    content={(
                                        <Menu className="forge-report-builder__chart-menu">
                                            <MenuDivider title="Table calculations" />
                                            {quickTableCalculationOptions.map((option) => (
                                                <MenuItem
                                                    key={option.id}
                                                    disabled={!option.prepared.canApply}
                                                    text={(
                                                        <div
                                                            className={[
                                                                "forge-report-builder__quick-option",
                                                                "forge-report-builder__quick-option--table",
                                                                "forge-report-builder__quick-option--featured",
                                                            ].join(" ")}
                                                        >
                                                            {option.eyebrow ? (
                                                                <div className="forge-report-builder__quick-option-eyebrow">{option.eyebrow}</div>
                                                            ) : null}
                                                            <div className="forge-report-builder__quick-option-title">{option.label}</div>
                                                            {option.description ? (
                                                                <div className="forge-report-builder__quick-option-description">{option.description}</div>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    onClick={() => applyQuickTableCalculation(option.id)}
                                                />
                                            ))}
                                        </Menu>
                                    )}
                                >
                                    <Button
                                        small
                                        className="forge-report-builder__chart-action-button forge-report-builder__panel-action-button forge-report-builder__panel-action-button--table-calc"
                                        icon="add"
                                        rightIcon="caret-down"
                                    >
                                        Quick table calc
                                    </Button>
                                </Popover>
                            ) : null}
                        </>
                    ) : null}
                    <button
                        type="button"
                        className="forge-report-builder__panel-toggle"
                        onClick={() => setMeasuresCollapsed((current) => !current)}
                        aria-expanded={!measuresCollapsed}
                    >
                        {measuresCollapsed ? "Show" : "Hide"}
                    </button>
                </div>
            </div>
            {!measuresCollapsed ? renderMeasureSections() : null}
        </section>
    );

    const renderBreakdownPanel = ({ collapsible = true } = {}) => {
        const headingId = collapsible ? "report-builder-breakdowns-heading" : "report-builder-breakdowns-compact-heading";
        return (
            <section className="forge-report-builder__panel" aria-labelledby={headingId}>
                <div className="forge-report-builder__panel-headerline forge-report-builder__panel-headerline--compact">
                    <h3 id={headingId} className="forge-report-builder__panel-title forge-report-builder__panel-title--featured">Breakdowns</h3>
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
                            {availableDimensionDefs.map((dimension) => {
                                const issue = semanticDimensionIssuesById[String(dimension?.id || "").trim()] || null;
                                const label = resolveSemanticGovernanceOptionLabel(dimension.label || dimension.id, dimension);
                                return (
                                    <option
                                        key={dimension.id}
                                        value={dimension.id}
                                        disabled={!!issue}
                                        title={[issue?.message, semanticFieldTitle(dimension)].filter(Boolean).join(" — ") || undefined}
                                    >
                                        {issue ? `${label} (Unavailable in semantic mode)` : label}
                                    </option>
                                );
                            })}
                        </select>
                        {selectedDimensionDefs.length > 0 ? (
                            <div className="forge-report-builder__dimension-selected" aria-label="Selected breakdowns">
                                {selectedDimensionDefs.map((dimension) => {
                                    const dimensionId = String(dimension?.id || "").trim();
                                    const removable = selectedDimensionDefs.length > 1;
                                    const issue = semanticDimensionIssuesById[dimensionId] || null;
                                    const providerDiagnostics = semanticProviderDimensionDiagnosticsById[dimensionId] || [];
                                    return (
                                        <button
                                            key={dimension.id}
                                            type="button"
                                            className={[
                                                "forge-report-builder__dimension-pill",
                                                issue ? "is-semantic-invalid" : "",
                                                providerDiagnostics.length > 0 ? "is-semantic-provider-invalid" : "",
                                            ].filter(Boolean).join(" ")}
                                            onClick={() => removeDimension(dimension.id)}
                                            disabled={!removable}
                                            title={[
                                                providerDiagnostics.length > 0 ? summarizeReportBuilderSemanticDiagnostics(providerDiagnostics) : "",
                                                issue?.message,
                                                semanticFieldTitle(dimension) || (removable ? `Remove ${dimension.label || dimension.id}` : dimension.label || dimension.id),
                                            ].filter(Boolean).join(" — ")}
                                        >
                                            <span className="forge-report-builder__pill-copy">
                                                <span className="forge-report-builder__pill-text">{dimension.label || dimension.id}</span>
                                                {renderSemanticGovernanceBadges(dimension, { compact: true })}
                                            </span>
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
    };

    const renderReportDocumentPanel = () => (
        <section className="forge-report-builder__panel" aria-labelledby="report-builder-document-heading">
            <div className="forge-report-builder__panel-headerline forge-report-builder__panel-headerline--compact">
                <h3 id="report-builder-document-heading" className="forge-report-builder__panel-title forge-report-builder__panel-title--featured">Report Document</h3>
                <div className="forge-report-builder__panel-header-actions">
                    <div className="forge-report-builder__panel-badge">
                        Metadata
                    </div>
                    <button
                        type="button"
                        className="forge-report-builder__panel-toggle"
                        onClick={() => setReportDocumentCollapsed((current) => !current)}
                        aria-expanded={!reportDocumentCollapsed}
                    >
                        {reportDocumentCollapsed ? "Show" : "Hide"}
                    </button>
                </div>
            </div>
            {!reportDocumentCollapsed ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label className="forge-report-builder__chart-field">
                        <span>Title</span>
                        <input
                            aria-label="Report document title"
                            type="text"
                            className="forge-report-builder-select"
                            value={resolveReportDocumentMetadataTitle(state, container, config)}
                            onChange={(event) => updateReportDocumentMetadata("reportDocumentTitle", event.target.value)}
                            placeholder={container?.title || config?.title || "Report"}
                        />
                    </label>
                    <label className="forge-report-builder__chart-field">
                        <span>Subtitle</span>
                        <input
                            aria-label="Report document subtitle"
                            type="text"
                            className="forge-report-builder-select"
                            value={String(state?.reportDocumentSubtitle || "")}
                            onChange={(event) => updateReportDocumentMetadata("reportDocumentSubtitle", event.target.value)}
                            placeholder="Optional subtitle"
                        />
                    </label>
                    <label className="forge-report-builder__chart-field forge-report-builder__chart-field--full">
                        <span>Description</span>
                        <textarea
                            aria-label="Report document description"
                            className="forge-report-builder__calculated-field-textarea"
                            value={String(state?.reportDocumentDescription || "")}
                            onChange={(event) => updateReportDocumentMetadata("reportDocumentDescription", event.target.value)}
                            placeholder="Optional document description"
                            rows={3}
                        />
                    </label>
                    {state.reportDocumentTemplateLabel ? (
                        <div style={{ fontSize: 11, lineHeight: 1.5, color: "#486579" }}>
                            Seeded from template: {state.reportDocumentTemplateLabel}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );

    function openAuthoredAction(actionId = "") {
        const normalizedActionId = String(actionId || "").trim();
        if (!normalizedActionId) {
            return;
        }
        if (normalizedActionId === "chartBlock") {
            openAuthoredChartBlockDialog();
            return;
        }
        openDocumentBlockDialog(normalizedActionId);
    }

    const renderAuthoredBlockActionButtons = ({ className = "", actionIds = null } = {}) => authoredCapabilities.actions
        .filter((action) => !Array.isArray(actionIds) || actionIds.length === 0 || actionIds.includes(action.id))
        .map((action) => (
        <Button
            key={action.id}
            small
            outlined
            icon={action.icon || "add"}
            className={className || undefined}
            disabled={action.disabled}
            title={action.disabled ? action.disabledReason : undefined}
            aria-label={action.disabled ? `${action.label}. ${action.disabledReason}` : action.label}
            onClick={() => openAuthoredAction(action.id)}
        >
            {action.label}
        </Button>
        ));
    const renderAuthoredActionGroupPopover = (group = null) => {
        if (!group || typeof group !== "object") {
            return null;
        }
        const actions = (Array.isArray(group.actionIds) ? group.actionIds : [])
            .map((actionId) => authoredActionsById.get(actionId))
            .filter(Boolean);
        if (actions.length === 0) {
            return null;
        }
        const triggerIcon = group.id === "runtime" ? "filter" : "annotation";
        return (
            <Popover
                key={group.id}
                usePortal={!compactMode}
                placement="bottom-start"
                content={(
                    <Menu className="forge-report-builder__chart-menu">
                        <MenuDivider title={group.title} />
                        {group.description ? (
                            <div className="forge-report-builder__quick-group-description">
                                {group.description}
                            </div>
                        ) : null}
                        {actions.map((action) => (
                            <MenuItem
                                key={action.id}
                                icon={action.icon || "add"}
                                disabled={action.disabled}
                                text={action.label}
                                title={action.disabled ? action.disabledReason : undefined}
                                label={action.disabled ? "Unavailable" : undefined}
                                onClick={() => openAuthoredAction(action.id)}
                            />
                        ))}
                    </Menu>
                )}
            >
                <Button
                    small
                    outlined
                    icon={triggerIcon}
                    rightIcon="caret-down"
                    className="forge-report-builder__authored-toolbar-trigger"
                    title={group.description || undefined}
                >
                    {group.title}
                </Button>
            </Popover>
        );
    };
    const renderAuthoredBlocksPanel = () => (
        <section className="forge-report-builder__panel" aria-labelledby="report-builder-authored-blocks-heading">
            <div className="forge-report-builder__panel-headerline forge-report-builder__panel-headerline--compact">
                <h3 id="report-builder-authored-blocks-heading" className="forge-report-builder__panel-title forge-report-builder__panel-title--featured">Authored Blocks</h3>
                <div className="forge-report-builder__panel-header-actions">
                    <div className="forge-report-builder__panel-badge">
                        {authoredDocumentBlocks.length} blocks
                    </div>
                    <Tooltip content={AUTHORED_BLOCKS_HINT} placement="top">
                        <button
                            type="button"
                            className="forge-report-builder__panel-info-button forge-report-builder__panel-info-button--icon"
                            aria-label="Authored block persistence details"
                        >
                            <Icon icon="info-sign" size={12} />
                        </button>
                    </Tooltip>
                    {reportDocumentTemplates.length > 0 ? (
                        <Popover
                            usePortal={!compactMode}
                            placement="bottom-start"
                            content={(
                                <Menu className="forge-report-builder__chart-menu">
                                    <MenuDivider title="Report templates" />
                                    {reportDocumentTemplates.map((template) => (
                                        <MenuItem
                                            key={template.id}
                                            text={template.label}
                                            label={template.description || undefined}
                                            onClick={() => applyDocumentTemplate(template.id)}
                                        />
                                    ))}
                                </Menu>
                            )}
                        >
                            <Button small outlined icon="duplicate">
                                Apply template
                            </Button>
                        </Popover>
                    ) : null}
                    <button
                        type="button"
                        className="forge-report-builder__panel-toggle"
                        onClick={() => setAuthoredBlocksCollapsed((current) => !current)}
                        aria-expanded={!authoredBlocksCollapsed}
                    >
                        {authoredBlocksCollapsed ? "Show" : "Hide"}
                    </button>
                </div>
            </div>
            <div className="forge-report-builder__document-block-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {authoredBlocksCollapsed ? null : authoredDocumentBlocks.length === 0 ? (
                    <div className="forge-report-builder__authored-empty-state">
                        <div className="forge-report-builder__authored-empty-state-groups">
                            {authoredCapabilities.actionGroups.map((group) => {
                                const headingId = `report-builder-authored-group-${group.id}`;
                                return (
                                <section key={group.id} className="forge-report-builder__authored-action-group" aria-labelledby={headingId}>
                                    <div className="forge-report-builder__authored-action-group-header">
                                        <div className="forge-report-builder__authored-action-group-heading">
                                            <div className="forge-report-builder__authored-action-group-title-row">
                                                <h4 id={headingId} className="forge-report-builder__authored-action-group-title">{group.title}</h4>
                                                {group.description ? (
                                                    <Tooltip content={group.description} placement="top">
                                                        <button
                                                            type="button"
                                                            className="forge-report-builder__authored-action-group-info"
                                                            aria-label={`${group.title} details`}
                                                        >
                                                            <Icon icon="info-sign" size={12} />
                                                        </button>
                                                    </Tooltip>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="forge-report-builder__authored-action-group-count">
                                            {group.actionIds.length} options
                                        </div>
                                    </div>
                                    <div className="forge-report-builder__authored-action-group-actions">
                                        {renderAuthoredBlockActionButtons({
                                            className: "forge-report-builder__authored-empty-state-action",
                                            actionIds: group.actionIds,
                                        })}
                                    </div>
                                </section>
                                );
                            })}
                        </div>
                        {authoredCapabilities.showDisabledHint ? (
                            <div className="forge-report-builder__authored-empty-state-footnote">
                                {authoredCapabilities.disabledHintText}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <>
                        <div className="forge-report-builder__authored-toolbar">
                            <div className="forge-report-builder__authored-toolbar-copy">
                                <div className="forge-report-builder__authored-toolbar-title">Add to report</div>
                                <div className="forge-report-builder__authored-toolbar-description">
                                    Keep composing with grouped report blocks and runtime controls.
                                </div>
                            </div>
                            <div className="forge-report-builder__authored-toolbar-actions">
                                {authoredCapabilities.actionGroups.map((group) => renderAuthoredActionGroupPopover(group))}
                            </div>
                        </div>
                        {authoredDocumentBlocks.map((block, index) => {
                    const normalizedKind = String(block?.kind || "").trim();
                    const layoutItem = authoredDocumentLayoutItemIndex.get(String(block?.id || "").trim()) || null;
                    const widthLabels = resolveReportBuilderDocumentWidthLabels(layoutItem?.size);
                    const isHalfWidth = widthLabels.isHalfWidth;
                    const summary = normalizedKind === "kpiBlock"
                        ? [
                            block?.valueLabel || block?.valueField || "Value",
                            block?.secondaryField ? `Secondary ${block.secondaryLabel || block.secondaryField}` : "",
                        ].filter(Boolean).join(" • ")
                        : normalizedKind === "filterBarBlock"
                            ? (() => {
                                const paramLabels = (Array.isArray(block?.paramIds) ? block.paramIds : [])
                                    .map((paramId) => authoredScopeParamOptions.find((option) => option.value === String(paramId || "").trim())?.label || paramId)
                                    .filter(Boolean);
                                return paramLabels.length > 0 ? paramLabels.join(" • ") : "No shared scope parameters";
                            })()
                        : normalizedKind === "refinementBarBlock"
                            ? [
                                ...(Array.isArray(block?.actionKinds) ? block.actionKinds : []),
                                block?.emptyLabel || "",
                            ].filter(Boolean).join(" • ") || "No refinement actions configured"
                        : normalizedKind === "chartBlock"
                            ? (() => {
                                const chartSpec = block?.chartSpec && typeof block.chartSpec === "object" ? block.chartSpec : {};
                                const xFieldLabel = authoredChartFieldOptions.find((entry) => entry.key === String(chartSpec?.xField || "").trim())?.label || chartSpec?.xField || "";
                                const yFieldLabels = (Array.isArray(chartSpec?.yFields) ? chartSpec.yFields : [])
                                    .map((fieldKey) => authoredChartFieldOptions.find((entry) => entry.key === String(fieldKey || "").trim())?.label || fieldKey)
                                    .filter(Boolean);
                                const seriesFieldLabel = authoredChartFieldOptions.find((entry) => entry.key === String(chartSpec?.seriesField || "").trim())?.label || chartSpec?.seriesField || "";
                                return [
                                    chartTypeLabel(chartSpec?.type || ""),
                                    xFieldLabel ? `X ${xFieldLabel}` : "",
                                    yFieldLabels.length > 0 ? yFieldLabels.join(" • ") : "",
                                    seriesFieldLabel ? `Series ${seriesFieldLabel}` : "",
                                ].filter(Boolean).join(" • ") || "Chart block";
                            })()
                        : normalizedKind === "geoMapBlock"
                            ? (() => {
                                const geo = block?.geo && typeof block.geo === "object" ? block.geo : {};
                                const metric = geo?.metric && typeof geo.metric === "object" ? geo.metric : {};
                                const keyLabel = authoredTableColumnOptions.find((entry) => entry.key === String(geo?.key || "").trim())?.label || geo?.key || "";
                                const labelFieldLabel = authoredTableColumnOptions.find((entry) => entry.key === String(geo?.labelKey || "").trim())?.label || geo?.labelKey || "";
                                const metricLabel = metric?.label || authoredTableColumnOptions.find((entry) => entry.key === String(metric?.key || "").trim())?.label || metric?.key || "";
                                return [
                                    keyLabel ? `Key ${keyLabel}` : "",
                                    labelFieldLabel ? `Label ${labelFieldLabel}` : "",
                                    metricLabel ? `Metric ${metricLabel}` : "",
                                    geo?.aggregate ? `Aggregate ${geo.aggregate}` : "",
                                ].filter(Boolean).join(" • ") || "Geo map block";
                            })()
                        : normalizedKind === "tableBlock"
                            ? (() => {
                                const labels = (Array.isArray(block?.columns) ? block.columns : [])
                                    .map((column) => column?.label || column?.key)
                                    .filter(Boolean);
                                const visualLabels = (Array.isArray(block?.columns) ? block.columns : [])
                                    .filter((column) => ["dataBar", "badge", "tone"].includes(String(column?.cellVisual?.kind || "").trim()))
                                    .map((column) => {
                                        const kind = String(column?.cellVisual?.kind || "").trim();
                                        if (kind === "badge") {
                                            return `${column?.label || column?.key} badge`;
                                        }
                                        if (kind === "tone") {
                                            return `${column?.label || column?.key} tone`;
                                        }
                                        return `${column?.label || column?.key} data bar`;
                                    })
                                    .filter(Boolean);
                                if (labels.length === 0) {
                                    return "No columns";
                                }
                                const labelSummary = labels.length <= 3
                                    ? labels.join(" • ")
                                    : `${labels.slice(0, 3).join(" • ")} +${labels.length - 3}`;
                                if (visualLabels.length === 0) {
                                    return labelSummary;
                                }
                                return `${labelSummary} • ${visualLabels.join(" • ")}`;
                            })()
                        : summarizeReportBuilderDocumentMarkdown(block?.markdown || "");
                    const kindLabel = normalizedKind === "filterBarBlock"
                        ? "Filter Bar"
                        : normalizedKind === "refinementBarBlock"
                            ? "Refinement Bar"
                            : normalizedKind === "geoMapBlock"
                                ? "Geo Map"
                            : normalizedKind === "chartBlock"
                                ? "Chart"
                            : normalizedKind === "kpiBlock"
                                ? "KPI"
                                : normalizedKind === "tableBlock"
                                    ? "Table"
                                    : "Narrative";
                    const kindIcon = reportBuilderDocumentBlockIcon(normalizedKind);
                    return (
                        <article
                            key={block.id}
                            className="forge-report-builder__document-block-card"
                            data-report-document-block-id={block.id}
                            data-report-document-block-kind={normalizedKind}
                            style={{
                                border: "1px solid #d7e2ee",
                                borderRadius: 12,
                                padding: "12px 14px",
                                background: "#fbfdff",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                                    <span className="forge-report-builder__document-block-icon" aria-hidden="true">
                                        <Icon icon={kindIcon} size={14} />
                                    </span>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                            <strong style={{ color: "#183247", fontSize: 13 }}>{block.title || block.id}</strong>
                                            <span className="forge-report-builder__result-meta-chip">{kindLabel}</span>
                                            <span className="forge-report-builder__result-meta-chip">{widthLabels.currentLabel}</span>
                                        </div>
                                        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#5f6b7c" }}>{summary}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <Button
                                        small
                                        minimal
                                        icon="arrow-up"
                                        aria-label={`Move ${block.title || block.id} up`}
                                        disabled={index === 0}
                                        onClick={() => moveDocumentBlock(block.id, "up")}
                                        title="Move block up"
                                    />
                                    <Button
                                        small
                                        minimal
                                        icon="arrow-down"
                                        aria-label={`Move ${block.title || block.id} down`}
                                        disabled={index === authoredDocumentBlocks.length - 1}
                                        onClick={() => moveDocumentBlock(block.id, "down")}
                                        title="Move block down"
                                    />
                                    <Button
                                        small
                                        minimal
                                        aria-label={isHalfWidth ? `Make ${block.title || block.id} full width` : `Make ${block.title || block.id} half width`}
                                        onClick={() => resizeDocumentBlock(block.id, isHalfWidth ? "full" : "half")}
                                        title={widthLabels.actionTitle}
                                    >
                                        {widthLabels.actionLabel}
                                    </Button>
                                    <Button
                                        small
                                        minimal
                                        icon="duplicate"
                                        aria-label={`Duplicate ${block.title || block.id}`}
                                        onClick={() => duplicateDocumentBlock(block.id)}
                                        title={`Duplicate ${block.title || block.id}`}
                                    />
                                    <Button
                                        small
                                        minimal
                                        icon="edit"
                                        aria-label={`Edit ${block.title || block.id}`}
                                        onClick={() => {
                                            if (normalizedKind === "chartBlock") {
                                                openAuthoredChartBlockDialog(block);
                                                return;
                                            }
                                            openDocumentBlockDialog(block);
                                        }}
                                        title={`Edit ${block.title || block.id}`}
                                    />
                                    <Button
                                        small
                                        minimal
                                        intent="danger"
                                        icon="trash"
                                        aria-label={`Remove ${block.title || block.id}`}
                                        onClick={() => removeDocumentBlock(block.id)}
                                        title={`Remove ${block.title || block.id}`}
                                    />
                                </div>
                            </div>
                        </article>
                    );
                        })}
                        {authoredCapabilities.notes.map((note) => (
                            <div key={note.id} style={{ fontSize: 11, lineHeight: 1.5, color: "#8a5d00" }}>
                                {note.message}
                            </div>
                        ))}
                    </>
                )}
            </div>
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
                                        <h3 className="forge-report-builder__panel-title forge-report-builder__panel-title--featured">Measures</h3>
                                    </div>
                                    {renderMeasureSections()}
                                </section>
                                {renderBreakdownPanel({ collapsible: false })}
                            </div>
                        ) : null}
                        {compactSheetTab === "filters" ? (
                            <div className="forge-report-builder__compact-panel-stack">
                                <section
                                    className="forge-report-builder__bottom-group forge-report-builder__bottom-group--static"
                                    aria-label="Filters"
                                    aria-labelledby="report-builder-filters-compact-heading"
                                >
                                    <div className="forge-report-builder__bottom-header">
                                        <div>
                                            <h3 id="report-builder-filters-compact-heading" className="forge-report-builder__bottom-label forge-report-builder__bottom-label--featured">Filters</h3>
                                            <div className="forge-report-builder__bottom-description">
                                                Refine optional filters and targeting while keeping the current result in view.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="forge-report-builder__bottom-body">
                                        {renderFilterCategoryControls()}
                                        {renderFilterBody({ includeRequiredStaticFilters: false })}
                                    </div>
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
                                {compactChartSheetState.title}
                            </div>
                        </div>
                        <button type="button" className="forge-report-builder__panel-toggle" onClick={closeCompactChartSheet}>
                            Close
                        </button>
                    </div>
                    <div className="forge-report-builder__compact-sheet-body forge-report-builder__compact-sheet-body--chart">
                        {compactChartSheetState.notice?.message ? (
                            <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${compactChartSheetState.notice.level || "info"}`}>
                                {compactChartSheetState.notice.message}
                            </div>
                        ) : null}
                        {compactChartSheetState.presetIdentity ? (
                            <div
                                className={[
                                    "forge-report-builder__preset-identity-card",
                                    compactChartSheetState.presetIdentity.accentTone
                                        ? `forge-report-builder__preset-identity-card--${compactChartSheetState.presetIdentity.accentTone}`
                                        : "",
                                    "forge-report-builder__preset-identity-card--compact",
                                ].filter(Boolean).join(" ")}
                            >
                                {compactChartSheetState.presetIdentity.eyebrow ? (
                                    <div className="forge-report-builder__preset-identity-eyebrow">
                                        {compactChartSheetState.presetIdentity.eyebrow}
                                    </div>
                                ) : null}
                                <div className="forge-report-builder__preset-identity-title">
                                    {compactChartSheetState.presetIdentity.title}
                                </div>
                                {compactChartSheetState.presetIdentity.highlights.length > 0 ? (
                                    <div className="forge-report-builder__preset-identity-highlights">
                                        {compactChartSheetState.presetIdentity.highlights.map((item) => (
                                            <span key={item} className="forge-report-builder__preset-identity-highlight">{item}</span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {compactChartSheetState.quickActions.enabled ? (
                            <ReportBuilderChartQuickActions
                                canCreate={compactChartSheetState.quickActions.canCreateChart}
                                showCreateButton={compactChartSheetState.quickActions.showCreateButton}
                                onCreate={() => {
                                    closeCompactChartSheet();
                                    openChartDialog(state.chartSpec);
                                }}
                                quickOptions={compactChartSheetState.quickActions.quickOptions}
                                buttonLabel={compactChartSheetState.quickActions.buttonLabel}
                                buttonIcon={compactChartSheetState.quickActions.buttonIcon}
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
                        {compactChartSheetState.editChartEnabled || compactChartSheetState.removeChartEnabled ? (
                            <div className="forge-report-builder__compact-chart-actions">
                                {compactChartSheetState.editChartEnabled ? (
                                    <Button small outlined icon="edit" onClick={() => {
                                        closeCompactChartSheet();
                                        openChartDialog(state.chartSpec);
                                    }}>
                                        Edit Chart
                                    </Button>
                                ) : null}
                                {compactChartSheetState.removeChartEnabled ? (
                                    <Button small minimal intent="danger" icon="trash" onClick={removeChart}>
                                        Remove Chart
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                        {compactChartSheetState.viewToggleEnabled || compactChartSheetState.exportEnabled ? (
                            <div className="forge-report-builder__compact-chart-actions">
                                {compactChartSheetState.viewToggleEnabled ? resultViewModes.map((mode) => (
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
                                {compactChartSheetState.exportEnabled ? (
                                    <Button small outlined icon="download" disabled={!canShowResults} onClick={downloadCsv}>
                                        Export
                                    </Button>
                                ) : null}
                            </div>
                        ) : compactChartSheetState.emptyStateEnabled ? (
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
            semanticDisplayConfig,
            nextState,
            buildReportBuilderRequest(semanticDisplayConfig, nextState),
        );
        const nextReadiness = resolveStateReadiness(nextState);
        const fingerprint = JSON.stringify(request);
        const shouldFetch = nextReadiness.canRun && (forceFetch || config.request?.autoFetch !== false);
        requestFingerprintRef.current = `${fingerprint}::${shouldFetch ? "fetch" : "hold"}`;
        if (markManual) {
            lastManualRunFingerprintRef.current = fingerprint;
        }
        const inputSignal = builderContext?.signals?.input;
        if (inputSignal) {
            const previous = inputSignal.peek?.() || {};
            inputSignal.value = {
                ...previous,
                parameters: request,
                fetch: shouldFetch,
            };
            return { request, fingerprint, readiness: nextReadiness, shouldFetch };
        }
        builderContext?.handlers?.dataSource?.setInputParameters?.(request);
        if (shouldFetch) {
            builderContext?.handlers?.dataSource?.fetchCollection?.();
        }
        return { request, fingerprint, readiness: nextReadiness, shouldFetch };
    }, [builderContext, config.request?.autoFetch, resolveStateReadiness, semanticDisplayConfig]);

    const runReport = React.useCallback(() => {
        setManualRunSequence((current) => current + 1);
        setChartApplyFeedback(null);
        dispatchReportRequest(state, { forceFetch: true, markManual: true });
    }, [dispatchReportRequest, state]);
    const hasRows = Array.isArray(computedCollection) && computedCollection.length > 0;
    const canShowResults = canRunReport && hasRows;
    const canShowResultsRef = useRef(canShowResults);
    canShowResultsRef.current = canShowResults;
    const railFilterState = useMemo(
        () => resolveReportBuilderRailFilterState({
            panelOpen: filterPanels.common,
            canShowResults,
            manualRunSequence,
            seededRequestFingerprint: currentRequestFingerprint,
            collapsedSeededFingerprint: lastSeededRailFilterCollapseFingerprintRef.current,
        }),
        [canShowResults, currentRequestFingerprint, filterPanels.common, manualRunSequence],
    );
    const explorationActive = useMemo(
        () => isReportBuilderExplorationActive(state),
        [state],
    );
    const explorationBannerState = useMemo(
        () => buildReportBuilderExplorationBannerState(state),
        [state],
    );
    const savedExplorationArtifactSummary = useMemo(
        () => buildReportBuilderExplorationArtifactSummary(savedExplorationArtifact),
        [savedExplorationArtifact],
    );
    const savedExplorationArtifactInspector = useMemo(
        () => buildReportBuilderExplorationArtifactInspectorState(savedExplorationArtifact),
        [savedExplorationArtifact],
    );
    const savedReportPayloadSummary = useMemo(
        () => buildReportBuilderSavedReportPayloadSummary(savedReportPayload),
        [savedReportPayload],
    );
    const rawLocalReportDocumentSavedPayloads = useMemo(
        () => [
            ...(savedReportPayload ? [savedReportPayload] : []),
            ...(Array.isArray(config?.reportDocumentSavedPayloads) ? config.reportDocumentSavedPayloads : []),
        ],
        [config?.reportDocumentSavedPayloads, savedReportPayload],
    );
    const savedReportPayloadInspector = useMemo(
        () => buildReportBuilderSavedReportPayloadInspectorState(savedReportPayload),
        [savedReportPayload],
    );
    const savedReportPayloadCompileDiagnostics = useMemo(
        () => {
            const structuralDiagnostics = buildReportBuilderDocumentCompileDiagnostics({
                document: savedReportPayload?.reportDocument || null,
            });
            const compileDiagnostics = Array.isArray(savedReportPayload?.compileState?.diagnostics)
                ? savedReportPayload.compileState.diagnostics
                : [];
            const diagnostics = [...structuralDiagnostics, ...compileDiagnostics];
            const seen = new Set();
            return diagnostics.filter((diagnostic) => {
                const key = [
                    normalizeString(diagnostic?.code),
                    normalizeString(diagnostic?.severity),
                    normalizeString(diagnostic?.path),
                    normalizeString(diagnostic?.blockId),
                    normalizeString(diagnostic?.message),
                ].join("::");
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });
        },
        [savedReportPayload?.compileState?.diagnostics, savedReportPayload?.reportDocument],
    );
    const savedReportPayloadCompileValidation = useMemo(
        () => buildReportBuilderDocumentCompileValidation(savedReportPayloadCompileDiagnostics),
        [savedReportPayloadCompileDiagnostics],
    );
    const reportDocumentPayloadCompileValidation = useMemo(
        () => (
            hydratedReportDocumentSession
                ? authoredDocumentCompileValidation
                : savedReportPayloadCompileValidation
        ),
        [authoredDocumentCompileValidation, hydratedReportDocumentSession, savedReportPayloadCompileValidation],
    );
    const reportPayloadValidationNotice = useMemo(() => {
        if (hydratedReportDocumentSession) {
            return reportDocumentPayloadCompileValidation.valid
                ? null
                : reportDocumentPayloadCompileValidation;
        }
        if (!savedReportPayloadCompileValidation.valid) {
            return savedReportPayloadCompileValidation;
        }
        return null;
    }, [hydratedReportDocumentSession, reportDocumentPayloadCompileValidation, savedReportPayloadCompileValidation]);
    const createReportDocumentPayloadSummary = useMemo(
        () => buildReportBuilderCreateReportDocumentPayloadSummary(createReportDocumentPayload),
        [createReportDocumentPayload],
    );
    const createReportDocumentPayloadInspector = useMemo(
        () => buildReportBuilderCreateReportDocumentPayloadInspectorState(createReportDocumentPayload),
        [createReportDocumentPayload],
    );
    const reportDocumentVersionState = useMemo(
        () => buildReportBuilderDocumentVersionState(reportDocumentVersionDraft),
        [reportDocumentVersionDraft],
    );
    const getReportDocumentResponseSummary = useMemo(
        () => buildReportBuilderGetReportDocumentResponseSummary(getReportDocumentResponse),
        [getReportDocumentResponse],
    );
    const getReportDocumentResponseInspector = useMemo(
        () => buildReportBuilderReportDocumentReadResponseInspectorState(getReportDocumentResponse),
        [getReportDocumentResponse],
    );
    const getReportDocumentResponseContent = useMemo(
        () => getReportDocumentResponseInspector?.content || "",
        [getReportDocumentResponseInspector],
    );
    const getReportDocumentResponseCompileValidation = useMemo(
        () => buildReportBuilderDocumentCompileValidation(getReportDocumentResponse?.compileState?.diagnostics),
        [getReportDocumentResponse?.compileState?.diagnostics],
    );
    const reopenReportDocumentDiagnosticSummary = useMemo(
        () => buildReportBuilderHydratedReportDocumentDiagnosticSummary(reopenReportDocumentDiagnostic),
        [reopenReportDocumentDiagnostic],
    );
    const reopenReportDocumentDiagnosticInspector = useMemo(
        () => buildReportBuilderHydratedReportDocumentDiagnosticInspectorState(reopenReportDocumentDiagnostic),
        [reopenReportDocumentDiagnostic],
    );
    const reopenedReportDocumentCompileValidation = useMemo(
        () => buildReportBuilderDocumentCompileValidation(hydratedReportDocumentSession?.reopenedCompileState?.diagnostics),
        [hydratedReportDocumentSession?.reopenedCompileState?.diagnostics],
    );
    const reopenedCompileDiagnosticsNotice = useMemo(() => buildReportBuilderCompileDiagnosticsNotice({
        compileValidation: reopenedReportDocumentCompileValidation,
        title: "Reopened compile diagnostics",
    }), [reopenedReportDocumentCompileValidation]);
    const listReportDocumentsResponseSummary = useMemo(
        () => buildReportBuilderListReportDocumentsResponseSummary(listReportDocumentsResponse),
        [listReportDocumentsResponse],
    );
    const listReportDocumentsEntryOptions = useMemo(
        () => (Array.isArray(listReportDocumentsResponse?.entries) ? listReportDocumentsResponse.entries : [])
            .map((entry) => ({
                reportId: String(entry?.reportRef?.reportId || "").trim(),
                title: String(entry?.title || entry?.reportRef?.reportId || "").trim(),
                subtitle: normalizeString(entry?.subtitle),
                description: normalizeString(entry?.description),
                compileStatus: normalizeString(entry?.compileState?.status),
            }))
            .filter((entry) => entry.reportId),
        [listReportDocumentsResponse],
    );
    const selectedListReportDocumentsEntry = useMemo(
        () => (Array.isArray(listReportDocumentsResponse?.entries) ? listReportDocumentsResponse.entries : [])
            .find((entry) => normalizeString(entry?.reportRef?.reportId) === normalizeString(listReportDocumentsSelectedReportId)) || null,
        [listReportDocumentsResponse, listReportDocumentsSelectedReportId],
    );
    const reopenedSavedReportSource = hydratedReportDocumentSession?.savedSource || hydratedReportDocumentSession?.source || null;
    const savedReportState = useMemo(() => buildReportBuilderSavedReportState({
        savedReportPayload,
        currentSavedRecord: savedReportPayloadRecord,
        configuredSavedPayloads: rawLocalReportDocumentSavedPayloads.filter((entry) => entry !== savedReportPayload),
        reopenedSource: reopenedSavedReportSource,
        reopenedReportId: hydratedReportDocumentSession?.reportId || "",
        selectedListEntry: selectedListReportDocumentsEntry,
    }), [hydratedReportDocumentSession?.reportId, rawLocalReportDocumentSavedPayloads, reopenedSavedReportSource, savedReportPayload, savedReportPayloadRecord, selectedListReportDocumentsEntry]);
    const reopenedExportRequest = savedReportState.reopenedExportRequest;
    const localReportDocumentSavedPayloads = savedReportState.rawLocalSavedPayloads;
    const localSavedReportRecords = savedReportState.localSavedReportRecords;
    const savedReportPayloadExportRequest = savedReportState.savedReportPayloadExportRequest;
    const selectedListReportDocumentsEntrySummary = useMemo(
        () => buildReportBuilderListReportDocumentsEntrySummary(selectedListReportDocumentsEntry, {
            localSavedPayloads: localSavedReportRecords,
        }),
        [localSavedReportRecords, selectedListReportDocumentsEntry],
    );
    const selectedListEntryExportRequest = savedReportState.selectedListEntryExportRequest;
    const selectedListReportDocumentsEntryCompileValidation = useMemo(
        () => buildReportBuilderDocumentCompileValidation(selectedListReportDocumentsEntry?.compileState?.diagnostics),
        [selectedListReportDocumentsEntry?.compileState?.diagnostics],
    );
    const selectedListEntryCompileDiagnosticsNotice = useMemo(() => buildReportBuilderCompileDiagnosticsNotice({
        compileValidation: selectedListReportDocumentsEntryCompileValidation,
        title: "Selected entry compile diagnostics",
    }), [selectedListReportDocumentsEntryCompileValidation]);
    const savedPayloadCompileDiagnosticsNotice = useMemo(() => buildReportBuilderCompileDiagnosticsNotice({
        compileValidation: savedReportPayloadCompileValidation,
        title: "Saved payload compile diagnostics",
    }), [savedReportPayloadCompileValidation]);
    const listReportDocumentsResponseInspector = useMemo(
        () => buildReportBuilderReportDocumentReadResponseInspectorState(listReportDocumentsResponse, {
            selectedReportId: listReportDocumentsSelectedReportId,
            localSavedPayloads: localSavedReportRecords,
        }),
        [listReportDocumentsResponse, listReportDocumentsSelectedReportId, localSavedReportRecords],
    );
    const listReportDocumentsResponseContent = useMemo(
        () => listReportDocumentsResponseInspector?.content || "",
        [listReportDocumentsResponseInspector],
    );
    const getReportDocumentRequestPayloadSummary = useMemo(
        () => buildReportBuilderGetReportDocumentRequestSummary(getReportDocumentRequestPayload, {
            metadata: selectedListReportDocumentsEntrySummary,
        }),
        [getReportDocumentRequestPayload, selectedListReportDocumentsEntrySummary],
    );
    const getReportDocumentRequestPayloadInspector = useMemo(
        () => buildReportBuilderGetReportDocumentRequestInspectorState(getReportDocumentRequestPayload, {
            metadata: selectedListReportDocumentsEntrySummary,
        }),
        [getReportDocumentRequestPayload, selectedListReportDocumentsEntrySummary],
    );
    const updateReportDocumentExpectedVersionState = useMemo(
        () => buildReportBuilderUpdateReportDocumentExpectedVersionState(updateReportDocumentExpectedVersionDraft),
        [updateReportDocumentExpectedVersionDraft],
    );
    const updateReportDocumentPayloadSummary = useMemo(
        () => buildReportBuilderUpdateReportDocumentPayloadSummary(updateReportDocumentPayload),
        [updateReportDocumentPayload],
    );
    const updateReportDocumentPayloadInspector = useMemo(
        () => buildReportBuilderUpdateReportDocumentPayloadInspectorState(updateReportDocumentPayload),
        [updateReportDocumentPayload],
    );
    const updateReportDocumentConflictVersionState = useMemo(
        () => buildReportBuilderUpdateReportDocumentConflictVersionState({
            expectedVersion: updateReportDocumentPayloadSummary?.expectedVersion || 0,
            currentVersionDraft: updateReportDocumentCurrentVersionDraft,
        }),
        [updateReportDocumentCurrentVersionDraft, updateReportDocumentPayloadSummary?.expectedVersion],
    );
    const updateReportDocumentConflictDiagnosticSummary = useMemo(
        () => buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(updateReportDocumentConflictDiagnostic),
        [updateReportDocumentConflictDiagnostic],
    );
    const updateReportDocumentConflictDiagnosticInspector = useMemo(
        () => buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState(updateReportDocumentConflictDiagnostic),
        [updateReportDocumentConflictDiagnostic],
    );
    const chartSelectionSummary = useMemo(
        () => (selectedBuilderChartSelection
            ? resolveReportRuntimeChartSelectionSummary({
                blockTitle: state.chartSpec?.title || "Selected chart value",
                selection: selectedBuilderChartSelection,
            })
            : ""),
        [selectedBuilderChartSelection, state.chartSpec?.title],
    );
    const canCreateChart = chartDimensions.length > 0 && chartMeasures.length > 0 && supportedChartTypes.length > 0;
    const compatiblePreviousChartPresets = useMemo(
        () => storedChartPresets.filter((preset) => (
            String(preset?.settingsHash || "").trim() === settingsHash
            && validateReportBuilderChartSpec(config, preset?.chartSpec, chartFields).valid
        )),
        [chartFields, config, settingsHash, storedChartPresets],
    );
    const quickChartOptions = useMemo(() => buildReportBuilderQuickViewOptions({
        config: displayConfig,
        state,
        quickPresetPolicy,
        defaultTablePresets,
        modifiedTablePreset,
        defaultChartSpecs,
        previousChartPresets: compatiblePreviousChartPresets,
    }), [compatiblePreviousChartPresets, defaultChartSpecs, defaultTablePresets, displayConfig, modifiedTablePreset, quickPresetPolicy, state]);
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
        if (!useFilterRail || !railFilterState.shouldAutoCollapseSeededPanel) {
            return;
        }
        lastSeededRailFilterCollapseFingerprintRef.current = currentRequestFingerprint;
        setFilterPanels((current) => (
            current.common ? { ...current, common: false } : current
        ));
    }, [currentRequestFingerprint, railFilterState.shouldAutoCollapseSeededPanel, useFilterRail]);

    useEffect(() => {
        if (typeof window === "undefined") {
            filterOverlayWasOpenRef.current = railFilterState.showOverlayBody;
            return;
        }
        if (compactMode || !useFilterRail) {
            if (filterOverlayWasOpenRef.current) {
                window.scrollTo({ top: Math.max(filterOverlayScrollRestoreRef.current || 0, 0), behavior: "auto" });
            }
            filterOverlayWasOpenRef.current = false;
            return;
        }
        const isOpen = railFilterState.showOverlayBody;
        const rootNode = builderRootRef.current;
        if (!rootNode) {
            filterOverlayWasOpenRef.current = isOpen;
            return;
        }
        if (!filterOverlayWasOpenRef.current && isOpen) {
            filterOverlayScrollRestoreRef.current = window.scrollY || 0;
            const nextTop = Math.max(rootNode.getBoundingClientRect().top + window.scrollY - 12, 0);
            window.scrollTo({ top: nextTop, behavior: "auto" });
        } else if (filterOverlayWasOpenRef.current && !isOpen) {
            window.scrollTo({ top: Math.max(filterOverlayScrollRestoreRef.current || 0, 0), behavior: "auto" });
        }
        filterOverlayWasOpenRef.current = isOpen;
    }, [compactMode, railFilterState.showOverlayBody, useFilterRail]);

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
        readinessMessage: readiness.message,
        activeTablePresetTitle: String(activeTablePreset?.title || "").trim(),
        modifiedTablePresetTitle: String(modifiedTablePreset?.title || "").trim(),
    }), [activeTablePreset?.title, canRunReport, canShowResults, computedCollection.length, error, explicitChartMode, hasValidChartSpec, loading, modifiedTablePreset?.title, readiness.message, readiness.reason, state.chartSpec, state.viewMode]);

    const compactSummaryItems = useMemo(() => resolveCompactSummaryItems({
        requiredStaticFilters: compactRequiredStaticFilters,
        staticFilters: state.staticFilters,
        selectedMeasures: state.selectedMeasures,
        selectedDimensions: state.selectedDimensions,
        totalActiveFilterCount,
        hasValidChartSpec,
        canShowResults,
        viewMode: state.viewMode,
        activeTablePresetTitle: String(activeTablePreset?.title || "").trim(),
        modifiedTablePresetTitle: String(modifiedTablePreset?.title || "").trim(),
    }), [activeTablePreset?.title, canShowResults, compactRequiredStaticFilters, hasValidChartSpec, modifiedTablePreset?.title, state.selectedDimensions, state.selectedMeasures, state.staticFilters, state.viewMode, totalActiveFilterCount]);

    const retainVisibleResultsWhileLoading = hasCompletedCurrentRun && computedCollection.length > 0;
    const showingChartView = !error && canShowResults && (!loading || retainVisibleResultsWhileLoading) && (
        (explicitChartMode && hasValidChartSpec && state.viewMode === "chart")
        || (!explicitChartMode && state.viewMode !== "table")
    );
    useEffect(() => {
        if (selectedBuilderChartSelection == null) {
            return;
        }
        if (!showingChartView) {
            setSelectedBuilderChartSelection(null);
        }
    }, [selectedBuilderChartSelection, showingChartView]);
    useEffect(() => {
        setSelectedBuilderChartSelection(null);
    }, [currentRequestFingerprint]);

    const compactChartSheetNotice = useMemo(() => {
        return resolveCompactChartSheetNotice({
            chartApplyFeedback,
            semanticSelectedIssueCount: semanticSelectedIssues.length,
            semanticFieldValidationMessage: semanticFieldValidation?.message,
            readinessReason: readiness.reason,
            readinessMessage: readiness.message,
            semanticStatusLevel: semanticStatus?.level,
            semanticSelectionValidationError: semanticSelectionValidationState.error,
            semanticSelectionValidationValid: semanticSelectionValidationState.valid,
            showingChartView,
            activeTablePresetTitle: activeTablePreset?.title,
            modifiedTablePresetTitle: modifiedTablePreset?.title,
        });
    }, [activeTablePreset?.title, chartApplyFeedback, modifiedTablePreset?.title, readiness.message, readiness.reason, semanticFieldValidation?.message, semanticSelectedIssues.length, semanticSelectionValidationState.error, semanticSelectionValidationState.valid, semanticStatus?.level, showingChartView]);
    const desktopResultState = useMemo(() => buildReportBuilderDesktopResultState({
        showingChartView,
        chartTitle: String(state.chartSpec?.title || "").trim(),
        fallbackChartTitle: (() => {
            const typeLabel = chartTypeLabel(state.chartSpec?.type || "");
            return typeLabel ? `${typeLabel} chart` : "Chart results";
        })(),
        chartUsesFullQuery: chartDataPolicy.mode === "fullQuery",
        canShowResults,
        canRunReport,
        loading,
        error,
        readinessReason: readiness.reason,
        readinessMessage: readiness.message,
        activeTablePresetTitle: String(activeTablePreset?.title || "").trim(),
        activeTablePresetDescription: String(activeTablePreset?.description || "").trim(),
        activeTablePresetEyebrow: String(activeTablePreset?.eyebrow || "").trim(),
        activeTablePresetAccentTone: String(activeTablePreset?.accentTone || "").trim(),
        activeTablePresetHighlights: Array.isArray(activeTablePreset?.highlights) ? activeTablePreset.highlights : [],
        activeChartPresetTitle: String(state.chartSpec?.title || "").trim(),
        activeChartPresetEyebrow: String(state.chartSpec?.eyebrow || "").trim(),
        activeChartPresetAccentTone: String(state.chartSpec?.accentTone || "").trim(),
        activeChartPresetHighlights: Array.isArray(state.chartSpec?.highlights) ? state.chartSpec.highlights : [],
        modifiedTablePresetTitle: String(modifiedTablePreset?.title || "").trim(),
        chartIdentityLabel: showingChartView ? chartTypeLabel(state.chartSpec?.type || "") : "",
        selectedMeasuresCount: state.selectedMeasures.length,
        selectedDimensionsCount: state.selectedDimensions.length,
        totalActiveFilterCount,
        pageRowCount: canShowResults ? computedCollection.length : 0,
    }), [activeTablePreset?.accentTone, activeTablePreset?.description, activeTablePreset?.eyebrow, activeTablePreset?.highlights, activeTablePreset?.title, canRunReport, canShowResults, chartDataPolicy.mode, computedCollection.length, error, loading, modifiedTablePreset?.title, readiness.message, readiness.reason, showingChartView, state.chartSpec, state.selectedDimensions.length, state.selectedMeasures.length, totalActiveFilterCount]);

    useEffect(() => {
        const deferForPrefill = shouldDeferReportBuilderRequestForPrefill({
            currentPrefillSignature,
            appliedPrefillSignature: appliedPrefillSignatureRef.current,
        });
        const fetchRecords = builderContext?.handlers?.dataSource?.fetchRecords;
        const transition = resolveReportBuilderChartQueryStateTransition({
            mode: chartDataPolicy.mode,
            deferForPrefill,
            showingChartView,
            hasRequest: !!chartQueryRequest,
            fingerprint: chartQueryFingerprint,
            requestKey: chartQueryRequestKey,
            fetchAvailable: typeof fetchRecords === "function",
            currentState: chartQueryState,
            unavailableError: new Error("Chart data fetch is unavailable for full-query mode."),
        });
        if (transition.type === "reset" || transition.type === "unavailable") {
            setChartQueryState(transition.nextState);
            return;
        }
        if (transition.type === "noop") {
            return;
        }
        let cancelled = false;
        setChartQueryState(transition.nextState);
        fetchRecords({ parameters: chartQueryRequest, requestKind: "chartQuery" })
            .then((body) => {
                if (cancelled) {
                    return;
                }
                setChartQueryState(buildResolvedReportBuilderChartQueryState({
                    fingerprint: chartQueryFingerprint,
                    requestKey: chartQueryRequestKey,
                    rows: Array.isArray(body?.rows) ? body.rows : [],
                }));
            })
            .catch((fetchError) => {
                if (cancelled) {
                    return;
                }
                setChartQueryState((current) => buildRejectedReportBuilderChartQueryState({
                    fingerprint: chartQueryFingerprint,
                    requestKey: chartQueryRequestKey,
                    currentState: current,
                    error: fetchError,
                }));
            });
        return () => {
            cancelled = true;
        };
    }, [builderContext, chartDataPolicy.mode, chartQueryFingerprint, chartQueryRequest, chartQueryRequestKey, chartQueryState, currentPrefillSignature, manualRunSequence, showingChartView]);
    const compiledRuntimePreviewModel = useMemo(() => {
        return buildReportBuilderRuntimePreviewModel({
            container,
            config: displayConfig,
            state,
            refinements: runtimePreviewRefinements,
            drillTransitions: runtimePreviewDrillTransitions,
            semanticSummary: resolvedSemanticSummary,
            requestTransform: ({ request, state: runtimeState }) => applyReportBuilderRequestHook(
                builderContext,
                displayConfig,
                runtimeState,
                request,
            ),
        });
    }, [
        builderContext,
        container,
        displayConfig,
        runtimePreviewDrillTransitions,
        runtimePreviewRefinements,
        resolvedSemanticSummary,
        state,
    ]);
    const authoredCapabilities = useMemo(() => buildReportBuilderAuthoredCapabilityViewModel({
        compiledRuntimePreviewModel,
        authoredKpiValueFieldOptions,
    }), [compiledRuntimePreviewModel, authoredKpiValueFieldOptions]);
    const authoredActionsById = useMemo(
        () => new Map((Array.isArray(authoredCapabilities.actions) ? authoredCapabilities.actions : []).map((action) => [action.id, action])),
        [authoredCapabilities.actions],
    );
    const runtimePreviewModel = useMemo(
        () => (shouldCompileRuntimePreview ? compiledRuntimePreviewModel : null),
        [compiledRuntimePreviewModel, shouldCompileRuntimePreview],
    );
    const runtimePreviewPrimaryDataset = useMemo(
        () => (Array.isArray(runtimePreviewModel?.reportSpec?.datasets)
            ? (runtimePreviewModel.reportSpec.datasets.find((dataset) => String(dataset?.id || "").trim() === "primary")
                || runtimePreviewModel.reportSpec.datasets[0]
                || null)
            : null),
        [runtimePreviewModel],
    );
    const runtimePreviewRequest = useMemo(
        () => (runtimePreviewPrimaryDataset?.request && typeof runtimePreviewPrimaryDataset.request === "object"
            ? runtimePreviewPrimaryDataset.request
            : null),
        [runtimePreviewPrimaryDataset],
    );
    const runtimePreviewFingerprint = useMemo(
        () => (runtimePreviewRequest ? JSON.stringify(runtimePreviewRequest) : ""),
        [runtimePreviewRequest],
    );
    const runtimePreviewRequestKey = useMemo(
        () => buildReportRuntimePreviewRequestKey(runtimePreviewFingerprint, manualRunSequence),
        [manualRunSequence, runtimePreviewFingerprint],
    );
    const runtimePreviewRowsState = useReportRuntimePreviewRows({
        enabled: runtimePreviewEnabled,
        canRun: canRunReport,
        hasModel: !!runtimePreviewModel,
        request: runtimePreviewRequest,
        fingerprint: runtimePreviewFingerprint,
        requestKey: runtimePreviewRequestKey,
        fetchRecords: builderContext?.handlers?.dataSource?.fetchRecords || null,
        requestKind: "runtimePreview",
        unavailableErrorMessage: "Runtime preview fetch is unavailable for this data source.",
    });
    const runtimePreviewRowsSource = resolveReportBuilderRuntimePreviewRowsSource({
        currentRequestFingerprint,
        requestDispatchFingerprint: requestFingerprintRef.current,
        currentRequestShouldFetch,
        runtimePreviewFingerprint,
        hasCompletedCurrentRun,
        collection,
        collectionInfo,
        loading,
        error,
        fetchedRows: runtimePreviewRowsState.rows,
        fetchedHasMore: runtimePreviewRowsState.hasMore,
        fetchedError: runtimePreviewRowsState.error,
        fetchedLoading: runtimePreviewRowsState.loading,
    });
    const runtimePreviewSurface = useAuthoredRuntimePreviewSurface({
        interaction: runtimePreviewInteraction,
        semanticModelHandler: builderContext?.handlers?.semanticModel || null,
        reportSpec: runtimePreviewModel?.reportSpec || {},
    });
    const runtimePreviewHostIntent = runtimePreviewSurface.hostIntent;
    const runtimePreviewDetailDiagnostic = runtimePreviewSurface.detailDiagnostic;
    const runtimePreviewArtifact = useMemo(() => {
        if (!runtimePreviewModel) {
            return null;
        }
        return buildReportBuilderRuntimePreview({
            model: runtimePreviewModel,
            rows: runtimePreviewRowsSource.rows,
            hasMore: runtimePreviewRowsSource.hasMore,
            error: runtimePreviewRowsSource.error,
            additionalDiagnostics: [
                ...runtimePreviewArtifactDiagnostics,
                ...(runtimePreviewDetailDiagnostic ? [runtimePreviewDetailDiagnostic] : []),
                ...authoredDocumentBlockDiagnostics,
            ],
            runtimeTitle: String(runtimePreviewConfig?.title || "").trim()
                || resolveReportDocumentMetadataTitle(state, container, displayConfig),
            runtimeSubtitle: String(runtimePreviewConfig?.subtitle || "").trim()
                || String(state?.reportDocumentSubtitle || "").trim()
                || String(state?.reportDocumentDescription || "").trim()
                || "Compiled from the current builder state using the generic Forge runtime contract.",
            hostIntent: runtimePreviewHostIntent,
        });
    }, [authoredDocumentBlockDiagnostics, container, displayConfig, runtimePreviewArtifactDiagnostics, runtimePreviewConfig?.subtitle, runtimePreviewConfig?.title, runtimePreviewDetailDiagnostic, runtimePreviewHostIntent, runtimePreviewModel, runtimePreviewRowsSource.error, runtimePreviewRowsSource.hasMore, runtimePreviewRowsSource.rows, state]);
    const draftExportRequest = useMemo(
        () => runtimePreviewArtifact?.exportRequest || null,
        [runtimePreviewArtifact],
    );
    const draftExportExecution = useReportBuilderExportExecution({
        request: draftExportRequest,
        sourceKind: "draft",
        reportExportHandler,
        setFeedback: setChartApplyFeedback,
        missingRequestMessage: "No draft export request is available.",
        missingJobMessage: "No draft export job is available to refresh.",
        missingArtifactMessage: "No completed draft export artifact is available yet.",
    });
    const savedReportPayloadExportExecution = useReportBuilderExportExecution({
        request: savedReportPayloadExportRequest,
        sourceKind: "savedPayload",
        reportExportHandler,
        setFeedback: setChartApplyFeedback,
        missingRequestMessage: "No canonical saved export snapshot is available for this report payload yet.",
        missingJobMessage: "No saved export job is available to refresh.",
        missingArtifactMessage: "No completed saved export artifact is available yet.",
    });
    const reopenedExportExecution = useReportBuilderExportExecution({
        request: reopenedExportRequest,
        sourceKind: "reopened",
        reportExportHandler,
        setFeedback: setChartApplyFeedback,
        missingRequestMessage: "No canonical export snapshot is available for the reopened ReportDocument.",
        missingJobMessage: "No reopened export job is available to refresh.",
        missingArtifactMessage: "No completed reopened export artifact is available yet.",
    });
    const selectedListEntryExportExecution = useReportBuilderExportExecution({
        request: selectedListEntryExportRequest,
        sourceKind: "listEntry",
        reportExportHandler,
        setFeedback: setChartApplyFeedback,
        missingRequestMessage: "No canonical export snapshot is available for the selected list entry.",
        missingJobMessage: "No selected export job is available to refresh.",
        missingArtifactMessage: "No completed selected export artifact is available yet.",
    });
    const runtimePreviewHandlers = runtimePreviewSurface.runtimeHandlers;

    useEffect(() => {
        if (!hydratedReportDocumentSession) {
            return;
        }
        const hydratedChanged = lastHydratedRuntimePreviewInteractionFingerprintRef.current !== hydratedRuntimePreviewInteractionFingerprint;
        lastHydratedRuntimePreviewInteractionFingerprintRef.current = hydratedRuntimePreviewInteractionFingerprint;
        if (runtimePreviewInteractionSnapshotFingerprint === hydratedRuntimePreviewInteractionFingerprint) {
            return;
        }
        if (hydratedChanged) {
            return;
        }
        if (!runtimePreviewInteractionSnapshot && hydratedRuntimePreviewInteractionSnapshot) {
            return;
        }
        const nextSession = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(
            hydratedReportDocumentSession,
            runtimePreviewInteractionSnapshot,
        );
        if (!nextSession) {
            return;
        }
        persistStateWithConfig(
            applyReportBuilderHydratedDocumentSessionState(state, nextSession),
            config,
            { skipExplorationHistory: true },
        );
    }, [
        config,
        hydratedReportDocumentSession,
        hydratedRuntimePreviewInteractionSnapshot,
        hydratedRuntimePreviewInteractionFingerprint,
        persistStateWithConfig,
        runtimePreviewInteractionSnapshot,
        runtimePreviewInteractionSnapshotFingerprint,
        state,
    ]);

    const chartRenderCollection = useMemo(
        () => resolveReportBuilderChartCollection({
            computedCollection,
            chartCollection: chartQueryCollection,
            policy: chartDataPolicy,
            chartQueryLoading: chartQueryState.loading,
        }),
        [chartDataPolicy, chartQueryCollection, chartQueryState.loading, computedCollection],
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

    const { activeResultLoading, activeResultError, reportBuilderStateMarker } = useMemo(() => resolveReportBuilderActiveResultState({
        loading,
        error,
        chartDataMode: chartDataPolicy.mode,
        showingChartView,
        chartQueryLoading: chartQueryState.loading,
        chartRenderRowCount: chartRenderCollection.length,
        chartQueryError: chartQueryState.error,
        resolvedResultRowCount: computedCollection.length,
        retainResultsWhileLoading: retainVisibleResultsWhileLoading,
        canRunReport,
        canShowResults,
    }), [canRunReport, canShowResults, chartDataPolicy.mode, chartQueryState.error, chartQueryState.loading, chartRenderCollection.length, computedCollection.length, error, loading, retainVisibleResultsWhileLoading, showingChartView]);
    const emptyResultState = useMemo(() => buildReportBuilderEmptyResultState({
        canRunReport,
        hasCompletedCurrentRun,
        readinessReason: readiness.reason,
        readinessMessage: readiness.message,
        readinessAction: readiness.action,
    }), [canRunReport, hasCompletedCurrentRun, readiness.action, readiness.message, readiness.reason]);
    const runtimePreviewBlockedState = useMemo(() => buildReportBuilderRuntimePreviewBlockedState({
        canRunReport,
        readinessReason: readiness.reason,
        readinessMessage: readiness.message,
        readinessAction: readiness.action,
        semanticDiagnosticsNotice,
    }), [canRunReport, readiness.action, readiness.message, readiness.reason, semanticDiagnosticsNotice]);
    const resultVisibility = useMemo(() => resolveReportBuilderResultVisibility({
        activeResultLoading,
        activeResultError,
        canShowResults,
        explicitChartMode,
        hasValidChartSpec,
        hasStaleChartSpec,
        viewMode: state.viewMode,
    }), [activeResultError, activeResultLoading, canShowResults, explicitChartMode, hasStaleChartSpec, hasValidChartSpec, state.viewMode]);
    const chartPlaceholderState = useMemo(() => buildReportBuilderChartPlaceholderState({
        hasStaleChartSpec,
        compactMode,
        canCreateChart,
        staleDescription: (chartSpecValidation.errors || []).map((entry) => chartErrorMessage(entry, { dimensions: chartDimensions, measures: chartMeasures })).join(" "),
    }), [canCreateChart, chartDimensions, chartMeasures, chartSpecValidation.errors, compactMode, hasStaleChartSpec]);
    const showPagination = resultVisibility.showPagination;

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

    const persistExplorationMutation = React.useCallback((nextState, {
        sourceKind = "reportBuilder.result",
        sourceContext = null,
    } = {}) => {
        if (!nextState || typeof nextState !== "object" || Array.isArray(nextState)) {
            return;
        }
        const currentState = currentBuilderStateRef.current || {};
        const currentCanShowResults = canShowResultsRef.current;
        const currentExplorationActive = isReportBuilderExplorationActive(currentState);
        if (!currentCanShowResults || currentExplorationActive) {
            persistState(nextState);
            return;
        }
        const startedState = beginReportBuilderExplorationSession(currentState, {
            container,
            sourceKind,
            sourceContext,
        });
        const draftedState = recordReportBuilderExplorationHistory(startedState, nextState);
        persistState(draftedState, { skipExplorationHistory: true });
        setChartApplyFeedback({
            level: "info",
            message: normalizeString(sourceContext?.label)
                ? `Draft started from ${normalizeString(sourceContext.label)}.`
                : "Draft started.",
        });
    }, [container, persistState]);

    const persistPassiveViewState = React.useCallback((nextState) => {
        if (!nextState || typeof nextState !== "object" || Array.isArray(nextState)) {
            return;
        }
        const currentState = currentBuilderStateRef.current || {};
        const activeSession = isReportBuilderExplorationActive(currentState)
            ? cloneReportBuilderValue(currentState.explorationSession)
            : null;
        const nextPersistedState = activeSession
            ? {
                ...nextState,
                explorationSession: activeSession,
            }
            : nextState;
        persistState(nextPersistedState, { skipExplorationHistory: true });
    }, [persistState]);

    const persistDynamicScaffoldingMutation = React.useCallback((nextState, groupIds = [], {
        sourceKind = "reportBuilder.result",
        sourceContext = null,
    } = {}) => {
        if (!nextState || typeof nextState !== "object" || Array.isArray(nextState)) {
            return;
        }
        const currentState = currentBuilderStateRef.current || {};
        const currentExplorationActive = isReportBuilderExplorationActive(currentState);
        const relevantGroupIds = normalizeArray(groupIds)
            .map((entry) => String(entry || "").trim())
            .filter(Boolean);
        if (currentExplorationActive || relevantGroupIds.length === 0) {
            persistExplorationMutation(nextState, { sourceKind, sourceContext });
            return;
        }
        const selectionCountsUnchanged = relevantGroupIds.every((groupId) => (
            countEffectiveDynamicSelections(currentState?.dynamicGroups?.[groupId] || [])
            === countEffectiveDynamicSelections(nextState?.dynamicGroups?.[groupId] || [])
        ));
        if (selectionCountsUnchanged) {
            persistPassiveViewState(nextState);
            return;
        }
        persistExplorationMutation(nextState, { sourceKind, sourceContext });
    }, [persistExplorationMutation, persistPassiveViewState]);

    const toggleMeasure = (measureId) => {
        const id = String(measureId || "").trim();
        if (!id) return;
        const current = Array.isArray(state.selectedMeasures) ? state.selectedMeasures : [];
        const has = current.includes(id);
        const nextMeasures = has ? current.filter((entry) => entry !== id) : [...current, id];
        const ensuredMeasures = nextMeasures.length > 0 ? nextMeasures : [id];
        persistExplorationMutation({
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
        persistExplorationMutation({
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
        const ensuredDimensions = nextDimensions.length > 0 ? nextDimensions : [id];
        persistExplorationMutation({
            ...state,
            selectedDimensions: ensuredDimensions,
            groupBy: clearReportBuilderGroupByWhenMissing(config, state.groupBy, ensuredDimensions),
        });
    };

    const addDimension = (dimensionId) => {
        const id = String(dimensionId || "").trim();
        if (!id) return;
        const current = Array.isArray(state.selectedDimensions) ? state.selectedDimensions : [];
        if (current.includes(id)) {
            return;
        }
        const nextDimensions = [...current, id];
        persistExplorationMutation({
            ...state,
            selectedDimensions: nextDimensions,
            groupBy: clearReportBuilderGroupByWhenMissing(config, state.groupBy, nextDimensions),
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
        const ensuredDimensions = nextDimensions.length > 0 ? nextDimensions : current;
        persistExplorationMutation({
            ...state,
            selectedDimensions: ensuredDimensions,
            groupBy: clearReportBuilderGroupByWhenMissing(config, state.groupBy, ensuredDimensions),
        });
    };

    const setViewMode = (viewMode) => {
        if (explicitChartMode && viewMode === "chart" && !hasValidChartSpec) {
            return;
        }
        persistExplorationMutation({
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
        const validation = validateReportBuilderChartSpec(displayConfig, normalized, chartFields);
        if (!normalized || !validation.valid) {
            return false;
        }
        persistExplorationMutation({
            ...state,
            chartSpec: normalized,
            viewMode: "chart",
        });
        setChartApplyFeedback(null);
        if (savePreset) {
            saveChartPreset(normalized);
        }
        return true;
    }, [chartFields, displayConfig, persistExplorationMutation, saveChartPreset, state]);

    const removeChart = React.useCallback(() => {
        persistExplorationMutation({
            ...state,
            chartSpec: null,
            viewMode: "table",
        });
        setChartApplyFeedback(null);
    }, [persistExplorationMutation, state]);

    const actionModel = useMemo(() => buildReportBuilderActionModel({
        viewModes,
        explicitChartMode,
        hasValidChartSpec,
        canShowResults,
        canRunReport,
        loading,
    }), [canRunReport, canShowResults, explicitChartMode, hasValidChartSpec, loading, viewModes]);
    const compactChartSheetState = useMemo(() => buildReportBuilderCompactChartSheetState({
        hasValidChartSpec,
        chartTitle: state.chartSpec?.title || "",
        notice: compactChartSheetNotice,
        canCreateChart,
        hasTableQuickPresets,
        quickChartOptions,
        showQuickChartActions: actionModel.compact.chartSheet.showQuickChartActions,
        showEditChart: actionModel.compact.chartSheet.showEditChart,
        showRemoveChart: actionModel.compact.chartSheet.showRemoveChart,
        showViewToggle: actionModel.compact.chartSheet.showViewToggle,
        showExport: actionModel.compact.chartSheet.showExport,
        showEmptyState: actionModel.compact.chartSheet.showEmptyState,
        activeTablePresetTitle: String(activeTablePreset?.title || "").trim(),
        activeTablePresetEyebrow: String(activeTablePreset?.eyebrow || "").trim(),
        activeTablePresetAccentTone: String(activeTablePreset?.accentTone || "").trim(),
        activeTablePresetHighlights: Array.isArray(activeTablePreset?.highlights) ? activeTablePreset.highlights : [],
        activeChartPresetTitle: String(state.chartSpec?.title || "").trim(),
        activeChartPresetEyebrow: String(state.chartSpec?.eyebrow || "").trim(),
        activeChartPresetAccentTone: String(state.chartSpec?.accentTone || "").trim(),
        activeChartPresetHighlights: Array.isArray(state.chartSpec?.highlights) ? state.chartSpec.highlights : [],
    }), [
        actionModel.compact.chartSheet.showEditChart,
        actionModel.compact.chartSheet.showEmptyState,
        actionModel.compact.chartSheet.showExport,
        actionModel.compact.chartSheet.showQuickChartActions,
        actionModel.compact.chartSheet.showRemoveChart,
        actionModel.compact.chartSheet.showViewToggle,
        activeTablePreset?.accentTone,
        activeTablePreset?.eyebrow,
        activeTablePreset?.highlights,
        activeTablePreset?.title,
        canCreateChart,
        compactChartSheetNotice,
        hasTableQuickPresets,
        hasValidChartSpec,
        quickChartOptions,
        state.chartSpec?.accentTone,
        state.chartSpec?.eyebrow,
        state.chartSpec?.highlights,
        state.chartSpec?.title,
    ]);

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
    const desktopResultHeaderState = useMemo(() => buildReportBuilderDesktopResultHeaderState({
        desktopActionModel: actionModel.desktop,
        resultViewModes,
        currentViewMode: state.viewMode,
        explicitChartMode,
        hasValidChartSpec,
        canCreateChart,
        hasTableQuickPresets,
        quickChartOptions,
        overflowActionCount: desktopResultOverflowActions.length,
    }), [
        actionModel.desktop,
        canCreateChart,
        desktopResultOverflowActions.length,
        explicitChartMode,
        hasTableQuickPresets,
        hasValidChartSpec,
        quickChartOptions,
        resultViewModes,
        state.viewMode,
    ]);

    const openChartDialog = React.useCallback((seed = null) => {
        const nextDraft = buildDefaultReportBuilderChartSpec(displayConfig, state, seed || {}, {
            suggestSeriesField: true,
        });
        if (!nextDraft) {
            return;
        }
        setChartApplyFeedback(null);
        setChartDraft(nextDraft);
        setChartDialogOpen(true);
    }, [displayConfig, state]);

    const applyQuickTableCalculation = React.useCallback((tableCalculationId = "") => {
        const prepared = prepareReportBuilderTableCalculationApplication(displayConfig, state, tableCalculationId, {
            forceAutoFetch: true,
            switchToTable: true,
        });
        if (!prepared.canApply) {
            setChartApplyFeedback({
                level: "danger",
                message: prepared.message || "This table calculation could not be added.",
            });
            return;
        }
        const authored = upsertReportBuilderLocalTableCalculationState(prepared.nextState, semanticDisplayConfig, tableCalculationId, {
            selectOnCreate: true,
        });
        if (!authored.valid) {
            setChartApplyFeedback({
                level: "danger",
                message: authored.errors?.[0]?.message || "This table calculation could not be materialized into builder state.",
            });
            return;
        }
        persistExplorationMutation(authored.nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: authored.field?.label || authored.field?.id || "Table calculation",
            },
        });
        const preparedReadiness = resolveStateReadiness(authored.nextState);
        const didFetchPreparedState = prepared.shouldFetch && preparedReadiness.canRun;
        if (didFetchPreparedState) {
            dispatchReportRequest(authored.nextState, { forceFetch: true });
        }
        setChartApplyFeedback(buildReportBuilderPresetApplyFeedback({
            kind: "tableCalc",
            presetTitle: prepared.tableCalculation?.label || prepared.tableCalculation?.id || "this table calculation",
            selectionChanged: prepared.selectionChanged,
            didFetchPreparedState,
            preparedReadiness,
            requiresManualRun: prepared.requiresManualRun,
        }));
    }, [dispatchReportRequest, displayConfig, persistExplorationMutation, resolveStateReadiness, semanticDisplayConfig, state]);

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
        if (next.kind === "table") {
            const prepared = next.prepared || prepareReportBuilderTablePresetApplication(displayConfig, state, next.spec, {
                forceAutoFetch: quickPresetPolicy.autoFetchOnSelect,
                selectionPolicy: next.spec?.selectionPolicy || quickPresetPolicy.selectionPolicy,
            });
            if (!prepared.canApply) {
                setChartApplyFeedback({
                    level: "danger",
                    message: prepared.message || "This table preset could not be applied.",
                });
                setSelectedQuickChartOption("");
                return;
            }
            persistExplorationMutation(prepared.nextState, {
                sourceKind: "reportBuilder.result",
                sourceContext: {
                    label: prepared.normalizedPreset?.title || "Table preset",
                },
            });
            const preparedReadiness = resolveStateReadiness(prepared.nextState);
            const didFetchPreparedState = prepared.shouldFetch && preparedReadiness.canRun;
            if (didFetchPreparedState) {
                dispatchReportRequest(prepared.nextState, { forceFetch: true });
            }
            const changedParts = [];
            if (prepared.measureSelectionChanged || prepared.primaryMeasureChanged) {
                changedParts.push("measures");
            }
            if (prepared.dimensionSelectionChanged) {
                changedParts.push("breakdowns");
            }
            if (prepared.orderChanged) {
                changedParts.push("sorting");
            }
            if (prepared.pageSizeChanged) {
                changedParts.push("page size");
            }
            setChartApplyFeedback(buildReportBuilderPresetApplyFeedback({
                kind: "table",
                presetTitle: prepared.normalizedPreset?.title || "this table preset",
                changedParts,
                selectionChanged: prepared.selectionChanged,
                didFetchPreparedState,
                preparedReadiness,
                requiresManualRun: prepared.requiresManualRun,
            }));
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
        const prepared = next.prepared || prepareReportBuilderChartApplication(displayConfig, state, next.spec, {
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
        persistExplorationMutation(prepared.nextState, {
            sourceKind: "reportBuilder.chartResult",
            sourceContext: {
                label: prepared.normalizedChartSpec?.title || next.label || "Chart",
            },
        });
        const preparedReadiness = resolveStateReadiness(prepared.nextState);
        const didFetchPreparedState = prepared.shouldFetch && preparedReadiness.canRun;
        if (didFetchPreparedState) {
            dispatchReportRequest(prepared.nextState, { forceFetch: true });
        }
        const changedParts = [];
        if (prepared.measureSelectionChanged || prepared.primaryMeasureChanged) {
            changedParts.push("measures");
        }
        if (prepared.dimensionSelectionChanged) {
            changedParts.push("breakdowns");
        }
        setChartApplyFeedback(buildReportBuilderPresetApplyFeedback({
            kind: "chart",
            changedParts,
            selectionChanged: prepared.selectionChanged,
            didFetchPreparedState,
            preparedReadiness,
            requiresManualRun: prepared.requiresManualRun,
        }));
        saveChartPreset(prepared.normalizedChartSpec, {
            settingsHash: buildReportBuilderSettingsHash(prepared.nextState),
        });
        setSelectedQuickChartOption("");
    }, [applyChartSpec, dispatchReportRequest, displayConfig, persistExplorationMutation, quickChartOptions, quickPresetPolicy.autoFetchOnSelect, quickPresetPolicy.autoProvisionMissingDimensions, quickPresetPolicy.selectionPolicy, resolveStateReadiness, saveChartPreset, selectedQuickChartOption, state]);

    const runCompactPrimaryAction = React.useCallback(() => {
        closeCompactSheet();
        closeCompactChartSheet();
        runReport();
    }, [closeCompactChartSheet, closeCompactSheet, runReport]);

    const compactBottomBarActions = useMemo(() => buildReportBuilderCompactBottomBarActions({
        bottomBar: actionModel.compact.bottomBar,
        onOpenSetup: () => openCompactSheet("scope"),
        onOpenChart: () => setCompactChartSheetOpen(true),
        onRunPrimary: runCompactPrimaryAction,
    }), [actionModel.compact.bottomBar, openCompactSheet, runCompactPrimaryAction]);

    const chartDraftValidation = useMemo(
        () => validateReportBuilderChartSpec(displayConfig, chartDraft, chartFields),
        [chartDraft, chartFields, displayConfig],
    );
    const calculatedFieldDraftValidation = useMemo(
        () => validateReportBuilderCalculatedFieldDraft(calculatedFieldDraft, displayConfig, {
            editingId: editingCalculatedFieldId,
        }),
        [calculatedFieldDraft, displayConfig, editingCalculatedFieldId],
    );
    const tableCalculationDraftValidation = useMemo(
        () => validateReportBuilderTableCalculationDraft(tableCalculationDraft, displayConfig, {
            editingId: editingTableCalculationId,
        }),
        [displayConfig, editingTableCalculationId, tableCalculationDraft],
    );
    const openDocumentBlockDialog = React.useCallback((kindOrSeed = "markdownBlock") => {
        const seed = kindOrSeed && typeof kindOrSeed === "object" && !Array.isArray(kindOrSeed)
            ? kindOrSeed
            : { kind: kindOrSeed };
        setChartApplyFeedback(null);
        setEditingDocumentBlockId(String(seed?.id || "").trim());
        setDocumentBlockDraft(buildReportBuilderDocumentBlockDraft(seed?.kind || "markdownBlock", seed, {
            existingBlocks: authoredDocumentBlocks,
            valueFieldOptions: authoredKpiValueFieldOptions,
            secondaryFieldOptions: authoredKpiSecondaryFieldOptions,
            tableColumnOptions: authoredTableColumnOptions,
            scopeParamOptions: authoredScopeParamOptions,
            chartConfig: authoredChartConfig,
            chartState: authoredChartState,
        }));
        setDocumentBlockDialogOpen(true);
    }, [authoredChartConfig, authoredChartState, authoredDocumentBlocks, authoredKpiSecondaryFieldOptions, authoredKpiValueFieldOptions, authoredScopeParamOptions, authoredTableColumnOptions]);
    const openAuthoredChartBlockDialog = React.useCallback((seed = null) => {
        const nextDraft = buildReportBuilderDocumentBlockDraft("chartBlock", seed, {
            existingBlocks: authoredDocumentBlocks,
            chartConfig: authoredChartConfig,
            chartState: authoredChartState,
        });
        if (!nextDraft?.chartSpec) {
            return;
        }
        setChartApplyFeedback(null);
        setEditingAuthoredChartBlockId(String(seed?.id || "").trim());
        setAuthoredChartBlockDraft(nextDraft);
        setAuthoredChartBlockDialogOpen(true);
    }, [authoredChartConfig, authoredChartState, authoredDocumentBlocks]);
    const openDocumentBlockDialogForDiagnostic = React.useCallback((diagnostic = null) => {
        const targetBlockId = String(diagnostic?.blockId || "").trim();
        if (!targetBlockId) {
            return;
        }
        const block = authoredDocumentBlocks.find((entry) => String(entry?.id || "").trim() === targetBlockId);
        if (!block) {
            return;
        }
        if (String(block?.kind || "").trim() === "chartBlock") {
            openAuthoredChartBlockDialog(block);
            return;
        }
        openDocumentBlockDialog(block);
    }, [authoredDocumentBlocks, openAuthoredChartBlockDialog, openDocumentBlockDialog]);
    const closeDocumentBlockDialog = React.useCallback(() => {
        setDocumentBlockDialogOpen(false);
        setEditingDocumentBlockId("");
        setDocumentBlockDraft(buildReportBuilderDocumentBlockDraft("markdownBlock"));
    }, []);
    const closeAuthoredChartBlockDialog = React.useCallback(() => {
        setAuthoredChartBlockDialogOpen(false);
        setEditingAuthoredChartBlockId("");
        setAuthoredChartBlockDraft(null);
    }, []);
    const openCalculatedFieldDialog = React.useCallback((seed = null) => {
        setChartApplyFeedback(null);
        setEditingCalculatedFieldId(String(seed?.id || "").trim());
        setCalculatedFieldDraft(buildReportBuilderCalculatedFieldDraft(seed));
        setCalculatedFieldDialogOpen(true);
    }, []);
    const closeCalculatedFieldDialog = React.useCallback(() => {
        setCalculatedFieldDialogOpen(false);
        setEditingCalculatedFieldId("");
        setCalculatedFieldDraft(buildReportBuilderCalculatedFieldDraft());
    }, []);
    const openTableCalculationDialog = React.useCallback((seed = null) => {
        setChartApplyFeedback(null);
        setEditingTableCalculationId(String(seed?.id || "").trim());
        setTableCalculationDraft(buildReportBuilderTableCalculationDraft(seed));
        setTableCalculationDialogOpen(true);
    }, []);
    const closeTableCalculationDialog = React.useCallback(() => {
        setTableCalculationDialogOpen(false);
        setEditingTableCalculationId("");
        setTableCalculationDraft(buildReportBuilderTableCalculationDraft());
    }, []);
    const applyCalculatedFieldDraft = React.useCallback(() => {
        const result = upsertReportBuilderLocalCalculatedFieldState(state, calculatedFieldDraft, displayConfig, {
            editingId: editingCalculatedFieldId,
            selectOnCreate: true,
        });
        if (!result.valid) {
            return false;
        }
        persistExplorationMutation(result.nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: result.field?.label || result.field?.id || "Calculated field",
            },
        });
        closeCalculatedFieldDialog();
        setChartApplyFeedback({
            level: "success",
            message: editingCalculatedFieldId
                ? `${result.field?.label || result.field?.id || "Calculated field"} updated.`
                : `${result.field?.label || result.field?.id || "Calculated field"} added to the builder.`,
        });
        return true;
    }, [calculatedFieldDraft, closeCalculatedFieldDialog, displayConfig, editingCalculatedFieldId, persistExplorationMutation, state]);
    const applyTableCalculationDraft = React.useCallback(() => {
        const authored = upsertReportBuilderLocalTableCalculationDraftState(state, tableCalculationDraft, displayConfig, {
            editingId: editingTableCalculationId,
            selectOnCreate: true,
        });
        if (!authored.valid || !authored.field) {
            return false;
        }
        const effectiveConfig = buildReportBuilderCalculatedFieldConfig(semanticDisplayConfig, authored.nextState);
        const prepared = prepareReportBuilderTableCalculationApplication(effectiveConfig, authored.nextState, authored.field.id, {
            forceAutoFetch: true,
            switchToTable: true,
        });
        if (!prepared.canApply) {
            setChartApplyFeedback({
                level: "danger",
                message: prepared.message || "This table calculation could not be applied.",
            });
            return false;
        }
        persistExplorationMutation(prepared.nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: authored.field?.label || authored.field?.id || "Table calculation",
            },
        });
        const preparedReadiness = resolveStateReadiness(prepared.nextState);
        const didFetchPreparedState = prepared.shouldFetch && preparedReadiness.canRun;
        if (didFetchPreparedState) {
            dispatchReportRequest(prepared.nextState, { forceFetch: true });
        }
        const feedback = editingTableCalculationId
            ? {
                level: "info",
                message: didFetchPreparedState
                    ? `${authored.field?.label || authored.field?.id || "This table calculation"} updated. Refreshing results.`
                    : `${authored.field?.label || authored.field?.id || "This table calculation"} updated.`,
            }
            : buildReportBuilderPresetApplyFeedback({
                kind: "tableCalc",
                presetTitle: authored.field?.label || authored.field?.id || "this table calculation",
                selectionChanged: prepared.selectionChanged,
                didFetchPreparedState,
                preparedReadiness,
                requiresManualRun: prepared.requiresManualRun,
            });
        closeTableCalculationDialog();
        setChartApplyFeedback(feedback);
        return true;
    }, [closeTableCalculationDialog, dispatchReportRequest, displayConfig, editingTableCalculationId, persistExplorationMutation, resolveStateReadiness, semanticDisplayConfig, state, tableCalculationDraft]);
    const removeCalculatedField = React.useCallback((fieldId = "") => {
        const normalizedFieldId = String(fieldId || "").trim();
        if (!normalizedFieldId) {
            return;
        }
        const nextState = removeReportBuilderLocalCalculatedFieldState(state, normalizedFieldId);
        persistExplorationMutation(nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: normalizedFieldId,
            },
        });
        setChartApplyFeedback({
            level: "warning",
            message: `${normalizedFieldId} removed from local calculated fields.`,
        });
    }, [persistExplorationMutation, state]);
    const removeTableCalculation = React.useCallback((fieldId = "") => {
        const normalizedFieldId = String(fieldId || "").trim();
        if (!normalizedFieldId) {
            return;
        }
        const nextState = removeReportBuilderLocalTableCalculationState(state, normalizedFieldId);
        persistExplorationMutation(nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: normalizedFieldId,
            },
        });
        setChartApplyFeedback({
            level: "warning",
            message: `${normalizedFieldId} removed from local table calculations.`,
        });
    }, [persistExplorationMutation, state]);
    const applyDocumentBlockDraft = React.useCallback(() => {
        const result = upsertReportBuilderDocumentBlockState(state, documentBlockDraft, {
            editingId: editingDocumentBlockId,
            valueFieldOptions: authoredKpiValueFieldOptions,
            secondaryFieldOptions: authoredKpiSecondaryFieldOptions,
            tableColumnOptions: authoredTableColumnOptions,
            scopeParamOptions: authoredScopeParamOptions,
            chartConfig: authoredChartConfig,
            chartFieldOptions: authoredChartFieldOptions,
        });
        if (!result.valid || !result.block) {
            return false;
        }
        persistExplorationMutation(result.nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: result.block.title || result.block.id || "Authored block",
            },
        });
        closeDocumentBlockDialog();
        setChartApplyFeedback({
            level: "success",
            message: result.created
                ? `${result.block.title || result.block.id || "Authored block"} added to the report document.`
                : `${result.block.title || result.block.id || "Authored block"} updated.`,
        });
        return true;
    }, [authoredChartConfig, authoredChartFieldOptions, authoredKpiSecondaryFieldOptions, authoredKpiValueFieldOptions, authoredScopeParamOptions, authoredTableColumnOptions, closeDocumentBlockDialog, documentBlockDraft, editingDocumentBlockId, persistExplorationMutation, state]);
    const applyDocumentTemplate = React.useCallback((templateId = "") => {
        const normalizedTemplateId = String(templateId || "").trim();
        if (!normalizedTemplateId) {
            return false;
        }
        const template = reportDocumentTemplates.find((entry) => String(entry?.id || "").trim() === normalizedTemplateId) || null;
        const result = instantiateReportBuilderDocumentTemplate(displayConfig, template);
        if (!result.valid || !result.nextState) {
            setChartApplyFeedback({
                level: "danger",
                message: result.diagnostics?.[0]?.message || "The selected report template is invalid.",
            });
            return false;
        }
        persistExplorationMutation(result.nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: result.template?.label || "Report template",
            },
        });
        const templateReadiness = resolveStateReadiness(result.nextState);
        if (templateReadiness.canRun) {
            dispatchReportRequest(result.nextState, { forceFetch: true });
        }
        setChartApplyFeedback({
            level: "success",
            message: `${result.template?.label || "Report template"} applied.`,
        });
        return true;
    }, [dispatchReportRequest, displayConfig, persistExplorationMutation, reportDocumentTemplates, resolveStateReadiness]);
    const updateReportDocumentMetadata = React.useCallback((field = "", value = "") => {
        const normalizedField = String(field || "").trim();
        if (!normalizedField) {
            return;
        }
        const nextState = {
            ...state,
        };
        if (normalizedField === "reportDocumentTitle") {
            const nextTitle = String(value || "").trim();
            if (!nextTitle || nextTitle === resolveReportDocumentMetadataTitle({}, container, config)) {
                delete nextState.reportDocumentTitle;
            } else {
                nextState.reportDocumentTitle = nextTitle;
            }
            persistExplorationMutation(nextState, {
                sourceKind: "reportBuilder.result",
                sourceContext: {
                    label: "Report title",
                },
            });
            return;
        }
        const nextValue = String(value || "").trim();
        if (!nextValue) {
            delete nextState[normalizedField];
        } else {
            nextState[normalizedField] = nextValue;
        }
        persistExplorationMutation(nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: normalizedField === "reportDocumentSubtitle"
                    ? "Report subtitle"
                    : "Report description",
            },
        });
    }, [config, container, persistExplorationMutation, state]);
    const applyAuthoredChartBlockDraft = React.useCallback(() => {
        const result = upsertReportBuilderDocumentBlockState(state, authoredChartBlockDraft, {
            editingId: editingAuthoredChartBlockId,
            chartConfig: authoredChartConfig,
            chartFieldOptions: authoredChartFieldOptions,
        });
        if (!result.valid || !result.block) {
            return false;
        }
        persistExplorationMutation(result.nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: result.block.title || result.block.id || "Authored chart",
            },
        });
        closeAuthoredChartBlockDialog();
        setChartApplyFeedback({
            level: "success",
            message: result.created
                ? `${result.block.title || result.block.id || "Authored chart"} added to the report document.`
                : `${result.block.title || result.block.id || "Authored chart"} updated.`,
        });
        return true;
    }, [authoredChartBlockDraft, authoredChartConfig, authoredChartFieldOptions, closeAuthoredChartBlockDialog, editingAuthoredChartBlockId, persistExplorationMutation, state]);
    const removeDocumentBlock = React.useCallback((blockId = "") => {
        const normalizedBlockId = String(blockId || "").trim();
        if (!normalizedBlockId) {
            return;
        }
        const currentBlock = authoredDocumentBlocks.find((block) => String(block?.id || "").trim() === normalizedBlockId) || null;
        persistExplorationMutation(removeReportBuilderDocumentBlockState(state, normalizedBlockId), {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: currentBlock?.title || normalizedBlockId,
            },
        });
        setChartApplyFeedback({
            level: "warning",
            message: `${currentBlock?.title || normalizedBlockId} removed from the authored report document.`,
        });
    }, [authoredDocumentBlocks, persistExplorationMutation, state]);
    const moveDocumentBlock = React.useCallback((blockId = "", direction = "up") => {
        const normalizedBlockId = String(blockId || "").trim();
        if (!normalizedBlockId) {
            return;
        }
        persistExplorationMutation(moveReportBuilderDocumentBlockState(state, normalizedBlockId, direction), {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: normalizedBlockId,
            },
        });
    }, [persistExplorationMutation, state]);
    const resizeDocumentBlock = React.useCallback((blockId = "", size = "full") => {
        const normalizedBlockId = String(blockId || "").trim();
        if (!normalizedBlockId) {
            return;
        }
        const currentBlock = authoredDocumentBlocks.find((block) => String(block?.id || "").trim() === normalizedBlockId) || null;
        persistExplorationMutation(resizeReportBuilderDocumentBlockState(state, normalizedBlockId, size), {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: currentBlock?.title || normalizedBlockId,
            },
        });
        setChartApplyFeedback({
            level: "info",
            message: `${currentBlock?.title || normalizedBlockId} resized to ${String(size || "full").trim() === "half" ? "half" : "full"} width in the authored report layout.`,
        });
    }, [authoredDocumentBlocks, persistExplorationMutation, state]);
    const duplicateDocumentBlock = React.useCallback((blockId = "") => {
        const normalizedBlockId = String(blockId || "").trim();
        if (!normalizedBlockId) {
            return;
        }
        const result = duplicateReportBuilderDocumentBlockState(state, normalizedBlockId);
        if (!result.valid || !result.block) {
            return;
        }
        persistExplorationMutation(result.nextState, {
            sourceKind: "reportBuilder.result",
            sourceContext: {
                label: result.block.title || result.block.id || normalizedBlockId,
            },
        });
        setChartApplyFeedback({
            level: "success",
            message: `${result.block.title || result.block.id || normalizedBlockId} duplicated in the authored report document.`,
        });
    }, [persistExplorationMutation, state]);
    const undoExploration = React.useCallback(() => {
        persistState(undoReportBuilderExplorationState(state), { skipExplorationHistory: true });
    }, [persistState, state]);
    const redoExploration = React.useCallback(() => {
        persistState(redoReportBuilderExplorationState(state), { skipExplorationHistory: true });
    }, [persistState, state]);
    const keepExplorationChanges = React.useCallback(() => {
        persistState(keepReportBuilderExplorationState(state), { skipExplorationHistory: true });
        setSelectedBuilderChartSelection(null);
        setChartApplyFeedback({
            level: "success",
            message: "Draft kept as the current report state.",
        });
    }, [persistState, state]);
    const discardExploration = React.useCallback(() => {
        persistState(discardReportBuilderExplorationState(state), { skipExplorationHistory: true });
        setSelectedBuilderChartSelection(null);
        setChartApplyFeedback({
            level: "info",
            message: "Draft discarded.",
        });
    }, [persistState, state]);
    const saveExploration = React.useCallback(() => {
        const artifact = buildReportBuilderExplorationArtifact({
            container,
            config: semanticDisplayConfig,
            state,
            semanticSummary: resolvedSemanticSummary,
            semanticRuntimeDiagnostics: runtimePreviewSemanticDiagnostics,
        });
        if (!artifact) {
            return;
        }
        setSavedExplorationArtifact(artifact);
        setSavedExplorationRuntimeArtifact(cloneReportBuilderValue(runtimePreviewArtifact));
        setSavedExplorationArtifactOpen(true);
        setSavedReportPayload(null);
        setSavedReportPayloadRecord(null);
        setSavedReportPayloadOpen(false);
        setCreateReportDocumentPayload(null);
        setCreateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentExpectedVersionDraft("");
        setUpdateReportDocumentPayload(null);
        setUpdateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentCurrentVersionDraft("");
        setUpdateReportDocumentConflictDiagnostic(null);
        setUpdateReportDocumentConflictDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Saved exploration artifact ${artifact.title || "Report"}.`,
        });
    }, [container, resolvedSemanticSummary, runtimePreviewArtifact, runtimePreviewSemanticDiagnostics, semanticDisplayConfig, state]);
    const downloadExplorationArtifact = React.useCallback(() => {
        const descriptor = buildReportBuilderExplorationArtifactDownload(savedExplorationArtifact);
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [savedExplorationArtifact]);
    const prepareSavedReportPayload = React.useCallback(() => {
        const payload = buildReportBuilderSavedReportPayload(savedExplorationArtifact);
        if (!payload) {
            return;
        }
        const nextSavedReportPayloadRecord = buildReportBuilderSavedReportPayloadRecord(payload, {
            runtimeArtifact: savedExplorationRuntimeArtifact,
        });
        setSavedReportPayload(payload);
        setSavedReportPayloadRecord(nextSavedReportPayloadRecord);
        setSavedReportPayloadOpen(true);
        setSavedReportPayloadExportRequestOpen(false);
        setSavedExplorationArtifactOpen(false);
        setCreateReportDocumentPayload(null);
        setCreateReportDocumentPayloadOpen(false);
        setReportDocumentVersionDraft("");
        setGetReportDocumentResponse(null);
        setGetReportDocumentResponseOpen(false);
        setReopenReportDocumentDiagnostic(null);
        setReopenReportDocumentDiagnosticOpen(false);
        setListReportDocumentsResponse(null);
        setListReportDocumentsResponseOpen(false);
        setListReportDocumentsSelectedReportId("");
        setGetReportDocumentRequestPayload(null);
        setGetReportDocumentRequestPayloadOpen(false);
        setUpdateReportDocumentExpectedVersionDraft("");
        setUpdateReportDocumentPayload(null);
        setUpdateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentCurrentVersionDraft("");
        setUpdateReportDocumentConflictDiagnostic(null);
        setUpdateReportDocumentConflictDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared saved report payload ${payload.title || "Report"}.`,
        });
    }, [savedExplorationArtifact, savedExplorationRuntimeArtifact]);
    const downloadSavedReportPayload = React.useCallback(() => {
        const descriptor = buildReportBuilderSavedReportPayloadDownload(savedReportPayload);
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [savedReportPayload]);
    const {
        requestOpen: draftExportRequestOpen,
        setRequestOpen: setDraftExportRequestOpen,
        requestSummary: draftExportRequestSummary,
        requestInspector: draftExportRequestInspector,
        submitting: draftExportSubmitting,
        job: draftExportJob,
        jobSummary: draftExportJobSummary,
        statusLoading: draftExportStatusLoading,
        artifactLoading: draftExportArtifactLoading,
        submit: triggerDraftExport,
        refreshStatus: refreshDraftExportStatus,
        downloadArtifact: downloadDraftExportArtifact,
        downloadRequest: downloadDraftExportRequest,
    } = draftExportExecution;
    const {
        requestOpen: savedReportPayloadExportRequestOpen,
        setRequestOpen: setSavedReportPayloadExportRequestOpen,
        requestSummary: savedReportPayloadExportRequestSummary,
        requestInspector: savedReportPayloadExportRequestInspector,
        submitting: savedReportPayloadExportSubmitting,
        job: savedReportPayloadExportJob,
        jobSummary: savedReportPayloadExportJobSummary,
        statusLoading: savedReportPayloadExportStatusLoading,
        artifactLoading: savedReportPayloadExportArtifactLoading,
        submit: triggerSavedReportPayloadExport,
        refreshStatus: refreshSavedReportPayloadExportStatus,
        downloadArtifact: downloadSavedReportPayloadArtifact,
        downloadRequest: downloadSavedReportPayloadExportRequest,
    } = savedReportPayloadExportExecution;
    const {
        requestOpen: reopenedExportRequestOpen,
        setRequestOpen: setReopenedExportRequestOpen,
        requestSummary: reopenedExportRequestSummary,
        requestInspector: reopenedExportRequestInspector,
        submitting: reopenedExportSubmitting,
        job: reopenedExportJob,
        jobSummary: reopenedExportJobSummary,
        statusLoading: reopenedExportStatusLoading,
        artifactLoading: reopenedExportArtifactLoading,
        submit: triggerReopenedExport,
        refreshStatus: refreshReopenedExportStatus,
        downloadArtifact: downloadReopenedExportArtifact,
        downloadRequest: downloadReopenedExportRequest,
    } = reopenedExportExecution;
    const {
        requestOpen: selectedListEntryExportRequestOpen,
        setRequestOpen: setSelectedListEntryExportRequestOpen,
        requestSummary: selectedListEntryExportRequestSummary,
        requestInspector: selectedListEntryExportRequestInspector,
        submitting: selectedListEntryExportSubmitting,
        job: selectedListEntryExportJob,
        jobSummary: selectedListEntryExportJobSummary,
        statusLoading: selectedListEntryExportStatusLoading,
        artifactLoading: selectedListEntryExportArtifactLoading,
        submit: triggerSelectedListEntryExport,
        refreshStatus: refreshSelectedListEntryExportStatus,
        downloadArtifact: downloadSelectedListEntryExportArtifact,
        downloadRequest: downloadSelectedListEntryExportRequest,
    } = selectedListEntryExportExecution;
    const draftExportFailureNotice = useMemo(
        () => buildReportBuilderExportFailureNotice(draftExportJob, { label: "Draft export" }),
        [draftExportJob],
    );
    const savedReportPayloadExportFailureNotice = useMemo(
        () => buildReportBuilderExportFailureNotice(savedReportPayloadExportJob, { label: "Saved export" }),
        [savedReportPayloadExportJob],
    );
    const reopenedExportFailureNotice = useMemo(
        () => buildReportBuilderExportFailureNotice(reopenedExportJob, { label: "Reopened export" }),
        [reopenedExportJob],
    );
    const selectedListEntryExportFailureNotice = useMemo(
        () => buildReportBuilderExportFailureNotice(selectedListEntryExportJob, { label: "Selected export" }),
        [selectedListEntryExportJob],
    );
    const renderExportFailureDiagnostics = React.useCallback((notice = null) => {
        if (!notice || !Array.isArray(notice.diagnostics) || notice.diagnostics.length === 0) {
            return null;
        }
        return (
            <div className="forge-report-builder__semantic-diagnostics-list" style={{ marginTop: 10 }}>
                {notice.diagnostics.map((diagnostic) => (
                    <article
                        key={diagnostic.id}
                        className={`forge-report-builder__semantic-diagnostic forge-report-builder__semantic-diagnostic--${diagnostic.severity || "warning"}`}
                    >
                        <div className="forge-report-builder__semantic-diagnostic-meta">
                            {diagnostic.code ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.code}</span> : null}
                            {diagnostic.path ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.path}</span> : null}
                        </div>
                        <div className="forge-report-builder__semantic-diagnostic-message">{diagnostic.message}</div>
                        {diagnostic.suggestedFix ? (
                            <div className="forge-report-builder__semantic-diagnostic-fix">{diagnostic.suggestedFix}</div>
                        ) : null}
                    </article>
                ))}
            </div>
        );
    }, []);
    const renderCompileDiagnosticsNotice = React.useCallback((notice = null, {
        actionForDiagnostic = null,
        actionLabel = "Edit block",
    } = {}) => {
        if (!notice || !Array.isArray(notice.diagnostics) || notice.diagnostics.length === 0) {
            return null;
        }
        return (
            <section className={`forge-report-builder__semantic-diagnostics forge-report-builder__semantic-diagnostics--${notice.level || "warning"}`} style={{ marginTop: 12 }}>
                <div className="forge-report-builder__semantic-diagnostics-header">
                    <div className="forge-report-builder__semantic-diagnostics-title">{notice.title}</div>
                    <div className="forge-report-builder__semantic-diagnostics-description">{notice.description}</div>
                </div>
                <div className="forge-report-builder__semantic-diagnostics-list">
                    {notice.diagnostics.map((diagnostic) => (
                        <article
                            key={diagnostic.id}
                            className={`forge-report-builder__semantic-diagnostic forge-report-builder__semantic-diagnostic--${diagnostic.severity || "error"}`}
                        >
                            <div className="forge-report-builder__semantic-diagnostic-meta">
                                {diagnostic.code ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.code}</span> : null}
                                {diagnostic.path ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.path}</span> : null}
                                {diagnostic.blockId ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.blockId}</span> : null}
                            </div>
                            <div className="forge-report-builder__semantic-diagnostic-message">{diagnostic.message}</div>
                            {diagnostic.suggestedFix ? (
                                <div className="forge-report-builder__semantic-diagnostic-fix">{diagnostic.suggestedFix}</div>
                            ) : null}
                            {typeof actionForDiagnostic === "function" && diagnostic.blockId ? (
                                <div style={{ marginTop: 8 }}>
                                    <Button
                                        small
                                        minimal
                                        onClick={() => actionForDiagnostic(diagnostic)}
                                        aria-label={`${actionLabel} ${diagnostic.blockId}`}
                                    >
                                        {actionLabel}
                                    </Button>
                                </div>
                            ) : null}
                        </article>
                    ))}
                </div>
            </section>
        );
    }, []);
    const prepareCreateReportDocumentPayload = React.useCallback(() => {
        if (!reportDocumentPayloadCompileValidation.valid) {
            setChartApplyFeedback({
                level: "warning",
                message: reportDocumentPayloadCompileValidation.message || "Resolve authored block validation issues before preparing the createReportDocument payload.",
            });
            return;
        }
        const payloadSeed = hydratedReportDocumentSession && getReportDocumentResponse
            ? getReportDocumentResponse
            : savedReportPayload;
        const payload = hydratedReportDocumentSession
            ? buildReportBuilderCreateReportDocumentPayloadFromBuilderState(payloadSeed, {
                container,
                config: semanticDisplayConfig,
                state,
                semanticSummary: resolvedSemanticSummary,
                semanticRuntimeDiagnostics: runtimePreviewSemanticDiagnostics,
            })
            : buildReportBuilderCreateReportDocumentPayload(savedReportPayload);
        if (!payload) {
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the createReportDocument payload. Confirm the saved report payload is available.",
            });
            return;
        }
        setCreateReportDocumentPayload(payload);
        setCreateReportDocumentPayloadOpen(true);
        setSavedReportPayloadOpen(false);
        setReopenReportDocumentDiagnostic(null);
        setReopenReportDocumentDiagnosticOpen(false);
        setGetReportDocumentResponseOpen(false);
        setListReportDocumentsResponseOpen(false);
        setListReportDocumentsSelectedReportId("");
        setGetReportDocumentRequestPayload(null);
        setGetReportDocumentRequestPayloadOpen(false);
        setUpdateReportDocumentPayload(null);
        setUpdateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentCurrentVersionDraft("");
        setUpdateReportDocumentConflictDiagnostic(null);
        setUpdateReportDocumentConflictDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared createReportDocument payload ${payload.title || "Report"}.`,
        });
    }, [container, getReportDocumentResponse, hydratedReportDocumentSession, reportDocumentPayloadCompileValidation, resolvedSemanticSummary, savedReportPayload, semanticDisplayConfig, state]);
    const downloadCreateReportDocumentPayload = React.useCallback(() => {
        const descriptor = buildReportBuilderCreateReportDocumentPayloadDownload(createReportDocumentPayload);
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [createReportDocumentPayload]);
    const prepareGetReportDocumentResponse = React.useCallback(() => {
        const payloadSeed = hydratedReportDocumentSession && getReportDocumentResponse
            ? getReportDocumentResponse
            : savedReportPayload;
        const response = hydratedReportDocumentSession
            ? buildReportBuilderGetReportDocumentResponseFromBuilderState(payloadSeed, {
                container,
                config: semanticDisplayConfig,
                state,
                semanticSummary: resolvedSemanticSummary,
                semanticRuntimeDiagnostics: runtimePreviewSemanticDiagnostics,
                documentVersion: reportDocumentVersionDraft,
            })
            : buildReportBuilderGetReportDocumentResponse(savedReportPayload, {
                documentVersion: reportDocumentVersionDraft,
            });
        if (!response) {
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the getReportDocument response. Confirm the saved report payload and document version are both available.",
            });
            return;
        }
        setGetReportDocumentResponse(response);
        setGetReportDocumentResponseOpen(true);
        setReopenReportDocumentDiagnostic(null);
        setReopenReportDocumentDiagnosticOpen(false);
        setListReportDocumentsResponse(null);
        setListReportDocumentsResponseOpen(false);
        setListReportDocumentsSelectedReportId("");
        setGetReportDocumentRequestPayload(null);
        setGetReportDocumentRequestPayloadOpen(false);
        setSavedReportPayloadOpen(false);
        setCreateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentConflictDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared getReportDocument response for ${response.document?.title || response.reportRef?.reportId || "Report"}.`,
        });
    }, [container, getReportDocumentResponse, hydratedReportDocumentSession, reportDocumentVersionDraft, resolvedSemanticSummary, savedReportPayload, semanticDisplayConfig, state]);
    const reopenGetReportDocumentResponse = React.useCallback(() => {
        const hydrated = buildHydratedReportBuilderDocument(getReportDocumentResponse, {
            container,
            builderIdentity: {
                containerId: container?.id,
                stateKey,
                dataSourceRef: builderContext?.identity?.dataSourceRef || container?.dataSourceRef,
            },
        });
        if (!hydrated.valid) {
            setGetReportDocumentResponseOpen(false);
            setSavedReportPayloadOpen(false);
            setCreateReportDocumentPayloadOpen(false);
            setListReportDocumentsResponseOpen(false);
            setUpdateReportDocumentPayloadOpen(false);
            setUpdateReportDocumentConflictDiagnosticOpen(false);
            const diagnostic = buildReportBuilderHydratedReportDocumentDiagnostic(getReportDocumentResponse, hydrated, {
                builderIdentity: {
                    containerId: container?.id,
                    stateKey,
                    dataSourceRef: builderContext?.identity?.dataSourceRef || container?.dataSourceRef,
                },
            });
            if (diagnostic) {
                setReopenReportDocumentDiagnostic(diagnostic);
                setReopenReportDocumentDiagnosticOpen(true);
            } else {
                setReopenReportDocumentDiagnostic(null);
                setReopenReportDocumentDiagnosticOpen(false);
            }
            setChartApplyFeedback({
                level: "warning",
                message: hydrated.message || "Could not reopen the saved ReportDocument in the builder.",
            });
            return;
        }
        const session = buildReportBuilderHydratedDocumentSession(hydrated, {
            liveConfig: cloneReportBuilderValue(hydratedReportDocumentSession?.liveSnapshot?.config || config),
            liveState: cloneReportBuilderValue(hydratedReportDocumentSession?.liveSnapshot?.state || state),
            priorSession: hydratedReportDocumentSession,
        });
        if (!session) {
            setReopenReportDocumentDiagnostic(null);
            setReopenReportDocumentDiagnosticOpen(false);
            setChartApplyFeedback({
                level: "warning",
                message: "Could not persist the reopen session for this ReportDocument.",
            });
            return;
        }
        persistStateWithConfig(
            applyReportBuilderHydratedDocumentSessionState(hydrated.state, session),
            hydrated.config,
            { skipExplorationHistory: true },
        );
        setSavedReportPayloadOpen(false);
        setCreateReportDocumentPayloadOpen(false);
        setGetReportDocumentResponseOpen(false);
        setReopenReportDocumentDiagnostic(null);
        setReopenReportDocumentDiagnosticOpen(false);
        setListReportDocumentsResponseOpen(false);
        setUpdateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentConflictDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Reopened ReportDocument ${hydrated.title || hydrated.reportId || "Report"} for editing.`,
        });
    }, [builderContext?.identity?.dataSourceRef, config, container, getReportDocumentResponse, hydratedReportDocumentSession, persistStateWithConfig, state, stateKey]);
    const downloadGetReportDocumentResponse = React.useCallback(() => {
        const descriptor = buildReportBuilderReportDocumentReadResponseDownload(getReportDocumentResponse, {
            fallbackName: "get-report-document-response",
        });
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [getReportDocumentResponse]);
    const restoreHydratedReportDocumentSession = React.useCallback(() => {
        if (!hydratedReportDocumentSession?.liveSnapshot?.config || !hydratedReportDocumentSession?.liveSnapshot?.state) {
            return;
        }
        persistStateWithConfig(
            stripReportBuilderHydratedDocumentSessionState(hydratedReportDocumentSession.liveSnapshot.state),
            hydratedReportDocumentSession.liveSnapshot.config,
            { skipExplorationHistory: true },
        );
        setChartApplyFeedback({
            level: "info",
            message: "Restored the live builder state from before reopening the saved ReportDocument.",
        });
    }, [hydratedReportDocumentSession, persistStateWithConfig]);
    const downloadReopenReportDocumentDiagnostic = React.useCallback(() => {
        const descriptor = buildReportBuilderHydratedReportDocumentDiagnosticDownload(reopenReportDocumentDiagnostic);
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [reopenReportDocumentDiagnostic]);
    const prepareListReportDocumentsResponse = React.useCallback(() => {
        const payloadSeed = hydratedReportDocumentSession && getReportDocumentResponse
            ? getReportDocumentResponse
            : savedReportPayload;
        const response = hydratedReportDocumentSession
            ? buildReportBuilderListReportDocumentsResponseFromBuilderState(payloadSeed, {
                container,
                config: semanticDisplayConfig,
                state,
                semanticSummary: resolvedSemanticSummary,
                semanticRuntimeDiagnostics: runtimePreviewSemanticDiagnostics,
                documentVersion: reportDocumentVersionDraft,
                cursor: "next-page",
                hasMore: true,
                localSavedPayloads: Array.isArray(config?.reportDocumentSavedPayloads) ? config.reportDocumentSavedPayloads : [],
                additionalEntries: Array.isArray(config?.reportDocumentListEntries) ? config.reportDocumentListEntries : [],
            })
            : buildReportBuilderListReportDocumentsResponse(savedReportPayload, {
                documentVersion: reportDocumentVersionDraft,
                cursor: "next-page",
                hasMore: true,
                localSavedPayloads: Array.isArray(config?.reportDocumentSavedPayloads) ? config.reportDocumentSavedPayloads : [],
                additionalEntries: Array.isArray(config?.reportDocumentListEntries) ? config.reportDocumentListEntries : [],
            });
        if (!response) {
            setListReportDocumentsResponse(null);
            setListReportDocumentsResponseOpen(false);
            setListReportDocumentsSelectedReportId("");
            setGetReportDocumentRequestPayload(null);
            setGetReportDocumentRequestPayloadOpen(false);
            setGetReportDocumentResponse(null);
            setGetReportDocumentResponseOpen(false);
            setReopenReportDocumentDiagnostic(null);
            setReopenReportDocumentDiagnosticOpen(false);
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the listReportDocuments response. Confirm the saved report payload and document version are both available.",
            });
            return;
        }
        setListReportDocumentsResponse(response);
        setListReportDocumentsResponseOpen(true);
        setReopenReportDocumentDiagnostic(null);
        setReopenReportDocumentDiagnosticOpen(false);
        setGetReportDocumentResponse(null);
        setGetReportDocumentResponseOpen(false);
        setListReportDocumentsSelectedReportId(
            String(response?.entries?.[0]?.reportRef?.reportId || "").trim(),
        );
        setGetReportDocumentRequestPayload(null);
        setGetReportDocumentRequestPayloadOpen(false);
        setSavedReportPayloadOpen(false);
        setCreateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentPayloadOpen(false);
        setUpdateReportDocumentConflictDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared listReportDocuments response with ${response.entries.length} entries.`,
        });
    }, [config, container, getReportDocumentResponse, hydratedReportDocumentSession, reportDocumentVersionDraft, resolvedSemanticSummary, savedReportPayload, semanticDisplayConfig, state]);
    const downloadListReportDocumentsResponse = React.useCallback(() => {
        const descriptor = buildReportBuilderReportDocumentReadResponseDownload(listReportDocumentsResponse, {
            fallbackName: "list-report-documents-response",
            selectedReportId: listReportDocumentsSelectedReportId,
        });
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [listReportDocumentsResponse, listReportDocumentsSelectedReportId]);
    const prepareGetReportDocumentRequestPayload = React.useCallback(() => {
        const request = buildReportBuilderGetReportDocumentRequest(listReportDocumentsResponse, {
            entryReportId: listReportDocumentsSelectedReportId,
        });
        if (!request) {
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the getReportDocument request. Select a valid list response entry first.",
            });
            return;
        }
        setGetReportDocumentRequestPayload(request);
        setGetReportDocumentRequestPayloadOpen(true);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared getReportDocument request for ${request.reportRef?.reportId || "Report"}.`,
        });
    }, [listReportDocumentsResponse, listReportDocumentsSelectedReportId]);
    const prepareSelectedGetReportDocumentResponseFromListEntry = React.useCallback(() => {
        const request = buildReportBuilderGetReportDocumentRequest(listReportDocumentsResponse, {
            entryReportId: listReportDocumentsSelectedReportId,
        });
        if (!request) {
            setGetReportDocumentRequestPayload(null);
            setGetReportDocumentRequestPayloadOpen(false);
            setGetReportDocumentResponse(null);
            setGetReportDocumentResponseOpen(false);
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the selected getReportDocument response. Select a valid list response entry first.",
            });
            return;
        }
        const payloadSeed = hydratedReportDocumentSession && getReportDocumentResponse
            ? getReportDocumentResponse
            : savedReportPayload;
        const response = hydratedReportDocumentSession
            ? (
                buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
                    listReportDocumentsResponse,
                    payloadSeed,
                    {
                        request,
                        container,
                        config: semanticDisplayConfig,
                        state,
                        semanticSummary: resolvedSemanticSummary,
                        semanticRuntimeDiagnostics: runtimePreviewSemanticDiagnostics,
                    },
                )
                || buildReportBuilderSelectedGetReportDocumentResponse(
                    listReportDocumentsResponse,
                    localSavedReportRecords,
                    {
                        request,
                    },
                )
            )
            : buildReportBuilderSelectedGetReportDocumentResponse(
                listReportDocumentsResponse,
                localSavedReportRecords,
                {
                    request,
                },
            );
        if (!response) {
            setGetReportDocumentRequestPayload(request);
            setGetReportDocumentRequestPayloadOpen(true);
            setGetReportDocumentResponse(null);
            setGetReportDocumentResponseOpen(false);
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the selected getReportDocument response. Only entries backed by a local ReportDocument payload can be expanded locally.",
            });
            return;
        }
        setGetReportDocumentRequestPayload(request);
        setGetReportDocumentRequestPayloadOpen(true);
        setGetReportDocumentResponse(response);
        setGetReportDocumentResponseOpen(true);
        setReopenReportDocumentDiagnostic(null);
        setReopenReportDocumentDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared getReportDocument response for ${response.reportRef?.reportId || response.document?.title || "Report"}.`,
        });
    }, [container, getReportDocumentResponse, hydratedReportDocumentSession, listReportDocumentsResponse, listReportDocumentsSelectedReportId, localSavedReportRecords, resolvedSemanticSummary, savedReportPayload, semanticDisplayConfig, state]);
    const prepareSelectedGetReportDocumentResponse = React.useCallback(() => {
        if (!getReportDocumentRequestPayload) {
            setGetReportDocumentResponse(null);
            setGetReportDocumentResponseOpen(false);
            setChartApplyFeedback({
                level: "warning",
                message: "Prepare the getReportDocument request for the selected list entry before expanding a response.",
            });
            return;
        }
        const payloadSeed = hydratedReportDocumentSession && getReportDocumentResponse
            ? getReportDocumentResponse
            : savedReportPayload;
        const response = hydratedReportDocumentSession
            ? (
                buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
                    listReportDocumentsResponse,
                    payloadSeed,
                    {
                        request: getReportDocumentRequestPayload,
                        container,
                        config: semanticDisplayConfig,
                        state,
                        semanticSummary: resolvedSemanticSummary,
                    },
                )
                || buildReportBuilderSelectedGetReportDocumentResponse(
                    listReportDocumentsResponse,
                    localSavedReportRecords,
                    {
                        request: getReportDocumentRequestPayload,
                    },
                )
            )
            : buildReportBuilderSelectedGetReportDocumentResponse(
                listReportDocumentsResponse,
                localSavedReportRecords,
                {
                    request: getReportDocumentRequestPayload,
                },
            );
        if (!response) {
            setGetReportDocumentResponse(null);
            setGetReportDocumentResponseOpen(false);
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the selected getReportDocument response. Only entries backed by a local ReportDocument payload can be expanded locally.",
            });
            return;
        }
        setGetReportDocumentResponse(response);
        setGetReportDocumentResponseOpen(true);
        setReopenReportDocumentDiagnostic(null);
        setReopenReportDocumentDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared getReportDocument response for ${response.reportRef?.reportId || response.document?.title || "Report"}.`,
        });
    }, [container, getReportDocumentRequestPayload, getReportDocumentResponse, hydratedReportDocumentSession, listReportDocumentsResponse, localSavedReportRecords, resolvedSemanticSummary, savedReportPayload, semanticDisplayConfig, state]);
    const downloadGetReportDocumentRequestPayload = React.useCallback(() => {
        const descriptor = buildReportBuilderGetReportDocumentRequestDownload(getReportDocumentRequestPayload, {
            metadata: selectedListReportDocumentsEntrySummary,
        });
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [getReportDocumentRequestPayload, selectedListReportDocumentsEntrySummary]);
    const prepareListEntryReopenDiagnostic = React.useCallback(() => {
        const diagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic(listReportDocumentsResponse, {
            entryReportId: listReportDocumentsSelectedReportId,
            builderIdentity: {
                containerId: container?.id,
                stateKey,
                dataSourceRef: builderContext?.identity?.dataSourceRef || container?.dataSourceRef,
            },
        });
        if (!diagnostic) {
            setReopenReportDocumentDiagnostic(null);
            setReopenReportDocumentDiagnosticOpen(false);
            setChartApplyFeedback({
                level: "info",
                message: "The selected list entry is compatible with the current builder target.",
            });
            return;
        }
        setReopenReportDocumentDiagnostic(diagnostic);
        setReopenReportDocumentDiagnosticOpen(true);
        setListReportDocumentsResponseOpen(false);
        setChartApplyFeedback({
            level: "warning",
            message: `Prepared reopen diagnostic for ${diagnostic.title || diagnostic.reportRef?.reportId || "Report"}.`,
        });
    }, [builderContext?.identity?.dataSourceRef, container?.dataSourceRef, container?.id, listReportDocumentsResponse, listReportDocumentsSelectedReportId, stateKey]);
    const prepareUpdateReportDocumentPayload = React.useCallback(() => {
        if (!reportDocumentPayloadCompileValidation.valid) {
            setChartApplyFeedback({
                level: "warning",
                message: reportDocumentPayloadCompileValidation.message || "Resolve authored block validation issues before preparing the updateReportDocument payload.",
            });
            return;
        }
        const payloadSeed = hydratedReportDocumentSession && getReportDocumentResponse
            ? getReportDocumentResponse
            : savedReportPayload;
        const payload = hydratedReportDocumentSession
            ? buildReportBuilderUpdateReportDocumentPayloadFromBuilderState(payloadSeed, {
                container,
                config: semanticDisplayConfig,
                state,
                semanticSummary: resolvedSemanticSummary,
                semanticRuntimeDiagnostics: runtimePreviewSemanticDiagnostics,
                expectedVersion: updateReportDocumentExpectedVersionDraft,
            })
            : buildReportBuilderUpdateReportDocumentPayload(savedReportPayload, {
            expectedVersion: updateReportDocumentExpectedVersionDraft,
        });
        if (!payload) {
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the updateReportDocument payload. Confirm the saved report payload and expected version are both available.",
            });
            return;
        }
        setUpdateReportDocumentPayload(payload);
        setUpdateReportDocumentPayloadOpen(true);
        setCreateReportDocumentPayloadOpen(false);
        setSavedReportPayloadOpen(false);
        setUpdateReportDocumentConflictDiagnostic(null);
        setUpdateReportDocumentConflictDiagnosticOpen(false);
        setChartApplyFeedback({
            level: "success",
            message: `Prepared updateReportDocument payload ${payload.title || "Report"} at version ${payload.expectedVersion}.`,
        });
    }, [container, getReportDocumentResponse, hydratedReportDocumentSession, reportDocumentPayloadCompileValidation, resolvedSemanticSummary, savedReportPayload, semanticDisplayConfig, state, updateReportDocumentExpectedVersionDraft]);
    const downloadUpdateReportDocumentPayload = React.useCallback(() => {
        const descriptor = buildReportBuilderUpdateReportDocumentPayloadDownload(updateReportDocumentPayload);
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [updateReportDocumentPayload]);
    const prepareUpdateReportDocumentConflictDiagnostic = React.useCallback(() => {
        const diagnostic = buildReportBuilderUpdateReportDocumentConflictDiagnostic(updateReportDocumentPayload, {
            currentVersion: updateReportDocumentCurrentVersionDraft,
        });
        if (!diagnostic) {
            setChartApplyFeedback({
                level: "warning",
                message: "Could not prepare the update conflict diagnostic. Confirm the update payload and a conflicting current version are both available.",
            });
            return;
        }
        setUpdateReportDocumentConflictDiagnostic(diagnostic);
        setUpdateReportDocumentConflictDiagnosticOpen(true);
        setUpdateReportDocumentPayloadOpen(false);
        setChartApplyFeedback({
            level: "warning",
            message: `Prepared update conflict diagnostic for ${diagnostic.title || "Report"}.`,
        });
    }, [updateReportDocumentCurrentVersionDraft, updateReportDocumentPayload]);
    const downloadUpdateReportDocumentConflictDiagnostic = React.useCallback(() => {
        const descriptor = buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload(updateReportDocumentConflictDiagnostic);
        if (!descriptor) {
            return;
        }
        const blob = new Blob([descriptor.payload], { type: descriptor.mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = descriptor.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, [updateReportDocumentConflictDiagnostic]);
    const handleUpdateReportDocumentCurrentVersionDraftChange = React.useCallback((event) => {
        setUpdateReportDocumentCurrentVersionDraft(event.target.value);
        if (updateReportDocumentConflictDiagnostic) {
            setUpdateReportDocumentConflictDiagnostic(null);
            setUpdateReportDocumentConflictDiagnosticOpen(false);
        }
    }, [updateReportDocumentConflictDiagnostic]);

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
        persistDynamicScaffoldingMutation(addDynamicFilterRow(state, group), [groupId]);
    };

    const setGroupBy = (value) => {
        persistExplorationMutation({
            ...state,
            groupBy: value,
            page: 1,
        });
    };

    const setOrderField = (value) => {
        persistExplorationMutation({
            ...state,
            orderField: value,
            page: 1,
        });
    };

    const setOrderDir = (value) => {
        persistExplorationMutation({
            ...state,
            orderDir: value,
            page: 1,
        });
    };

    const setPageSize = (value) => {
        const pageSize = Math.max(1, Number(value) || 1);
        persistExplorationMutation({
            ...state,
            pageSize,
            page: 1,
        });
    };

    const goToPage = (page) => {
        const currentState = currentBuilderStateRef.current || state;
        persistPassiveViewState({
            ...currentState,
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
        persistExplorationMutation({
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
        persistExplorationMutation({
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
        persistDynamicScaffoldingMutation(addDynamicFilterRow(state, group), [groupId]);
    };

    const changeDynamicFilterType = (group, rowId, filterId) => {
        persistDynamicScaffoldingMutation(updateDynamicFilterRow(state, group, rowId, {
            filterId,
            selections: [],
        }), [group?.id]);
    };

    const removeDynamicSelection = (group, rowId, index) => {
        const rows = (state?.dynamicGroups?.[group.id] || []).map((row) => {
            if (row.id !== rowId) return row;
            return {
                ...row,
                selections: (row.selections || []).filter((_, selectionIndex) => selectionIndex !== index),
            };
        });
        persistExplorationMutation({
            ...state,
            dynamicGroups: {
                ...(state.dynamicGroups || {}),
                [group.id]: rows,
            },
        });
    };

    const removeRow = (group, rowId) => {
        persistDynamicScaffoldingMutation(removeDynamicFilterRow(state, group, rowId), [group?.id]);
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
        persistDynamicScaffoldingMutation(addDynamicFilterRow(state, subgroup), [subgroup.id]);
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
        persistExplorationMutation(nextState);
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
        persistDynamicScaffoldingMutation(updateDynamicFilterRow(state, subgroup, rowId, {
            filterId: String(targetFilter.id || "").trim(),
            selections: [],
        }), [subgroup?.id]);
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
        persistDynamicScaffoldingMutation({
            ...state,
            dynamicGroups: {
                ...(state.dynamicGroups || {}),
                [group.id]: rows,
            },
        }, [group?.id]);
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
        persistDynamicScaffoldingMutation({
            ...state,
            dynamicGroups: {
                ...(state.dynamicGroups || {}),
                [group.id]: rows,
            },
        }, [group?.id]);
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
            const currentState = currentBuilderStateRef.current || state;
            const rows = (currentState?.dynamicGroups?.[group.id] || []).map((row) => {
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
            persistExplorationMutation({
                ...currentState,
                dynamicGroups: {
                    ...(currentState.dynamicGroups || {}),
                    [group.id]: rows,
                },
            });
        } catch (e) {
            console.error("reportBuilder lookup failed", e);
        }
    };
    const renderRuntimePreview = () => {
        if (!runtimePreviewEnabled) {
            return null;
        }
        const runtimeConfig = runtimePreviewArtifact?.runtimeBlock?.dashboard?.reportRuntime || null;
        const runtimePrimaryDataset = Array.isArray(runtimeConfig?.reportFill?.datasets)
            ? (runtimeConfig.reportFill.datasets.find((dataset) => String(dataset?.id || "").trim() === "primary")
                || runtimeConfig.reportFill.datasets[0]
                || null)
            : null;
        const hasRuntimeRows = Array.isArray(runtimePrimaryDataset?.rows)
            && runtimePrimaryDataset.rows.length > 0;
        return (
            <section
                className="forge-report-builder__runtime-preview"
                aria-label="Authored runtime preview"
            >
                <div className="forge-report-builder__runtime-preview-header">
                    <div className="forge-report-builder__runtime-preview-eyebrow">Authored Runtime</div>
                    <h4 className="forge-report-builder__runtime-preview-title">
                        {runtimePreviewArtifact?.document?.title || "Compiled Runtime Preview"}
                    </h4>
                    {runtimePreviewArtifact?.document?.subtitle ? (
                        <div className="forge-report-builder__runtime-preview-description">
                            {runtimePreviewArtifact.document.subtitle}
                        </div>
                    ) : null}
                    <p className="forge-report-builder__runtime-preview-description">
                        {runtimePreviewArtifact?.document?.description
                            || "Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow."}
                    </p>
                </div>
                {runtimePreviewRowsSource.loading && !hasRuntimeRows ? (
                    <ReportBuilderResultState
                        icon="refresh"
                        eyebrow="Runtime preview"
                        title="Refreshing authored runtime"
                        description="Executing the compiled runtime request for the current builder state."
                    />
                ) : null}
                {!canRunReport && !runtimePreviewRowsSource.loading ? (
                    <div>
                        <ReportBuilderResultState
                            tone={runtimePreviewBlockedState?.tone || "neutral"}
                            icon={runtimePreviewBlockedState?.icon || "filter-list"}
                            eyebrow={runtimePreviewBlockedState?.eyebrow || "Runtime preview"}
                            title={runtimePreviewBlockedState?.title || "Compile the authored runtime preview"}
                            description={runtimePreviewBlockedState?.description || "Complete the required scope and filters to compile the authored runtime preview."}
                            actionLabel={runtimePreviewBlockedState?.actionLabel || ""}
                            onAction={runtimePreviewBlockedState?.action === "retrySemanticValidation" ? retrySemanticValidation : undefined}
                        />
                        {Array.isArray(runtimePreviewBlockedState?.diagnostics) && runtimePreviewBlockedState.diagnostics.length > 0 ? (
                            <section className={`forge-report-builder__semantic-diagnostics forge-report-builder__semantic-diagnostics--${runtimePreviewBlockedState.tone === "error" ? "danger" : (runtimePreviewBlockedState.tone || "warning")}`} style={{ marginTop: 12 }}>
                                {runtimePreviewBlockedState.diagnosticsTitle || runtimePreviewBlockedState.diagnosticsDescription ? (
                                    <div className="forge-report-builder__semantic-diagnostics-header">
                                        {runtimePreviewBlockedState.diagnosticsTitle ? (
                                            <div className="forge-report-builder__semantic-diagnostics-title">{runtimePreviewBlockedState.diagnosticsTitle}</div>
                                        ) : null}
                                        {runtimePreviewBlockedState.diagnosticsDescription ? (
                                            <div className="forge-report-builder__semantic-diagnostics-description">{runtimePreviewBlockedState.diagnosticsDescription}</div>
                                        ) : null}
                                    </div>
                                ) : null}
                                <div className="forge-report-builder__semantic-diagnostics-list">
                                    {runtimePreviewBlockedState.diagnostics.map((diagnostic) => (
                                        <article
                                            key={diagnostic.id}
                                            className={`forge-report-builder__semantic-diagnostic forge-report-builder__semantic-diagnostic--${diagnostic.severity || "error"}`}
                                        >
                                            <div className="forge-report-builder__semantic-diagnostic-meta">
                                                {diagnostic.code ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.code}</span> : null}
                                                {diagnostic.path ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.path}</span> : null}
                                            </div>
                                            <div className="forge-report-builder__semantic-diagnostic-message">{diagnostic.message}</div>
                                            {diagnostic.suggestedFix ? (
                                                <div className="forge-report-builder__semantic-diagnostic-fix">{diagnostic.suggestedFix}</div>
                                            ) : null}
                                        </article>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </div>
                ) : null}
                {!runtimePreviewRowsSource.loading && runtimePreviewRowsSource.error && !hasRuntimeRows ? (
                    <ReportBuilderResultState
                        tone="error"
                        icon="warning-sign"
                        eyebrow="Runtime preview"
                        title="We couldn't compile these runtime results"
                        description={renderReportBuilderError(runtimePreviewRowsSource.error)}
                    />
                ) : null}
                {runtimeConfig && (canRunReport || (readiness.reason === "semantic" && runtimePreviewArtifactDiagnostics.length > 0)) ? (
                    <ReportRuntime
                        reportSpec={runtimeConfig.reportSpec}
                        reportFill={runtimeConfig.reportFill}
                        title={runtimePreviewArtifact?.runtimeBlock?.title || ""}
                        subtitle={runtimePreviewArtifact?.runtimeBlock?.subtitle || ""}
                        locale={locale}
                        hostIntent={runtimeConfig.hostIntent}
                        runtimeHandlers={runtimePreviewHandlers}
                    />
                ) : null}
            </section>
        );
    };

    return (
        <div className={[
            "forge-report-builder",
            compactMode ? "forge-report-builder--compact" : "",
            compactSheetOpen || compactChartSheetOpen ? "forge-report-builder--compact-overlay-open" : "",
            useFilterDrawer ? "forge-report-builder--filters-drawer" : "",
            (!compactMode && useFilterRail && railFilterState.showOverlayBody) ? "forge-report-builder--filter-overlay-open" : "",
            resultPanePosition === "left" ? "forge-report-builder--result-left" : "",
        ].filter(Boolean).join(" ")}
        ref={builderRootRef}
        style={builderRootStyle}
        data-report-builder-state={reportBuilderStateMarker}
        data-report-builder-view-mode={String(state.viewMode || "").trim() || "table"}
        data-report-builder-chart-title={String(state.chartSpec?.title || "").trim()}
        data-report-builder-chart-type={String(state.chartSpec?.type || "").trim()}
        data-report-builder-left-rail-width={compactMode ? "" : `${resolvedLeftRailWidthPercent.toFixed(2)}%`}
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

            {semanticStatus?.message ? (
                <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${semanticStatus.level || "info"}`}>
                    <span>{semanticStatus.title}: {semanticStatus.message}</span>
                </div>
            ) : null}
            {semanticSelectedIssues.length > 0 && readiness.reason === "semantic" ? (
                <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--danger">
                    <span>Semantic selection issue: {semanticFieldValidation?.message || "Resolve semantic field issues before running the report."}</span>
                </div>
            ) : null}
            {semanticSelectedIssues.length === 0 && readiness.reason === "semantic" && readiness.message && semanticStatus?.level === "info" ? (
                <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${semanticSelectionValidationState.error || semanticSelectionValidationState.valid === false ? "danger" : "info"}`}>
                    <span>Semantic validation: {readiness.message}</span>
                </div>
            ) : null}
            {semanticSelectedIssues.length === 0 && semanticDiagnosticsNotice ? (
                <section className={`forge-report-builder__semantic-diagnostics forge-report-builder__semantic-diagnostics--${semanticDiagnosticsNotice.level}`}>
                    <div className="forge-report-builder__semantic-diagnostics-header">
                        <div className="forge-report-builder__semantic-diagnostics-title">{semanticDiagnosticsNotice.title}</div>
                        <div className="forge-report-builder__semantic-diagnostics-description">{semanticDiagnosticsNotice.description}</div>
                    </div>
                    {semanticDiagnosticsNotice.diagnostics.length > 0 ? (
                        <div className="forge-report-builder__semantic-diagnostics-list">
                            {semanticDiagnosticsNotice.diagnostics.map((diagnostic) => (
                                <article key={diagnostic.id} className={`forge-report-builder__semantic-diagnostic forge-report-builder__semantic-diagnostic--${diagnostic.severity || "error"}`}>
                                    <div className="forge-report-builder__semantic-diagnostic-meta">
                                        {diagnostic.code ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.code}</span> : null}
                                        {diagnostic.path ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.path}</span> : null}
                                    </div>
                                    <div className="forge-report-builder__semantic-diagnostic-message">{diagnostic.message}</div>
                                    {diagnostic.suggestedFix ? (
                                        <div className="forge-report-builder__semantic-diagnostic-fix">{diagnostic.suggestedFix}</div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    ) : null}
                </section>
            ) : null}
            {authoredDocumentBlockDiagnostics.length > 0 ? (
                <section className="forge-report-builder__semantic-diagnostics forge-report-builder__semantic-diagnostics--warning">
                    <div className="forge-report-builder__semantic-diagnostics-header">
                        <div className="forge-report-builder__semantic-diagnostics-title">Authored Block Validation</div>
                        <div className="forge-report-builder__semantic-diagnostics-description">
                            Some authored blocks reference measures, breakdowns, scope parameters, or geo fields that are no longer available in the current builder state.
                        </div>
                    </div>
                    <div className="forge-report-builder__semantic-diagnostics-list">
                        {authoredDocumentBlockDiagnostics.map((diagnostic) => (
                            <article
                                key={diagnostic.id}
                                className={`forge-report-builder__semantic-diagnostic forge-report-builder__semantic-diagnostic--${diagnostic.severity || "error"}`}
                            >
                                <div className="forge-report-builder__semantic-diagnostic-meta">
                                    {diagnostic.code ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.code}</span> : null}
                                    {diagnostic.blockId ? <span className="forge-report-builder__semantic-diagnostic-chip">{diagnostic.blockId}</span> : null}
                                </div>
                                <div className="forge-report-builder__semantic-diagnostic-message">{diagnostic.message}</div>
                                {diagnostic.suggestedFix ? (
                                    <div className="forge-report-builder__semantic-diagnostic-fix">{diagnostic.suggestedFix}</div>
                                ) : null}
                                {diagnostic.blockId ? (
                                    <div style={{ marginTop: 8 }}>
                                        <Button
                                            small
                                            minimal
                                            onClick={() => openDocumentBlockDialogForDiagnostic(diagnostic)}
                                            aria-label={`Edit authored block ${diagnostic.blockId}`}
                                        >
                                            Edit block
                                        </Button>
                                    </div>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            <div className="forge-report-builder__body">
                {!compactMode ? (
                    <aside className="forge-report-builder__left" ref={leftRailRef}>
                        {renderReportDocumentPanel()}
                        {renderMeasuresPanel()}
                        {renderBreakdownPanel()}
                        {renderAuthoredBlocksPanel()}
                        {useFilterRail ? renderFilterRailControls() : null}
                        {useFilterDrawer && filtersDrawerOpen ? renderFiltersPanel() : null}
                        {leftRailCanScrollDown ? (
                            <button
                                type="button"
                                className="forge-report-builder__left-jump"
                                onClick={scrollLeftRailToBottom}
                                aria-label="Scroll setup panel to bottom"
                                title="Scroll to the last setup section"
                            >
                                <Icon icon="double-chevron-down" size={12} />
                                Bottom
                            </button>
                        ) : null}
                        <div
                            className={leftRailResizing ? "forge-report-builder__left-resizer is-active" : "forge-report-builder__left-resizer"}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize setup panel"
                            title="Drag to resize the setup panel. Double-click to reset."
                            onMouseDown={startLeftRailResize}
                            onDoubleClick={resetLeftRailWidth}
                        >
                            <span className="forge-report-builder__left-resizer-thumb" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </span>
                        </div>
                    </aside>
                ) : null}

                <main className="forge-report-builder__center">
                    {!compactMode && useFilterRail && railFilterState.showOverlayBody ? (
                        <div className="forge-report-builder__overlay-shell">
                            <button
                                type="button"
                                className="forge-report-builder__overlay-backdrop"
                                aria-label="Close filters drawer"
                                onClick={() => setFilterPanels((current) => ({ ...current, common: false }))}
                            />
                            {renderFiltersPanel({
                                forceBody: true,
                                showCloseAction: true,
                                overlay: true,
                                onClose: () => setFilterPanels((current) => ({ ...current, common: false })),
                            })}
                        </div>
                    ) : null}
                    {!compactMode && config.showResultHeader !== false && config?.result?.showResultHeader !== false ? (
                        <div className="forge-report-builder__result-header">
                            <div className="forge-report-builder__result-header-copy">
                                <div className="forge-report-builder__result-header-eyebrow">Results</div>
                                <h3>{desktopResultState.title}</h3>
                                <p>{desktopResultState.description}</p>
                                {desktopResultState.presetIdentity ? (
                                    <div
                                        className={[
                                            "forge-report-builder__preset-identity-card",
                                            desktopResultState.presetIdentity.accentTone
                                                ? `forge-report-builder__preset-identity-card--${desktopResultState.presetIdentity.accentTone}`
                                                : "",
                                        ].filter(Boolean).join(" ")}
                                    >
                                        {desktopResultState.presetIdentity.eyebrow ? (
                                            <div className="forge-report-builder__preset-identity-eyebrow">
                                                {desktopResultState.presetIdentity.eyebrow}
                                            </div>
                                        ) : null}
                                        <div className="forge-report-builder__preset-identity-title">
                                            {desktopResultState.presetIdentity.title}
                                        </div>
                                        {desktopResultState.presetIdentity.highlights.length > 0 ? (
                                            <div className="forge-report-builder__preset-identity-highlights">
                                                {desktopResultState.presetIdentity.highlights.map((item) => (
                                                    <span key={item} className="forge-report-builder__preset-identity-highlight">{item}</span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                                {desktopResultState.metaItems.length > 0 ? (
                                    <div className="forge-report-builder__result-meta" aria-label="Current result summary">
                                        {desktopResultState.metaItems.map((item) => (
                                            <span key={item} className="forge-report-builder__result-meta-chip">{item}</span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                {desktopResultHeaderState.quickActions.enabled ? (
                                    <ReportBuilderChartQuickActions
                                        canCreate={desktopResultHeaderState.quickActions.canCreate}
                                        showCreateButton={desktopResultHeaderState.quickActions.showCreateButton}
                                        onCreate={() => openChartDialog(state.chartSpec)}
                                        quickOptions={desktopResultHeaderState.quickActions.quickOptions}
                                        buttonLabel={desktopResultHeaderState.quickActions.buttonLabel}
                                        buttonIcon={desktopResultHeaderState.quickActions.buttonIcon}
                                        onSelectQuickOption={(value) => {
                                            setSelectedQuickChartOption(value);
                                            setChartApplyFeedback(null);
                                            if (value) {
                                                applyQuickChart(value);
                                            }
                                        }}
                                    />
                                ) : null}
                                {desktopResultHeaderState.editChartEnabled ? (
                                    <Button
                                        small
                                        outlined
                                        icon="edit"
                                        className="forge-report-builder__chart-action-button forge-report-builder__chart-action-button--edit"
                                        onClick={() => openChartDialog(state.chartSpec)}
                                    >
                                        Edit Chart
                                    </Button>
                                ) : null}
                                {draftExportRequestSummary ? (
                                    <>
                                        <Button
                                            small
                                            outlined
                                            icon="download"
                                            className="forge-report-builder__chart-action-button"
                                            disabled={draftExportSubmitting}
                                            onClick={triggerDraftExport}
                                        >
                                            {reportExportHandler ? "Export PDF" : "Review Export"}
                                        </Button>
                                        <Button
                                            small
                                            minimal
                                            className="forge-report-builder__chart-action-button"
                                            onClick={() => setDraftExportRequestOpen((current) => !current)}
                                        >
                                            {draftExportRequestOpen ? "Hide export" : "Inspect export"}
                                        </Button>
                                    </>
                                ) : null}
                                <div className="forge-report-builder__view-toggle">
                                    {desktopResultHeaderState.viewToggleModes.map((modeState) => (
                                        <button
                                            key={modeState.mode}
                                            type="button"
                                            className={modeState.active ? "is-active" : ""}
                                            onClick={() => setViewMode(modeState.mode)}
                                            disabled={modeState.disabled}
                                        >
                                            <Icon icon={modeState.icon} size={12} />
                                            {modeState.mode}
                                        </button>
                                    ))}
                                </div>
                                <ReportBuilderOverflowActions actions={desktopResultOverflowActions} />
                            </div>
                        </div>
                    ) : null}
                    {showingChartView && selectedBuilderChartSelection && !explorationActive ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <span>
                                <strong>Chart selection:</strong> {chartSelectionSummary || "Selected chart value"}
                                </span>
                                <span style={{ fontSize: 12, lineHeight: 1.45 }}>
                                    This selection is only temporary context. A local draft starts automatically when you change the result, and the keep/save/discard actions appear above.
                                </span>
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <Button small minimal onClick={() => setSelectedBuilderChartSelection(null)}>Clear</Button>
                            </div>
                        </div>
                    ) : null}
                    {explorationBannerState?.active ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <span>
                                <strong>{explorationBannerState.title}.</strong>{" "}
                                {explorationBannerState.description}
                            </span>
                            {Array.isArray(explorationBannerState.hintItems) && explorationBannerState.hintItems.length > 0 ? (
                                <div className="forge-report-builder__result-meta" aria-label="Exploration guidance" style={{ marginTop: 10 }}>
                                    {explorationBannerState.hintItems.map((item) => (
                                        <span key={item} className="forge-report-builder__result-meta-chip">{item}</span>
                                    ))}
                                </div>
                            ) : null}
                            <div className="forge-report-builder__result-header-actions">
                                <Button small minimal onClick={undoExploration} disabled={!explorationBannerState.canUndo}>Undo</Button>
                                <Button small minimal onClick={redoExploration} disabled={!explorationBannerState.canRedo}>Redo</Button>
                                <Button small minimal onClick={keepExplorationChanges} disabled={!explorationBannerState.canKeep}>Keep changes</Button>
                                <Button small minimal onClick={saveExploration} disabled={!explorationBannerState.canSaveArtifact}>Save artifact</Button>
                                <Button small minimal onClick={discardExploration}>Discard draft</Button>
                            </div>
                        </div>
                    ) : null}
                    {hydratedReportDocumentSession ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Reopened ReportDocument:</strong> {hydratedReportDocumentSession.title}
                                </span>
                                {hydratedReportDocumentSession.templateLabel ? (
                                    <span><strong>Template:</strong> {hydratedReportDocumentSession.templateLabel}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{hydratedReportDocumentSession.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">v{hydratedReportDocumentSession.documentVersion || 0}</span>
                                {hydratedReportDocumentSession.reopenedCompileState?.status ? (
                                    <span className="forge-report-builder__result-meta-chip">{hydratedReportDocumentSession.reopenedCompileState.status}</span>
                                ) : null}
                                {hydratedReportDocumentSession.templateLabel ? (
                                    <span className="forge-report-builder__result-meta-chip">{hydratedReportDocumentSession.templateLabel}</span>
                                ) : null}
                                {reopenedExportRequestSummary ? (
                                    <>
                                        <Button small minimal disabled={reopenedExportSubmitting} onClick={triggerReopenedExport}>
                                            {reportExportHandler ? "Export snapshot" : "Review export"}
                                        </Button>
                                        <Button small minimal onClick={() => setReopenedExportRequestOpen((current) => !current)}>
                                            {reopenedExportRequestOpen ? "Hide export" : "Inspect export"}
                                        </Button>
                                    </>
                                ) : null}
                                <Button small minimal onClick={restoreHydratedReportDocumentSession}>
                                    Restore live builder
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {reopenedExportRequestOpen && reopenedExportRequestInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Reopened export request summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{reopenedExportRequestInspector.from}</span>
                                <span className="forge-report-builder__result-meta-chip">{reopenedExportRequestInspector.format}</span>
                                <span className="forge-report-builder__result-meta-chip">{reopenedExportRequestInspector.artifactRef}</span>
                            </div>
                            <div className="forge-report-builder__result-header-actions" style={{ marginBottom: 10 }}>
                                <Button small minimal onClick={() => setReopenedExportRequestOpen(false)}>
                                    Hide export request
                                </Button>
                                <Button small minimal onClick={downloadReopenedExportRequest}>
                                    Download export request
                                </Button>
                            </div>
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
                                }}
                            >
                                {reopenedExportRequestInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {reopenedExportJobSummary ? (
                        <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${reopenedExportJobSummary.hasFailure ? "warning" : "info"}`}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Reopened export:</strong> {hydratedReportDocumentSession?.title || "Report"}
                                </span>
                                {reopenedExportJobSummary.error ? (
                                    <span>{reopenedExportJobSummary.error}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{reopenedExportJobSummary.jobId}</span>
                                <span className="forge-report-builder__result-meta-chip">{reopenedExportJobSummary.status}</span>
                                {reopenedExportJobSummary.artifactId ? (
                                    <span className="forge-report-builder__result-meta-chip">{reopenedExportJobSummary.artifactId}</span>
                                ) : null}
                                <Button
                                    small
                                    minimal
                                    disabled={reopenedExportStatusLoading || !reopenedExportJobSummary.canRefresh}
                                    onClick={refreshReopenedExportStatus}
                                >
                                    {reopenedExportStatusLoading ? "Refreshing..." : "Refresh status"}
                                </Button>
                                <Button
                                    small
                                    minimal
                                    disabled={reopenedExportArtifactLoading || !reopenedExportJobSummary.hasArtifact}
                                    onClick={downloadReopenedExportArtifact}
                                >
                                    {reopenedExportArtifactLoading ? "Loading artifact..." : "Download artifact"}
                                </Button>
                            </div>
                            {renderExportFailureDiagnostics(reopenedExportFailureNotice)}
                        </div>
                    ) : null}
                    {hydratedReportDocumentSession && !reopenedReportDocumentCompileValidation.valid ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning">
                            <span>
                                <strong>Reopened compile warning:</strong> {reopenedReportDocumentCompileValidation.message}
                            </span>
                                <div className="forge-report-builder__result-header-actions">
                                    {reopenedReportDocumentCompileValidation.blockingDiagnostics.map((diagnostic) => (
                                        diagnostic.blockId ? (
                                            <Button
                                                key={diagnostic.id || `${diagnostic.code || "diagnostic"}:${diagnostic.blockId}`}
                                                small
                                                minimal
                                                onClick={() => openDocumentBlockDialogForDiagnostic(diagnostic)}
                                                aria-label={`Edit authored block ${diagnostic.blockId}`}
                                            >
                                            Edit {diagnostic.blockId}
                                        </Button>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {hydratedReportDocumentSession ? renderCompileDiagnosticsNotice(reopenedCompileDiagnosticsNotice, {
                        actionForDiagnostic: openDocumentBlockDialogForDiagnostic,
                    }) : null}
                    {draftExportRequestOpen && draftExportRequestInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Draft export request summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{draftExportRequestInspector.from}</span>
                                <span className="forge-report-builder__result-meta-chip">{draftExportRequestInspector.format}</span>
                                <span className="forge-report-builder__result-meta-chip">{draftExportRequestInspector.artifactRef}</span>
                                {draftExportRequestInspector.hasReportPrint ? (
                                    <span className="forge-report-builder__result-meta-chip">reportPrint</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions" style={{ marginBottom: 10 }}>
                                <Button small minimal onClick={() => setDraftExportRequestOpen(false)}>
                                    Hide export request
                                </Button>
                                <Button small minimal onClick={downloadDraftExportRequest}>
                                    Download export request
                                </Button>
                            </div>
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
                                }}
                            >
                                {draftExportRequestInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {draftExportJobSummary ? (
                        <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${draftExportJobSummary.hasFailure ? "warning" : "info"}`}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Draft export:</strong> {draftExportRequestSummary?.title || "Report"}
                                </span>
                                {draftExportJobSummary.error ? (
                                    <span>{draftExportJobSummary.error}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{draftExportJobSummary.jobId}</span>
                                <span className="forge-report-builder__result-meta-chip">{draftExportJobSummary.status}</span>
                                {draftExportJobSummary.artifactId ? (
                                    <span className="forge-report-builder__result-meta-chip">{draftExportJobSummary.artifactId}</span>
                                ) : null}
                                <Button
                                    small
                                    minimal
                                    disabled={draftExportStatusLoading || !draftExportJobSummary.canRefresh}
                                    onClick={refreshDraftExportStatus}
                                >
                                    {draftExportStatusLoading ? "Refreshing..." : "Refresh status"}
                                </Button>
                                <Button
                                    small
                                    minimal
                                    disabled={draftExportArtifactLoading || !draftExportJobSummary.hasArtifact}
                                    onClick={downloadDraftExportArtifact}
                                >
                                    {draftExportArtifactLoading ? "Loading artifact..." : "Download artifact"}
                                </Button>
                            </div>
                            {renderExportFailureDiagnostics(draftExportFailureNotice)}
                        </div>
                    ) : null}
                    {savedExplorationArtifactSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Saved exploration artifact:</strong> {savedExplorationArtifactSummary.title}
                                    {savedExplorationArtifactSummary.sourceLabel ? ` (${savedExplorationArtifactSummary.sourceLabel})` : ""}
                                </span>
                                {savedExplorationArtifactSummary.subtitle ? (
                                    <span>{savedExplorationArtifactSummary.subtitle}</span>
                                ) : null}
                                {savedExplorationArtifactSummary.description ? (
                                    <span>{savedExplorationArtifactSummary.description}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{savedExplorationArtifactSummary.blockCount} blocks</span>
                                <span className="forge-report-builder__result-meta-chip">{savedExplorationArtifactSummary.datasetCount} dataset</span>
                                <Button small minimal onClick={prepareSavedReportPayload}>
                                    Prepare report payload
                                </Button>
                                <Button small minimal onClick={() => setSavedExplorationArtifactOpen((current) => !current)}>
                                    {savedExplorationArtifactOpen ? "Hide artifact" : "Inspect artifact"}
                                </Button>
                                <Button small minimal onClick={downloadExplorationArtifact}>
                                    Download artifact
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {savedExplorationArtifactOpen && savedExplorationArtifactInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Saved exploration artifact summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{savedExplorationArtifactInspector.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{savedExplorationArtifactInspector.artifactId}</span>
                                <span className="forge-report-builder__result-meta-chip">{savedExplorationArtifactInspector.sourceKind}</span>
                            </div>
                            {savedExplorationArtifactInspector.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {savedExplorationArtifactInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {savedExplorationArtifactInspector.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {savedExplorationArtifactInspector.headerDescription}
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
                                }}
                            >
                                {savedExplorationArtifactInspector.payload}
                            </pre>
                        </div>
                    ) : null}
                    {savedReportPayloadSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Saved report payload:</strong> {savedReportPayloadSummary.title}
                                    {savedReportPayloadSummary.sourceLabel ? ` (${savedReportPayloadSummary.sourceLabel})` : ""}
                                </span>
                                {savedReportPayloadSummary.subtitle ? (
                                    <span>{savedReportPayloadSummary.subtitle}</span>
                                ) : null}
                                {savedReportPayloadSummary.description ? (
                                    <span>{savedReportPayloadSummary.description}</span>
                                ) : null}
                                {savedReportPayloadSummary.templateLabel ? (
                                    <span><strong>Template:</strong> {savedReportPayloadSummary.templateLabel}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                {savedReportPayloadSummary.compileStatus ? (
                                    <span className="forge-report-builder__result-meta-chip">{savedReportPayloadSummary.compileStatus}</span>
                                ) : null}
                                {savedReportPayloadSummary.templateLabel ? (
                                    <span className="forge-report-builder__result-meta-chip">{savedReportPayloadSummary.templateLabel}</span>
                                ) : null}
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadSummary.blockCount} blocks</span>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadSummary.datasetCount} dataset</span>
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#486579", fontSize: 11 }}>
                                    <span>Document version</span>
                                    <input
                                        aria-label="Document version"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={reportDocumentVersionDraft}
                                        onChange={(event) => setReportDocumentVersionDraft(event.target.value)}
                                        style={{
                                            width: 72,
                                            minHeight: 28,
                                            padding: "4px 8px",
                                            borderRadius: 8,
                                            border: "1px solid #c8d6e5",
                                            background: "#ffffff",
                                            color: "#183247",
                                        }}
                                    />
                                </label>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareGetReportDocumentResponse}
                                    disabled={!reportDocumentVersionState.valid}
                                >
                                    Prepare get response
                                </Button>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareListReportDocumentsResponse}
                                    disabled={!reportDocumentVersionState.valid}
                                >
                                    Prepare list response
                                </Button>
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#486579", fontSize: 11 }}>
                                    <span>Expected version</span>
                                    <input
                                        aria-label="Expected version"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={updateReportDocumentExpectedVersionDraft}
                                        onChange={(event) => setUpdateReportDocumentExpectedVersionDraft(event.target.value)}
                                        style={{
                                            width: 72,
                                            minHeight: 28,
                                            padding: "4px 8px",
                                            borderRadius: 8,
                                            border: "1px solid #c8d6e5",
                                            background: "#ffffff",
                                            color: "#183247",
                                        }}
                                    />
                                </label>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareUpdateReportDocumentPayload}
                                    disabled={!updateReportDocumentExpectedVersionState.valid || !reportDocumentPayloadCompileValidation.valid}
                                >
                                    Prepare update payload
                                </Button>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareCreateReportDocumentPayload}
                                    disabled={!reportDocumentPayloadCompileValidation.valid}
                                >
                                    Prepare create payload
                                </Button>
                                <Button small minimal onClick={() => setSavedReportPayloadOpen((current) => !current)}>
                                    {savedReportPayloadOpen ? "Hide report payload" : "Inspect report payload"}
                                </Button>
                                <Button small minimal onClick={downloadSavedReportPayload}>
                                    Download report payload
                                </Button>
                                {savedReportPayloadExportRequestSummary ? (
                                    <>
                                        <Button
                                            small
                                            minimal
                                            disabled={savedReportPayloadExportSubmitting}
                                            onClick={triggerSavedReportPayloadExport}
                                        >
                                            {reportExportHandler ? "Export snapshot" : "Review export"}
                                        </Button>
                                        <Button
                                            small
                                            minimal
                                            onClick={() => setSavedReportPayloadExportRequestOpen((current) => !current)}
                                        >
                                            {savedReportPayloadExportRequestOpen ? "Hide export" : "Inspect export"}
                                        </Button>
                                    </>
                                ) : (
                                    <span className="forge-report-builder__result-meta-chip">No export snapshot</span>
                                )}
                            </div>
                            {reportPayloadValidationNotice ? (
                                <div className="forge-report-builder__result-header-actions" style={{ marginTop: 8 }}>
                                    <span>{reportPayloadValidationNotice.message}</span>
                                    {reportPayloadValidationNotice.blockingDiagnostics[0]?.blockId ? (
                                        <Button
                                            small
                                            minimal
                                            onClick={() => openDocumentBlockDialogForDiagnostic(reportPayloadValidationNotice.blockingDiagnostics[0])}
                                            aria-label={`Edit authored block ${reportPayloadValidationNotice.blockingDiagnostics[0].blockId}`}
                                        >
                                            Edit {reportPayloadValidationNotice.blockingDiagnostics[0].blockId}
                                        </Button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {savedReportPayloadSummary ? renderCompileDiagnosticsNotice(savedPayloadCompileDiagnosticsNotice, {
                        actionForDiagnostic: openDocumentBlockDialogForDiagnostic,
                    }) : null}
                    {savedReportPayloadOpen && savedReportPayloadInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Saved report payload summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadInspector.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadInspector.payloadId}</span>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadInspector.sourceArtifactId}</span>
                                {savedReportPayloadInspector.compileStatus ? (
                                    <span className="forge-report-builder__result-meta-chip">{savedReportPayloadInspector.compileStatus}</span>
                                ) : null}
                                {savedReportPayloadInspector.templateLabel ? (
                                    <span className="forge-report-builder__result-meta-chip">{savedReportPayloadInspector.templateLabel}</span>
                                ) : null}
                            </div>
                            {savedReportPayloadInspector.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {savedReportPayloadInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {savedReportPayloadInspector.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {savedReportPayloadInspector.headerDescription}
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
                                }}
                            >
                                {savedReportPayloadInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {savedReportPayloadExportRequestOpen && savedReportPayloadExportRequestInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Saved export request summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadExportRequestInspector.from}</span>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadExportRequestInspector.format}</span>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadExportRequestInspector.artifactRef}</span>
                                {savedReportPayloadExportRequestInspector.documentVersion ? (
                                    <span className="forge-report-builder__result-meta-chip">v{savedReportPayloadExportRequestInspector.documentVersion}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions" style={{ marginBottom: 10 }}>
                                <Button small minimal onClick={() => setSavedReportPayloadExportRequestOpen(false)}>
                                    Hide export request
                                </Button>
                                <Button small minimal onClick={downloadSavedReportPayloadExportRequest}>
                                    Download export request
                                </Button>
                            </div>
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
                                }}
                            >
                                {savedReportPayloadExportRequestInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {savedReportPayloadExportJobSummary ? (
                        <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${savedReportPayloadExportJobSummary.hasFailure ? "warning" : "info"}`}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Saved export:</strong> {savedReportPayloadSummary?.title || "Report"}
                                </span>
                                {savedReportPayloadExportJobSummary.error ? (
                                    <span>{savedReportPayloadExportJobSummary.error}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadExportJobSummary.jobId}</span>
                                <span className="forge-report-builder__result-meta-chip">{savedReportPayloadExportJobSummary.status}</span>
                                {savedReportPayloadExportJobSummary.artifactId ? (
                                    <span className="forge-report-builder__result-meta-chip">{savedReportPayloadExportJobSummary.artifactId}</span>
                                ) : null}
                                <Button
                                    small
                                    minimal
                                    disabled={savedReportPayloadExportStatusLoading || !savedReportPayloadExportJobSummary.canRefresh}
                                    onClick={refreshSavedReportPayloadExportStatus}
                                >
                                    {savedReportPayloadExportStatusLoading ? "Refreshing..." : "Refresh status"}
                                </Button>
                                <Button
                                    small
                                    minimal
                                    disabled={savedReportPayloadExportArtifactLoading || !savedReportPayloadExportJobSummary.hasArtifact}
                                    onClick={downloadSavedReportPayloadArtifact}
                                >
                                    {savedReportPayloadExportArtifactLoading ? "Loading artifact..." : "Download artifact"}
                                </Button>
                            </div>
                            {renderExportFailureDiagnostics(savedReportPayloadExportFailureNotice)}
                        </div>
                    ) : null}
                    {savedReportPayloadSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <span>{reportDocumentVersionState.helperText}</span>
                        </div>
                    ) : null}
                    {savedReportPayloadSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <span>{updateReportDocumentExpectedVersionState.helperText}</span>
                        </div>
                    ) : null}
                    {getReportDocumentResponseSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Get ReportDocument response:</strong> {getReportDocumentResponseSummary.title}
                                </span>
                                {getReportDocumentResponseSummary.subtitle ? (
                                    <span>{getReportDocumentResponseSummary.subtitle}</span>
                                ) : null}
                                {getReportDocumentResponseSummary.description ? (
                                    <span>{getReportDocumentResponseSummary.description}</span>
                                ) : null}
                                {getReportDocumentResponseSummary.templateLabel ? (
                                    <span><strong>Template:</strong> {getReportDocumentResponseSummary.templateLabel}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{getReportDocumentResponseSummary.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">v{getReportDocumentResponseSummary.documentVersion}</span>
                                <span className="forge-report-builder__result-meta-chip">{getReportDocumentResponseSummary.compileStatus}</span>
                                {getReportDocumentResponseSummary.templateLabel ? (
                                    <span className="forge-report-builder__result-meta-chip">{getReportDocumentResponseSummary.templateLabel}</span>
                                ) : null}
                                <Button small minimal onClick={reopenGetReportDocumentResponse}>
                                    Reopen in builder
                                </Button>
                                <Button small minimal onClick={() => setGetReportDocumentResponseOpen((current) => !current)}>
                                    {getReportDocumentResponseOpen ? "Hide get response" : "Inspect get response"}
                                </Button>
                                <Button small minimal onClick={downloadGetReportDocumentResponse}>
                                    Download get response
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {getReportDocumentResponseSummary && !getReportDocumentResponseCompileValidation.valid ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning">
                            <span>
                                <strong>Persisted compile warning:</strong> {getReportDocumentResponseCompileValidation.message}
                            </span>
                        </div>
                    ) : null}
                    {getReportDocumentResponseOpen && getReportDocumentResponseContent ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Get ReportDocument response summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">getReportDocumentResponse</span>
                                <span className="forge-report-builder__result-meta-chip">v{getReportDocumentResponseSummary?.documentVersion || 0}</span>
                                {getReportDocumentResponseInspector?.title ? (
                                    <span className="forge-report-builder__result-meta-chip">{getReportDocumentResponseInspector.title}</span>
                                ) : null}
                                {getReportDocumentResponseInspector?.templateLabel ? (
                                    <span className="forge-report-builder__result-meta-chip">{getReportDocumentResponseInspector.templateLabel}</span>
                                ) : null}
                            </div>
                            {getReportDocumentResponseInspector?.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {getReportDocumentResponseInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {getReportDocumentResponseInspector?.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {getReportDocumentResponseInspector.headerDescription}
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
                                }}
                            >
                                {getReportDocumentResponseContent}
                            </pre>
                        </div>
                    ) : null}
                    {reopenReportDocumentDiagnosticSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Reopen diagnostic:</strong> {reopenReportDocumentDiagnosticSummary.title}
                                </span>
                                {reopenReportDocumentDiagnosticSummary.subtitle ? (
                                    <span>{reopenReportDocumentDiagnosticSummary.subtitle}</span>
                                ) : null}
                                {reopenReportDocumentDiagnosticSummary.description ? (
                                    <span>{reopenReportDocumentDiagnosticSummary.description}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{reopenReportDocumentDiagnosticSummary.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">{reopenReportDocumentDiagnosticSummary.code}</span>
                                <span className="forge-report-builder__result-meta-chip">{reopenReportDocumentDiagnosticSummary.severity}</span>
                                <Button small minimal onClick={() => setReopenReportDocumentDiagnosticOpen((current) => !current)}>
                                    {reopenReportDocumentDiagnosticOpen ? "Hide reopen diagnostic" : "Inspect reopen diagnostic"}
                                </Button>
                                <Button small minimal onClick={downloadReopenReportDocumentDiagnostic}>
                                    Download reopen diagnostic
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {reopenReportDocumentDiagnosticOpen && reopenReportDocumentDiagnosticInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Reopen diagnostic summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{reopenReportDocumentDiagnosticInspector.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{reopenReportDocumentDiagnosticInspector.code}</span>
                                <span className="forge-report-builder__result-meta-chip">{reopenReportDocumentDiagnosticInspector.severity}</span>
                            </div>
                            {reopenReportDocumentDiagnosticInspector.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#5f3411" }}>
                                    {reopenReportDocumentDiagnosticInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {reopenReportDocumentDiagnosticInspector.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#5f3411" }}>
                                    {reopenReportDocumentDiagnosticInspector.headerDescription}
                                </div>
                            ) : null}
                            <pre
                                className="forge-report-builder__saved-artifact-json"
                                style={{
                                    margin: 0,
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    border: "1px solid #d7e2ee",
                                    background: "#fff9f5",
                                    color: "#5f3411",
                                    fontSize: 11,
                                    lineHeight: 1.5,
                                    whiteSpace: "pre-wrap",
                                    overflow: "auto",
                                    maxHeight: 320,
                                }}
                            >
                                {reopenReportDocumentDiagnosticInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {listReportDocumentsResponseSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>List ReportDocuments response:</strong> {listReportDocumentsResponseSummary.entryCount} entries
                                </span>
                                {selectedListReportDocumentsEntrySummary?.title ? (
                                    <span><strong>Selected entry:</strong> {selectedListReportDocumentsEntrySummary.title}</span>
                                ) : null}
                                {selectedListReportDocumentsEntrySummary?.subtitle ? (
                                    <span>{selectedListReportDocumentsEntrySummary.subtitle}</span>
                                ) : null}
                                {selectedListReportDocumentsEntrySummary?.description ? (
                                    <span>{selectedListReportDocumentsEntrySummary.description}</span>
                                ) : null}
                                {selectedListReportDocumentsEntrySummary?.templateLabel ? (
                                    <span><strong>Template:</strong> {selectedListReportDocumentsEntrySummary.templateLabel}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{listReportDocumentsResponseSummary.cursor || "no-cursor"}</span>
                                <span className="forge-report-builder__result-meta-chip">{listReportDocumentsResponseSummary.hasMore ? "has-more" : "complete"}</span>
                                {listReportDocumentsEntryOptions.length > 0 ? (
                                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#486579", fontSize: 11 }}>
                                        <span>Entry</span>
                                        <select
                                            aria-label="List response entry"
                                            value={listReportDocumentsSelectedReportId}
                                            onChange={(event) => {
                                                setListReportDocumentsSelectedReportId(event.target.value);
                                                setGetReportDocumentRequestPayload(null);
                                                setGetReportDocumentRequestPayloadOpen(false);
                                                setGetReportDocumentResponse(null);
                                                setGetReportDocumentResponseOpen(false);
                                                setReopenReportDocumentDiagnostic(null);
                                                setReopenReportDocumentDiagnosticOpen(false);
                                            }}
                                            style={{
                                                minHeight: 28,
                                                padding: "4px 8px",
                                                borderRadius: 8,
                                                border: "1px solid #c8d6e5",
                                                background: "#ffffff",
                                                color: "#183247",
                                            }}
                                        >
                                            {listReportDocumentsEntryOptions.map((entry) => (
                                                <option key={entry.reportId} value={entry.reportId}>
                                                    {entry.title || entry.reportId}{entry.compileStatus && entry.compileStatus !== "clean" ? ` (${entry.compileStatus})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ) : null}
                                {selectedListReportDocumentsEntry?.subtitle ? (
                                    <span className="forge-report-builder__result-meta-chip">{selectedListReportDocumentsEntry.subtitle}</span>
                                ) : null}
                                {selectedListReportDocumentsEntrySummary?.templateLabel ? (
                                    <span className="forge-report-builder__result-meta-chip">{selectedListReportDocumentsEntrySummary.templateLabel}</span>
                                ) : null}
                                <Button
                                    small
                                    minimal
                                    onClick={prepareListEntryReopenDiagnostic}
                                    disabled={!listReportDocumentsSelectedReportId}
                                >
                                    Check reopen compatibility
                                </Button>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareGetReportDocumentRequestPayload}
                                    disabled={!listReportDocumentsSelectedReportId}
                                >
                                    Prepare get request
                                </Button>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareSelectedGetReportDocumentResponse}
                                    disabled={!listReportDocumentsSelectedReportId}
                                >
                                    Prepare selected get response
                                </Button>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareSelectedGetReportDocumentResponseFromListEntry}
                                    disabled={!listReportDocumentsSelectedReportId}
                                >
                                    Open selected response
                                </Button>
                                {selectedListEntryExportRequestSummary ? (
                                    <>
                                        <Button
                                            small
                                            minimal
                                            disabled={selectedListEntryExportSubmitting || !listReportDocumentsSelectedReportId}
                                            onClick={triggerSelectedListEntryExport}
                                        >
                                            {reportExportHandler ? "Export selected" : "Review export"}
                                        </Button>
                                        <Button
                                            small
                                            minimal
                                            disabled={!listReportDocumentsSelectedReportId}
                                            onClick={() => setSelectedListEntryExportRequestOpen((current) => !current)}
                                        >
                                            {selectedListEntryExportRequestOpen ? "Hide export" : "Inspect export"}
                                        </Button>
                                    </>
                                ) : null}
                                <Button small minimal onClick={() => setListReportDocumentsResponseOpen((current) => !current)}>
                                    {listReportDocumentsResponseOpen ? "Hide list response" : "Inspect list response"}
                                </Button>
                                <Button small minimal onClick={downloadListReportDocumentsResponse}>
                                    Download list response
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {selectedListEntryExportRequestOpen && selectedListEntryExportRequestInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Selected list entry export request summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{selectedListEntryExportRequestInspector.from}</span>
                                <span className="forge-report-builder__result-meta-chip">{selectedListEntryExportRequestInspector.format}</span>
                                <span className="forge-report-builder__result-meta-chip">{selectedListEntryExportRequestInspector.artifactRef}</span>
                            </div>
                            <div className="forge-report-builder__result-header-actions" style={{ marginBottom: 10 }}>
                                <Button small minimal onClick={() => setSelectedListEntryExportRequestOpen(false)}>
                                    Hide export request
                                </Button>
                                <Button small minimal onClick={downloadSelectedListEntryExportRequest}>
                                    Download export request
                                </Button>
                            </div>
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
                                }}
                            >
                                {selectedListEntryExportRequestInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {selectedListEntryExportJobSummary ? (
                        <div className={`forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--${selectedListEntryExportJobSummary.hasFailure ? "warning" : "info"}`}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Selected export:</strong> {selectedListReportDocumentsEntrySummary?.title || "Report"}
                                </span>
                                {selectedListEntryExportJobSummary.error ? (
                                    <span>{selectedListEntryExportJobSummary.error}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{selectedListEntryExportJobSummary.jobId}</span>
                                <span className="forge-report-builder__result-meta-chip">{selectedListEntryExportJobSummary.status}</span>
                                {selectedListEntryExportJobSummary.artifactId ? (
                                    <span className="forge-report-builder__result-meta-chip">{selectedListEntryExportJobSummary.artifactId}</span>
                                ) : null}
                                <Button
                                    small
                                    minimal
                                    disabled={selectedListEntryExportStatusLoading || !selectedListEntryExportJobSummary.canRefresh}
                                    onClick={refreshSelectedListEntryExportStatus}
                                >
                                    {selectedListEntryExportStatusLoading ? "Refreshing..." : "Refresh status"}
                                </Button>
                                <Button
                                    small
                                    minimal
                                    disabled={selectedListEntryExportArtifactLoading || !selectedListEntryExportJobSummary.hasArtifact}
                                    onClick={downloadSelectedListEntryExportArtifact}
                                >
                                    {selectedListEntryExportArtifactLoading ? "Loading artifact..." : "Download artifact"}
                                </Button>
                            </div>
                            {renderExportFailureDiagnostics(selectedListEntryExportFailureNotice)}
                        </div>
                    ) : null}
                    {selectedListReportDocumentsEntry && !selectedListReportDocumentsEntryCompileValidation.valid ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning">
                            <span>
                                <strong>Selected entry compile warning:</strong> {selectedListReportDocumentsEntryCompileValidation.message}
                            </span>
                            <div className="forge-report-builder__result-header-actions">
                                {selectedListReportDocumentsEntry?.reportRef?.reportId ? (
                                    <span className="forge-report-builder__result-meta-chip">{selectedListReportDocumentsEntry.reportRef.reportId}</span>
                                ) : null}
                                {selectedListReportDocumentsEntrySummary?.title ? (
                                    <span className="forge-report-builder__result-meta-chip">{selectedListReportDocumentsEntrySummary.title}</span>
                                ) : null}
                                {selectedListReportDocumentsEntry?.compileState?.status ? (
                                    <span className="forge-report-builder__result-meta-chip">{selectedListReportDocumentsEntry.compileState.status}</span>
                                ) : null}
                                <Button
                                    small
                                    minimal
                                    onClick={prepareSelectedGetReportDocumentResponseFromListEntry}
                                    disabled={!listReportDocumentsSelectedReportId}
                                >
                                    Open selected response
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {selectedListReportDocumentsEntry ? renderCompileDiagnosticsNotice(selectedListEntryCompileDiagnosticsNotice, {
                        actionForDiagnostic: openDocumentBlockDialogForDiagnostic,
                    }) : null}
                    {listReportDocumentsResponseOpen && listReportDocumentsResponseContent ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="List ReportDocuments response summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">listReportDocumentsResponse</span>
                                <span className="forge-report-builder__result-meta-chip">{listReportDocumentsResponseSummary?.entryCount || 0} entries</span>
                                {listReportDocumentsResponseInspector?.selectedEntry?.title ? (
                                    <span className="forge-report-builder__result-meta-chip">{listReportDocumentsResponseInspector.selectedEntry.title}</span>
                                ) : null}
                                {listReportDocumentsResponseInspector?.templateLabel ? (
                                    <span className="forge-report-builder__result-meta-chip">{listReportDocumentsResponseInspector.templateLabel}</span>
                                ) : null}
                            </div>
                            {listReportDocumentsResponseInspector?.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {listReportDocumentsResponseInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {listReportDocumentsResponseInspector?.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {listReportDocumentsResponseInspector.headerDescription}
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
                                }}
                            >
                                {listReportDocumentsResponseContent}
                            </pre>
                        </div>
                    ) : null}
                    {getReportDocumentRequestPayloadSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Get ReportDocument request:</strong> {getReportDocumentRequestPayloadSummary.title || getReportDocumentRequestPayloadSummary.reportId}
                                </span>
                                {getReportDocumentRequestPayloadSummary.subtitle ? (
                                    <span>{getReportDocumentRequestPayloadSummary.subtitle}</span>
                                ) : null}
                                {getReportDocumentRequestPayloadSummary.description ? (
                                    <span>{getReportDocumentRequestPayloadSummary.description}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{getReportDocumentRequestPayloadSummary.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{getReportDocumentRequestPayloadSummary.reportId}</span>
                                <Button small minimal onClick={() => setGetReportDocumentRequestPayloadOpen((current) => !current)}>
                                    {getReportDocumentRequestPayloadOpen ? "Hide get request" : "Inspect get request"}
                                </Button>
                                <Button small minimal onClick={downloadGetReportDocumentRequestPayload}>
                                    Download get request
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {getReportDocumentRequestPayloadOpen && getReportDocumentRequestPayloadInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Get ReportDocument request summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{getReportDocumentRequestPayloadInspector.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{getReportDocumentRequestPayloadInspector.reportId}</span>
                                {getReportDocumentRequestPayloadInspector.title ? (
                                    <span className="forge-report-builder__result-meta-chip">{getReportDocumentRequestPayloadInspector.title}</span>
                                ) : null}
                            </div>
                            {getReportDocumentRequestPayloadInspector.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {getReportDocumentRequestPayloadInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {getReportDocumentRequestPayloadInspector.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {getReportDocumentRequestPayloadInspector.headerDescription}
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
                                }}
                            >
                                {getReportDocumentRequestPayloadInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {createReportDocumentPayloadSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Create ReportDocument payload:</strong> {createReportDocumentPayloadSummary.title}
                                </span>
                                {createReportDocumentPayloadSummary.subtitle ? (
                                    <span>{createReportDocumentPayloadSummary.subtitle}</span>
                                ) : null}
                                {createReportDocumentPayloadSummary.description ? (
                                    <span>{createReportDocumentPayloadSummary.description}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{createReportDocumentPayloadSummary.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">{createReportDocumentPayloadSummary.compileStatus}</span>
                                <span className="forge-report-builder__result-meta-chip">{createReportDocumentPayloadSummary.blockCount} blocks</span>
                                <span className="forge-report-builder__result-meta-chip">{createReportDocumentPayloadSummary.datasetCount} dataset</span>
                                <Button small minimal onClick={() => setCreateReportDocumentPayloadOpen((current) => !current)}>
                                    {createReportDocumentPayloadOpen ? "Hide create payload" : "Inspect create payload"}
                                </Button>
                                <Button small minimal onClick={downloadCreateReportDocumentPayload}>
                                    Download create payload
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {createReportDocumentPayloadOpen && createReportDocumentPayloadInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Create ReportDocument payload summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{createReportDocumentPayloadInspector.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{createReportDocumentPayloadInspector.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">{createReportDocumentPayloadInspector.compileStatus}</span>
                            </div>
                            {createReportDocumentPayloadInspector.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {createReportDocumentPayloadInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {createReportDocumentPayloadInspector.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {createReportDocumentPayloadInspector.headerDescription}
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
                                }}
                            >
                                {createReportDocumentPayloadInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {updateReportDocumentPayloadSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Update ReportDocument payload:</strong> {updateReportDocumentPayloadSummary.title}
                                </span>
                                {updateReportDocumentPayloadSummary.subtitle ? (
                                    <span>{updateReportDocumentPayloadSummary.subtitle}</span>
                                ) : null}
                                {updateReportDocumentPayloadSummary.description ? (
                                    <span>{updateReportDocumentPayloadSummary.description}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentPayloadSummary.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">v{updateReportDocumentPayloadSummary.expectedVersion}</span>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentPayloadSummary.compileStatus}</span>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentPayloadSummary.blockCount} blocks</span>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentPayloadSummary.datasetCount} dataset</span>
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#486579", fontSize: 11 }}>
                                    <span>Current version</span>
                                    <input
                                        aria-label="Current version"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={updateReportDocumentCurrentVersionDraft}
                                        onChange={handleUpdateReportDocumentCurrentVersionDraftChange}
                                        style={{
                                            width: 72,
                                            minHeight: 28,
                                            padding: "4px 8px",
                                            borderRadius: 8,
                                            border: "1px solid #c8d6e5",
                                            background: "#ffffff",
                                            color: "#183247",
                                        }}
                                    />
                                </label>
                                <Button
                                    small
                                    minimal
                                    onClick={prepareUpdateReportDocumentConflictDiagnostic}
                                    disabled={!updateReportDocumentConflictVersionState.conflictReady}
                                >
                                    Prepare conflict diagnostic
                                </Button>
                                <Button small minimal onClick={() => setUpdateReportDocumentPayloadOpen((current) => !current)}>
                                    {updateReportDocumentPayloadOpen ? "Hide update payload" : "Inspect update payload"}
                                </Button>
                                <Button small minimal onClick={downloadUpdateReportDocumentPayload}>
                                    Download update payload
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {updateReportDocumentPayloadOpen && updateReportDocumentPayloadInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Update ReportDocument payload summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentPayloadInspector.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentPayloadInspector.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">v{updateReportDocumentPayloadInspector.expectedVersion}</span>
                            </div>
                            {updateReportDocumentPayloadInspector.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {updateReportDocumentPayloadInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {updateReportDocumentPayloadInspector.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#486579" }}>
                                    {updateReportDocumentPayloadInspector.headerDescription}
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
                                }}
                            >
                                {updateReportDocumentPayloadInspector.content}
                            </pre>
                        </div>
                    ) : null}
                    {updateReportDocumentPayloadSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--info">
                            <span>{updateReportDocumentConflictVersionState.helperText}</span>
                        </div>
                    ) : null}
                    {updateReportDocumentConflictDiagnosticSummary ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning">
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span>
                                    <strong>Update conflict diagnostic:</strong> {updateReportDocumentConflictDiagnosticSummary.title}
                                </span>
                                {updateReportDocumentConflictDiagnosticSummary.subtitle ? (
                                    <span>{updateReportDocumentConflictDiagnosticSummary.subtitle}</span>
                                ) : null}
                                {updateReportDocumentConflictDiagnosticSummary.description ? (
                                    <span>{updateReportDocumentConflictDiagnosticSummary.description}</span>
                                ) : null}
                            </div>
                            <div className="forge-report-builder__result-header-actions">
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentConflictDiagnosticSummary.reportId}</span>
                                <span className="forge-report-builder__result-meta-chip">expected v{updateReportDocumentConflictDiagnosticSummary.expectedVersion}</span>
                                <span className="forge-report-builder__result-meta-chip">current v{updateReportDocumentConflictDiagnosticSummary.currentVersion}</span>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentConflictDiagnosticSummary.code}</span>
                                <Button small minimal onClick={() => setUpdateReportDocumentConflictDiagnosticOpen((current) => !current)}>
                                    {updateReportDocumentConflictDiagnosticOpen ? "Hide conflict diagnostic" : "Inspect conflict diagnostic"}
                                </Button>
                                <Button small minimal onClick={downloadUpdateReportDocumentConflictDiagnostic}>
                                    Download conflict diagnostic
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {updateReportDocumentConflictDiagnosticOpen && updateReportDocumentConflictDiagnosticInspector ? (
                        <div className="forge-report-builder__chart-inline-notice forge-report-builder__chart-inline-notice--warning" style={{ display: "block" }}>
                            <div className="forge-report-builder__result-meta" aria-label="Update conflict diagnostic summary" style={{ marginBottom: 10 }}>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentConflictDiagnosticInspector.kind}</span>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentConflictDiagnosticInspector.code}</span>
                                <span className="forge-report-builder__result-meta-chip">{updateReportDocumentConflictDiagnosticInspector.severity}</span>
                            </div>
                            {updateReportDocumentConflictDiagnosticInspector.headerSubtitle ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#5f3411" }}>
                                    {updateReportDocumentConflictDiagnosticInspector.headerSubtitle}
                                </div>
                            ) : null}
                            {updateReportDocumentConflictDiagnosticInspector.headerDescription ? (
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#5f3411" }}>
                                    {updateReportDocumentConflictDiagnosticInspector.headerDescription}
                                </div>
                            ) : null}
                            <pre
                                className="forge-report-builder__saved-artifact-json"
                                style={{
                                    margin: 0,
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    border: "1px solid #d7e2ee",
                                    background: "#fff9f5",
                                    color: "#5f3411",
                                    fontSize: 11,
                                    lineHeight: 1.5,
                                    whiteSpace: "pre-wrap",
                                    overflow: "auto",
                                    maxHeight: 320,
                                }}
                            >
                                {updateReportDocumentConflictDiagnosticInspector.content}
                            </pre>
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
                                icon={emptyResultState.icon}
                                eyebrow={emptyResultState.eyebrow}
                                title={emptyResultState.title}
                                description={emptyResultState.description}
                                actionLabel={emptyResultState.actionLabel}
                                onAction={
                                    emptyResultState.action === "retrySemanticValidation"
                                        ? retrySemanticValidation
                                        : (canRunReport && !hasCompletedCurrentRun ? runReport : undefined)
                                }
                            />
                        ) : null}
                        {resultVisibility.showChartResult ? (
                            <div className="forge-report-builder__chart-wrap">
                                <Chart
                                    key={chartRenderKey}
                                    container={chartContainer}
                                    context={builderContext}
                                    embedded
                                    onDatumSelect={showingChartView ? setSelectedBuilderChartSelection : null}
                                    onLegendItemSelect={showingChartView ? setSelectedBuilderChartSelection : null}
                                />
                            </div>
                        ) : null}
                        {resultVisibility.showTableResult ? (
                            <div className="forge-report-builder__table-wrap">
                                <table className="forge-report-builder__table">
                                    <thead>
                                        <tr>
                                            {runtimeTableColumns.map((column) => (
                                                <th key={column.key} style={{ textAlign: column.align || "left" }}>
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(computedCollection || []).map((row, index) => (
                                            <tr key={index}>
                                                {runtimeTableColumns.map((column) => {
                                                    const value = resolveReportBuilderCellValue(row, column);
                                                    return (
                                                        <td key={`${index}_${column.key}`} style={{ textAlign: column.align || "left" }}>
                                                            {renderDashboardTableCell(value, row, column, locale, builderContext)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                        {resultVisibility.showChartPlaceholder ? (
                            <ReportBuilderResultState
                                tone={chartPlaceholderState.tone}
                                icon={chartPlaceholderState.icon}
                                eyebrow={chartPlaceholderState.eyebrow}
                                title={chartPlaceholderState.title}
                                description={chartPlaceholderState.description}
                                actionLabel={chartPlaceholderState.actionLabel}
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
                    {renderRuntimePreview()}
                    {renderCompactBottomBar()}
                </main>
            </div>

            {!compactMode && !useFilterDrawer && !useFilterRail ? renderFiltersPanel() : null}
            {renderCompactSetupSheet()}
            {renderCompactChartSheet()}
            <ReportBuilderCalculatedFieldDialog
                isOpen={calculatedFieldDialogOpen}
                onClose={closeCalculatedFieldDialog}
                draft={calculatedFieldDraft}
                onDraftChange={setCalculatedFieldDraft}
                onApply={applyCalculatedFieldDraft}
                validation={calculatedFieldDraftValidation}
                availableFields={calculatedFieldReferenceOptions}
                isEditing={!!editingCalculatedFieldId}
            />
            <ReportBuilderTableCalculationDialog
                isOpen={tableCalculationDialogOpen}
                onClose={closeTableCalculationDialog}
                draft={tableCalculationDraft}
                onDraftChange={setTableCalculationDraft}
                onApply={applyTableCalculationDraft}
                validation={tableCalculationDraftValidation}
                fieldOptions={tableCalculationFieldOptions}
                isEditing={!!editingTableCalculationId}
            />
            <ReportBuilderDocumentBlockDialog
                isOpen={documentBlockDialogOpen}
                onClose={closeDocumentBlockDialog}
                draft={documentBlockDraft}
                onDraftChange={setDocumentBlockDraft}
                onApply={applyDocumentBlockDraft}
                validation={documentBlockDraftValidation}
                valueFieldOptions={authoredKpiValueFieldOptions}
                secondaryFieldOptions={authoredKpiSecondaryFieldOptions}
                tableColumnOptions={authoredTableColumnOptions}
                scopeParamOptions={authoredScopeParamOptions}
                isEditing={!!editingDocumentBlockId}
            />
            <ReportBuilderChartDialog
                isOpen={authoredChartBlockDialogOpen}
                onClose={closeAuthoredChartBlockDialog}
                draft={authoredChartBlockDraft?.chartSpec || null}
                onDraftChange={(nextDraft) => {
                    const nextTitle = String(nextDraft?.title || authoredChartBlockDraft?.title || "Chart").trim() || "Chart";
                    setAuthoredChartBlockDraft((current) => current ? ({
                        ...current,
                        title: nextTitle,
                        chartSpec: normalizeReportBuilderChartSpec({
                            ...(nextDraft || {}),
                            title: nextTitle,
                        }),
                    }) : current);
                }}
                onApply={applyAuthoredChartBlockDraft}
                supportedTypes={supportedChartTypes}
                dimensions={authoredChartDimensions}
                measures={authoredChartMeasures}
                validation={authoredChartBlockDraftValidation}
                sanitizeDraftPatch={sanitizeChartDraftPatch}
                renderChartError={chartErrorMessage}
            />
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
