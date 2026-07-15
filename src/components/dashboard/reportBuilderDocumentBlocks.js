import {
    resolveReportDocumentBuilderContext,
    buildReportDocumentBadgesBlock,
    buildReportDocumentChartBlock,
    buildReportDocumentCollectionBlock,
    buildReportDocumentCompositeBlock,
    buildReportDocumentFilterBarBlock,
    buildReportDocumentGeoMapBlock,
    buildReportDocumentKpiBlock,
    buildReportDocumentMarkdownBlock,
    buildReportDocumentRefinementBarBlock,
    buildReportDocumentSectionBlock,
    buildReportDocumentTabGroupBlock,
    buildReportDocumentStepperBlock,
    buildReportDocumentInfoPanelBlock,
    buildReportDocumentCalloutBlock,
    buildReportDocumentKanbanBlock,
    buildReportDocumentTimelineBlock,
    buildReportDocumentTableBlock,
    normalizeReportBuilderDocumentBlocks,
} from "../../reporting/reportDocumentModel.js";
import { resolveReportBuilderBlock } from "../../reporting/reportBuilderBlockModel.js";
import {
    buildReportLayoutItem,
    resolveNextReportLayoutSpan,
    resolveReportLayoutPreset,
    resolveReportLayoutSpan,
} from "../../reporting/reportLayoutModel.js";
import { normalizeReportTableCellVisual } from "../../reporting/tableVisualSpec.js";
import { resolveReportDatasetRefResolution } from "../../reporting/reportDatasetRefModel.js";
import { buildReportBuilderCalculatedFieldConfig } from "./reportBuilderCalculatedFieldAuthoring.js";
import { resolveReportBuilderDynamicFilterFamilies, resolveReportBuilderScopeParamFilters } from "./reportBuilderPredicates.js";
import { buildReportBuilderStaticDatasetOptions } from "./reportBuilderStaticDatasets.js";
import { normalizeReportBuilderPublishedDataSources } from "../../reporting/reportSpecModel.js";
import {
    buildReportBuilderChartFields,
    buildDefaultReportBuilderChartSpec,
    getComputedReportBuilderMeasures,
    getReportBuilderSupportedChartTypes,
    getSelectableReportBuilderMeasures,
    getTableCalculationReportBuilderMeasures,
    getVisibleReportBuilderDimensions,
    normalizeReportBuilderChartSpec,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";

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
            const value = normalizeString(option?.value ?? option?.id);
            if (!value || seen.has(value)) {
                return null;
            }
            seen.add(value);
            return {
                value,
                label: normalizeString(option?.label || value),
            };
        })
        .filter(Boolean);
}

function normalizeScopeParamOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const value = normalizeString(option?.value ?? option?.id);
            if (!value || seen.has(value)) {
                return null;
            }
            seen.add(value);
            return {
                value,
                label: normalizeString(option?.label || value),
                ...(normalizeString(option?.description) ? { description: normalizeString(option.description) } : {}),
                kind: normalizeString(option?.kind || "value") || "value",
                required: option?.required === true,
                ...(option?.multiple === true ? { multiple: true } : {}),
                ...(normalizeString(option?.presentation) ? { presentation: normalizeString(option.presentation) } : {}),
                ...(Array.isArray(option?.options) ? { options: cloneValue(option.options) } : {}),
                ...(normalizeString(option?.semanticRef) ? { semanticRef: normalizeString(option.semanticRef) } : {}),
                ...(normalizeString(option?.paramPath) ? { paramPath: normalizeString(option.paramPath) } : {}),
                ...(normalizeString(option?.startParamPath) ? { startParamPath: normalizeString(option.startParamPath) } : {}),
                ...(normalizeString(option?.endParamPath) ? { endParamPath: normalizeString(option.endParamPath) } : {}),
            };
        })
        .filter(Boolean);
}

function normalizeFilterBarGroupOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const value = normalizeString(option?.value ?? option?.id);
            if (!value || seen.has(value)) {
                return null;
            }
            seen.add(value);
            return {
                value,
                label: normalizeString(option?.label || value),
                kind: normalizeString(option?.kind || "group") || "group",
                ...(normalizeString(option?.description) ? { description: normalizeString(option.description) } : {}),
                required: option?.required === true,
            };
        })
        .filter(Boolean);
}

function deriveFilterBarParamIdsFromVisibleGroups(visibleGroups = [], filterBarGroupOptions = []) {
    const optionIndex = new Map(
        normalizeFilterBarGroupOptions(filterBarGroupOptions).map((option) => [option.value, option]),
    );
    return normalizeStringArray(visibleGroups).filter((groupId) => optionIndex.get(groupId)?.kind === "scopeParam");
}

function normalizeFilterBarBlockMode(value = "") {
    const normalized = normalizeString(value).toLowerCase();
    return ["baseline", "unified"].includes(normalized) ? normalized : "baseline";
}

function normalizeFilterBarBlockPlacement(value = "") {
    const normalized = normalizeString(value).toLowerCase();
    return ["inherit", "inline", "rail-left", "hidden"].includes(normalized) ? normalized : "inherit";
}

function normalizeCollectionBlockLayout(value = "") {
    return normalizeString(value).toLowerCase() === "list" ? "list" : "grid";
}

function normalizeCollectionBlockColumns(value = 0) {
    const normalized = Math.trunc(Number(value));
    return Number.isInteger(normalized) && normalized >= 1 && normalized <= 4 ? normalized : 2;
}

function normalizeCollectionBlockRowLimit(value = 0) {
    const normalized = Math.trunc(Number(value));
    return Number.isInteger(normalized) && normalized > 0 ? normalized : 6;
}

function normalizeStepperDraftSteps(steps = []) {
    return (Array.isArray(steps) ? steps : [])
        .map((step, index) => {
            if (!step || typeof step !== "object" || Array.isArray(step)) {
                return null;
            }
            const title = normalizeString(step?.title);
            const body = String(step?.body || "");
            const tone = normalizeString(step?.tone).toLowerCase();
            if (!title && !body.trim()) {
                return null;
            }
            return {
                id: normalizeString(step?.id || `step_${index + 1}`) || `step_${index + 1}`,
                title,
                body,
                tone,
            };
        })
        .filter(Boolean);
}

function normalizeKanbanDraftCards(cards = []) {
    return (Array.isArray(cards) ? cards : [])
        .map((card, index) => {
            if (!card || typeof card !== "object" || Array.isArray(card)) {
                return null;
            }
            const title = normalizeString(card?.title);
            const body = String(card?.body || "");
            const badge = normalizeString(card?.badge);
            const tone = normalizeString(card?.tone).toLowerCase();
            if (!title && !body.trim() && !badge) {
                return null;
            }
            return {
                id: normalizeString(card?.id || `card_${index + 1}`) || `card_${index + 1}`,
                title,
                body,
                badge,
                tone,
            };
        })
        .filter(Boolean);
}

function normalizeKanbanDraftColumns(columns = []) {
    return (Array.isArray(columns) ? columns : [])
        .map((column, index) => {
            if (!column || typeof column !== "object" || Array.isArray(column)) {
                return null;
            }
            const title = normalizeString(column?.title);
            const tone = normalizeString(column?.tone).toLowerCase();
            const cards = normalizeKanbanDraftCards(column?.cards);
            if (!title && cards.length === 0) {
                return null;
            }
            return {
                id: normalizeString(column?.id || `column_${index + 1}`) || `column_${index + 1}`,
                title,
                tone,
                cards,
            };
        })
        .filter(Boolean);
}

function normalizeTimelineDraftEvents(events = []) {
    return (Array.isArray(events) ? events : [])
        .map((event, index) => {
            if (!event || typeof event !== "object" || Array.isArray(event)) {
                return null;
            }
            const title = normalizeString(event?.title);
            const body = String(event?.body || "");
            const date = normalizeString(event?.date);
            const badge = normalizeString(event?.badge);
            const tone = normalizeString(event?.tone).toLowerCase();
            if (!title && !body.trim() && !date && !badge) {
                return null;
            }
            return {
                id: normalizeString(event?.id || `event_${index + 1}`) || `event_${index + 1}`,
                date,
                title,
                body,
                badge,
                tone,
            };
        })
        .filter(Boolean);
}

function resolveDatasetOptionValues(datasetOptions = []) {
    return (Array.isArray(datasetOptions) ? datasetOptions : [])
        .map((option) => normalizeString(option?.value ?? option?.id))
        .filter(Boolean);
}

function resolveDocumentBlockDatasetRefResolution(preferredDatasetRef = "", datasetOptions = []) {
    return resolveReportDatasetRefResolution({
        preferredDatasetRef,
        availableDatasetRefs: resolveDatasetOptionValues(datasetOptions),
        fallbackDatasetRef: "primary",
    });
}

function resolveDocumentBlockScopeParamOptions(datasetRef = "primary", datasetOptions = [], scopeParamOptions = [], {
    allowImplicitTopLevelFallback = false,
} = {}) {
    const normalizedDatasetRef = normalizeString(datasetRef || "primary") || "primary";
    const normalizedDatasetOption = (Array.isArray(datasetOptions) ? datasetOptions : [])
        .find((option) => normalizeString(option?.value ?? option?.id) === normalizedDatasetRef) || null;
    if (normalizedDatasetOption) {
        const datasetScopedOptions = normalizeScopeParamOptions(normalizedDatasetOption?.scopeParamOptions);
        if (datasetScopedOptions.length > 0) {
            return datasetScopedOptions;
        }
    }
    return normalizedDatasetRef === "primary" || allowImplicitTopLevelFallback
        ? normalizeScopeParamOptions(scopeParamOptions)
        : [];
}

function resolveDefaultDocumentBlockDatasetRef(preferredDatasetRef = "", datasetOptions = []) {
    return resolveDocumentBlockDatasetRefResolution(preferredDatasetRef, datasetOptions).datasetRef;
}

function normalizeTableColumnOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const key = normalizeString(option?.key ?? option?.value ?? option?.id);
            if (!key || seen.has(key)) {
                return null;
            }
            seen.add(key);
            const sourceKey = normalizeString(option?.sourceKey || key) || key;
            const displayKey = normalizeString(option?.displayKey || option?.displayPath || sourceKey) || sourceKey;
            return {
                key,
                sourceKey,
                displayKey,
                ...(option?.displayValueMap && typeof option.displayValueMap === "object" && !Array.isArray(option.displayValueMap)
                    ? { displayValueMap: cloneValue(option.displayValueMap) }
                    : {}),
                label: normalizeString(option?.label || key),
                kind: normalizeString(option?.kind),
                ...(option?.calculated === true ? { calculated: true } : {}),
                selected: option?.selected === true,
                ...(normalizeString(option?.format) ? { format: normalizeString(option.format) } : {}),
            };
        })
        .filter(Boolean);
}

function normalizeChartFieldOptions(options = []) {
    const seen = new Set();
    return (Array.isArray(options) ? options : [])
        .map((option) => {
            const key = normalizeString(option?.key ?? option?.value ?? option?.id);
            if (!key || seen.has(key)) {
                return null;
            }
            seen.add(key);
            return {
                key,
                aliases: Array.from(new Set(
                    (Array.isArray(option?.aliases) ? option.aliases : [option?.aliases])
                        .map((alias) => normalizeString(alias))
                        .filter((alias) => alias && alias !== key),
                )),
                label: normalizeString(option?.label || key),
                kind: normalizeString(option?.kind),
                ...(normalizeString(option?.format) ? { format: normalizeString(option.format) } : {}),
            };
        })
        .filter(Boolean);
}

function buildDatasetChartSpecSeed(datasetOption = null, title = "Chart", fallbackType = "bar") {
    const normalizedOption = datasetOption && typeof datasetOption === "object" && !Array.isArray(datasetOption)
        ? datasetOption
        : null;
    const chartFieldOptions = normalizeChartFieldOptions(normalizedOption?.chartFieldOptions);
    const xField = normalizeString(
        chartFieldOptions.find((option) => normalizeString(option?.kind) === "dimension")?.key,
    );
    const yField = normalizeString(
        chartFieldOptions.find((option) => normalizeString(option?.kind) === "measure")?.key,
    );
    if (!xField || !yField) {
        return null;
    }
    return normalizeReportBuilderChartSpec({
        title: normalizeString(title || "Chart") || "Chart",
        type: normalizeString(fallbackType || "bar") || "bar",
        xField,
        yFields: [yField],
    });
}

function normalizeGeoMetricFormat(value = "") {
    const normalized = normalizeString(value);
    if (normalized === "compactNumber") {
        return "compact";
    }
    return normalized;
}

export function buildReportBuilderDatasetOptions({
    currentSourceRef = "",
    configuredSources = [],
    configuredDatasets = [],
    staticDatasets = [],
    tableColumnOptions = [],
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    chartFieldOptions = [],
    scopeParamOptions = [],
    filterBarGroupOptions = [],
} = {}) {
    const normalizedCurrentSourceRef = normalizeString(currentSourceRef);
    const normalizedConfiguredSources = normalizeReportBuilderPublishedDataSources({
        datasets: Array.isArray(configuredDatasets) ? configuredDatasets : [],
        dataSources: Array.isArray(configuredSources) ? configuredSources : [],
    });
    const configuredPrimarySource = normalizedConfiguredSources
        .find((entry) => normalizeString(entry?.dataSourceRef) === normalizedCurrentSourceRef) || null;
    const configuredPublishedDatasetOptions = normalizedConfiguredSources
        .map((entry) => {
            const dataSourceRef = normalizeString(entry?.dataSourceRef || entry?.value || entry?.id);
            const value = normalizeString(entry?.id || dataSourceRef);
            if (!dataSourceRef || !value || dataSourceRef === normalizedCurrentSourceRef) {
                return null;
            }
            return {
                value,
                dataSourceRef,
                label: normalizeString(entry?.label || dataSourceRef),
                description: normalizeString(entry?.description),
                kindLabel: normalizeString(entry?.kindLabel || entry?.kind || "published") || "published",
                ...(entry?.request && typeof entry.request === "object" && !Array.isArray(entry.request)
                    ? { request: cloneValue(entry.request) }
                    : {}),
                ...(entry?.scope && typeof entry.scope === "object" && !Array.isArray(entry.scope)
                    ? { scope: cloneValue(entry.scope) }
                    : {}),
                ...(entry?.source && typeof entry.source === "object" && !Array.isArray(entry.source)
                    ? { source: cloneValue(entry.source) }
                    : {}),
                ...(entry?.resultContract && typeof entry.resultContract === "object" && !Array.isArray(entry.resultContract)
                    ? { resultContract: cloneValue(entry.resultContract) }
                    : {}),
                ...(entry?.capabilities && typeof entry.capabilities === "object" && !Array.isArray(entry.capabilities)
                    ? { capabilities: cloneValue(entry.capabilities) }
                    : {}),
                columnOptions: Array.isArray(entry?.columnOptions) ? entry.columnOptions : [],
                valueFieldOptions: Array.isArray(entry?.valueFieldOptions) ? entry.valueFieldOptions : [],
                secondaryFieldOptions: Array.isArray(entry?.secondaryFieldOptions) ? entry.secondaryFieldOptions : [],
                chartFieldOptions: Array.isArray(entry?.chartFieldOptions) ? entry.chartFieldOptions : [],
                scopeParamOptions: Array.isArray(entry?.scopeParamOptions) ? entry.scopeParamOptions : [],
                filterBarGroupOptions: Array.isArray(entry?.filterBarGroupOptions) ? entry.filterBarGroupOptions : [],
            };
        })
        .filter(Boolean);
    const primaryLabel = normalizeString(configuredPrimarySource?.label || normalizedCurrentSourceRef) || normalizedCurrentSourceRef || "Primary";
    return [{
        value: "primary",
        dataSourceRef: normalizedCurrentSourceRef,
        label: primaryLabel,
        description: normalizeString(configuredPrimarySource?.description),
        kindLabel: normalizeString(configuredPrimarySource?.kindLabel || configuredPrimarySource?.kind || "published") || "published",
        ...(configuredPrimarySource?.request && typeof configuredPrimarySource.request === "object" && !Array.isArray(configuredPrimarySource.request)
            ? { request: cloneValue(configuredPrimarySource.request) }
            : {}),
        ...(configuredPrimarySource?.scope && typeof configuredPrimarySource.scope === "object" && !Array.isArray(configuredPrimarySource.scope)
            ? { scope: cloneValue(configuredPrimarySource.scope) }
            : {}),
        ...(configuredPrimarySource?.source && typeof configuredPrimarySource.source === "object" && !Array.isArray(configuredPrimarySource.source)
            ? { source: cloneValue(configuredPrimarySource.source) }
            : {}),
        ...(configuredPrimarySource?.resultContract && typeof configuredPrimarySource.resultContract === "object" && !Array.isArray(configuredPrimarySource.resultContract)
            ? { resultContract: cloneValue(configuredPrimarySource.resultContract) }
            : {}),
        ...(configuredPrimarySource?.capabilities && typeof configuredPrimarySource.capabilities === "object" && !Array.isArray(configuredPrimarySource.capabilities)
            ? { capabilities: cloneValue(configuredPrimarySource.capabilities) }
            : {}),
        columnOptions: Array.isArray(tableColumnOptions) ? tableColumnOptions : [],
        valueFieldOptions: Array.isArray(valueFieldOptions) ? valueFieldOptions : [],
        secondaryFieldOptions: Array.isArray(secondaryFieldOptions) ? secondaryFieldOptions : [],
        chartFieldOptions: Array.isArray(chartFieldOptions) ? chartFieldOptions : [],
        scopeParamOptions: Array.isArray(configuredPrimarySource?.scopeParamOptions) && configuredPrimarySource.scopeParamOptions.length > 0
            ? configuredPrimarySource.scopeParamOptions
            : (Array.isArray(scopeParamOptions) ? scopeParamOptions : []),
        filterBarGroupOptions: Array.isArray(filterBarGroupOptions) ? filterBarGroupOptions : [],
    }, ...configuredPublishedDatasetOptions, ...buildReportBuilderStaticDatasetOptions(staticDatasets)];
}

