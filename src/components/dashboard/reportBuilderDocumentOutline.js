import {
    buildReportBuilderScopeParamSummary,
    resolveReportBuilderDocumentWidthLabels,
    summarizeReportBuilderDocumentMarkdown,
} from "./reportBuilderDocumentBlocks.js";
import { chartTypeLabel } from "./reportBuilderChartRules.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function shouldShowReportBuilderSelectedSemanticBinding(entryKind = "") {
    const normalizedKind = normalizeString(entryKind);
    return new Set([
        "primaryBuilder",
        "chartView",
        "tableView",
        "chartBlock",
        "tableBlock",
        "kpiBlock",
        "collectionBlock",
        "sectionBlock",
        "compositeBlock",
        "tabGroupBlock",
        "stepperBlock",
        "infoPanelBlock",
        "calloutBlock",
        "kanbanBlock",
        "timelineBlock",
        "badgesBlock",
        "geoMapBlock",
        "filterBarBlock",
        "refinementBarBlock",
        "drillHierarchy",
        "drillPlaceholder",
    ]).has(normalizedKind);
}

export function isReportBuilderScopeRuntimeOnlyOutlineKind(entryKind = "") {
    const normalizedKind = normalizeString(entryKind);
    return new Set([
        "filterBarBlock",
        "refinementBarBlock",
        "drillHierarchy",
        "drillPlaceholder",
    ]).has(normalizedKind);
}

export function resolveReportBuilderSelectedInsertionGroupIds(entryKind = "") {
    const normalizedKind = normalizeString(entryKind);
    if (!normalizedKind) {
        return ["document"];
    }
    if (new Set(["primaryBuilder", "chartView", "tableView"]).has(normalizedKind)) {
        return ["document", "runtime"];
    }
    if (new Set(["drillHierarchy", "drillPlaceholder", "filterBarBlock", "refinementBarBlock", "geoMapBlock"]).has(normalizedKind)) {
        return ["runtime"];
    }
    if (new Set(["markdownBlock", "chartBlock", "tableBlock", "kpiBlock", "collectionBlock", "sectionBlock", "compositeBlock", "tabGroupBlock", "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock", "badgesBlock"]).has(normalizedKind)) {
        return ["document"];
    }
    return ["document"];
}

export function resolveReportBuilderSelectedDrillBindings({
    selectedEntryId = "",
    hierarchies = [],
    detailBindings = [],
} = {}) {
    const normalizedEntryId = normalizeString(selectedEntryId);
    const match = /^primaryBuilder:drill:(.+)$/.exec(normalizedEntryId);
    if (!match || match[1] === "new") {
        return {
            hierarchy: null,
            bindings: [],
            missingFieldRefs: [],
        };
    }
    const hierarchyId = normalizeString(match[1]);
    const hierarchy = (Array.isArray(hierarchies) ? hierarchies : [])
        .find((entry) => normalizeString(entry?.id) === hierarchyId) || null;
    if (!hierarchy) {
        return {
            hierarchy: null,
            bindings: [],
            missingFieldRefs: [],
        };
    }
    const levelFieldRefs = new Set(
        (Array.isArray(hierarchy?.levels) ? hierarchy.levels : [])
            .map((level) => normalizeString(level?.field))
            .filter(Boolean),
    );
    const bindings = (Array.isArray(detailBindings) ? detailBindings : [])
        .filter((binding) => levelFieldRefs.has(normalizeString(binding?.fieldRef)));
    return {
        hierarchy,
        bindings,
        missingFieldRefs: Array.from(levelFieldRefs).filter((fieldRef) => (
            !bindings.some((binding) => normalizeString(binding?.fieldRef) === fieldRef)
        )),
    };
}

export function resolveReportBuilderPreferredSelectedEntryId(entries = [], {
    currentSelectedEntryId = "",
    preferChartView = false,
    preferTableView = false,
} = {}) {
    const flattenedEntries = flattenReportBuilderDocumentOutlineEntries(entries);
    if (flattenedEntries.length === 0) {
        return "";
    }
    const entryIds = new Set(flattenedEntries.map((entry) => entry.id));
    const normalizedCurrentSelectedEntryId = normalizeString(currentSelectedEntryId);
    const chartViewEntry = flattenedEntries.find((entry) => normalizeString(entry?.kind) === "chartView") || null;
    const tableViewEntry = flattenedEntries.find((entry) => normalizeString(entry?.kind) === "tableView") || null;
    if (preferChartView && chartViewEntry && (!normalizedCurrentSelectedEntryId || normalizedCurrentSelectedEntryId === "primaryBuilder")) {
        return chartViewEntry.id;
    }
    if (preferTableView && tableViewEntry && (!normalizedCurrentSelectedEntryId || normalizedCurrentSelectedEntryId === "primaryBuilder")) {
        return tableViewEntry.id;
    }
    if (normalizedCurrentSelectedEntryId && entryIds.has(normalizedCurrentSelectedEntryId)) {
        return normalizedCurrentSelectedEntryId;
    }
    return chartViewEntry?.id && preferChartView
        ? chartViewEntry.id
        : (tableViewEntry?.id && preferTableView
            ? tableViewEntry.id
            : flattenedEntries[0].id);
}

