import {
    normalizeDetailTarget,
    normalizeRefinementActions,
} from "../../reporting/drillMetadataProvider.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function slugifySegment(value = "") {
    return normalizeString(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeRoutePrefix(value = "") {
    const normalized = normalizeString(value);
    if (!normalized) {
        return "";
    }
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export function mergeReportBuilderDetailTargets(...detailTargetSets) {
    const merged = [];
    const seen = new Set();
    detailTargetSets.forEach((detailTargets) => {
        (Array.isArray(detailTargets) ? detailTargets : [])
            .map((target) => normalizeDetailTarget(target))
            .filter(Boolean)
            .forEach((target) => {
                const targetRef = normalizeString(target?.targetRef);
                if (!targetRef || seen.has(targetRef)) {
                    return;
                }
                seen.add(targetRef);
                merged.push(target);
            });
    });
    return merged;
}

function inferRoutePrefix(detailTargets = [], fallbackPrefix = "target://example/performance/") {
    const prefixes = (Array.isArray(detailTargets) ? detailTargets : [])
        .map((target) => normalizeString(target?.targetRef))
        .map((targetRef) => {
            const separatorIndex = targetRef.lastIndexOf("/");
            return separatorIndex >= 0 ? normalizeRoutePrefix(targetRef.slice(0, separatorIndex + 1)) : "";
        })
        .filter(Boolean);
    return prefixes[0] || normalizeRoutePrefix(fallbackPrefix);
}

export function buildReportBuilderDetailTargetRouteSuggestions({
    field = null,
    detailTargets = [],
    fallbackPrefix = "target://example/performance/",
} = {}) {
    const fieldRef = normalizeString(field?.key || field?.id || field);
    const fieldLabel = normalizeString(field?.label || fieldRef);
    const prefix = inferRoutePrefix(detailTargets, fallbackPrefix);
    const suggestedSegment = slugifySegment(fieldLabel) || slugifySegment(fieldRef);
    const suggestions = [];
    const seen = new Set();
    const pushSuggestion = (entry = null) => {
        const targetRef = normalizeString(entry?.targetRef);
        if (!targetRef || seen.has(targetRef)) {
            return;
        }
        seen.add(targetRef);
        suggestions.push({
            targetRef,
            label: normalizeString(entry?.label || targetRef),
            description: normalizeString(entry?.description),
        });
    };
    if (fieldRef && fieldLabel && prefix && suggestedSegment) {
        pushSuggestion({
            targetRef: `${prefix}${suggestedSegment}-detail`,
            label: `Suggested ${fieldLabel} detail`,
            description: `Uses ${prefix} as the detail-target namespace.`,
        });
    }
    (Array.isArray(detailTargets) ? detailTargets : []).forEach((target) => {
        const targetRef = normalizeString(target?.targetRef);
        if (!targetRef) {
            return;
        }
        pushSuggestion({
            targetRef,
            label: normalizeString(target?.title || targetRef),
            description: normalizeString(target?.navigationMode),
        });
    });
    return suggestions;
}

export async function resolveReportBuilderProviderDetailTargetPresets({
    detailProvider = null,
    fieldRef = "",
    blockKind = "tableBlock",
    options = {},
} = {}) {
    const normalizedFieldRef = normalizeString(fieldRef);
    if (
        !normalizedFieldRef
        || typeof detailProvider?.listAvailableRefinements !== "function"
        || typeof detailProvider?.getDetailTarget !== "function"
    ) {
        return [];
    }
    const actions = normalizeRefinementActions(
        await detailProvider.listAvailableRefinements(blockKind, normalizedFieldRef, options),
    );
    const detailActions = actions.filter((action) => action.kind === "detail" && normalizeString(action?.targetRef));
    const detailTargets = await Promise.all(detailActions.map(async (action) => {
        const detailTarget = normalizeDetailTarget(
            await detailProvider.getDetailTarget(action.targetRef, {
                ...options,
                blockKind,
                fieldRef: normalizedFieldRef,
            }),
        );
        if (!detailTarget) {
            return null;
        }
        const fallbackTitle = normalizeString(action?.label);
        return {
            ...detailTarget,
            ...(normalizeString(detailTarget?.title) ? {} : (fallbackTitle ? { title: fallbackTitle } : {})),
        };
    }));
    return mergeReportBuilderDetailTargets(detailTargets);
}

export function resolveReportBuilderDetailTargetRoutePreset(detailTargets = [], targetRef = "") {
    const normalizedTargetRef = normalizeString(targetRef);
    if (!normalizedTargetRef) {
        return null;
    }
    const target = (Array.isArray(detailTargets) ? detailTargets : []).find(
        (entry) => normalizeString(entry?.targetRef) === normalizedTargetRef,
    );
    if (!target) {
        return null;
    }
    return {
        targetRef: normalizedTargetRef,
        navigationMode: normalizeString(target?.navigationMode),
        title: normalizeString(target?.title),
        description: normalizeString(target?.description),
        parameters: target?.parameters && typeof target.parameters === "object" && !Array.isArray(target.parameters)
            ? cloneValue(target.parameters)
            : {},
    };
}