function normalizeColumnVisualKinds(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return Object.entries(value).reduce((acc, [key, visualKind]) => {
        const normalizedKey = normalizeString(key);
        const normalizedKind = normalizeString(visualKind);
        if (!normalizedKey || !normalizedKind) {
            return acc;
        }
        acc[normalizedKey] = normalizedKind;
        return acc;
    }, {});
}

function buildTableColumnVisualDraft(column = {}) {
    const cellVisual = column?.cellVisual && typeof column.cellVisual === "object" && !Array.isArray(column.cellVisual)
        ? column.cellVisual
        : null;
    return normalizeString(cellVisual?.kind);
}

function normalizeColumnVisualRuleTexts(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return Object.entries(value).reduce((acc, [key, rulesText]) => {
        const normalizedKey = normalizeString(key);
        const normalizedText = String(rulesText || "");
        if (!normalizedKey || !normalizedText.trim()) {
            return acc;
        }
        acc[normalizedKey] = normalizedText;
        return acc;
    }, {});
}

function buildVisualRulesText(kind = "", column = {}) {
    const normalizedKind = normalizeString(kind);
    if (normalizedKind === "shareBar") {
        const normalized = normalizeReportTableCellVisual({
            kind: normalizedKind,
            segments: Array.isArray(column?.cellVisual?.segments) ? column.cellVisual.segments : [],
        });
        return Array.isArray(normalized?.segments) && normalized.segments.length > 0
            ? JSON.stringify(normalized.segments, null, 2)
            : "";
    }
    const normalized = normalizeReportTableCellVisual({
        kind: normalizedKind,
        rules: Array.isArray(column?.cellVisual?.rules) ? column.cellVisual.rules : [],
    });
    return Array.isArray(normalized?.rules) && normalized.rules.length > 0
        ? JSON.stringify(normalized.rules, null, 2)
        : "";
}

function parseVisualRulesText(kind = "", rulesText = "") {
    const normalizedKind = normalizeString(kind);
    const visualLabel = normalizedKind
        ? `${normalizedKind.slice(0, 1).toUpperCase()}${normalizedKind.slice(1)}`
        : "Visual";
    const normalizedText = String(rulesText || "").trim();
    if (!normalizedText) {
        return {
            valid: false,
            rules: [],
            segments: [],
            error: `Define at least one ${normalizedKind || "visual"} ${normalizedKind === "shareBar" ? "segment" : "rule"} for the selected column.`,
        };
    }
    let parsed = null;
    try {
        parsed = JSON.parse(normalizedText);
    } catch (_) {
        return {
            valid: false,
            rules: [],
            segments: [],
            error: `${visualLabel} ${normalizedKind === "shareBar" ? "segments" : "rules"} must be valid JSON.`,
        };
    }
    const normalized = normalizedKind === "shareBar"
        ? normalizeReportTableCellVisual({
            kind: normalizedKind,
            segments: parsed,
        })
        : normalizeReportTableCellVisual({
            kind: normalizedKind,
            rules: parsed,
        });
    const validItems = normalizedKind === "shareBar" ? normalized?.segments : normalized?.rules;
    if (!Array.isArray(validItems) || validItems.length === 0) {
        return {
            valid: false,
            rules: [],
            segments: [],
            error: `${visualLabel} ${normalizedKind === "shareBar" ? "segments" : "rules"} must be a non-empty JSON array of objects.`,
        };
    }
    if (normalizedKind !== "shareBar" && normalized.rules.some((rule) => !Object.prototype.hasOwnProperty.call(rule, "value"))) {
        return {
            valid: false,
            rules: [],
            segments: [],
            error: `Each ${normalizedKind || "visual"} rule must define a value.`,
        };
    }
    return {
        valid: true,
        rules: Array.isArray(normalized?.rules) ? normalized.rules : [],
        segments: Array.isArray(normalized?.segments) ? normalized.segments : [],
        error: "",
    };
}

function resolveDocumentPrimaryIndex(items = [], authoredIds = new Set()) {
    let authoredBeforePrimary = 0;
    for (const item of (Array.isArray(items) ? items : [])) {
        const blockId = normalizeString(item?.blockId || item);
        if (!blockId) {
            continue;
        }
        if (blockId === "primaryBuilder") {
            return authoredBeforePrimary;
        }
        if (authoredIds.has(blockId)) {
            authoredBeforePrimary += 1;
        }
    }
    return authoredBeforePrimary;
}

function stripMarkdownPreviewDecorators(value = "") {
    const source = String(value || "").trim();
    if (/^(`{3,}|-{3,}|_{3,})$/.test(source)) {
        return "";
    }
    return source
        .replace(/^#{1,6}\s+/, "")
        .replace(/^>\s+/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .trim();
}

export function summarizeReportBuilderDocumentMarkdown(markdown = "") {
    const lines = String(markdown || "")
        .split(/\n+/)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
    if (lines.length === 0) {
        return "Narrative block";
    }
    let insideFence = false;
    for (const line of lines) {
        if (/^`{3,}/.test(line)) {
            insideFence = !insideFence;
            continue;
        }
        if (insideFence) {
            continue;
        }
        const cleaned = stripMarkdownPreviewDecorators(line);
        if (!cleaned) {
            continue;
        }
        if (!/^#{1,6}\s+/.test(line)) {
            return cleaned;
        }
    }
    return stripMarkdownPreviewDecorators(lines[0]) || "Narrative block";
}

export function resolveReportBuilderDocumentWidthLabels(layoutItem = null) {
    const span = resolveReportLayoutSpan(layoutItem);
    const currentPreset = resolveReportLayoutPreset(span);
    const nextSpan = resolveNextReportLayoutSpan(span);
    const nextPreset = resolveReportLayoutPreset(nextSpan);
    return {
        span,
        nextSpan,
        isHalfWidth: span === 6,
        currentLabel: `Width: ${currentPreset.label}`,
        actionLabel: `Make ${nextPreset.label}`,
        actionTitle: `Resize block to ${nextPreset.label} width`,
        actionIcon: nextSpan < span ? "minimize" : "maximize",
    };
}

function buildDocumentLayoutItem(blockId = "", source = null) {
    return buildReportLayoutItem(blockId, source, {
        preserveLegacyHalf: true,
    });
}

function buildDocumentLayoutItemIndex(items = []) {
    const index = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
        const normalizedItem = buildDocumentLayoutItem(item?.blockId || item, item);
        if (!normalizedItem) {
            return;
        }
        index.set(normalizedItem.blockId, normalizedItem);
    });
    return index;
}

function buildLayoutItemsFromAuthoredOrder(authoredIds = [], primaryIndex = 0, layoutItemIndex = new Map()) {
    const boundedPrimaryIndex = Math.max(0, Math.min(
        Array.isArray(authoredIds) ? authoredIds.length : 0,
        Number(primaryIndex || 0) || 0,
    ));
    const resolveLayoutItem = (blockId = "") => {
        const normalizedBlockId = normalizeString(blockId);
        const indexedItem = layoutItemIndex instanceof Map ? layoutItemIndex.get(normalizedBlockId) : null;
        return buildDocumentLayoutItem(normalizedBlockId, indexedItem || {});
    };
    return [
        ...(Array.isArray(authoredIds) ? authoredIds : [])
            .slice(0, boundedPrimaryIndex)
            .map((blockId) => resolveLayoutItem(blockId)),
        resolveLayoutItem("primaryBuilder"),
        ...(Array.isArray(authoredIds) ? authoredIds : [])
            .slice(boundedPrimaryIndex)
            .map((blockId) => resolveLayoutItem(blockId)),
    ].filter(Boolean);
}

function resolveUniqueDocumentBlockId(existingBlocks = [], baseId = "documentBlock") {
    const normalizedBaseId = normalizeString(baseId) || "documentBlock";
    const existingIds = new Set(
        normalizeReportBuilderDocumentBlocks(existingBlocks)
            .map((block) => normalizeString(block?.id))
            .filter(Boolean),
    );
    if (!existingIds.has(normalizedBaseId)) {
        return normalizedBaseId;
    }
    let suffix = 2;
    while (existingIds.has(`${normalizedBaseId}${suffix}`)) {
        suffix += 1;
    }
    return `${normalizedBaseId}${suffix}`;
}

function resolveUniqueDocumentBlockTitle(existingBlocks = [], baseTitle = "Authored block") {
    const normalizedBaseTitle = normalizeString(baseTitle) || "Authored block";
    const existingTitles = new Set(
        normalizeReportBuilderDocumentBlocks(existingBlocks)
            .map((block) => normalizeString(block?.title))
            .filter(Boolean),
    );
    if (!existingTitles.has(normalizedBaseTitle)) {
        return normalizedBaseTitle;
    }
    let suffix = 2;
    while (existingTitles.has(`${normalizedBaseTitle} ${suffix}`)) {
        suffix += 1;
    }
    return `${normalizedBaseTitle} ${suffix}`;
}

function resolveOptionLabel(options = [], value = "") {
  const normalizedValue = normalizeString(value);
  return normalizeFieldOptions(options).find((option) => option.value === normalizedValue)?.label || normalizedValue;
}

function normalizeBadgeTone(value = "") {
    const normalized = normalizeString(value).toLowerCase();
    return ["neutral", "info", "success", "warning", "danger"].includes(normalized)
        ? normalized
        : "info";
}

function normalizeBadgeLabelMode(value = "", { hasExplicitLabel = false } = {}) {
    const normalized = normalizeString(value).toLowerCase();
    if (normalized === "manual" || normalized === "field") {
        return normalized;
    }
    return hasExplicitLabel ? "manual" : "field";
}

function normalizeReportBuilderBadgeRules(rules = []) {
    return (Array.isArray(rules) ? rules : [])
        .map((rule) => {
            if (!rule || typeof rule !== "object" || Array.isArray(rule) || !Object.prototype.hasOwnProperty.call(rule, "value")) {
                return null;
            }
            return {
                value: cloneValue(rule.value),
                ...(normalizeString(rule?.label) ? { label: normalizeString(rule.label) } : {}),
                ...(normalizeString(rule?.tone) ? { tone: normalizeBadgeTone(rule.tone) } : {}),
            };
        })
        .filter(Boolean);
}

export function serializeReportBuilderBadgeRuleRows(rows = []) {
    const normalizedRules = normalizeReportBuilderBadgeRules(rows);
    return normalizedRules.length > 0 ? JSON.stringify(normalizedRules, null, 2) : "";
}

export function parseReportBuilderBadgeRuleRows(rulesText = "") {
    const normalizedText = String(rulesText || "").trim();
    if (!normalizedText) {
        return {
            valid: true,
            rules: [],
            error: "",
        };
    }
    let parsed = null;
    try {
        parsed = JSON.parse(normalizedText);
    } catch (_) {
        return {
            valid: false,
            rules: [],
            error: "Pill rules must be valid JSON.",
        };
    }
    const rules = normalizeReportBuilderBadgeRules(parsed);
    if (rules.length === 0) {
        return {
            valid: false,
            rules: [],
            error: "Pill rules must be a non-empty JSON array of objects with a value.",
        };
    }
    return {
        valid: true,
        rules,
        error: "",
    };
}

export function resolveReportBuilderBadgeRuleRows(item = {}) {
    const explicitRules = normalizeReportBuilderBadgeRules(item?.rules);
    if (explicitRules.length > 0) {
        return explicitRules;
    }
    const parsed = parseReportBuilderBadgeRuleRows(item?.rulesText || "");
    return parsed.valid ? parsed.rules : [];
}

export function normalizeReportBuilderBadgeItems(items = []) {
    return (Array.isArray(items) ? items : [])
        .map((item, index) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
                return null;
            }
            const label = normalizeString(item?.label);
            const value = normalizeString(item?.value);
            const valueField = normalizeString(item?.valueField);
            const format = normalizeString(item?.format);
            const labelMode = normalizeBadgeLabelMode(item?.labelMode, {
                hasExplicitLabel: !!label,
            });
            const rulesText = String(item?.rulesText || "").trim();
            const normalizedRules = normalizeReportBuilderBadgeRules(item?.rules);
            const parsedRules = !normalizedRules.length && rulesText
                ? parseReportBuilderBadgeRuleRows(rulesText)
                : { valid: true, rules: [] };
            if (!label && !value && !valueField) {
                return null;
            }
            return {
                id: normalizeString(item?.id || `badge_${index + 1}`) || `badge_${index + 1}`,
                label,
                value,
                ...(valueField ? { valueField } : {}),
                ...(format ? { format } : {}),
                labelMode,
                ...(normalizedRules.length > 0 ? { rules: normalizedRules } : {}),
                ...(normalizedRules.length === 0 && parsedRules.valid && parsedRules.rules.length > 0 ? { rules: parsedRules.rules } : {}),
                ...(rulesText ? { rulesText } : {}),
                tone: normalizeBadgeTone(item?.tone || item?.severity),
            };
        })
        .filter(Boolean);
}

function buildBadgeRulesText(item = {}) {
    return serializeReportBuilderBadgeRuleRows(item?.rules);
}

function labelForBadgeItem(item = {}, index = 0) {
    return normalizeString(item?.label || item?.valueField || item?.id || `Pill ${index + 1}`) || `Pill ${index + 1}`;
}

function formatDocumentBlockTitle(block = {}) {
    return normalizeString(block?.title || block?.id || "Authored block") || "Authored block";
}

function formatChartBlockValidationMessage(error = {}, chartFieldOptions = []) {
    const fieldPath = normalizeString(error?.field);
    const code = normalizeString(error?.code);
    const chartFieldIndex = new Map(
        normalizeChartFieldOptions(chartFieldOptions)
            .map((entry) => [entry.key, entry]),
    );
    const chartSpec = normalizeReportBuilderChartSpec(error?.chartSpec || {});
    const labelForKey = (key = "") => chartFieldIndex.get(normalizeString(key))?.label || normalizeString(key);
    if (fieldPath === "xField") {
        if (code === "wrongKind") {
            return "The chart X-axis must use an available breakdown.";
        }
        return "The chart X-axis field is not available in the current builder.";
    }
    if (fieldPath.startsWith("yFields")) {
        const indexMatch = /\.([0-9]+)$/.exec(fieldPath);
        const fieldKey = indexMatch
            ? (Array.isArray(chartSpec?.yFields) ? chartSpec.yFields[Number(indexMatch[1])] : "")
            : "";
        if (code === "wrongKind") {
            return `${labelForKey(fieldKey)} must be an available measure.`;
        }
        if (code === "empty") {
            return "Select at least one measure for the chart block.";
        }
        return `${labelForKey(fieldKey) || "One chart measure"} is not available in the current builder.`;
    }
    if (fieldPath === "seriesField") {
        if (code === "wrongKind") {
            return "The chart series field must use an available breakdown.";
        }
        if (code === "tooManyMeasures") {
            return "Series grouping is only available when the authored chart uses a single measure.";
        }
        if (code === "duplicateField") {
            return "The chart series field cannot match the X-axis field.";
        }
        return "The chart series field is not available in the current builder.";
    }
    if (fieldPath === "type") {
        return "This chart type is not supported for the current builder.";
    }
    if (fieldPath.startsWith("seriesOptions")) {
        return "One or more per-measure chart options are no longer compatible with the current authored chart.";
    }
    return "Chart settings are incomplete.";
}

function formatChartBlockDiagnosticPath(blockId = "", error = {}) {
    const fieldPath = normalizeString(error?.field);
    if (!fieldPath) {
        return `reportDocument.blocks.${blockId}.chartSpec`;
    }
    if (fieldPath.startsWith("yFields.")) {
        const indexMatch = /\.([0-9]+)$/.exec(fieldPath);
        if (indexMatch) {
            return `reportDocument.blocks.${blockId}.chartSpec.yFields[${indexMatch[1]}]`;
        }
    }
    if (fieldPath.startsWith("seriesOptions.")) {
        return `reportDocument.blocks.${blockId}.chartSpec.${fieldPath}`;
    }
    return `reportDocument.blocks.${blockId}.chartSpec.${fieldPath}`;
}

function normalizeStringArray(values = []) {
    return (Array.isArray(values) ? values : [])
        .map((value) => normalizeString(value))
        .filter(Boolean);
}

export function buildReportBuilderScopeParamSummary(paramIds = [], scopeParamOptions = []) {
    const normalizedScopeParamOptions = normalizeScopeParamOptions(scopeParamOptions);
    const scopeParamIndex = new Map(
        normalizedScopeParamOptions
            .map((option) => [normalizeString(option?.value), option])
            .filter(([value]) => !!value),
    );
    const items = normalizeStringArray(paramIds).map((paramId) => {
        const option = scopeParamIndex.get(paramId);
        const label = normalizeString(option?.label || paramId);
        if (!label) {
            return null;
        }
        const description = normalizeString(option?.description);
        return {
            id: paramId,
            label,
            ...(description ? { description } : {}),
        };
    }).filter(Boolean);
    return {
        items,
        text: items.length > 0
            ? items.map((item) => item.label).join(" • ")
            : "No report filters",
    };
}

export function buildReportBuilderScopeSummaryFromParams(scopeParams = []) {
    return buildReportBuilderScopeParamSummary(
        (Array.isArray(scopeParams) ? scopeParams : [])
            .map((param) => normalizeString(param?.id))
            .filter(Boolean),
        (Array.isArray(scopeParams) ? scopeParams : []).map((param) => ({
            value: normalizeString(param?.id),
            label: normalizeString(param?.label || param?.id),
            description: normalizeString(param?.description),
        })),
    );
}

function orderAuthoringFieldsBySelection(fields = [], selectedIds = new Set()) {
    const selected = [];
    const remaining = [];
    (Array.isArray(fields) ? fields : []).forEach((field) => {
        const fieldId = normalizeString(field?.id);
        if (!fieldId) {
            return;
        }
        if (selectedIds.has(fieldId)) {
            selected.push(field);
            return;
        }
        remaining.push(field);
    });
    return [...selected, ...remaining];
}