export function flattenReportBuilderDocumentOutlineEntries(entries = [], {
    parentId = "",
    depth = 0,
} = {}) {
    return (Array.isArray(entries) ? entries : []).flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return [];
        }
        const normalizedEntry = {
            id: normalizeString(entry.id),
            kind: normalizeString(entry.kind),
            title: normalizeString(entry.title),
            summary: normalizeString(entry.summary),
            actionLabel: normalizeString(entry.actionLabel),
            datasetLabel: normalizeString(entry.datasetLabel),
            widthLabel: normalizeString(entry.widthLabel),
            parentId: normalizeString(parentId),
            depth: Math.max(0, Number(depth || 0) || 0),
        };
        if (!normalizedEntry.id || !normalizedEntry.kind || !normalizedEntry.title) {
            return [];
        }
        return [
            normalizedEntry,
            ...flattenReportBuilderDocumentOutlineEntries(entry.children, {
                parentId: normalizedEntry.id,
                depth: normalizedEntry.depth + 1,
            }),
        ];
    });
}

export function resolveReportBuilderDocumentInsertionTarget(entries = [], selectedEntryId = "") {
    const flattenedEntries = flattenReportBuilderDocumentOutlineEntries(entries);
    const entryIndex = new Map(
        flattenedEntries.map((entry) => [entry.id, entry]),
    );
    const fallbackEntry = entryIndex.get("primaryBuilder") || flattenedEntries[0] || null;
    const selectedEntry = entryIndex.get(normalizeString(selectedEntryId)) || fallbackEntry;
    if (!selectedEntry) {
        return {
            selectedEntryId: "",
            selectedTitle: "",
            insertionAfterId: "",
            insertionAnchorTitle: "",
        };
    }
    const normalizedKind = normalizeString(selectedEntry.kind);
    if (normalizedKind === "primaryBuilder" || normalizedKind === "chartView" || normalizedKind === "tableView") {
        return {
            selectedEntryId: selectedEntry.id,
            selectedTitle: selectedEntry.title,
            insertionAfterId: "primaryBuilder",
            insertionAnchorTitle: "",
        };
    }
    if (normalizedKind === "drillHierarchy" || normalizedKind === "drillPlaceholder") {
        const parentEntry = entryIndex.get(normalizeString(selectedEntry.parentId)) || fallbackEntry;
        const parentEntryId = normalizeString(parentEntry?.id || "primaryBuilder") || "primaryBuilder";
        return {
            selectedEntryId: selectedEntry.id,
            selectedTitle: selectedEntry.title,
            insertionAfterId: parentEntryId,
            insertionAnchorTitle: parentEntryId === "primaryBuilder"
                ? ""
                : (normalizeString(parentEntry?.title) || ""),
        };
    }
    return {
        selectedEntryId: selectedEntry.id,
        selectedTitle: selectedEntry.title,
        insertionAfterId: selectedEntry.id,
        insertionAnchorTitle: selectedEntry.title,
    };
}

