import { normalizeReportBuilderDrillMetadata } from "../../reporting/reportBuilderDrillMetadata.js";
import { summarizeReportBuilderDocumentMarkdown } from "./reportBuilderDocumentBlocks.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeStringArray(values = []) {
    return (Array.isArray(values) ? values : [])
        .map((value) => normalizeString(value))
        .filter(Boolean);
}

function toStartCase(value = "") {
    const normalized = normalizeString(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ");
    return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

function pluralize(count = 0, singular = "", plural = "") {
    if (count === 1) {
        return `${count} ${singular}`;
    }
    if (plural) {
        return `${count} ${plural}`;
    }
    if (/[^aeiou]y$/i.test(singular)) {
        return `${count} ${singular.slice(0, -1)}ies`;
    }
    return `${count} ${singular}s`;
}

function formatList(values = [], limit = 3) {
    const normalized = normalizeStringArray(values);
    if (normalized.length === 0) {
        return "";
    }
    if (normalized.length <= limit) {
        return normalized.join(", ");
    }
    return `${normalized.slice(0, limit).join(", ")}, +${normalized.length - limit} more`;
}

function resolveSummaryTitle(block = {}, fallback = "") {
    return normalizeString(block?.title || block?.id || fallback);
}

function resolveParamLabelLookup(options = []) {
    return new Map(
        (Array.isArray(options) ? options : [])
            .map((option) => {
                const value = normalizeString(option?.value || option?.id);
                if (!value) {
                    return null;
                }
                return [value, normalizeString(option?.label || value)];
            })
            .filter(Boolean),
    );
}

function summarizeMarkdownBlock(block = {}) {
    const title = resolveSummaryTitle(block, "Narrative");
    const preview = summarizeReportBuilderDocumentMarkdown(block?.markdown);
    return {
        kind: "markdownBlock",
        title,
        summary: preview,
    };
}

function summarizeTableBlock(block = {}) {
    const title = resolveSummaryTitle(block, "Detail Table");
    const columns = (Array.isArray(block?.columns) ? block.columns : [])
        .map((column) => normalizeString(column?.label || column?.key))
        .filter(Boolean);
    return {
        kind: "tableBlock",
        title,
        columnCount: columns.length,
        columns,
        summary: columns.length > 0
            ? `${pluralize(columns.length, "column")}: ${formatList(columns)}`
            : "No columns selected",
    };
}

function summarizeChartBlock(block = {}) {
    const title = resolveSummaryTitle(block, "Chart");
    const chartSpec = block?.chartSpec && typeof block.chartSpec === "object" && !Array.isArray(block.chartSpec)
        ? block.chartSpec
        : {};
    const chartType = normalizeString(chartSpec?.type);
    const xField = normalizeString(chartSpec?.xField);
    const yFields = normalizeStringArray(chartSpec?.yFields);
    const seriesField = normalizeString(chartSpec?.seriesField);
    const segments = [];
    if (chartType) {
        segments.push(`${toStartCase(chartType)} chart`);
    } else {
        segments.push("Chart");
    }
    if (xField) {
        segments.push(`by ${xField}`);
    }
    if (yFields.length > 0) {
        segments.push(`using ${formatList(yFields)}`);
    }
    if (seriesField) {
        segments.push(`split by ${seriesField}`);
    }
    return {
        kind: "chartBlock",
        title,
        chartType,
        xField,
        yFields,
        seriesField,
        summary: segments.join(" "),
    };
}

function summarizeKpiBlock(block = {}) {
    const title = resolveSummaryTitle(block, "Headline KPI");
    const valueLabel = normalizeString(block?.valueLabel || block?.valueField || "Value");
    const secondaryLabel = normalizeString(block?.secondaryLabel || block?.secondaryField);
    const description = normalizeString(block?.description);
    const segments = [valueLabel];
    if (secondaryLabel) {
        segments.push(`with ${secondaryLabel} context`);
    }
    if (description) {
        segments.push(`(${description})`);
    }
    return {
        kind: "kpiBlock",
        title,
        valueLabel,
        secondaryLabel,
        description,
        summary: segments.join(" "),
    };
}

function summarizeGeoMapBlock(block = {}) {
    const title = resolveSummaryTitle(block, "Geo Map");
    const geo = block?.geo && typeof block.geo === "object" && !Array.isArray(block.geo)
        ? block.geo
        : {};
    const shape = normalizeString(geo?.shape);
    const key = normalizeString(geo?.key);
    const metricLabel = normalizeString(geo?.metric?.label || geo?.metric?.key);
    const aggregate = normalizeString(geo?.aggregate);
    const segments = [];
    if (shape) {
        segments.push(`${toStartCase(shape)} map`);
    } else {
        segments.push("Geo map");
    }
    if (key) {
        segments.push(`by ${key}`);
    }
    if (metricLabel) {
        segments.push(`using ${metricLabel}`);
    }
    if (aggregate) {
        segments.push(`(${aggregate})`);
    }
    return {
        kind: "geoMapBlock",
        title,
        shape,
        key,
        metricLabel,
        aggregate,
        summary: segments.join(" "),
    };
}

function summarizeFilterBarBlock(block = {}, options = {}) {
    const title = resolveSummaryTitle(block, "Filters");
    const labelLookup = resolveParamLabelLookup(options?.scopeParamOptions);
    const paramIds = normalizeStringArray(block?.paramIds);
    const paramLabels = paramIds.map((paramId) => labelLookup.get(paramId) || paramId);
    return {
        kind: "filterBarBlock",
        title,
        paramCount: paramIds.length,
        paramIds,
        paramLabels,
        summary: paramIds.length > 0
            ? `${pluralize(paramIds.length, "report filter")}: ${formatList(paramLabels)}`
            : "No report filters",
    };
}

function summarizeRefinementBarBlock(block = {}) {
    const title = resolveSummaryTitle(block, "Active Refinements");
    const actionKinds = normalizeStringArray(block?.actionKinds);
    const actionLabels = actionKinds.map((kind) => toStartCase(kind));
    return {
        kind: "refinementBarBlock",
        title,
        actionKinds,
        actionCount: actionKinds.length,
        summary: actionKinds.length > 0
            ? `${pluralize(actionKinds.length, "refinement action")}: ${formatList(actionLabels)}`
            : "No refinement actions configured",
    };
}

export function summarizeReportBuilderAuthoredBlock(block = {}, options = {}) {
    const normalizedKind = normalizeString(block?.kind);
    const id = normalizeString(block?.id);
    let baseSummary = null;
    if (normalizedKind === "markdownBlock") {
        baseSummary = summarizeMarkdownBlock(block);
    } else if (normalizedKind === "tableBlock") {
        baseSummary = summarizeTableBlock(block);
    } else if (normalizedKind === "chartBlock") {
        baseSummary = summarizeChartBlock(block);
    } else if (normalizedKind === "kpiBlock") {
        baseSummary = summarizeKpiBlock(block);
    } else if (normalizedKind === "geoMapBlock") {
        baseSummary = summarizeGeoMapBlock(block);
    } else if (normalizedKind === "filterBarBlock") {
        baseSummary = summarizeFilterBarBlock(block, options);
    } else if (normalizedKind === "refinementBarBlock") {
        baseSummary = summarizeRefinementBarBlock(block);
    } else {
        baseSummary = {
            kind: normalizedKind || "unknown",
            title: resolveSummaryTitle(block, "Authored block"),
            summary: resolveSummaryTitle(block, toStartCase(normalizedKind || "authored block")),
        };
    }
    return {
        id,
        ...baseSummary,
    };
}

export function summarizeReportBuilderAuthoredBlocks(blocks = [], options = {}) {
    const items = (Array.isArray(blocks) ? blocks : [])
        .map((block) => summarizeReportBuilderAuthoredBlock(block, options))
        .filter((block) => normalizeString(block?.kind));
    const countsByKind = items.reduce((acc, item) => {
        const kind = normalizeString(item?.kind);
        if (!kind) {
            return acc;
        }
        acc[kind] = (acc[kind] || 0) + 1;
        return acc;
    }, {});
    const summaryParts = Object.entries(countsByKind)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([kind, count]) => `${count} ${toStartCase(kind.replace(/Block$/, ""))}`);
    return {
        totalCount: items.length,
        countsByKind,
        items,
        summary: items.length > 0
            ? `${pluralize(items.length, "authored block")}: ${summaryParts.join(", ")}`
            : "No authored blocks",
    };
}

function summarizeDrillHierarchy(hierarchy = {}) {
    const label = normalizeString(hierarchy?.label || hierarchy?.id || "Drill hierarchy");
    const levels = (Array.isArray(hierarchy?.levels) ? hierarchy.levels : [])
        .map((level) => normalizeString(level?.label || level?.field || level?.id))
        .filter(Boolean);
    return {
        id: normalizeString(hierarchy?.id),
        label,
        levelCount: levels.length,
        levels,
        summary: levels.length > 0
            ? `${pluralize(levels.length, "level")}: ${levels.join(" -> ")}`
            : "No drill levels",
    };
}

function summarizeDetailTarget(target = {}) {
    const targetRef = normalizeString(target?.targetRef);
    const label = normalizeString(target?.title || targetRef || "Detail target");
    const parameters = target?.parameters && typeof target.parameters === "object" && !Array.isArray(target.parameters)
        ? Object.keys(target.parameters).map((key) => normalizeString(key)).filter(Boolean)
        : [];
    return {
        targetRef,
        label,
        navigationMode: normalizeString(target?.navigationMode),
        parameterCount: parameters.length,
        parameters,
        summary: parameters.length > 0
            ? `${pluralize(parameters.length, "parameter")}: ${parameters.join(", ")}`
            : "No detail parameters",
    };
}

export function summarizeReportBuilderAuthoredDrillMetadata(config = {}) {
    const normalized = normalizeReportBuilderDrillMetadata(config);
    const hierarchies = normalized.hierarchies.map((hierarchy) => summarizeDrillHierarchy(hierarchy));
    const detailTargets = normalized.detailTargets.map((target) => summarizeDetailTarget(target));
    const hierarchyLevelCount = hierarchies.reduce((total, hierarchy) => total + hierarchy.levelCount, 0);
    const detailTargetParameterCount = detailTargets.reduce((total, target) => total + target.parameterCount, 0);
    const fieldActionCount = normalized.fieldActions.reduce(
        (total, entry) => total + ((Array.isArray(entry?.actions) ? entry.actions.length : 0)),
        0,
    );
    return {
        hierarchyCount: hierarchies.length,
        hierarchyLevelCount,
        detailTargetCount: detailTargets.length,
        detailTargetParameterCount,
        fieldActionCount,
        hierarchies,
        detailTargets,
        summary: [
            pluralize(hierarchies.length, "drill hierarchy"),
            pluralize(hierarchyLevelCount, "level"),
            pluralize(detailTargets.length, "detail target"),
            pluralize(fieldActionCount, "field action"),
        ].join(" • "),
    };
}