function buildAvailableAuthoringDimensions(config = {}, state = {}) {
    const selectedDimensionIds = new Set(normalizeStringArray(state?.selectedDimensions));
    return orderAuthoringFieldsBySelection(
        getVisibleReportBuilderDimensions(config)
            .map((dimension) => ({
                id: normalizeString(dimension?.id),
                key: normalizeString(dimension?.id),
                sourceKey: normalizeString(dimension?.key || dimension?.id),
                displayKey: normalizeString(dimension?.displayKey || dimension?.displayPath || dimension?.key || dimension?.id),
                ...(dimension?.displayValueMap && typeof dimension.displayValueMap === "object" && !Array.isArray(dimension.displayValueMap)
                    ? { displayValueMap: cloneValue(dimension.displayValueMap) }
                    : {}),
                rawId: normalizeString(dimension?.rawId || (normalizeString(dimension?.semanticRef) ? (dimension?.key || dimension?.id) : "")),
                label: normalizeString(dimension?.label || dimension?.id),
                kind: "dimension",
                selected: selectedDimensionIds.has(normalizeString(dimension?.id)),
                ...(normalizeString(dimension?.format) ? { format: normalizeString(dimension.format) } : {}),
                ...(normalizeString(dimension?.description) ? { description: normalizeString(dimension.description) } : {}),
                ...(normalizeString(dimension?.category) ? { category: normalizeString(dimension.category) } : {}),
                ...(normalizeString(dimension?.definitionRef) ? { definitionRef: normalizeString(dimension.definitionRef) } : {}),
                ...(normalizeString(dimension?.semanticRef) ? { semanticRef: normalizeString(dimension.semanticRef) } : {}),
                ...(dimension?.governance && typeof dimension.governance === "object" && !Array.isArray(dimension.governance)
                    ? { governance: cloneValue(dimension.governance) }
                    : {}),
            }))
            .filter((dimension) => dimension.id),
        selectedDimensionIds,
    );
}

function buildAvailableAuthoringMeasures(config = {}, state = {}) {
    const selectedMeasureIds = new Set(normalizeStringArray(state?.selectedMeasures));
    const calculatedMeasureIds = new Set(
        [
            ...getComputedReportBuilderMeasures(config),
            ...getTableCalculationReportBuilderMeasures(config),
        ]
            .map((entry) => normalizeString(entry?.id))
            .filter(Boolean),
    );
    return orderAuthoringFieldsBySelection(
        getSelectableReportBuilderMeasures(config)
            .map((measure) => ({
                id: normalizeString(measure?.id),
                key: normalizeString(measure?.id),
                sourceKey: normalizeString(measure?.key || measure?.id),
                displayKey: normalizeString(measure?.displayKey || measure?.displayPath || measure?.key || measure?.id),
                ...(measure?.displayValueMap && typeof measure.displayValueMap === "object" && !Array.isArray(measure.displayValueMap)
                    ? { displayValueMap: cloneValue(measure.displayValueMap) }
                    : {}),
                rawId: normalizeString(measure?.rawId || (normalizeString(measure?.semanticRef) ? (measure?.key || measure?.id) : "")),
                label: normalizeString(measure?.label || measure?.id),
                kind: "measure",
                ...(calculatedMeasureIds.has(normalizeString(measure?.id)) ? { calculated: true } : {}),
                selected: selectedMeasureIds.has(normalizeString(measure?.id)),
                ...(normalizeString(measure?.format) ? { format: normalizeString(measure.format) } : {}),
                ...(normalizeString(measure?.description) ? { description: normalizeString(measure.description) } : {}),
                ...(normalizeString(measure?.category) ? { category: normalizeString(measure.category) } : {}),
                ...(normalizeString(measure?.definitionRef) ? { definitionRef: normalizeString(measure.definitionRef) } : {}),
                ...(normalizeString(measure?.semanticRef) ? { semanticRef: normalizeString(measure.semanticRef) } : {}),
                ...(measure?.governance && typeof measure.governance === "object" && !Array.isArray(measure.governance)
                    ? { governance: cloneValue(measure.governance) }
                    : {}),
            }))
            .filter((measure) => measure.id),
        selectedMeasureIds,
    );
}

function buildAuthoringChartState(config = {}, state = {}) {
    const availableDimensions = buildAvailableAuthoringDimensions(config, state);
    const availableMeasures = buildAvailableAuthoringMeasures(config, state);
    const nextState = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    nextState.selectedDimensions = availableDimensions.map((dimension) => dimension.id);
    nextState.selectedMeasures = availableMeasures.map((measure) => measure.id);
    nextState.primaryMeasure = normalizeString(nextState?.primaryMeasure || availableMeasures[0]?.id);
    return nextState;
}

export function normalizeReportBuilderDocumentLayoutState(layout = null, blocks = []) {
    const normalizedBlocks = normalizeReportBuilderDocumentBlocks(blocks);
    if (normalizedBlocks.length === 0) {
        return null;
    }
    const authoredIds = normalizedBlocks
        .map((block) => normalizeString(block?.id))
        .filter(Boolean);
    const authoredIdSet = new Set(authoredIds);
    const items = Array.isArray(layout)
        ? layout
        : (Array.isArray(layout?.items) ? layout.items : []);
    const orderedAuthoredIds = [];
    const seen = new Set();
    items.forEach((item) => {
        const blockId = normalizeString(item?.blockId || item);
        if (!blockId || blockId === "primaryBuilder" || seen.has(blockId) || !authoredIdSet.has(blockId)) {
            return;
        }
        seen.add(blockId);
        orderedAuthoredIds.push(blockId);
    });
    authoredIds.forEach((blockId) => {
        if (seen.has(blockId)) {
            return;
        }
        seen.add(blockId);
        orderedAuthoredIds.push(blockId);
    });
    const primaryIndex = resolveDocumentPrimaryIndex(items, authoredIdSet);
    const layoutItemIndex = buildDocumentLayoutItemIndex(items);
    return {
        type: normalizeString(layout?.type || "stack") || "stack",
        items: buildLayoutItemsFromAuthoredOrder(orderedAuthoredIds, primaryIndex, layoutItemIndex),
    };
}

export function resolveReportBuilderDocumentBlockList(state = {}) {
    const blocks = normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks);
    if (blocks.length === 0) {
        return [];
    }
    const normalizedLayout = normalizeReportBuilderDocumentLayoutState(
        state?.reportDocumentLayout,
        blocks,
    );
    const blockIndex = new Map(
        blocks.map((block) => [normalizeString(block?.id), block]).filter(([id]) => !!id),
    );
    return (Array.isArray(normalizedLayout?.items) ? normalizedLayout.items : [])
        .map((item) => normalizeString(item?.blockId))
        .filter((blockId) => blockId && blockId !== "primaryBuilder")
        .map((blockId) => cloneValue(blockIndex.get(blockId)))
        .filter(Boolean);
}

export function buildReportBuilderDocumentBlockDraft(kind = "markdownBlock", seed = null, {
    existingBlocks = [],
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    tableColumnOptions = [],
    childBlockOptions = [],
    scopeParamOptions = [],
    filterBarGroupOptions = [],
    datasetOptions = [],
    chartConfig = null,
    chartState = null,
} = {}) {
    const normalizedKind = normalizeString(seed?.kind || kind || "markdownBlock") || "markdownBlock";
    const normalizedDatasetOptions = (Array.isArray(datasetOptions) ? datasetOptions : [])
        .map((option) => ({
            value: normalizeString(option?.value ?? option?.id),
            scopeParamOptions: normalizeScopeParamOptions(option?.scopeParamOptions),
        }))
        .filter((option) => !!option.value);
    if (normalizedKind === "filterBarBlock") {
        const normalizedDatasetRef = resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions);
        const normalizedScopeParamOptions = resolveDocumentBlockScopeParamOptions(
            normalizedDatasetRef,
            normalizedDatasetOptions,
            scopeParamOptions,
        );
        const normalizedMode = normalizeFilterBarBlockMode(seed?.mode || "");
        const normalizedPlacement = normalizeFilterBarBlockPlacement(seed?.placement || "");
        const primaryGroupFallback = normalizedScopeParamOptions.map((option) => ({
            ...option,
            kind: "scopeParam",
        }));
        const scopedGroupOptions = normalizeFilterBarGroupOptions(
            normalizedDatasetRef === "primary"
                ? ((Array.isArray(filterBarGroupOptions) && filterBarGroupOptions.length > 0) ? filterBarGroupOptions : primaryGroupFallback)
                : primaryGroupFallback,
        );
        const defaultVisibleGroups = scopedGroupOptions.map((option) => option.value);
        const legacyParamIds = normalizeStringArray(seed?.paramIds);
        const visibleGroups = normalizeStringArray(
            Array.isArray(seed?.visibleGroups) && seed.visibleGroups.length > 0
                ? seed.visibleGroups
                : legacyParamIds.length > 0
                    ? legacyParamIds
                    : defaultVisibleGroups,
        ).filter((groupId) => scopedGroupOptions.some((option) => option.value === groupId));
        const groupOrder = normalizeStringArray(
            Array.isArray(seed?.groupOrder) && seed.groupOrder.length > 0
                ? seed.groupOrder
                : visibleGroups,
        ).filter((groupId) => visibleGroups.includes(groupId));
        const collapsedGroups = normalizeStringArray(seed?.collapsedGroups).filter((groupId) => visibleGroups.includes(groupId));
        const paramIds = deriveFilterBarParamIdsFromVisibleGroups(visibleGroups, scopedGroupOptions);
        return {
            kind: "filterBarBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "filterBar")),
            title: normalizeString(seed?.title || "Filters") || "Filters",
            datasetRef: normalizedDatasetRef,
            paramIds,
            mode: normalizedMode === "baseline" ? "baseline" : "unified",
            placement: normalizedPlacement || "inherit",
            visibleGroups,
            groupOrder,
            collapsedGroups,
        };
    }
    if (normalizedKind === "refinementBarBlock") {
        return {
            kind: "refinementBarBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "refinementTrail")),
            title: normalizeString(seed?.title || "Active Refinements") || "Active Refinements",
            actionKinds: Array.isArray(seed?.actionKinds)
                ? seed.actionKinds.map((entry) => normalizeString(entry)).filter(Boolean)
                : ["remove", "clearAll"],
            emptyLabel: normalizeString(seed?.emptyLabel || "No active refinements") || "No active refinements",
        };
    }
    if (normalizedKind === "chartBlock") {
        const normalizedDatasetRef = resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions);
        const datasetOption = (Array.isArray(datasetOptions) ? datasetOptions : [])
            .find((option) => normalizeString(option?.value ?? option?.id) === normalizedDatasetRef) || null;
        const seededChartSpec = normalizeReportBuilderChartSpec(seed?.chartSpec || {});
        const hasExplicitSeededChartFields = !!normalizeString(seed?.chartSpec?.xField)
            || normalizeStringArray(seed?.chartSpec?.yFields || seed?.chartSpec?.yField).length > 0
            || !!normalizeString(seed?.chartSpec?.seriesField);
        const title = normalizeString(seed?.title || seededChartSpec?.title || "Chart") || "Chart";
        const datasetChartSpec = !hasExplicitSeededChartFields && normalizedDatasetRef !== "primary"
            ? buildDatasetChartSpecSeed(datasetOption, title, "bar")
            : null;
        const chartSpec = datasetChartSpec || buildDefaultReportBuilderChartSpec(
            chartConfig && typeof chartConfig === "object" && !Array.isArray(chartConfig) ? chartConfig : {},
            chartState && typeof chartState === "object" && !Array.isArray(chartState) ? chartState : {},
            seededChartSpec || {},
            { suggestSeriesField: true },
        ) || seededChartSpec || null;
        return {
            kind: "chartBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "chartBlock")),
            title,
            datasetRef: normalizedDatasetRef,
            chartSpec: chartSpec
                ? normalizeReportBuilderChartSpec({
                    ...chartSpec,
                    title,
                })
                : null,
        };
    }
    if (normalizedKind === "geoMapBlock") {
        const normalizedColumnOptions = normalizeTableColumnOptions(tableColumnOptions);
        const dimensionOptions = normalizedColumnOptions.filter((option) => normalizeString(option?.kind) === "dimension");
        const measureOptions = normalizedColumnOptions.filter((option) => normalizeString(option?.kind) === "measure");
        const geo = seed?.geo && typeof seed.geo === "object" && !Array.isArray(seed.geo)
            ? seed.geo
            : {};
        const metric = geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)
            ? geo.metric
            : {};
        const key = normalizeString(geo?.key || dimensionOptions[0]?.key);
        const labelKey = normalizeString(geo?.labelKey || "");
        const metricKey = normalizeString(metric?.key || measureOptions[0]?.key);
        const metricLabel = normalizeString(
            metric?.label
            || measureOptions.find((option) => option.key === metricKey)?.label
            || metricKey
            || "Metric",
        );
        const metricFormat = normalizeGeoMetricFormat(
            metric?.format
            || measureOptions.find((option) => option.key === metricKey)?.format
            || "",
        );
        return {
            kind: "geoMapBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "geoMapBlock")),
            title: normalizeString(seed?.title || "Geo Map") || "Geo Map",
            datasetRef: resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions),
            geo: {
                shape: normalizeString(geo?.shape || "us-states") || "us-states",
                key,
                ...(labelKey ? { labelKey } : {}),
                metric: {
                    key: metricKey,
                    label: metricLabel,
                    ...(metricFormat ? { format: metricFormat } : {}),
                },
                aggregate: normalizeString(geo?.aggregate || "sum") || "sum",
            },
        };
    }
    if (normalizedKind === "kpiBlock") {
        const normalizedDatasetRef = resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions);
        const datasetOption = (Array.isArray(datasetOptions) ? datasetOptions : [])
            .find((option) => normalizeString(option?.value ?? option?.id) === normalizedDatasetRef) || null;
        const normalizedValueOptions = Array.isArray(datasetOption?.valueFieldOptions) && datasetOption.valueFieldOptions.length > 0
            ? normalizeFieldOptions(datasetOption.valueFieldOptions)
            : normalizeFieldOptions(valueFieldOptions);
        const normalizedSecondaryOptions = Array.isArray(datasetOption?.secondaryFieldOptions) && datasetOption.secondaryFieldOptions.length > 0
            ? normalizeFieldOptions(datasetOption.secondaryFieldOptions)
            : normalizeFieldOptions(secondaryFieldOptions);
        const valueField = normalizeString(seed?.valueField || normalizedValueOptions[0]?.value);
        const secondaryField = normalizeString(seed?.secondaryField || "");
        return {
            kind: "kpiBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "kpiBlock")),
            title: normalizeString(seed?.title || "Headline KPI") || "Headline KPI",
            datasetRef: normalizedDatasetRef,
            valueField,
            valueLabel: normalizeString(seed?.valueLabel || resolveOptionLabel(normalizedValueOptions, valueField) || "Value"),
            secondaryField,
            secondaryLabel: normalizeString(
                secondaryField
                    ? (seed?.secondaryLabel || resolveOptionLabel(normalizedSecondaryOptions, secondaryField))
                    : "",
            ),
            description: normalizeString(seed?.description),
            emptyLabel: normalizeString(seed?.emptyLabel || "No KPI value available."),
            presentationMode: ["body", "both"].includes(normalizeString(seed?.presentationMode).toLowerCase())
                ? normalizeString(seed.presentationMode).toLowerCase()
                : "card",
            rowSelector: ["maxbyvalue", "minbyvalue"].includes(normalizeString(seed?.rowSelector).toLowerCase())
                ? normalizeString(seed.rowSelector).toLowerCase()
                : "firstRow",
            bodyFormat: "markdown",
            bodyTemplate: String(seed?.bodyTemplate || ""),
        };
    }
    if (normalizedKind === "collectionBlock") {
        const normalizedDatasetRef = resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions);
        const datasetOption = (Array.isArray(datasetOptions) ? datasetOptions : [])
            .find((option) => normalizeString(option?.value ?? option?.id) === normalizedDatasetRef) || null;
        const normalizedValueOptions = Array.isArray(datasetOption?.valueFieldOptions) && datasetOption.valueFieldOptions.length > 0
            ? normalizeFieldOptions(datasetOption.valueFieldOptions)
            : normalizeFieldOptions(valueFieldOptions);
        const normalizedSecondaryOptions = Array.isArray(datasetOption?.secondaryFieldOptions) && datasetOption.secondaryFieldOptions.length > 0
            ? normalizeFieldOptions(datasetOption.secondaryFieldOptions)
            : normalizeFieldOptions(secondaryFieldOptions);
        const valueField = normalizeString(seed?.valueField || normalizedValueOptions[0]?.value);
        const itemTitleField = normalizeString(seed?.itemTitleField || normalizedSecondaryOptions[0]?.value);
        const secondaryField = normalizeString(seed?.secondaryField || "");
        return {
            kind: "collectionBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "collectionBlock")),
            title: normalizeString(seed?.title || "Collection") || "Collection",
            datasetRef: normalizedDatasetRef,
            itemTitleField,
            itemTitleLabel: normalizeString(
                itemTitleField
                    ? (seed?.itemTitleLabel || resolveOptionLabel(normalizedSecondaryOptions, itemTitleField) || itemTitleField)
                    : "",
            ),
            valueField,
            valueLabel: normalizeString(
                valueField
                    ? (seed?.valueLabel || resolveOptionLabel(normalizedValueOptions, valueField) || "Value")
                    : "",
            ),
            secondaryField,
            secondaryLabel: normalizeString(
                secondaryField
                    ? (seed?.secondaryLabel || resolveOptionLabel(normalizedSecondaryOptions, secondaryField))
                    : "",
            ),
            description: normalizeString(seed?.description),
            emptyLabel: normalizeString(seed?.emptyLabel || "No collection items available."),
            layout: normalizeCollectionBlockLayout(seed?.layout),
            columns: normalizeCollectionBlockColumns(seed?.columns),
            rowLimit: normalizeCollectionBlockRowLimit(seed?.rowLimit),
            bodyFormat: "markdown",
            bodyTemplate: String(seed?.bodyTemplate || ""),
        };
    }
    if (normalizedKind === "sectionBlock") {
        return {
            kind: "sectionBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "sectionBlock")),
            title: normalizeString(seed?.title || "Section") || "Section",
            subtitle: normalizeString(seed?.subtitle),
            description: normalizeString(seed?.description),
            navigationLabel: normalizeString(seed?.navigationLabel || seed?.title || "Section") || "Section",
        };
    }
    if (normalizedKind === "compositeBlock") {
        const normalizedChildBlockOptions = normalizeFieldOptions(childBlockOptions);
        return {
            kind: "compositeBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "compositeBlock")),
            title: normalizeString(seed?.title || "Grouped Panel") || "Grouped Panel",
            description: normalizeString(seed?.description),
            childBlockIds: normalizeStringArray(seed?.childBlockIds).filter((blockId) => (
                normalizedChildBlockOptions.length === 0
                    ? true
                    : normalizedChildBlockOptions.some((option) => option.value === blockId)
            )),
        };
    }
    if (normalizedKind === "tabGroupBlock") {
        const sectionIds = normalizeStringArray(seed?.sectionIds).length > 0
            ? normalizeStringArray(seed.sectionIds)
            : existingBlocks
                .filter((block) => normalizeString(block?.kind) === "sectionBlock")
                .map((block) => normalizeString(block?.id))
                .filter(Boolean);
        return {
            kind: "tabGroupBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "tabGroupBlock")),
            title: normalizeString(seed?.title || "Sections") || "Sections",
            sectionIds,
            defaultSectionId: normalizeString(seed?.defaultSectionId || sectionIds[0] || ""),
        };
    }
    if (normalizedKind === "stepperBlock") {
        return {
            kind: "stepperBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "stepperBlock")),
            title: normalizeString(seed?.title || "Process") || "Process",
            description: normalizeString(seed?.description),
            steps: normalizeStepperDraftSteps(seed?.steps).length > 0
                ? normalizeStepperDraftSteps(seed?.steps)
                : [
                    { id: "step_1", title: "", body: "", tone: "" },
            ],
        };
    }
    if (normalizedKind === "infoPanelBlock") {
        return {
            kind: "infoPanelBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "infoPanelBlock")),
            title: normalizeString(seed?.title || "Info Panel") || "Info Panel",
            eyebrow: normalizeString(seed?.eyebrow),
            description: normalizeString(seed?.description),
            tone: normalizeString(seed?.tone).toLowerCase(),
            bodyFormat: "markdown",
            body: String(seed?.body || ""),
        };
    }
    if (normalizedKind === "calloutBlock") {
        const badgesText = Array.isArray(seed?.badges)
            ? seed.badges.map((badge) => normalizeString(badge)).filter(Boolean).join(", ")
            : String(seed?.badgesText || "");
        return {
            kind: "calloutBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "calloutBlock")),
            title: normalizeString(seed?.title || "Callout") || "Callout",
            icon: normalizeString(seed?.icon),
            description: normalizeString(seed?.description),
            tone: normalizeString(seed?.tone).toLowerCase(),
            badgesText,
            bodyFormat: "markdown",
            body: String(seed?.body || ""),
        };
    }
    if (normalizedKind === "kanbanBlock") {
        return {
            kind: "kanbanBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "kanbanBlock")),
            title: normalizeString(seed?.title || "Pipeline") || "Pipeline",
            description: normalizeString(seed?.description),
            columns: normalizeKanbanDraftColumns(seed?.columns).length > 0
                ? normalizeKanbanDraftColumns(seed?.columns)
                : [
                    {
                        id: "column_1",
                        title: "",
                        tone: "",
                        cards: [{ id: "card_1", title: "", body: "", badge: "", tone: "" }],
                    },
            ],
        };
    }
    if (normalizedKind === "timelineBlock") {
        return {
            kind: "timelineBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "timelineBlock")),
            title: normalizeString(seed?.title || "Timeline") || "Timeline",
            description: normalizeString(seed?.description),
            events: normalizeTimelineDraftEvents(seed?.events).length > 0
                ? normalizeTimelineDraftEvents(seed?.events)
                : [{ id: "event_1", date: "", title: "", body: "", badge: "", tone: "" }],
        };
    }
    if (normalizedKind === "markdownBlock") {
        return {
            kind: "markdownBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "markdownBlock")),
            title: normalizeString(seed?.title || "Narrative") || "Narrative",
            datasetRef: resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions),
            markdown: String(seed?.markdown || ""),
        };
    }
    if (normalizedKind === "badgesBlock") {
        const items = normalizeReportBuilderBadgeItems(seed?.items);
        return {
            kind: "badgesBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "badgesBlock")),
            title: normalizeString(seed?.title || "Status Pills") || "Status Pills",
            datasetRef: resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions),
            items: items.length > 0
                ? items.map((item) => ({
                    ...item,
                    rulesText: normalizeString(item?.rulesText || buildBadgeRulesText(item)),
                }))
                : [{
                    id: "badge_1",
                    label: "",
                    value: "",
                    valueField: "",
                    format: "",
                    labelMode: "field",
                    tone: "info",
                    rulesText: "",
                }],
        };
    }
    if (normalizedKind === "tableBlock") {
        const normalizedDatasetRef = resolveDefaultDocumentBlockDatasetRef(seed?.datasetRef, normalizedDatasetOptions);
        const datasetOption = (Array.isArray(datasetOptions) ? datasetOptions : [])
            .find((option) => normalizeString(option?.value ?? option?.id) === normalizedDatasetRef) || null;
        const normalizedColumnOptions = Array.isArray(datasetOption?.columnOptions) && datasetOption.columnOptions.length > 0
            ? normalizeTableColumnOptions(datasetOption.columnOptions)
            : normalizeTableColumnOptions(tableColumnOptions);
        const selectedColumnDefaults = normalizedColumnOptions.filter((option) => option.selected).map((option) => option.key);
        const defaultColumnKeys = selectedColumnDefaults.length > 0
            ? selectedColumnDefaults
            : normalizedColumnOptions.map((option) => option.key);
        const columnKeys = normalizeStringArray(
            Array.isArray(seed?.columnKeys)
                ? seed.columnKeys
                : (Array.isArray(seed?.columns) ? seed.columns.map((column) => column?.key) : defaultColumnKeys),
        );
        const resolvedColumnKeys = columnKeys.length > 0 ? columnKeys : defaultColumnKeys;
        const optionIndex = new Map(normalizedColumnOptions.map((option) => [option.key, option]));
        const existingColumns = new Map(
            (Array.isArray(seed?.columns) ? seed.columns : [])
                .filter((column) => column && typeof column === "object" && !Array.isArray(column))
                .map((column) => [normalizeString(column?.key), cloneValue(column)]),
        );
        const columnVisualKinds = {};
        const columnVisualRuleTexts = {};
        return {
            kind: "tableBlock",
            id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "tableBlock")),
            title: normalizeString(seed?.title || "Detail Table") || "Detail Table",
            datasetRef: normalizedDatasetRef,
            columnKeys: resolvedColumnKeys,
            columns: resolvedColumnKeys.map((columnKey) => {
                const existing = existingColumns.get(columnKey);
                const visualKind = buildTableColumnVisualDraft(existing);
                if (visualKind) {
                    columnVisualKinds[columnKey] = visualKind;
                    if (visualKind === "badge" || visualKind === "tone") {
                        const rulesText = buildVisualRulesText(visualKind, existing);
                        if (rulesText) {
                            columnVisualRuleTexts[columnKey] = rulesText;
                        }
                    }
                }
                const option = optionIndex.get(columnKey);
                if (existing) {
                    return {
                        ...existing,
                        key: columnKey,
                        ...(normalizeString(existing?.sourceKey || option?.sourceKey)
                            ? { sourceKey: normalizeString(existing?.sourceKey || option?.sourceKey) }
                            : {}),
                        ...(normalizeString(existing?.displayKey || option?.displayKey)
                            ? { displayKey: normalizeString(existing?.displayKey || option?.displayKey) }
                            : {}),
                        ...(existing?.displayValueMap || option?.displayValueMap
                            ? { displayValueMap: cloneValue(existing?.displayValueMap || option?.displayValueMap) }
                            : {}),
                        ...(normalizeString(existing?.label || option?.label || columnKey)
                            ? { label: normalizeString(existing?.label || option?.label || columnKey) }
                            : {}),
                        ...(normalizeString(existing?.format || option?.format)
                            ? { format: normalizeString(existing?.format || option?.format) }
                            : {}),
                    };
                }
                return option
                    ? {
                        key: option.key,
                        sourceKey: option.sourceKey,
                        displayKey: option.displayKey,
                        ...(option.displayValueMap ? { displayValueMap: cloneValue(option.displayValueMap) } : {}),
                        label: option.label,
                        ...(option.format ? { format: option.format } : {}),
                    }
                    : { key: columnKey };
            }),
            columnVisualKinds,
            columnVisualRuleTexts,
        };
    }
    return {
        kind: "markdownBlock",
        id: normalizeString(seed?.id || resolveUniqueDocumentBlockId(existingBlocks, "markdownBlock")),
        title: normalizeString(seed?.title || "Narrative") || "Narrative",
        markdown: String(seed?.markdown || ""),
    };
}