export function buildReportBuilderDocumentOutlineEntries({
    authoredDocumentBlocks = [],
    authoredDocumentLayout = null,
    authoredDatasetOptions = [],
    primaryDatasetLabel = "",
    authoredScopeParamOptions = [],
    authoredDrillSummary = {},
    currentBreakdownDrillHierarchy = null,
    activeDataViewLabel = "",
    primaryResultChildren = [],
} = {}) {
    const blockIndex = new Map(
        (Array.isArray(authoredDocumentBlocks) ? authoredDocumentBlocks : [])
            .map((block) => [normalizeString(block?.id), block])
            .filter(([blockId]) => !!blockId),
    );
    const normalizedPrimaryChildren = (Array.isArray(primaryResultChildren) ? primaryResultChildren : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
            id: normalizeString(entry.id),
            kind: normalizeString(entry.kind),
            title: normalizeString(entry.title),
            summary: normalizeString(entry.summary),
            actionLabel: normalizeString(entry.actionLabel),
            datasetLabel: normalizeString(entry.datasetLabel),
            widthLabel: normalizeString(entry.widthLabel),
            children: Array.isArray(entry.children) ? entry.children : [],
        }))
        .filter((entry) => entry.id && entry.kind && entry.title);
    const authoredDatasetLabelIndex = new Map(
        (Array.isArray(authoredDatasetOptions) ? authoredDatasetOptions : [])
            .map((option) => {
                const datasetRef = normalizeString(option?.value ?? option?.id);
                const datasetLabel = normalizeString(option?.label);
                return datasetRef && datasetLabel ? [datasetRef, datasetLabel] : null;
            })
            .filter(Boolean),
    );
    const drillHierarchies = Array.isArray(authoredDrillSummary?.hierarchies)
        ? authoredDrillSummary.hierarchies
        : [];
    const buildDrillChildren = (ownerId = "", drillCapable = false) => {
        if (!drillCapable) {
            return [];
        }
        if (drillHierarchies.length > 0) {
            return drillHierarchies.map((hierarchy) => ({
                id: `${ownerId}:drill:${hierarchy.id}`,
                kind: "drillHierarchy",
                title: hierarchy.label,
                summary: hierarchy.summary,
                actionLabel: "Edit drill",
                widthLabel: "Drill branch",
                children: [],
            }));
        }
        return [{
            id: `${ownerId}:drill:new`,
            kind: "drillPlaceholder",
            title: "Add drill branch",
            summary: currentBreakdownDrillHierarchy
                ? `Current path ${currentBreakdownDrillHierarchy.levels.map((level) => level.label).join(" -> ")}`
                : "Capture a drill path to turn this result into a navigable node.",
            actionLabel: "Add drill",
            widthLabel: "Drill branch",
            children: [],
        }];
    };
    const authoredBlockIds = (Array.isArray(authoredDocumentBlocks) ? authoredDocumentBlocks : [])
        .map((block) => normalizeString(block?.id))
        .filter(Boolean);
    const layoutItems = Array.isArray(authoredDocumentLayout?.items) && authoredDocumentLayout.items.length > 0
        ? authoredDocumentLayout.items
        : [
            ...authoredBlockIds.map((blockId) => ({ blockId })),
            { blockId: "primaryBuilder" },
        ];
    return layoutItems.map((item) => {
        const blockId = normalizeString(item?.blockId);
        const widthLabels = resolveReportBuilderDocumentWidthLabels(item);
        if (blockId === "primaryBuilder") {
            return {
                id: "primaryBuilder",
                kind: "primaryBuilder",
                title: "Current data selection",
                summary: activeDataViewLabel ? `Uses ${activeDataViewLabel}.` : "Uses the active data view.",
                widthLabel: widthLabels.currentLabel,
                actionLabel: "Edit data",
                children: [
                    ...normalizedPrimaryChildren,
                    ...buildDrillChildren("primaryBuilder", true),
                ],
            };
        }
        const block = blockIndex.get(blockId);
        if (!block) {
            return null;
        }
        const normalizedKind = normalizeString(block?.kind);
        let summary = summarizeReportBuilderDocumentMarkdown(block?.markdown || "");
        if (normalizedKind === "tableBlock") {
            const columnCount = Array.isArray(block?.columns) ? block.columns.length : 0;
            summary = columnCount > 0 ? `${columnCount} ${columnCount === 1 ? "field" : "fields"}` : "No fields selected";
        } else if (normalizedKind === "chartBlock") {
            const chartSpec = block?.chartSpec && typeof block.chartSpec === "object" ? block.chartSpec : {};
            summary = [
                chartTypeLabel(chartSpec?.type || ""),
                chartSpec?.xField ? `X ${chartSpec.xField}` : "",
                Array.isArray(chartSpec?.yFields) && chartSpec.yFields.length > 0 ? `${chartSpec.yFields.length} measure${chartSpec.yFields.length === 1 ? "" : "s"}` : "",
            ].filter(Boolean).join(" • ") || "Chart block";
        } else if (normalizedKind === "kpiBlock") {
            summary = block?.valueLabel || block?.valueField || "KPI block";
        } else if (normalizedKind === "badgesBlock") {
            const itemCount = Array.isArray(block?.items) ? block.items.length : 0;
            summary = itemCount > 0 ? `${itemCount} ${itemCount === 1 ? "pill" : "pills"}` : "No pills";
        } else if (normalizedKind === "filterBarBlock") {
            summary = buildReportBuilderScopeParamSummary(block?.paramIds, authoredScopeParamOptions).text;
        } else if (normalizedKind === "refinementBarBlock") {
            const actionCount = Array.isArray(block?.actionKinds) ? block.actionKinds.length : 0;
            summary = actionCount > 0 ? `${actionCount} runtime action${actionCount === 1 ? "" : "s"}` : "No runtime actions";
        } else if (normalizedKind === "geoMapBlock") {
            const metricLabel = block?.geo?.metric?.label || block?.geo?.metric?.key || "Metric";
            summary = `${metricLabel} by ${block?.geo?.key || "region"}`;
        }
        const datasetRef = normalizeString(block?.datasetRef || "primary") || "primary";
        const datasetLabel = datasetRef === "primary"
            ? (normalizeString(primaryDatasetLabel) || authoredDatasetLabelIndex.get(datasetRef) || "")
            : (authoredDatasetLabelIndex.get(datasetRef) || "");
        return {
            id: blockId,
            kind: normalizedKind,
            title: normalizeString(block?.title || blockId) || blockId,
            summary,
            datasetLabel,
            widthLabel: widthLabels.currentLabel,
            actionLabel: "Edit block",
            children: [],
        };
    }).filter(Boolean);
}
