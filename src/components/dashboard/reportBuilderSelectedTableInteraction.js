import { resolveKey } from "../../utils/selector.js";
import { dedupeRefinementActions } from "../../reporting/drillMetadataProvider.js";
import { resolveReportRuntimeFieldActionKey } from "./reportRuntimeModel.js";
import {
    buildReportRuntimeTableInteractionState,
    resolveReportRuntimeTableInteractionExecution,
} from "./reportRuntimeTableInteractionState.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function buildReportBuilderSelectedTableFields(columns = []) {
    return (Array.isArray(columns) ? columns : [])
        .map((column) => {
            const valueKey = normalizeString(column?.sourceKey || column?.key);
            if (!valueKey) {
                return null;
            }
            return {
                valueKey,
                displayValueKey: normalizeString(column?.displayKey || column?.sourceKey || column?.key) || valueKey,
                label: normalizeString(column?.label || valueKey) || valueKey,
                runtimeFilterable: column?.runtimeFilterable === true,
            };
        })
        .filter(Boolean);
}

export function buildReportBuilderSelectedTableProviderActionsByField({
    blockId = "",
    fields = [],
    drillMetadata = null,
    liveProviderActionsByField = null,
} = {}) {
    const normalizedBlockId = normalizeString(blockId);
    const fieldActions = Array.isArray(drillMetadata?.fieldActions) ? drillMetadata.fieldActions : [];
    const hierarchies = Array.isArray(drillMetadata?.hierarchies) ? drillMetadata.hierarchies : [];
    const nextProviderActionsByField = new Map();
    (Array.isArray(fields) ? fields : []).forEach((field) => {
        const providerActionKey = resolveReportRuntimeFieldActionKey(normalizedBlockId, field?.valueKey);
        if (liveProviderActionsByField instanceof Map && liveProviderActionsByField.has(providerActionKey)) {
            const liveActions = Array.isArray(liveProviderActionsByField.get(providerActionKey))
                ? liveProviderActionsByField.get(providerActionKey)
                : [];
            nextProviderActionsByField.set(
                providerActionKey,
                dedupeRefinementActions(liveActions),
            );
            return;
        }
        const matched = fieldActions.find((entry) => normalizeString(entry?.fieldRef) === normalizeString(field?.valueKey)) || null;
        const actions = Array.isArray(matched?.actions)
            ? matched.actions.filter((action) => {
                const kind = normalizeString(action?.kind).toLowerCase();
                return kind === "keep" || kind === "exclude" || kind === "drill" || kind === "detail";
            })
            : [];
        const derivedHierarchyActions = hierarchies
            .map((hierarchy) => {
                const levels = Array.isArray(hierarchy?.levels) ? hierarchy.levels : [];
                const currentLevelIndex = levels.findIndex((level) => normalizeString(level?.field) === normalizeString(field?.valueKey));
                if (currentLevelIndex === -1 || currentLevelIndex >= levels.length - 1) {
                    return null;
                }
                const nextLevel = levels[currentLevelIndex + 1];
                const nextFieldRef = normalizeString(nextLevel?.field);
                const nextLabel = normalizeString(nextLevel?.label || nextFieldRef);
                if (!nextFieldRef) {
                    return null;
                }
                return {
                    id: `drill:${normalizeString(field?.valueKey)}:${normalizeString(hierarchy?.id || nextFieldRef) || nextFieldRef}`,
                    label: `Drill to ${nextLabel}`,
                    kind: "drill",
                    nextFieldRef,
                };
            })
            .filter(Boolean);
        nextProviderActionsByField.set(
            providerActionKey,
            dedupeRefinementActions([
                ...derivedHierarchyActions,
                ...actions,
            ]),
        );
    });
    return nextProviderActionsByField;
}

export function buildReportBuilderSelectedTableRowSummary({
    row = null,
    fields = [],
} = {}) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
        return "";
    }
    const parts = (Array.isArray(fields) ? fields : [])
        .slice(0, 3)
        .map((field) => {
            const displayValue = resolveKey(row, field?.displayValueKey || field?.valueKey);
            if (displayValue === undefined || displayValue === null || displayValue === "") {
                return "";
            }
            return `${field.label}: ${String(displayValue)}`;
        })
        .filter(Boolean);
    return parts.join(" • ");
}

export function buildReportBuilderSelectedTableInteractionState({
    blockId = "",
    row = null,
    columns = [],
    drillMetadata = null,
    providerActionsByField = null,
} = {}) {
    const fields = buildReportBuilderSelectedTableFields(columns);
    if (!row || typeof row !== "object" || Array.isArray(row) || fields.length === 0) {
        return null;
    }
    const baseInteractionState = buildReportRuntimeTableInteractionState({
        blockId,
        fields,
        providerActionsByField: new Map(),
    });
    const resolvedProviderActionsByField = buildReportBuilderSelectedTableProviderActionsByField({
        blockId,
        fields,
        drillMetadata,
        liveProviderActionsByField: providerActionsByField,
    });
    const providerInteractionState = buildReportRuntimeTableInteractionState({
        blockId,
        fields,
        providerActionsByField: resolvedProviderActionsByField,
    });
    const providerKeepExcludeKeys = new Set(
        (Array.isArray(providerInteractionState?.actionEntries) ? providerInteractionState.actionEntries : [])
            .filter((entry) => {
                const kind = normalizeString(entry?.kind).toLowerCase();
                return kind === "keep" || kind === "exclude";
            })
            .map((entry) => `${normalizeString(entry?.kind).toLowerCase()}:${normalizeString(entry?.field?.valueKey)}`),
    );
    const seen = new Set();
    const mergedActionEntries = [
        ...(Array.isArray(baseInteractionState?.actionEntries) ? baseInteractionState.actionEntries : [])
            .filter((entry) => !providerKeepExcludeKeys.has(`${normalizeString(entry?.kind).toLowerCase()}:${normalizeString(entry?.field?.valueKey)}`)),
        ...(Array.isArray(providerInteractionState?.actionEntries) ? providerInteractionState.actionEntries : []),
    ];
    const actions = mergedActionEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        kind: entry.kind,
        publishSelection: entry.publishSelection,
        resolveExecution(item = {}) {
            return resolveReportRuntimeTableInteractionExecution({
                blockId,
                actionEntries: [entry],
                actionId: entry.id,
                item,
            });
        },
    })).filter((action) => {
        const id = normalizeString(action?.id);
        if (!id || seen.has(id)) {
            return false;
        }
        seen.add(id);
        return true;
    });
    return {
        ...providerInteractionState,
        fields,
        actionEntries: mergedActionEntries,
        actions,
        rowSummary: buildReportBuilderSelectedTableRowSummary({
            row,
            fields,
        }),
    };
}