export function rebindReportBuilderDocumentBlockDraft(draft = null, {
    datasetRef = "",
    datasetOptions = [],
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    tableColumnOptions = [],
    scopeParamOptions = [],
    filterBarGroupOptions = [],
} = {}) {
    const normalizedDraft = draft && typeof draft === "object" && !Array.isArray(draft)
        ? cloneValue(draft)
        : null;
    if (!normalizedDraft) {
        return normalizedDraft;
    }
    const normalizedKind = normalizeString(normalizedDraft?.kind);
    const datasetResolution = resolveDocumentBlockDatasetRefResolution(
        normalizeString(datasetRef || normalizedDraft?.datasetRef),
        datasetOptions,
    );
    const nextDatasetRef = datasetResolution.datasetRef;
    normalizedDraft.datasetRef = nextDatasetRef;

    const normalizedValueOptions = normalizeFieldOptions(valueFieldOptions);
    const normalizedSecondaryOptions = normalizeFieldOptions(secondaryFieldOptions);
    const normalizedColumnOptions = normalizeTableColumnOptions(tableColumnOptions);
    const normalizedScopeParamOptions = normalizeScopeParamOptions(scopeParamOptions);

    if (normalizedKind === "filterBarBlock") {
        const scopedParamOptions = resolveDocumentBlockScopeParamOptions(
            nextDatasetRef,
            [{ value: nextDatasetRef, scopeParamOptions: normalizedScopeParamOptions }],
            [],
            {
                allowImplicitTopLevelFallback: datasetResolution.source === "singleAvailable",
            },
        );
        const primaryGroupFallback = scopedParamOptions.map((option) => ({
            ...option,
            kind: "scopeParam",
        }));
        const scopedGroupOptions = normalizeFilterBarGroupOptions(
            nextDatasetRef === "primary"
                ? ((Array.isArray(filterBarGroupOptions) && filterBarGroupOptions.length > 0) ? filterBarGroupOptions : primaryGroupFallback)
                : primaryGroupFallback,
        );
        const allowedGroupIds = new Set(scopedGroupOptions.map((option) => option.value));
        const defaultVisibleGroups = scopedGroupOptions.map((option) => option.value);
        const visibleGroups = normalizeStringArray(normalizedDraft?.visibleGroups).filter((groupId) => allowedGroupIds.has(groupId));
        normalizedDraft.visibleGroups = visibleGroups.length > 0
            ? visibleGroups
            : defaultVisibleGroups;
        normalizedDraft.groupOrder = normalizeStringArray(normalizedDraft?.groupOrder)
            .filter((groupId) => normalizedDraft.visibleGroups.includes(groupId));
        if (normalizedDraft.groupOrder.length === 0) {
            normalizedDraft.groupOrder = [...normalizedDraft.visibleGroups];
        }
        normalizedDraft.collapsedGroups = normalizeStringArray(normalizedDraft?.collapsedGroups)
            .filter((groupId) => normalizedDraft.visibleGroups.includes(groupId));
        normalizedDraft.paramIds = deriveFilterBarParamIdsFromVisibleGroups(normalizedDraft.visibleGroups, scopedGroupOptions);
        normalizedDraft.mode = normalizeFilterBarBlockMode(normalizedDraft?.mode || "");
        normalizedDraft.placement = normalizeFilterBarBlockPlacement(normalizedDraft?.placement || "") || "inherit";
        return normalizedDraft;
    }

    if (normalizedKind === "tableBlock") {
        const selectedColumnKeys = normalizeStringArray(normalizedDraft?.columnKeys);
        const allowedColumnKeys = new Set(normalizedColumnOptions.map((option) => option.key));
        const defaultColumnKeys = (() => {
            const selectedDefaults = normalizedColumnOptions.filter((option) => option.selected).map((option) => option.key);
            return selectedDefaults.length > 0
                ? selectedDefaults
                : normalizedColumnOptions.map((option) => option.key);
        })();
        const nextColumnKeys = selectedColumnKeys.filter((key) => allowedColumnKeys.has(key));
        const resolvedColumnKeys = nextColumnKeys.length > 0 ? nextColumnKeys : defaultColumnKeys;
        const optionIndex = new Map(normalizedColumnOptions.map((option) => [option.key, option]));
        const existingColumns = new Map(
            (Array.isArray(normalizedDraft?.columns) ? normalizedDraft.columns : [])
                .filter((column) => column && typeof column === "object" && !Array.isArray(column))
                .map((column) => [normalizeString(column?.key), cloneValue(column)]),
        );
        normalizedDraft.columnKeys = resolvedColumnKeys;
        normalizedDraft.columns = resolvedColumnKeys.map((columnKey) => {
            const option = optionIndex.get(columnKey);
            const existing = existingColumns.get(columnKey);
            return {
                ...(existing || {}),
                key: columnKey,
                ...(normalizeString(existing?.sourceKey || option?.sourceKey)
                    ? { sourceKey: normalizeString(existing?.sourceKey || option?.sourceKey) }
                    : {}),
                ...(normalizeString(existing?.displayKey || option?.displayKey)
                    ? { displayKey: normalizeString(existing?.displayKey || option?.displayKey) }
                    : {}),
                ...(existing?.displayValueMap || option?.displayValueMap
                    ? { displayValueMap: cloneValue(existing?.displayValueMap || option?.displayValueMap) }
                    : {}),
                label: normalizeString(existing?.label || option?.label || columnKey) || columnKey,
                ...(normalizeString(existing?.format || option?.format) ? { format: normalizeString(existing?.format || option?.format) } : {}),
            };
        });
        if (normalizedDraft.columnVisualKinds && typeof normalizedDraft.columnVisualKinds === "object" && !Array.isArray(normalizedDraft.columnVisualKinds)) {
            normalizedDraft.columnVisualKinds = Object.fromEntries(
                Object.entries(normalizedDraft.columnVisualKinds)
                    .filter(([key]) => resolvedColumnKeys.includes(normalizeString(key))),
            );
        }
        if (normalizedDraft.columnVisualRuleTexts && typeof normalizedDraft.columnVisualRuleTexts === "object" && !Array.isArray(normalizedDraft.columnVisualRuleTexts)) {
            normalizedDraft.columnVisualRuleTexts = Object.fromEntries(
                Object.entries(normalizedDraft.columnVisualRuleTexts)
                    .filter(([key]) => resolvedColumnKeys.includes(normalizeString(key))),
            );
        }
        return normalizedDraft;
    }

    if (normalizedKind === "kpiBlock") {
        const currentValueField = normalizeString(normalizedDraft?.valueField);
        const nextValueField = normalizedValueOptions.some((option) => option.value === currentValueField)
            ? currentValueField
            : normalizeString(normalizedValueOptions[0]?.value);
        const currentSecondaryField = normalizeString(normalizedDraft?.secondaryField);
        const nextSecondaryField = normalizedSecondaryOptions.some((option) => option.value === currentSecondaryField)
            ? currentSecondaryField
            : "";
        normalizedDraft.valueField = nextValueField;
        normalizedDraft.valueLabel = normalizeString(
            normalizedValueOptions.find((option) => option.value === nextValueField)?.label
            || normalizedDraft?.valueLabel
            || nextValueField,
        );
        normalizedDraft.secondaryField = nextSecondaryField;
        normalizedDraft.secondaryLabel = normalizeString(
            nextSecondaryField
                ? (normalizedSecondaryOptions.find((option) => option.value === nextSecondaryField)?.label || normalizedDraft?.secondaryLabel || nextSecondaryField)
                : "",
        );
        normalizedDraft.rowSelector = ["maxbyvalue", "minbyvalue"].includes(normalizeString(normalizedDraft?.rowSelector).toLowerCase())
            ? normalizeString(normalizedDraft.rowSelector).toLowerCase()
            : "firstRow";
        normalizedDraft.bodyFormat = "markdown";
        return normalizedDraft;
    }

    if (normalizedKind === "collectionBlock") {
        const currentValueField = normalizeString(normalizedDraft?.valueField);
        const nextValueField = normalizedValueOptions.some((option) => option.value === currentValueField)
            ? currentValueField
            : normalizeString(normalizedValueOptions[0]?.value);
        const currentItemTitleField = normalizeString(normalizedDraft?.itemTitleField);
        const nextItemTitleField = normalizedSecondaryOptions.some((option) => option.value === currentItemTitleField)
            ? currentItemTitleField
            : normalizeString(normalizedSecondaryOptions[0]?.value);
        const currentSecondaryField = normalizeString(normalizedDraft?.secondaryField);
        const nextSecondaryField = normalizedSecondaryOptions.some((option) => option.value === currentSecondaryField)
            ? currentSecondaryField
            : "";
        normalizedDraft.valueField = nextValueField;
        normalizedDraft.valueLabel = normalizeString(
            nextValueField
                ? (normalizedValueOptions.find((option) => option.value === nextValueField)?.label || normalizedDraft?.valueLabel || nextValueField)
                : "",
        );
        normalizedDraft.itemTitleField = nextItemTitleField;
        normalizedDraft.itemTitleLabel = normalizeString(
            nextItemTitleField
                ? (normalizedSecondaryOptions.find((option) => option.value === nextItemTitleField)?.label || normalizedDraft?.itemTitleLabel || nextItemTitleField)
                : "",
        );
        normalizedDraft.secondaryField = nextSecondaryField;
        normalizedDraft.secondaryLabel = normalizeString(
            nextSecondaryField
                ? (normalizedSecondaryOptions.find((option) => option.value === nextSecondaryField)?.label || normalizedDraft?.secondaryLabel || nextSecondaryField)
                : "",
        );
        normalizedDraft.layout = normalizeCollectionBlockLayout(normalizedDraft?.layout);
        normalizedDraft.columns = normalizeCollectionBlockColumns(normalizedDraft?.columns);
        normalizedDraft.rowLimit = normalizeCollectionBlockRowLimit(normalizedDraft?.rowLimit);
        normalizedDraft.bodyFormat = "markdown";
        return normalizedDraft;
    }

    if (normalizedKind === "sectionBlock") {
        normalizedDraft.navigationLabel = normalizeString(normalizedDraft?.navigationLabel || normalizedDraft?.title || "Section") || "Section";
        return normalizedDraft;
    }

    if (normalizedKind === "compositeBlock") {
        normalizedDraft.childBlockIds = normalizeStringArray(normalizedDraft?.childBlockIds);
        return normalizedDraft;
    }

    if (normalizedKind === "tabGroupBlock") {
        normalizedDraft.sectionIds = normalizeStringArray(normalizedDraft?.sectionIds);
        const defaultSectionId = normalizeString(normalizedDraft?.defaultSectionId);
        normalizedDraft.defaultSectionId = defaultSectionId && normalizedDraft.sectionIds.includes(defaultSectionId)
            ? defaultSectionId
            : normalizeString(normalizedDraft.sectionIds[0] || "");
        return normalizedDraft;
    }

    if (normalizedKind === "stepperBlock") {
        normalizedDraft.steps = normalizeStepperDraftSteps(normalizedDraft?.steps).length > 0
            ? normalizeStepperDraftSteps(normalizedDraft.steps)
            : [{ id: "step_1", title: "", body: "", tone: "" }];
        return normalizedDraft;
    }

    if (normalizedKind === "infoPanelBlock") {
        normalizedDraft.tone = normalizeString(normalizedDraft?.tone).toLowerCase();
        normalizedDraft.bodyFormat = "markdown";
        return normalizedDraft;
    }

    if (normalizedKind === "calloutBlock") {
        normalizedDraft.icon = normalizeString(normalizedDraft?.icon);
        normalizedDraft.tone = normalizeString(normalizedDraft?.tone).toLowerCase();
        normalizedDraft.badgesText = String(normalizedDraft?.badgesText || "");
        normalizedDraft.bodyFormat = "markdown";
        return normalizedDraft;
    }

    if (normalizedKind === "kanbanBlock") {
        normalizedDraft.columns = normalizeKanbanDraftColumns(normalizedDraft?.columns).length > 0
            ? normalizeKanbanDraftColumns(normalizedDraft.columns)
            : [{ id: "column_1", title: "", tone: "", cards: [{ id: "card_1", title: "", body: "", badge: "", tone: "" }] }];
        return normalizedDraft;
    }

    if (normalizedKind === "timelineBlock") {
        normalizedDraft.events = normalizeTimelineDraftEvents(normalizedDraft?.events).length > 0
            ? normalizeTimelineDraftEvents(normalizedDraft.events)
            : [{ id: "event_1", date: "", title: "", body: "", badge: "", tone: "" }];
        return normalizedDraft;
    }

    if (normalizedKind === "chartBlock") {
        const datasetOption = (Array.isArray(datasetOptions) ? datasetOptions : [])
            .find((option) => normalizeString(option?.value ?? option?.id) === nextDatasetRef) || null;
        const availableChartFields = normalizeChartFieldOptions(
            Array.isArray(datasetOption?.chartFieldOptions) ? datasetOption.chartFieldOptions : [],
        );
        const availableFieldKeys = new Set(availableChartFields.map((option) => normalizeString(option?.key)));
        const currentChartSpec = normalizeReportBuilderChartSpec(normalizedDraft?.chartSpec || {});
        const hasValidCurrentSpec = !!normalizeString(currentChartSpec?.xField)
            && availableFieldKeys.has(normalizeString(currentChartSpec?.xField))
            && normalizeStringArray(currentChartSpec?.yFields).length > 0
            && normalizeStringArray(currentChartSpec?.yFields).every((field) => availableFieldKeys.has(normalizeString(field)))
            && (!normalizeString(currentChartSpec?.seriesField) || availableFieldKeys.has(normalizeString(currentChartSpec?.seriesField)));
        const fallbackChartSpec = buildDatasetChartSpecSeed(
            datasetOption,
            normalizeString(currentChartSpec?.title || normalizedDraft?.title || "Chart") || "Chart",
            normalizeString(currentChartSpec?.type || "bar") || "bar",
        );
        normalizedDraft.chartSpec = hasValidCurrentSpec
            ? currentChartSpec
            : fallbackChartSpec;
        return normalizedDraft;
    }

    if (normalizedKind === "badgesBlock") {
        const allowedColumnKeys = new Set(normalizedColumnOptions.map((option) => option.key));
        const optionIndex = new Map(normalizedColumnOptions.map((option) => [option.key, option]));
        normalizedDraft.items = normalizeReportBuilderBadgeItems(normalizedDraft?.items).map((item) => {
            const normalizedValueField = normalizeString(item?.valueField);
            const matchedOption = optionIndex.get(normalizedValueField);
            return {
                ...item,
                rulesText: normalizeString(item?.rulesText || buildBadgeRulesText(item)),
                ...(normalizedValueField && allowedColumnKeys.has(normalizedValueField)
                    ? {
                        valueField: normalizedValueField,
                        format: normalizeString(matchedOption?.format),
                    }
                    : { valueField: "", format: "" }),
            };
        });
        return normalizedDraft;
    }

    if (normalizedKind === "geoMapBlock") {
        const geo = normalizedDraft?.geo && typeof normalizedDraft.geo === "object" && !Array.isArray(normalizedDraft.geo)
            ? cloneValue(normalizedDraft.geo)
            : {};
        const metric = geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)
            ? cloneValue(geo.metric)
            : {};
        const dimensionOptions = normalizedColumnOptions.filter((option) => normalizeString(option?.kind) === "dimension");
        const measureOptions = normalizedColumnOptions.filter((option) => normalizeString(option?.kind) === "measure");
        const currentKey = normalizeString(geo?.key);
        const currentLabelKey = normalizeString(geo?.labelKey);
        const currentMetricKey = normalizeString(metric?.key);
        const nextKey = dimensionOptions.some((option) => option.key === currentKey)
            ? currentKey
            : normalizeString(dimensionOptions[0]?.key);
        const nextLabelKey = dimensionOptions.some((option) => option.key === currentLabelKey)
            ? currentLabelKey
            : "";
        const nextMetricKey = measureOptions.some((option) => option.key === currentMetricKey)
            ? currentMetricKey
            : normalizeString(measureOptions[0]?.key);
        normalizedDraft.geo = {
            ...geo,
            key: nextKey,
            ...(nextLabelKey ? { labelKey: nextLabelKey } : {}),
            metric: {
                ...metric,
                key: nextMetricKey,
                label: normalizeString(
                    measureOptions.find((option) => option.key === nextMetricKey)?.label
                    || metric?.label
                    || nextMetricKey,
                ),
                ...(normalizeString(
                    measureOptions.find((option) => option.key === nextMetricKey)?.format
                    || metric?.format,
                ) ? {
                    format: normalizeGeoFormat(
                        measureOptions.find((option) => option.key === nextMetricKey)?.format
                        || metric?.format,
                    ),
                } : {}),
            },
        };
        return normalizedDraft;
    }

    return normalizedDraft;
}

export function validateReportBuilderDocumentBlockDraft(draft = null, {
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    tableColumnOptions = [],
    childBlockOptions = [],
    scopeParamOptions = [],
    filterBarGroupOptions = [],
    datasetOptions = [],
    chartConfig = null,
    chartFieldOptions = [],
} = {}) {
    const errors = [];
    const normalizedKind = normalizeString(draft?.kind || "markdownBlock");
    const blockId = normalizeString(draft?.id);
    if (!blockId) {
        errors.push({
            field: "id",
            code: "required",
            message: "Block ID is required.",
        });
    }
    if (normalizedKind === "filterBarBlock") {
        const datasetOptionsByValue = new Map(
            (Array.isArray(datasetOptions) ? datasetOptions : [])
                .map((option) => [
                    normalizeString(option?.value ?? option?.id),
                    normalizeScopeParamOptions(option?.scopeParamOptions),
                ])
                .filter(([value]) => !!value),
        );
        const datasetResolution = resolveDocumentBlockDatasetRefResolution(
            normalizeString(draft?.datasetRef),
            datasetOptions,
        );
        const normalizedDatasetRef = datasetResolution.datasetRef;
        const datasetScopedOptions = datasetOptionsByValue.has(normalizedDatasetRef)
            ? (datasetOptionsByValue.get(normalizedDatasetRef) || [])
            : [];
        const normalizedScopeParamOptions = datasetScopedOptions.length > 0
            ? datasetScopedOptions
            : ((normalizedDatasetRef === "primary" || datasetResolution.source === "singleAvailable")
                ? normalizeScopeParamOptions(scopeParamOptions)
                : []);
        const primaryGroupFallback = normalizedScopeParamOptions.map((option) => ({
            ...option,
            kind: "scopeParam",
        }));
        const scopedGroupOptions = normalizeFilterBarGroupOptions(
            normalizedDatasetRef === "primary"
                ? ((Array.isArray(filterBarGroupOptions) && filterBarGroupOptions.length > 0) ? filterBarGroupOptions : primaryGroupFallback)
                : primaryGroupFallback,
        );
        const allowedGroupIds = new Set(scopedGroupOptions.map((option) => option.value));
        const visibleGroups = (() => {
            const explicit = normalizeStringArray(draft?.visibleGroups);
            if (explicit.length > 0) {
                return explicit;
            }
            return normalizeStringArray(draft?.paramIds);
        })();
        const groupOrder = normalizeStringArray(draft?.groupOrder);
        const collapsedGroups = normalizeStringArray(draft?.collapsedGroups);
        const mode = normalizeFilterBarBlockMode(draft?.mode || "");
        if (visibleGroups.length === 0 && scopedGroupOptions.length > 0) {
            errors.push({
                field: "visibleGroups",
                code: "required",
                message: "Select at least one visible filter group for the filter bar block.",
            });
        } else if (visibleGroups.some((groupId) => !allowedGroupIds.has(groupId))) {
            errors.push({
                field: "visibleGroups",
                code: "unknown",
                message: "One or more filter bar groups are not available in the current builder.",
            });
        }
        if (groupOrder.some((groupId) => !visibleGroups.includes(groupId))) {
            errors.push({
                field: "groupOrder",
                code: "unknown",
                message: "The filter group order can only include currently visible groups.",
            });
        }
        if (collapsedGroups.some((groupId) => !visibleGroups.includes(groupId))) {
            errors.push({
                field: "collapsedGroups",
                code: "unknown",
                message: "Collapsed groups must also be included in visible groups.",
            });
        }
        if (mode === "baseline") {
            const nonScopeGroups = visibleGroups.filter((groupId) => {
                const option = scopedGroupOptions.find((entry) => entry.value === groupId);
                return normalizeString(option?.kind) !== "scopeParam";
            });
            if (nonScopeGroups.length > 0) {
                errors.push({
                    field: "mode",
                    code: "invalid",
                    message: "Baseline filter bars can only include baseline report filters.",
                });
            }
        }
        const datasetOptionIds = new Set(
            (Array.isArray(datasetOptions) ? datasetOptions : [])
                .map((option) => normalizeString(option?.value ?? option?.id))
                .filter(Boolean),
        );
        if (datasetResolution.source === "explicit" && datasetOptionIds.size > 0 && normalizedDatasetRef !== "primary" && !datasetOptionIds.has(normalizedDatasetRef)) {
            errors.push({
                field: "datasetRef",
                code: "unknown",
                message: "The filter bar data source is not available in the current builder.",
            });
        }
    } else if (normalizedKind === "refinementBarBlock") {
        // No additional validation beyond the generic authored contract.
    } else if (normalizedKind === "geoMapBlock") {
        const normalizedColumnOptions = normalizeTableColumnOptions(tableColumnOptions);
        const dimensionOptionIds = new Set(
            normalizedColumnOptions
                .filter((option) => normalizeString(option?.kind) === "dimension")
                .map((option) => option.key),
        );
        const measureOptionIds = new Set(
            normalizedColumnOptions
                .filter((option) => normalizeString(option?.kind) === "measure")
                .map((option) => option.key),
        );
        const geo = draft?.geo && typeof draft.geo === "object" && !Array.isArray(draft.geo)
            ? draft.geo
            : {};
        const metric = geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)
            ? geo.metric
            : {};
        const key = normalizeString(geo?.key);
        const labelKey = normalizeString(geo?.labelKey);
        const metricKey = normalizeString(metric?.key);
        const aggregate = normalizeString(geo?.aggregate || "sum");
        const shape = normalizeString(geo?.shape || "us-states");
        if (!key) {
            errors.push({
                field: "geo.key",
                code: "required",
                message: "Select a key field for the geo block.",
            });
        } else if (!dimensionOptionIds.has(key)) {
            errors.push({
                field: "geo.key",
                code: "unknown",
                message: "The selected geo key field is not available in the current builder.",
            });
        }
        if (labelKey && !dimensionOptionIds.has(labelKey)) {
            errors.push({
                field: "geo.labelKey",
                code: "unknown",
                message: "The selected geo label field is not available in the current builder.",
            });
        }
        if (!metricKey) {
            errors.push({
                field: "geo.metric.key",
                code: "required",
                message: "Select a metric field for the geo block.",
            });
        } else if (!measureOptionIds.has(metricKey)) {
            errors.push({
                field: "geo.metric.key",
                code: "unknown",
                message: "The selected geo metric field is not available in the current builder.",
            });
        }
        if (!["us-states", "us-state-tiles"].includes(shape)) {
            errors.push({
                field: "geo.shape",
                code: "unsupported",
                message: "The selected geo shape is not supported in this builder slice.",
            });
        }
        if (!["sum", "avg", "min", "max", "first"].includes(aggregate)) {
            errors.push({
                field: "geo.aggregate",
                code: "unsupported",
                message: "The selected geo aggregate is not supported.",
            });
        }
    } else if (normalizedKind === "chartBlock") {
        const normalizedChartSpec = normalizeReportBuilderChartSpec(draft?.chartSpec || {});
        if (!normalizedChartSpec) {
            errors.push({
                field: "chartSpec",
                code: "missing",
                message: "Chart settings are incomplete.",
            });
        } else {
            const chartValidation = validateReportBuilderChartSpec(
                chartConfig && typeof chartConfig === "object" && !Array.isArray(chartConfig)
                    ? chartConfig
                    : {},
                normalizedChartSpec,
                normalizeChartFieldOptions(chartFieldOptions),
            );
            chartValidation.errors.forEach((entry) => {
                errors.push({
                    field: normalizeString(entry?.field || "chartSpec"),
                    code: normalizeString(entry?.code || "invalid"),
                    message: formatChartBlockValidationMessage({
                        ...entry,
                        chartSpec: normalizedChartSpec,
                    }, chartFieldOptions),
                });
            });
        }
    } else if (normalizedKind === "kpiBlock") {
        const normalizedValueOptions = normalizeFieldOptions(valueFieldOptions);
        const normalizedSecondaryOptions = normalizeFieldOptions(secondaryFieldOptions);
        const valueField = normalizeString(draft?.valueField);
        const secondaryField = normalizeString(draft?.secondaryField);
        if (!valueField) {
            errors.push({
                field: "valueField",
                code: "required",
                message: "Select a value field for the KPI block.",
            });
        } else if (normalizedValueOptions.length > 0 && !normalizedValueOptions.some((option) => option.value === valueField)) {
            errors.push({
                field: "valueField",
                code: "unknown",
                message: "The selected KPI value field is not available in the current builder.",
            });
        }
        if (secondaryField && normalizedSecondaryOptions.length > 0 && !normalizedSecondaryOptions.some((option) => option.value === secondaryField)) {
            errors.push({
                field: "secondaryField",
                code: "unknown",
                message: "The selected KPI secondary field is not available in the current builder.",
            });
        }
    } else if (normalizedKind === "collectionBlock") {
        const normalizedValueOptions = normalizeFieldOptions(valueFieldOptions);
        const normalizedSecondaryOptions = normalizeFieldOptions(secondaryFieldOptions);
        const valueField = normalizeString(draft?.valueField);
        const itemTitleField = normalizeString(draft?.itemTitleField);
        const secondaryField = normalizeString(draft?.secondaryField);
        if (!itemTitleField) {
            errors.push({
                field: "itemTitleField",
                code: "required",
                message: "Select a title field for the collection block.",
            });
        } else if (normalizedSecondaryOptions.length > 0 && !normalizedSecondaryOptions.some((option) => option.value === itemTitleField)) {
            errors.push({
                field: "itemTitleField",
                code: "unknown",
                message: "The selected collection title field is not available in the current builder.",
            });
        }
        if (valueField && normalizedValueOptions.length > 0 && !normalizedValueOptions.some((option) => option.value === valueField)) {
            errors.push({
                field: "valueField",
                code: "unknown",
                message: "The selected collection value field is not available in the current builder.",
            });
        }
        if (secondaryField && normalizedSecondaryOptions.length > 0 && !normalizedSecondaryOptions.some((option) => option.value === secondaryField)) {
            errors.push({
                field: "secondaryField",
                code: "unknown",
                message: "The selected collection secondary field is not available in the current builder.",
            });
        }
    } else if (normalizedKind === "sectionBlock") {
        if (!normalizeString(draft?.title)) {
            errors.push({
                field: "title",
                code: "required",
                message: "Section title is required.",
            });
        }
    } else if (normalizedKind === "compositeBlock") {
        const childBlockIds = normalizeStringArray(draft?.childBlockIds);
        const normalizedChildBlockOptions = normalizeFieldOptions(childBlockOptions);
        if (childBlockIds.length === 0) {
            errors.push({
                field: "childBlockIds",
                code: "required",
                message: "Select at least one child block for the grouped panel.",
            });
        }
        if (normalizeString(draft?.id) && childBlockIds.includes(normalizeString(draft.id))) {
            errors.push({
                field: "childBlockIds",
                code: "selfReference",
                message: "A grouped panel cannot include itself as a child block.",
            });
        }
        if (normalizedChildBlockOptions.length > 0 && childBlockIds.some((blockId) => !normalizedChildBlockOptions.some((option) => option.value === blockId))) {
            errors.push({
                field: "childBlockIds",
                code: "unknown",
                message: "One or more selected child blocks are no longer available in the report document.",
            });
        }
    } else if (normalizedKind === "tabGroupBlock") {
        const sectionIds = normalizeStringArray(draft?.sectionIds);
        if (sectionIds.length === 0) {
            errors.push({
                field: "sectionIds",
                code: "required",
                message: "Select at least one section for the tab group.",
            });
        }
    } else if (normalizedKind === "stepperBlock") {
        const steps = normalizeStepperDraftSteps(draft?.steps);
        if (steps.length === 0) {
            errors.push({
                field: "steps",
                code: "required",
                message: "Add at least one step to the process block.",
            });
        }
    } else if (normalizedKind === "infoPanelBlock") {
        if (!String(draft?.body || "").trim()) {
            errors.push({
                field: "body",
                code: "required",
                message: "Info panel body is required.",
            });
        }
    } else if (normalizedKind === "calloutBlock") {
        if (!String(draft?.body || "").trim()) {
            errors.push({
                field: "body",
                code: "required",
                message: "Callout body is required.",
            });
        }
    } else if (normalizedKind === "kanbanBlock") {
        const columns = normalizeKanbanDraftColumns(draft?.columns);
        if (columns.length === 0) {
            errors.push({
                field: "columns",
                code: "required",
                message: "Add at least one lane to the kanban block.",
            });
        }
    } else if (normalizedKind === "timelineBlock") {
        const events = normalizeTimelineDraftEvents(draft?.events);
        if (events.length === 0) {
            errors.push({
                field: "events",
                code: "required",
                message: "Add at least one event to the timeline block.",
            });
        }
    } else if (normalizedKind === "badgesBlock") {
        const items = normalizeReportBuilderBadgeItems(draft?.items);
        if (items.length === 0) {
            errors.push({
                field: "items",
                code: "required",
                message: "Add at least one pill to the authored badges block.",
            });
        }
        const allowedColumnKeys = new Set(
            normalizeTableColumnOptions(tableColumnOptions).map((option) => option.key),
        );
        items.forEach((item, index) => {
            const valueField = normalizeString(item?.valueField);
            if (valueField && tableColumnOptions.length > 0 && !allowedColumnKeys.has(valueField)) {
                errors.push({
                    field: `items.${index}.valueField`,
                    code: "unknown",
                    message: `The selected pill field '${valueField}' is not available in the current builder.`,
                });
            }
            const parsedRules = parseReportBuilderBadgeRuleRows(item?.rulesText || "");
            if (!parsedRules.valid) {
                errors.push({
                    field: `items.${index}.rulesText`,
                    code: "invalidRules",
                    message: `${labelForBadgeItem(item, index)}: ${parsedRules.error}`,
                });
            }
        });
    } else if (normalizedKind === "tableBlock") {
        const normalizedColumnOptions = normalizeTableColumnOptions(tableColumnOptions);
        const allowedColumnKeys = new Set(normalizedColumnOptions.map((option) => option.key));
        const columnKeys = normalizeStringArray(draft?.columnKeys);
        if (columnKeys.length === 0) {
            errors.push({
                field: "columnKeys",
                code: "required",
                message: "Select at least one breakdown or measure for the table block.",
            });
        } else if (normalizedColumnOptions.length > 0 && columnKeys.some((columnKey) => !allowedColumnKeys.has(columnKey))) {
            errors.push({
                field: "columnKeys",
                code: "unknown",
                message: "One or more table block fields are not available in the current builder.",
            });
        }
        const columnVisualKinds = normalizeColumnVisualKinds(draft?.columnVisualKinds);
        const columnVisualRuleTexts = normalizeColumnVisualRuleTexts(draft?.columnVisualRuleTexts);
        columnKeys.forEach((columnKey) => {
            const visualKind = normalizeString(columnVisualKinds[columnKey]);
            if (!visualKind) {
                return;
            }
            if (visualKind !== "dataBar" && visualKind !== "progressBar" && visualKind !== "sparkBar" && visualKind !== "shareBar" && visualKind !== "delta" && visualKind !== "rank") {
                if (visualKind !== "badge" && visualKind !== "tone") {
                    errors.push({
                        field: "columnVisualKinds",
                        code: "unsupported",
                        message: `${columnKey} uses unsupported table visual '${visualKind}'.`,
                    });
                    return;
                }
            }
            const option = normalizedColumnOptions.find((entry) => entry.key === columnKey) || null;
            if (visualKind === "dataBar" && normalizeString(option?.kind) !== "measure") {
                errors.push({
                    field: "columnVisualKinds",
                    code: "unsupported",
                    message: `${columnKey} does not support data bars in the authored table block.`,
                });
                return;
            }
            if (visualKind === "progressBar" && normalizeString(option?.kind) !== "measure") {
                errors.push({
                    field: "columnVisualKinds",
                    code: "unsupported",
                    message: `${columnKey} does not support progress bars in the authored table block.`,
                });
                return;
            }
            if (visualKind === "sparkBar" && normalizeString(option?.kind) !== "measure") {
                errors.push({
                    field: "columnVisualKinds",
                    code: "unsupported",
                    message: `${columnKey} does not support spark bars in the authored table block.`,
                });
                return;
            }
            if (visualKind === "shareBar" && normalizeString(option?.kind) !== "measure") {
                errors.push({
                    field: "columnVisualKinds",
                    code: "unsupported",
                    message: `${columnKey} does not support share bars in the authored table block.`,
                });
                return;
            }
            if (visualKind === "delta" && normalizeString(option?.kind) !== "measure") {
                errors.push({
                    field: "columnVisualKinds",
                    code: "unsupported",
                    message: `${columnKey} does not support delta chips in the authored table block.`,
                });
                return;
            }
            if (visualKind === "rank" && normalizeString(option?.kind) !== "measure") {
                errors.push({
                    field: "columnVisualKinds",
                    code: "unsupported",
                    message: `${columnKey} does not support rank chips in the authored table block.`,
                });
                return;
            }
            if (visualKind === "badge") {
                if (normalizeString(option?.kind) !== "dimension") {
                    errors.push({
                        field: "columnVisualKinds",
                        code: "unsupported",
                        message: `${columnKey} does not support badges in the authored table block.`,
                    });
                    return;
                }
                const parsed = parseVisualRulesText("badge", columnVisualRuleTexts[columnKey] || "");
                if (!parsed.valid) {
                    errors.push({
                        field: "columnVisualRuleTexts",
                        code: "invalidRules",
                        message: `${columnKey}: ${parsed.error}`,
                    });
                }
                return;
            }
            if (visualKind === "shareBar") {
                const parsed = parseVisualRulesText("shareBar", columnVisualRuleTexts[columnKey] || "");
                if (!parsed.valid) {
                    errors.push({
                        field: "columnVisualRuleTexts",
                        code: "invalidRules",
                        message: `${columnKey}: ${parsed.error}`,
                    });
                }
                return;
            }
            if (visualKind === "tone") {
                if (normalizeString(option?.kind) !== "dimension") {
                    errors.push({
                        field: "columnVisualKinds",
                        code: "unsupported",
                        message: `${columnKey} does not support tones in the authored table block.`,
                    });
                    return;
                }
                const parsed = parseVisualRulesText("tone", columnVisualRuleTexts[columnKey] || "");
                if (!parsed.valid) {
                    errors.push({
                        field: "columnVisualRuleTexts",
                        code: "invalidRules",
                        message: `${columnKey}: ${parsed.error}`,
                    });
                }
            }
        });
    } else if (!["markdownBlock", "filterBarBlock", "refinementBarBlock", "geoMapBlock"].includes(normalizedKind)) {
        errors.push({
            field: "kind",
            code: "unsupported",
            message: "Only narrative, collection, pills, filter bar, refinement bar, geo map, KPI, chart, and table authored blocks are supported in this builder slice.",
        });
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}

export function buildReportBuilderDocumentBlockDiagnostics(blocks = [], {
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    tableColumnOptions = [],
    scopeParamOptions = [],
    chartConfig = null,
    chartFieldOptions = [],
    datasetOptions = [],
} = {}) {
    const normalizedBlocks = normalizeReportBuilderDocumentBlocks(blocks);
    const normalizedValueOptions = normalizeFieldOptions(valueFieldOptions);
    const normalizedSecondaryOptions = normalizeFieldOptions(secondaryFieldOptions);
    const normalizedTableColumnOptions = normalizeTableColumnOptions(tableColumnOptions);
    const normalizedScopeParamOptions = normalizeScopeParamOptions(scopeParamOptions);
    const normalizedDatasetOptions = (Array.isArray(datasetOptions) ? datasetOptions : [])
        .map((option) => {
            const value = normalizeString(option?.value ?? option?.id);
            if (!value) {
                return null;
            }
            return {
                value,
                valueFieldOptions: normalizeFieldOptions(option?.valueFieldOptions),
                secondaryFieldOptions: normalizeFieldOptions(option?.secondaryFieldOptions),
                tableColumnOptions: normalizeTableColumnOptions(option?.columnOptions),
                chartFieldOptions: normalizeChartFieldOptions(
                    Array.isArray(option?.chartFieldOptions) && option.chartFieldOptions.length > 0
                        ? option.chartFieldOptions
                        : option?.columnOptions,
                ),
            };
        })
        .filter(Boolean);
    const datasetOptionsByValue = new Map(normalizedDatasetOptions.map((option) => [option.value, option]));
    const valueOptionIds = new Set(normalizedValueOptions.map((option) => option.value));
    const secondaryOptionIds = new Set(normalizedSecondaryOptions.map((option) => option.value));
    const tableColumnOptionIds = new Set(normalizedTableColumnOptions.map((option) => option.key));
    const datasetOptionIds = new Set(normalizedDatasetOptions.map((option) => option.value));
    const diagnostics = [];

    normalizedBlocks.forEach((block, index) => {
        const blockId = normalizeString(block?.id || `documentBlock_${index + 1}`);
        const blockTitle = formatDocumentBlockTitle(block);
        const normalizedKind = normalizeString(block?.kind);
        const datasetResolution = resolveDocumentBlockDatasetRefResolution(
            normalizeString(block?.datasetRef),
            normalizedDatasetOptions,
        );
        const normalizedDatasetRef = datasetResolution.datasetRef;
        const datasetOption = datasetOptionsByValue.get(normalizedDatasetRef) || null;
        const effectiveValueOptionIds = datasetOption
            ? new Set((datasetOption.valueFieldOptions || []).map((option) => option.value))
            : valueOptionIds;
        const effectiveSecondaryOptionIds = datasetOption
            ? new Set((datasetOption.secondaryFieldOptions || []).map((option) => option.value))
            : secondaryOptionIds;
        const effectiveTableColumnOptions = datasetOption?.tableColumnOptions?.length > 0
            ? datasetOption.tableColumnOptions
            : normalizedTableColumnOptions;
        const effectiveTableColumnOptionIds = new Set(effectiveTableColumnOptions.map((option) => option.key));
        const effectiveChartFieldOptions = datasetOption?.chartFieldOptions?.length > 0
            ? datasetOption.chartFieldOptions
            : normalizeChartFieldOptions(chartFieldOptions);
        if (normalizedDatasetRef && normalizedDatasetRef !== "primary" && datasetOptionIds.size > 0 && !datasetOptionIds.has(normalizedDatasetRef)) {
            diagnostics.push({
                id: `documentBlockDatasetUnavailable:${blockId}:${normalizedDatasetRef}`,
                code: "documentBlockDatasetUnavailable",
                severity: "error",
                blockId,
                path: `reportDocument.blocks.${blockId}.datasetRef`,
                message: `${blockTitle} references unavailable data source '${normalizedDatasetRef}'.`,
                suggestedFix: "Edit the authored block to bind it to one of the current data sources or re-import the missing static dataset.",
            });
        }
        if (normalizedKind === "filterBarBlock") {
            const datasetScopedOptions = datasetOption
                ? normalizeScopeParamOptions(datasetOption.scopeParamOptions)
                : [];
            const effectiveScopeParamOptions = datasetScopedOptions.length > 0
                ? datasetScopedOptions
                : ((normalizedDatasetRef === "primary" || datasetResolution.source === "singleAvailable") ? normalizedScopeParamOptions : []);
            const effectiveScopeParamOptionIds = new Set(effectiveScopeParamOptions.map((option) => option.value));
            (Array.isArray(block?.paramIds) ? block.paramIds : []).forEach((paramId, paramIndex) => {
                const normalizedParamId = normalizeString(paramId);
                if (!normalizedParamId || effectiveScopeParamOptionIds.has(normalizedParamId)) {
                    return;
                }
                diagnostics.push({
                    id: `documentBlockScopeParamUnavailable:${blockId}:${normalizedParamId}`,
                    code: "documentBlockScopeParamUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.paramIds[${paramIndex}]`,
                    message: `${blockTitle} references unavailable report filter '${normalizedParamId}'.`,
                    suggestedFix: "Edit the filter bar block to use one of the current available report filters or remove the authored block.",
                });
            });
            return;
        }
        if (normalizedKind === "chartBlock") {
            const normalizedChartSpec = normalizeReportBuilderChartSpec(block?.chartSpec || {});
            if (!normalizedChartSpec) {
                diagnostics.push({
                    id: `documentBlockChartSpecMissing:${blockId}`,
                    code: "documentBlockChartSpecMissing",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.chartSpec`,
                    message: `${blockTitle} does not define a compatible chart specification.`,
                    suggestedFix: "Edit the chart block and reapply a valid authored chart.",
                });
                return;
            }
            const chartValidation = validateReportBuilderChartSpec(
                chartConfig && typeof chartConfig === "object" && !Array.isArray(chartConfig)
                    ? chartConfig
                    : {},
                normalizedChartSpec,
                effectiveChartFieldOptions,
            );
            chartValidation.errors.forEach((entry, errorIndex) => {
                diagnostics.push({
                    id: `documentBlockChartInvalid:${blockId}:${normalizeString(entry?.field || "chartSpec")}:${errorIndex + 1}`,
                    code: "documentBlockChartInvalid",
                    severity: "error",
                    blockId,
                    path: formatChartBlockDiagnosticPath(blockId, entry),
                    message: `${blockTitle} is no longer compatible with the current builder. ${formatChartBlockValidationMessage({
                        ...entry,
                        chartSpec: normalizedChartSpec,
                    }, effectiveChartFieldOptions)}`,
                    suggestedFix: "Edit the chart block to use one of the current builder fields or restore the missing chart fields in the builder.",
                });
            });
            return;
        }
        if (normalizedKind === "geoMapBlock") {
            const geo = block?.geo && typeof block.geo === "object" && !Array.isArray(block.geo)
                ? block.geo
                : {};
            const metric = geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)
                ? geo.metric
                : {};
            const normalizedKey = normalizeString(geo?.key);
            const normalizedLabelKey = normalizeString(geo?.labelKey);
            const normalizedMetricKey = normalizeString(metric?.key);
            const dimensionOptionIds = new Set(
                effectiveTableColumnOptions
                    .filter((option) => normalizeString(option?.kind) === "dimension")
                    .map((option) => option.key),
            );
            const measureOptionIds = new Set(
                effectiveTableColumnOptions
                    .filter((option) => normalizeString(option?.kind) === "measure")
                    .map((option) => option.key),
            );
            if (normalizedKey && !dimensionOptionIds.has(normalizedKey)) {
                diagnostics.push({
                    id: `documentBlockGeoKeyUnavailable:${blockId}:${normalizedKey}`,
                    code: "documentBlockGeoKeyUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.geo.key`,
                    message: `${blockTitle} references unavailable geo key field '${normalizedKey}'.`,
                    suggestedFix: "Edit the geo block to use one of the current available breakdowns or restore the missing field in the builder.",
                });
            }
            if (normalizedLabelKey && !dimensionOptionIds.has(normalizedLabelKey)) {
                diagnostics.push({
                    id: `documentBlockGeoLabelUnavailable:${blockId}:${normalizedLabelKey}`,
                    code: "documentBlockGeoLabelUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.geo.labelKey`,
                    message: `${blockTitle} references unavailable geo label field '${normalizedLabelKey}'.`,
                    suggestedFix: "Edit the geo block to use one of the current available breakdowns or clear the optional label field.",
                });
            }
            if (normalizedMetricKey && !measureOptionIds.has(normalizedMetricKey)) {
                diagnostics.push({
                    id: `documentBlockGeoMetricUnavailable:${blockId}:${normalizedMetricKey}`,
                    code: "documentBlockGeoMetricUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.geo.metric.key`,
                    message: `${blockTitle} references unavailable geo metric field '${normalizedMetricKey}'.`,
                    suggestedFix: "Edit the geo block to use one of the current available measures or restore the missing measure in the builder.",
                });
            }
            return;
        }
        if (normalizedKind === "kpiBlock") {
            const valueField = normalizeString(block?.valueField);
            const secondaryField = normalizeString(block?.secondaryField);
            if (valueField && !effectiveValueOptionIds.has(valueField)) {
                diagnostics.push({
                    id: `documentBlockValueFieldUnavailable:${blockId}`,
                    code: "documentBlockValueFieldUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.valueField`,
                    message: `${blockTitle} references unavailable KPI value field '${valueField}'.`,
                    suggestedFix: "Edit the KPI block to use one of the current available measures or restore the missing measure in the builder.",
                });
            }
            if (secondaryField && !effectiveSecondaryOptionIds.has(secondaryField)) {
                diagnostics.push({
                    id: `documentBlockSecondaryFieldUnavailable:${blockId}`,
                    code: "documentBlockSecondaryFieldUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.secondaryField`,
                    message: `${blockTitle} references unavailable KPI secondary field '${secondaryField}'.`,
                    suggestedFix: "Edit the KPI block to use one of the current available breakdowns or restore the missing field in the builder.",
                });
            }
            return;
        }
        if (normalizedKind === "collectionBlock") {
            const itemTitleField = normalizeString(block?.itemTitleField);
            const valueField = normalizeString(block?.valueField);
            const secondaryField = normalizeString(block?.secondaryField);
            if (itemTitleField && !effectiveSecondaryOptionIds.has(itemTitleField)) {
                diagnostics.push({
                    id: `documentBlockCollectionTitleFieldUnavailable:${blockId}`,
                    code: "documentBlockCollectionTitleFieldUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.itemTitleField`,
                    message: `${blockTitle} references unavailable collection title field '${itemTitleField}'.`,
                    suggestedFix: "Edit the collection block to use one of the current available breakdowns or restore the missing field in the builder.",
                });
            }
            if (valueField && !effectiveValueOptionIds.has(valueField)) {
                diagnostics.push({
                    id: `documentBlockCollectionValueFieldUnavailable:${blockId}`,
                    code: "documentBlockCollectionValueFieldUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.valueField`,
                    message: `${blockTitle} references unavailable collection value field '${valueField}'.`,
                    suggestedFix: "Edit the collection block to use one of the current available measures or clear the value field.",
                });
            }
            if (secondaryField && !effectiveSecondaryOptionIds.has(secondaryField)) {
                diagnostics.push({
                    id: `documentBlockCollectionSecondaryFieldUnavailable:${blockId}`,
                    code: "documentBlockCollectionSecondaryFieldUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.secondaryField`,
                    message: `${blockTitle} references unavailable collection secondary field '${secondaryField}'.`,
                    suggestedFix: "Edit the collection block to use one of the current available breakdowns or clear the secondary field.",
                });
            }
            return;
        }
        if (normalizedKind === "badgesBlock") {
            const items = normalizeReportBuilderBadgeItems(block?.items);
            if (items.length === 0) {
                diagnostics.push({
                    id: `documentBlockBadgesEmpty:${blockId}`,
                    code: "documentBlockBadgesEmpty",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.items`,
                    message: `${blockTitle} does not define any pills.`,
                    suggestedFix: "Edit the pills block and add at least one visible pill.",
                });
            }
            items.forEach((item, itemIndex) => {
                const valueField = normalizeString(item?.valueField);
                if (!valueField || effectiveTableColumnOptionIds.has(valueField)) {
                    return;
                }
                diagnostics.push({
                    id: `documentBlockBadgeValueFieldUnavailable:${blockId}:${valueField}`,
                    code: "documentBlockBadgeValueFieldUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.items[${itemIndex}].valueField`,
                    message: `${blockTitle} references unavailable pill field '${valueField}'.`,
                    suggestedFix: "Edit the pills block to use one of the current available fields or clear the field-backed value.",
                });
            });
            return;
        }
        if (normalizedKind === "tableBlock") {
            const columns = (Array.isArray(block?.columns) ? block.columns : [])
                .filter((column) => column && typeof column === "object" && !Array.isArray(column));
            if (columns.length === 0) {
                diagnostics.push({
                    id: `documentBlockTableEmpty:${blockId}`,
                    code: "documentBlockTableEmpty",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.columns`,
                    message: `${blockTitle} does not define any table fields.`,
                    suggestedFix: "Edit the table block and apply at least one current dimension or measure.",
                });
                return;
            }
            columns.forEach((column, columnIndex) => {
                const columnKey = normalizeString(column?.key);
                if (!columnKey || effectiveTableColumnOptionIds.has(columnKey)) {
                    return;
                }
                diagnostics.push({
                    id: `documentBlockColumnUnavailable:${blockId}:${columnKey}`,
                    code: "documentBlockColumnUnavailable",
                    severity: "error",
                    blockId,
                    path: `reportDocument.blocks.${blockId}.columns[${columnIndex}]`,
                    message: `${blockTitle} references unavailable table column '${columnKey}'.`,
                    suggestedFix: "Edit the table block to use one of the current available fields or restore the missing field in the builder.",
                });
            });
        }
    });

    return diagnostics;
}

export function buildReportBuilderDocumentBlockFieldOptions({
    document = null,
    config = null,
    state = null,
    currentSourceRef = "",
} = {}) {
    const reportBuilderBlock = resolveReportBuilderBlock(document);
    const embeddedConfig = config && typeof config === "object" && !Array.isArray(config)
        ? cloneValue(config)
        : (reportBuilderBlock?.config && typeof reportBuilderBlock.config === "object" && !Array.isArray(reportBuilderBlock.config)
            ? cloneValue(reportBuilderBlock.config)
            : null);
    const effectiveState = state && typeof state === "object" && !Array.isArray(state)
        ? cloneValue(state)
        : (reportBuilderBlock?.state && typeof reportBuilderBlock.state === "object" && !Array.isArray(reportBuilderBlock.state)
            ? cloneValue(reportBuilderBlock.state)
            : null);
    const builderContext = resolveReportDocumentBuilderContext(document, embeddedConfig, effectiveState);
    const resolvedConfig = builderContext?.config || null;
    if (!resolvedConfig) {
        return {
            valueFieldOptions: [],
            secondaryFieldOptions: [],
            tableColumnOptions: [],
            scopeParamOptions: [],
            chartFieldOptions: [],
            supportedChartTypes: [],
            chartConfig: null,
        };
    }
    const normalizedState = builderContext?.state && typeof builderContext.state === "object" && !Array.isArray(builderContext.state)
        ? builderContext.state
        : {};
    const calculatedFieldConfig = buildReportBuilderCalculatedFieldConfig(resolvedConfig, normalizedState);
    return buildReportBuilderDocumentBlockFieldOptionsFromPreparedConfig({
        config: calculatedFieldConfig,
        state: normalizedState,
        currentSourceRef: normalizeString(currentSourceRef || reportBuilderBlock?.source?.dataSourceRef || calculatedFieldConfig?.dataSourceRef),
    });
}

export function buildReportBuilderDocumentBlockFieldOptionsFromPreparedConfig({
    config = null,
    state = null,
    currentSourceRef = "",
} = {}) {
    const preparedConfig = config && typeof config === "object" && !Array.isArray(config)
        ? cloneValue(config)
        : null;
    const normalizedState = state && typeof state === "object" && !Array.isArray(state)
        ? cloneValue(state)
        : {};
    if (!preparedConfig) {
        return {
            valueFieldOptions: [],
            secondaryFieldOptions: [],
            tableColumnOptions: [],
            scopeParamOptions: [],
            filterBarGroupOptions: [],
            datasetOptions: [],
            chartFieldOptions: [],
            supportedChartTypes: [],
            chartConfig: null,
            chartState: null,
        };
    }
    const scopeParamOptions = resolveReportBuilderScopeParamFilters(preparedConfig)
        .map((filter) => {
            const value = normalizeString(filter?.id || filter?.field);
            if (!value) {
                return null;
            }
            return {
                value,
                label: normalizeString(filter?.label || value),
                ...(normalizeString(filter?.description) ? { description: normalizeString(filter.description) } : {}),
                kind: normalizeString(filter?.type || (filter?.multiple ? "multiSelect" : "value")) || "value",
                required: filter?.required === true,
            };
        })
        .filter(Boolean);
    const availableDimensions = buildAvailableAuthoringDimensions(preparedConfig, normalizedState);
    const availableMeasures = buildAvailableAuthoringMeasures(preparedConfig, normalizedState);
    const tableColumnOptions = [
        ...availableDimensions.map((dimension) => ({
            key: dimension.id,
            sourceKey: normalizeString(dimension.sourceKey || dimension.id) || dimension.id,
            displayKey: normalizeString(dimension.displayKey || dimension.sourceKey || dimension.id) || dimension.id,
            ...(dimension.displayValueMap ? { displayValueMap: cloneValue(dimension.displayValueMap) } : {}),
            ...(dimension.rawId ? { rawId: dimension.rawId } : {}),
            label: dimension.label,
            kind: dimension.kind,
            selected: dimension.selected === true,
            ...(dimension.format ? { format: dimension.format } : {}),
            ...(dimension.description ? { description: dimension.description } : {}),
            ...(dimension.category ? { category: dimension.category } : {}),
            ...(dimension.definitionRef ? { definitionRef: dimension.definitionRef } : {}),
            ...(dimension.semanticRef ? { semanticRef: dimension.semanticRef } : {}),
            ...(dimension.governance ? { governance: cloneValue(dimension.governance) } : {}),
        })),
        ...availableMeasures.map((measure) => ({
            key: measure.id,
            sourceKey: normalizeString(measure.sourceKey || measure.id) || measure.id,
            displayKey: normalizeString(measure.displayKey || measure.sourceKey || measure.id) || measure.id,
            ...(measure.displayValueMap ? { displayValueMap: cloneValue(measure.displayValueMap) } : {}),
            ...(measure.rawId ? { rawId: measure.rawId } : {}),
            label: measure.label,
            kind: measure.kind,
            ...(measure.calculated ? { calculated: true } : {}),
            selected: measure.selected === true,
            ...(measure.format ? { format: measure.format } : {}),
            ...(measure.description ? { description: measure.description } : {}),
            ...(measure.category ? { category: measure.category } : {}),
            ...(measure.definitionRef ? { definitionRef: measure.definitionRef } : {}),
            ...(measure.semanticRef ? { semanticRef: measure.semanticRef } : {}),
            ...(measure.governance ? { governance: cloneValue(measure.governance) } : {}),
        })),
    ].filter((option) => option.key);
    const valueFieldOptions = availableMeasures
        .map((measure) => ({
            value: measure.id,
            ...(measure.rawId ? { rawId: measure.rawId } : {}),
            label: measure.label,
            ...(measure.format ? { format: measure.format } : {}),
            ...(measure.description ? { description: measure.description } : {}),
            ...(measure.category ? { category: measure.category } : {}),
            ...(measure.definitionRef ? { definitionRef: measure.definitionRef } : {}),
            ...(measure.semanticRef ? { semanticRef: measure.semanticRef } : {}),
            ...(measure.governance ? { governance: cloneValue(measure.governance) } : {}),
        }))
        .filter((option) => option.value);
    const secondaryFieldOptions = availableDimensions
        .map((dimension) => ({
            value: dimension.id,
            ...(dimension.rawId ? { rawId: dimension.rawId } : {}),
            label: dimension.label,
            ...(dimension.format ? { format: dimension.format } : {}),
            ...(dimension.description ? { description: dimension.description } : {}),
            ...(dimension.category ? { category: dimension.category } : {}),
            ...(dimension.definitionRef ? { definitionRef: dimension.definitionRef } : {}),
            ...(dimension.semanticRef ? { semanticRef: dimension.semanticRef } : {}),
            ...(dimension.governance ? { governance: cloneValue(dimension.governance) } : {}),
        }))
        .filter((option) => option.value);
    const chartFieldOptions = buildReportBuilderChartFields(preparedConfig, buildAuthoringChartState(preparedConfig, normalizedState));
    const chartState = buildAuthoringChartState(preparedConfig, normalizedState);
    const dynamicFilterFamilies = resolveReportBuilderDynamicFilterFamilies(preparedConfig);
    const filterBarGroupOptions = [
        ...scopeParamOptions.map((option) => ({
            value: option.value,
            label: option.label,
            kind: "scopeParam",
            description: option.description,
            required: option.required === true,
        })),
        ...dynamicFilterFamilies.map((family) => ({
            value: normalizeString(family?.id),
            label: normalizeString(family?.label || family?.id),
            kind: "filterFamily",
            description: normalizeString(family?.description),
            required: false,
        })).filter((option) => option.value),
    ];
    const datasetOptions = buildReportBuilderDatasetOptions({
        currentSourceRef: normalizeString(currentSourceRef || preparedConfig?.dataSourceRef),
        configuredSources: preparedConfig?.dataSources,
        configuredDatasets: preparedConfig?.datasets,
        staticDatasets: normalizedState?.reportStaticDatasets,
        tableColumnOptions,
        valueFieldOptions,
        secondaryFieldOptions,
        chartFieldOptions,
        scopeParamOptions,
        filterBarGroupOptions,
    });
    return {
        valueFieldOptions,
        secondaryFieldOptions,
        tableColumnOptions,
        scopeParamOptions,
        filterBarGroupOptions,
        datasetOptions,
        chartFieldOptions,
        supportedChartTypes: getReportBuilderSupportedChartTypes(preparedConfig),
        chartConfig: cloneValue(preparedConfig),
        chartState: cloneValue(chartState),
    };
}

export function buildReportBuilderDocumentCompileDiagnostics({
    document = null,
    config = null,
    state = null,
} = {}) {
    const blocks = document
        ? normalizeReportBuilderDocumentBlocks(
            (Array.isArray(document?.blocks) ? document.blocks : [])
                .filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock"),
        )
        : normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks);
    if (blocks.length === 0) {
        return [];
    }
    const fieldOptions = buildReportBuilderDocumentBlockFieldOptions({
        document,
        config,
        state,
    });
    return buildReportBuilderDocumentBlockDiagnostics(blocks, fieldOptions);
}

export function buildReportBuilderDocumentCompileValidation(diagnostics = []) {
    const normalizedDiagnostics = (Array.isArray(diagnostics) ? diagnostics : [])
        .filter((diagnostic) => diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic));
    const blockingDiagnostics = normalizedDiagnostics
        .filter((diagnostic) => normalizeString(diagnostic?.severity).toLowerCase() === "error");
    return {
        valid: blockingDiagnostics.length === 0,
        diagnostics: normalizedDiagnostics,
        blockingDiagnostics,
        message: blockingDiagnostics.length > 0
            ? "Resolve authored block validation issues before preparing writable ReportDocument payloads."
            : "",
    };
}

function buildNextDocumentState(baseState = {}, blocks = [], layout = null) {
    const nextState = cloneValue(baseState && typeof baseState === "object" && !Array.isArray(baseState) ? baseState : {});
    const normalizedBlocks = normalizeReportBuilderDocumentBlocks(blocks);
    if (normalizedBlocks.length === 0) {
        delete nextState.reportDocumentBlocks;
        delete nextState.reportDocumentLayout;
        return nextState;
    }
    const normalizedLayout = normalizeReportBuilderDocumentLayoutState(layout, normalizedBlocks);
    nextState.reportDocumentBlocks = normalizedBlocks;
    nextState.reportDocumentLayout = normalizedLayout;
    return nextState;
}

export function upsertReportBuilderDocumentBlockState(state = {}, draft = null, {
    editingId = "",
    insertionAfterId = "",
    insertionPlacement = "after",
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    tableColumnOptions = [],
    childBlockOptions = [],
    scopeParamOptions = [],
    chartConfig = null,
    chartFieldOptions = [],
} = {}) {
    const validation = validateReportBuilderDocumentBlockDraft(draft, {
        valueFieldOptions,
        secondaryFieldOptions,
        tableColumnOptions,
        childBlockOptions,
        scopeParamOptions,
        chartConfig,
        chartFieldOptions,
    });
    if (!validation.valid) {
        return {
            valid: false,
            errors: validation.errors,
            nextState: cloneValue(state),
            block: null,
        };
    }
    const currentBlocks = resolveReportBuilderDocumentBlockList(state);
    const normalizedCurrentLayout = normalizeReportBuilderDocumentLayoutState(
        state?.reportDocumentLayout,
        normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks),
    );
    const layoutItemIndex = buildDocumentLayoutItemIndex(normalizedCurrentLayout?.items);
    const currentPrimaryIndex = resolveDocumentPrimaryIndex(
        normalizedCurrentLayout?.items,
        new Set(currentBlocks.map((block) => normalizeString(block?.id)).filter(Boolean)),
    );
    const normalizedEditingId = normalizeString(editingId);
    const normalizedInsertionAfterId = normalizeString(insertionAfterId);
    const normalizedInsertionPlacement = normalizeString(insertionPlacement).toLowerCase() === "before"
        ? "before"
        : "after";
    const normalizedKind = normalizeString(draft?.kind);
    let normalizedBlock = null;
    if (normalizedKind === "filterBarBlock") {
        normalizedBlock = buildReportDocumentFilterBarBlock(draft);
    } else if (normalizedKind === "refinementBarBlock") {
        normalizedBlock = buildReportDocumentRefinementBarBlock(draft);
    } else if (normalizedKind === "chartBlock") {
        normalizedBlock = buildReportDocumentChartBlock(draft);
    } else if (normalizedKind === "geoMapBlock") {
        normalizedBlock = buildReportDocumentGeoMapBlock(draft);
    } else if (normalizedKind === "kpiBlock") {
        normalizedBlock = buildReportDocumentKpiBlock(draft);
    } else if (normalizedKind === "collectionBlock") {
        normalizedBlock = buildReportDocumentCollectionBlock(draft);
    } else if (normalizedKind === "sectionBlock") {
        normalizedBlock = buildReportDocumentSectionBlock(draft);
    } else if (normalizedKind === "compositeBlock") {
        normalizedBlock = buildReportDocumentCompositeBlock(draft);
    } else if (normalizedKind === "tabGroupBlock") {
        normalizedBlock = buildReportDocumentTabGroupBlock(draft);
    } else if (normalizedKind === "stepperBlock") {
        normalizedBlock = buildReportDocumentStepperBlock(draft);
    } else if (normalizedKind === "infoPanelBlock") {
        normalizedBlock = buildReportDocumentInfoPanelBlock(draft);
    } else if (normalizedKind === "calloutBlock") {
        normalizedBlock = buildReportDocumentCalloutBlock(draft);
    } else if (normalizedKind === "kanbanBlock") {
        normalizedBlock = buildReportDocumentKanbanBlock(draft);
    } else if (normalizedKind === "timelineBlock") {
        normalizedBlock = buildReportDocumentTimelineBlock(draft);
    } else if (normalizedKind === "badgesBlock") {
        normalizedBlock = buildReportDocumentBadgesBlock({
            ...draft,
            items: normalizeReportBuilderBadgeItems(draft?.items).map((item) => {
                const parsedRules = parseReportBuilderBadgeRuleRows(item?.rulesText || "");
                return {
                    ...item,
                    ...(parsedRules.valid && parsedRules.rules.length > 0 ? { rules: parsedRules.rules } : {}),
                };
            }),
        });
    } else if (normalizedKind === "tableBlock") {
        const normalizedColumnOptions = normalizeTableColumnOptions(tableColumnOptions);
        const optionIndex = new Map(normalizedColumnOptions.map((option) => [option.key, option]));
        const existingColumns = new Map(
            (Array.isArray(draft?.columns) ? draft.columns : [])
                .filter((column) => column && typeof column === "object" && !Array.isArray(column))
                .map((column) => [normalizeString(column?.key), cloneValue(column)]),
        );
        const columnVisualKinds = normalizeColumnVisualKinds(draft?.columnVisualKinds);
        const columnVisualRuleTexts = normalizeColumnVisualRuleTexts(draft?.columnVisualRuleTexts);
        normalizedBlock = buildReportDocumentTableBlock({
            ...draft,
            columns: normalizeStringArray(draft?.columnKeys)
                .map((columnKey) => {
                    const existing = existingColumns.get(columnKey);
                    const option = optionIndex.get(columnKey);
                    const baseColumn = existing
                        ? existing
                        : option
                            ? {
                                key: option.key,
                                ...(option.sourceKey ? { sourceKey: option.sourceKey } : {}),
                                ...(option.displayKey ? { displayKey: option.displayKey } : {}),
                                ...(option.displayValueMap ? { displayValueMap: cloneValue(option.displayValueMap) } : {}),
                                label: option.label,
                                ...(option.format ? { format: option.format } : {}),
                            }
                            : { key: columnKey };
                    const visualKind = normalizeString(columnVisualKinds[columnKey]);
                    if (visualKind === "dataBar") {
                        return {
                            ...baseColumn,
                            cellVisual: {
                                kind: "dataBar",
                                valueField: columnKey,
                                range: { mode: "columnMax" },
                                palette: ["#dbeafe", "#2563eb"],
                            },
                        };
                    }
                    if (visualKind === "progressBar") {
                        return {
                            ...baseColumn,
                            cellVisual: {
                                kind: "progressBar",
                                valueField: columnKey,
                                range: { mode: "columnMax" },
                                palette: ["#e5edf5", "#2f6de1"],
                            },
                        };
                    }
                    if (visualKind === "sparkBar") {
                        return {
                            ...baseColumn,
                            cellVisual: {
                                kind: "sparkBar",
                                valueField: columnKey,
                                range: { mode: "columnMax" },
                                palette: ["#eef2f6", "#4c6fff"],
                            },
                        };
                    }
                    if (visualKind === "shareBar") {
                        const parsed = parseVisualRulesText("shareBar", columnVisualRuleTexts[columnKey] || "");
                        if (parsed.valid) {
                            return {
                                ...baseColumn,
                                cellVisual: {
                                    kind: "shareBar",
                                    segments: parsed.segments,
                                },
                            };
                        }
                        if (baseColumn?.cellVisual) {
                            const nextColumn = cloneValue(baseColumn);
                            delete nextColumn.cellVisual;
                            return nextColumn;
                        }
                        return baseColumn;
                    }
                    if (visualKind === "delta") {
                        return {
                            ...baseColumn,
                            cellVisual: {
                                kind: "delta",
                                valueField: columnKey,
                            },
                        };
                    }
                    if (visualKind === "rank") {
                        return {
                            ...baseColumn,
                            cellVisual: {
                                kind: "rank",
                                valueField: columnKey,
                            },
                        };
                    }
                    if (visualKind === "badge") {
                        const parsed = parseVisualRulesText("badge", columnVisualRuleTexts[columnKey] || "");
                        if (parsed.valid) {
                            return {
                                ...baseColumn,
                                cellVisual: {
                                    kind: "badge",
                                    rules: parsed.rules,
                                },
                            };
                        }
                        if (baseColumn?.cellVisual) {
                            const nextColumn = cloneValue(baseColumn);
                            delete nextColumn.cellVisual;
                            return nextColumn;
                        }
                        return baseColumn;
                    }
                    if (visualKind === "tone") {
                        const parsed = parseVisualRulesText("tone", columnVisualRuleTexts[columnKey] || "");
                        if (parsed.valid) {
                            return {
                                ...baseColumn,
                                cellVisual: {
                                    kind: "tone",
                                    rules: parsed.rules,
                                },
                            };
                        }
                        if (baseColumn?.cellVisual) {
                            const nextColumn = cloneValue(baseColumn);
                            delete nextColumn.cellVisual;
                            return nextColumn;
                        }
                        return baseColumn;
                    }
                    if (baseColumn?.cellVisual) {
                        const nextColumn = cloneValue(baseColumn);
                        delete nextColumn.cellVisual;
                        return nextColumn;
                    }
                    return baseColumn;
                }),
        });
    } else {
        normalizedBlock = buildReportDocumentMarkdownBlock(draft);
    }
    const targetId = normalizeString(normalizedEditingId || normalizedBlock?.id);
    const existingIndex = currentBlocks.findIndex((block) => normalizeString(block?.id) === targetId);
    const nextBlocks = [...currentBlocks];
    let nextPrimaryIndex = currentPrimaryIndex;
    if (existingIndex >= 0) {
        nextBlocks[existingIndex] = normalizedBlock;
    } else if (normalizedInsertionAfterId) {
        const insertionAfterPrimary = normalizedInsertionAfterId === "primaryBuilder";
        if (insertionAfterPrimary) {
            nextBlocks.splice(currentPrimaryIndex, 0, normalizedBlock);
            if (normalizedInsertionPlacement === "before") {
                nextPrimaryIndex = currentPrimaryIndex + 1;
            }
        } else {
            const afterIndex = currentBlocks.findIndex((block) => normalizeString(block?.id) === normalizedInsertionAfterId);
            if (afterIndex === -1) {
                nextBlocks.push(normalizedBlock);
            } else {
                const nextIndex = normalizedInsertionPlacement === "before"
                    ? afterIndex
                    : afterIndex + 1;
                nextBlocks.splice(nextIndex, 0, normalizedBlock);
                const insertionBeforePrimary = afterIndex < currentPrimaryIndex;
                if (insertionBeforePrimary) {
                    nextPrimaryIndex += 1;
                }
            }
        }
    } else {
        nextBlocks.push(normalizedBlock);
    }
    const nextState = buildNextDocumentState(
        state,
        nextBlocks,
        {
            type: normalizedCurrentLayout?.type || "stack",
            items: buildLayoutItemsFromAuthoredOrder(
                nextBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
                nextPrimaryIndex,
                layoutItemIndex,
            ),
        },
    );
    return {
        valid: true,
        errors: [],
        nextState,
        block: normalizedBlock,
        created: existingIndex === -1,
    };
}

export function removeReportBuilderDocumentBlockState(state = {}, blockId = "") {
    const normalizedBlockId = normalizeString(blockId);
    if (!normalizedBlockId) {
        return cloneValue(state);
    }
    const currentBlocks = normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks);
    const nextBlocks = currentBlocks.filter((block) => normalizeString(block?.id) !== normalizedBlockId);
    return buildNextDocumentState(state, nextBlocks, state?.reportDocumentLayout);
}

export function duplicateReportBuilderDocumentBlockState(state = {}, blockId = "") {
    const normalizedBlockId = normalizeString(blockId);
    if (!normalizedBlockId) {
        return {
            valid: false,
            nextState: cloneValue(state),
            block: null,
        };
    }
    const currentBlocks = resolveReportBuilderDocumentBlockList(state);
    const currentIndex = currentBlocks.findIndex((block) => normalizeString(block?.id) === normalizedBlockId);
    if (currentIndex === -1) {
        return {
            valid: false,
            nextState: cloneValue(state),
            block: null,
        };
    }
    const sourceBlock = currentBlocks[currentIndex];
    const normalizedKind = normalizeString(sourceBlock?.kind);
    if (!["filterBarBlock", "refinementBarBlock", "chartBlock", "geoMapBlock", "kpiBlock", "collectionBlock", "sectionBlock", "compositeBlock", "tabGroupBlock", "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock", "badgesBlock", "markdownBlock", "tableBlock"].includes(normalizedKind)) {
        return {
            valid: false,
            nextState: cloneValue(state),
            block: null,
        };
    }
    const duplicatedSeed = cloneValue(sourceBlock);
    duplicatedSeed.id = resolveUniqueDocumentBlockId(
        currentBlocks,
        `${normalizeString(sourceBlock?.id || normalizedKind || "documentBlock")}Copy`,
    );
    duplicatedSeed.title = resolveUniqueDocumentBlockTitle(
        currentBlocks,
        `${formatDocumentBlockTitle(sourceBlock)} Copy`,
    );
    const duplicatedBlock = normalizedKind === "filterBarBlock"
        ? buildReportDocumentFilterBarBlock(duplicatedSeed)
        : normalizedKind === "refinementBarBlock"
            ? buildReportDocumentRefinementBarBlock(duplicatedSeed)
            : normalizedKind === "chartBlock"
                ? buildReportDocumentChartBlock(duplicatedSeed)
            : normalizedKind === "geoMapBlock"
                    ? buildReportDocumentGeoMapBlock(duplicatedSeed)
            : normalizedKind === "kpiBlock"
                ? buildReportDocumentKpiBlock(duplicatedSeed)
                : normalizedKind === "collectionBlock"
                    ? buildReportDocumentCollectionBlock(duplicatedSeed)
                : normalizedKind === "sectionBlock"
                    ? buildReportDocumentSectionBlock(duplicatedSeed)
                : normalizedKind === "stepperBlock"
                    ? buildReportDocumentStepperBlock(duplicatedSeed)
                : normalizedKind === "infoPanelBlock"
                    ? buildReportDocumentInfoPanelBlock(duplicatedSeed)
                : normalizedKind === "calloutBlock"
                    ? buildReportDocumentCalloutBlock(duplicatedSeed)
                : normalizedKind === "kanbanBlock"
                    ? buildReportDocumentKanbanBlock(duplicatedSeed)
                : normalizedKind === "timelineBlock"
                    ? buildReportDocumentTimelineBlock(duplicatedSeed)
                : normalizedKind === "badgesBlock"
                    ? buildReportDocumentBadgesBlock(duplicatedSeed)
                : normalizedKind === "tableBlock"
                    ? buildReportDocumentTableBlock(duplicatedSeed)
                    : buildReportDocumentMarkdownBlock(duplicatedSeed);
    const reorderedBlocks = [...currentBlocks];
    reorderedBlocks.splice(currentIndex + 1, 0, duplicatedBlock);
    const normalizedCurrentLayout = normalizeReportBuilderDocumentLayoutState(
        state?.reportDocumentLayout,
        normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks),
    );
    const layoutItemIndex = buildDocumentLayoutItemIndex(normalizedCurrentLayout?.items);
    const currentPrimaryIndex = resolveDocumentPrimaryIndex(
        normalizedCurrentLayout?.items,
        new Set(reorderedBlocks.map((block) => normalizeString(block?.id)).filter(Boolean)),
    );
    const nextPrimaryIndex = currentIndex < currentPrimaryIndex
        ? currentPrimaryIndex + 1
        : currentPrimaryIndex;
    const duplicatedLayoutItem = layoutItemIndex.get(normalizedBlockId);
    if (duplicatedLayoutItem) {
        layoutItemIndex.set(duplicatedBlock.id, {
            ...duplicatedLayoutItem,
            blockId: duplicatedBlock.id,
        });
    }
    return {
        valid: true,
        nextState: buildNextDocumentState(
            state,
            reorderedBlocks,
            {
                type: normalizedCurrentLayout?.type || "stack",
                items: buildLayoutItemsFromAuthoredOrder(
                    reorderedBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
                    nextPrimaryIndex,
                    layoutItemIndex,
                ),
            },
        ),
        block: duplicatedBlock,
    };
}

export function resizeReportBuilderDocumentBlockState(state = {}, blockId = "", size = "full") {
    const normalizedBlockId = normalizeString(blockId);
    if (!normalizedBlockId) {
        return cloneValue(state);
    }
    const currentBlocks = resolveReportBuilderDocumentBlockList(state);
    if (!currentBlocks.some((block) => normalizeString(block?.id) === normalizedBlockId)) {
        return cloneValue(state);
    }
    const normalizedCurrentLayout = normalizeReportBuilderDocumentLayoutState(
        state?.reportDocumentLayout,
        normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks),
    );
    const layoutItemIndex = buildDocumentLayoutItemIndex(normalizedCurrentLayout?.items);
    const normalizedSpan = resolveReportLayoutSpan(size);
    if (normalizedSpan < 12) {
        layoutItemIndex.set(normalizedBlockId, {
            blockId: normalizedBlockId,
            span: normalizedSpan,
        });
    } else {
        layoutItemIndex.delete(normalizedBlockId);
    }
    const primaryIndex = resolveDocumentPrimaryIndex(
        normalizedCurrentLayout?.items,
        new Set(currentBlocks.map((block) => normalizeString(block?.id)).filter(Boolean)),
    );
    return buildNextDocumentState(
        state,
        currentBlocks,
        {
            type: normalizedCurrentLayout?.type || "stack",
            items: buildLayoutItemsFromAuthoredOrder(
                currentBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
                primaryIndex,
                layoutItemIndex,
            ),
        },
    );
}

export function moveReportBuilderDocumentBlockState(state = {}, blockId = "", direction = "up") {
    const normalizedBlockId = normalizeString(blockId);
    if (!normalizedBlockId) {
        return cloneValue(state);
    }
    const currentBlocks = resolveReportBuilderDocumentBlockList(state);
    const currentIndex = currentBlocks.findIndex((block) => normalizeString(block?.id) === normalizedBlockId);
    if (currentIndex === -1) {
        return cloneValue(state);
    }
    const delta = normalizeString(direction).toLowerCase() === "down" ? 1 : -1;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= currentBlocks.length) {
        return cloneValue(state);
    }
    const reorderedBlocks = [...currentBlocks];
    const [movedBlock] = reorderedBlocks.splice(currentIndex, 1);
    reorderedBlocks.splice(nextIndex, 0, movedBlock);
    const normalizedCurrentLayout = normalizeReportBuilderDocumentLayoutState(
        state?.reportDocumentLayout,
        normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks),
    );
    const layoutItemIndex = buildDocumentLayoutItemIndex(normalizedCurrentLayout?.items);
    const primaryIndex = resolveDocumentPrimaryIndex(
        normalizedCurrentLayout?.items,
        new Set(reorderedBlocks.map((block) => normalizeString(block?.id)).filter(Boolean)),
    );
    return buildNextDocumentState(
        state,
        reorderedBlocks,
        {
            type: normalizedCurrentLayout?.type || "stack",
            items: buildLayoutItemsFromAuthoredOrder(
                reorderedBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
                primaryIndex,
                layoutItemIndex,
            ),
        },
    );
}

export function moveReportBuilderDocumentBlockRelativeState(state = {}, blockId = "", targetBlockId = "", placement = "before") {
    const normalizedBlockId = normalizeString(blockId);
    const normalizedTargetBlockId = normalizeString(targetBlockId);
    const normalizedPlacement = normalizeString(placement).toLowerCase() === "after"
        ? "after"
        : "before";
    if (!normalizedBlockId || !normalizedTargetBlockId || normalizedBlockId === normalizedTargetBlockId) {
        return cloneValue(state);
    }
    const currentBlocks = resolveReportBuilderDocumentBlockList(state);
    const currentIndex = currentBlocks.findIndex((block) => normalizeString(block?.id) === normalizedBlockId);
    const targetIndex = currentBlocks.findIndex((block) => normalizeString(block?.id) === normalizedTargetBlockId);
    if (currentIndex === -1 || targetIndex === -1) {
        return cloneValue(state);
    }
    const reorderedBlocks = [...currentBlocks];
    const [movedBlock] = reorderedBlocks.splice(currentIndex, 1);
    const reducedTargetIndex = reorderedBlocks.findIndex((block) => normalizeString(block?.id) === normalizedTargetBlockId);
    if (!movedBlock || reducedTargetIndex === -1) {
        return cloneValue(state);
    }
    reorderedBlocks.splice(
        normalizedPlacement === "after" ? reducedTargetIndex + 1 : reducedTargetIndex,
        0,
        movedBlock,
    );
    const normalizedCurrentLayout = normalizeReportBuilderDocumentLayoutState(
        state?.reportDocumentLayout,
        normalizeReportBuilderDocumentBlocks(state?.reportDocumentBlocks),
    );
    const layoutItemIndex = buildDocumentLayoutItemIndex(normalizedCurrentLayout?.items);
    const primaryIndex = resolveDocumentPrimaryIndex(
        normalizedCurrentLayout?.items,
        new Set(reorderedBlocks.map((block) => normalizeString(block?.id)).filter(Boolean)),
    );
    return buildNextDocumentState(
        state,
        reorderedBlocks,
        {
            type: normalizedCurrentLayout?.type || "stack",
            items: buildLayoutItemsFromAuthoredOrder(
                reorderedBlocks.map((block) => normalizeString(block?.id)).filter(Boolean),
                primaryIndex,
                layoutItemIndex,
            ),
        },
    );
}
