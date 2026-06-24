import { normalizeDetailTarget, normalizeRefinementActions } from "../../reporting/drillMetadataProvider.js";
import { normalizeReportBuilderDrillHierarchy, normalizeReportBuilderDrillHierarchies } from "../../reporting/reportBuilderDrillHierarchy.js";
import { resolveReportBuilderDrillMetadata } from "../../reporting/reportBuilderDrillMetadata.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDrillMetadataOverride(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    const normalized = resolveReportBuilderDrillMetadata({}, value);
    return {
        ...(Object.prototype.hasOwnProperty.call(value, "hierarchies") ? { hierarchies: normalized.hierarchies } : {}),
        ...(Object.prototype.hasOwnProperty.call(value, "detailTargets") ? { detailTargets: normalized.detailTargets } : {}),
        ...(Object.prototype.hasOwnProperty.call(value, "fieldActions") ? { fieldActions: normalized.fieldActions } : {}),
    };
}

function sanitizeActionIdSegment(value = "") {
    return normalizeString(value).replace(/[^a-zA-Z0-9:_-]+/g, "_");
}

function normalizeFieldActionEntries(fieldActions = []) {
    return (Array.isArray(fieldActions) ? fieldActions : [])
        .map((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                return null;
            }
            const fieldRef = normalizeString(entry.fieldRef || entry.field || entry.id);
            if (!fieldRef) {
                return null;
            }
            return {
                fieldRef,
                actions: normalizeRefinementActions(entry.actions || entry.refinementActions || []),
            };
        })
        .filter(Boolean);
}

function normalizeDetailTargets(detailTargets = []) {
    return (Array.isArray(detailTargets) ? detailTargets : [])
        .map((entry) => normalizeDetailTarget(entry))
        .filter(Boolean);
}

function normalizeParameterRows(rows = []) {
    return (Array.isArray(rows) ? rows : [])
        .map((row) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
                return null;
            }
            const parameter = normalizeString(row.parameter || row.key);
            const valueKind = normalizeString(row.valueKind || row.kind || "runtimeValue") || "runtimeValue";
            const valueRef = String(row.valueRef || row.value || "").trim();
            if (!parameter) {
                return null;
            }
            if (!["runtimeValue", "rowField", "literal"].includes(valueKind)) {
                return null;
            }
            if ((valueKind === "rowField" || valueKind === "literal") && !valueRef) {
                return null;
            }
            return {
                parameter,
                valueKind,
                valueRef,
            };
        })
        .filter(Boolean);
}

export function buildReportBuilderDetailParameterDraftRow(id = "", overrides = {}) {
    const normalizedId = String(id || "").trim() || "detailParam";
    const valueKind = String(overrides?.valueKind || "runtimeValue").trim() || "runtimeValue";
    return {
        id: normalizedId,
        parameter: String(overrides?.parameter || "").trim(),
        valueKind: ["runtimeValue", "rowField", "literal"].includes(valueKind) ? valueKind : "runtimeValue",
        valueRef: String(overrides?.valueRef || "").trim(),
    };
}

export function normalizeReportBuilderDetailParameterDraftRows(rows = [], {
    fallbackId = "detailParam_0",
} = {}) {
    const normalized = (Array.isArray(rows) ? rows : [])
        .map((row, index) => buildReportBuilderDetailParameterDraftRow(row?.id || `${fallbackId}_${index}`, row))
        .filter((row) => String(row?.id || "").trim());
    return normalized.length > 0 ? normalized : [buildReportBuilderDetailParameterDraftRow(fallbackId)];
}

export function hasReportBuilderDetailParameterDraftContent(rows = []) {
    return normalizeReportBuilderDetailParameterDraftRows(rows).some((row) => {
        if (!String(row?.parameter || "").trim()) {
            return false;
        }
        if (row.valueKind === "runtimeValue") {
            return true;
        }
        return !!String(row?.valueRef || "").trim();
    });
}

export function buildReportBuilderDetailParameterDraftRowsFromParameters(parameters = {}, {
    fallbackId = "detailParam",
} = {}) {
    const entries = parameters && typeof parameters === "object" && !Array.isArray(parameters)
        ? Object.entries(parameters)
        : [];
    if (entries.length === 0) {
        return normalizeReportBuilderDetailParameterDraftRows([], { fallbackId });
    }
    return entries.map(([parameter, value], index) => {
        const normalizedValue = String(value || "").trim();
        const rowMatch = /^\$row\.(.+)$/.exec(normalizedValue);
        return buildReportBuilderDetailParameterDraftRow(`${fallbackId}_${index}`, {
            parameter,
            valueKind: normalizedValue === "$value"
                ? "runtimeValue"
                : (rowMatch ? "rowField" : "literal"),
            valueRef: rowMatch ? rowMatch[1] : (normalizedValue === "$value" ? "" : normalizedValue),
        });
    });
}

export function buildReportBuilderDrillHierarchyId(levels = []) {
    const fields = (Array.isArray(levels) ? levels : [])
        .map((level) => normalizeString(level?.field))
        .filter(Boolean);
    if (fields.length < 2) {
        return "";
    }
    return `hierarchy:${fields.join("::")}`;
}

export function buildReportBuilderDrillHierarchyFromDimensions(dimensions = [], {
    label = "",
} = {}) {
    const levels = (Array.isArray(dimensions) ? dimensions : [])
        .map((dimension) => {
            const field = normalizeString(dimension?.key || dimension?.id);
            const levelLabel = normalizeString(dimension?.label || field);
            if (!field || !levelLabel) {
                return null;
            }
            return {
                id: field,
                field,
                label: levelLabel,
            };
        })
        .filter(Boolean);
    if (levels.length < 2) {
        return null;
    }
    return normalizeReportBuilderDrillHierarchy({
        id: buildReportBuilderDrillHierarchyId(levels),
        label: normalizeString(label) || `${levels[0].label} Drill`,
        levels,
    });
}

function buildNextDrillMetadataOverride(existingOverride = {}, overrides = {}) {
    const base = normalizeDrillMetadataOverride(existingOverride);
    return {
        ...base,
        ...(Object.prototype.hasOwnProperty.call(overrides, "hierarchies")
            ? { hierarchies: normalizeReportBuilderDrillHierarchies(overrides.hierarchies) }
            : {}),
        ...(Object.prototype.hasOwnProperty.call(overrides, "detailTargets")
            ? { detailTargets: normalizeDetailTargets(overrides.detailTargets) }
            : {}),
        ...(Object.prototype.hasOwnProperty.call(overrides, "fieldActions")
            ? { fieldActions: normalizeFieldActionEntries(overrides.fieldActions) }
            : {}),
    };
}

export function upsertReportBuilderDrillHierarchyState(state = {}, hierarchy = {}, {
    currentHierarchies = null,
} = {}) {
    const normalizedHierarchy = normalizeReportBuilderDrillHierarchy(hierarchy);
    if (!normalizedHierarchy) {
        return cloneValue(state || {});
    }
    const nextState = cloneValue(state || {});
    const baseHierarchies = Array.isArray(currentHierarchies)
        ? normalizeReportBuilderDrillHierarchies(currentHierarchies)
        : normalizeReportBuilderDrillHierarchies(nextState?.drillMetadata?.hierarchies);
    const hierarchyIndex = baseHierarchies.findIndex((entry) => normalizeString(entry?.id) === normalizedHierarchy.id);
    const nextHierarchies = hierarchyIndex >= 0
        ? baseHierarchies.map((entry, index) => (index === hierarchyIndex ? normalizedHierarchy : entry))
        : [...baseHierarchies, normalizedHierarchy];
    nextState.drillMetadata = buildNextDrillMetadataOverride(nextState?.drillMetadata, {
        hierarchies: nextHierarchies,
    });
    return nextState;
}

export function removeReportBuilderDrillHierarchyState(state = {}, hierarchyId = "", {
    currentHierarchies = null,
} = {}) {
    const normalizedHierarchyId = normalizeString(hierarchyId);
    if (!normalizedHierarchyId) {
        return cloneValue(state || {});
    }
    const nextState = cloneValue(state || {});
    const baseHierarchies = Array.isArray(currentHierarchies)
        ? normalizeReportBuilderDrillHierarchies(currentHierarchies)
        : normalizeReportBuilderDrillHierarchies(nextState?.drillMetadata?.hierarchies);
    nextState.drillMetadata = buildNextDrillMetadataOverride(nextState?.drillMetadata, {
        hierarchies: baseHierarchies.filter((entry) => normalizeString(entry?.id) !== normalizedHierarchyId),
    });
    return nextState;
}

export function buildReportBuilderDetailTargetAction(field = {}, {
    targetRef = "",
    navigationMode = "hostRoute",
    parameterKey = "",
    parameters = null,
    title = "",
    description = "",
} = {}) {
    const fieldRef = normalizeString(field?.key || field?.id || field);
    const fieldLabel = normalizeString(field?.label || fieldRef);
    const normalizedTargetRef = normalizeString(targetRef);
    if (!fieldRef || !fieldLabel || !normalizedTargetRef) {
        return null;
    }
    const normalizedParameters = parameters && typeof parameters === "object" && !Array.isArray(parameters)
        ? Object.entries(parameters).reduce((acc, [key, value]) => {
            const normalizedKey = normalizeString(key);
            const normalizedValue = String(value || "").trim();
            if (!normalizedKey || !normalizedValue) {
                return acc;
            }
            acc[normalizedKey] = normalizedValue;
            return acc;
        }, {})
        : {};
    const normalizedParameterKey = normalizeString(parameterKey || fieldRef);
    const detailTarget = normalizeDetailTarget({
        targetRef: normalizedTargetRef,
        navigationMode: normalizeString(navigationMode) || "hostRoute",
        parameters: Object.keys(normalizedParameters).length > 0
            ? normalizedParameters
            : (normalizedParameterKey ? { [normalizedParameterKey]: "$value" } : {}),
        title: normalizeString(title) || `${fieldLabel} detail`,
        description: normalizeString(description),
    });
    if (!detailTarget) {
        return null;
    }
    return {
        detailTarget,
        fieldAction: {
            fieldRef,
            actions: normalizeRefinementActions([{
                id: `detail:${fieldRef}:${sanitizeActionIdSegment(normalizedTargetRef)}`,
                label: `Show ${fieldLabel} details`,
                kind: "detail",
                targetRef: detailTarget.targetRef,
            }]),
        },
    };
}

export function buildReportBuilderDetailTargetParameters(rows = [], fallbackFieldRef = "") {
    const normalizedRows = normalizeParameterRows(rows);
    if (normalizedRows.length === 0) {
        const normalizedFallbackFieldRef = normalizeString(fallbackFieldRef);
        return normalizedFallbackFieldRef
            ? { [normalizedFallbackFieldRef]: "$value" }
            : {};
    }
    return normalizedRows.reduce((acc, row) => {
        if (row.valueKind === "runtimeValue") {
            acc[row.parameter] = "$value";
        } else if (row.valueKind === "rowField") {
            acc[row.parameter] = `$row.${normalizeString(row.valueRef)}`;
        } else {
            acc[row.parameter] = row.valueRef;
        }
        return acc;
    }, {});
}

export function resolveReportBuilderDetailTargetDraftParameters(rows = [], fallbackFieldRef = "", existingParameters = null) {
    if (hasReportBuilderDetailParameterDraftContent(rows)) {
        return buildReportBuilderDetailTargetParameters(rows, fallbackFieldRef);
    }
    if (existingParameters && typeof existingParameters === "object" && !Array.isArray(existingParameters)) {
        return cloneValue(existingParameters);
    }
    return buildReportBuilderDetailTargetParameters([], fallbackFieldRef);
}

export function buildReportBuilderDetailTargetDraftFromBinding(binding = null, {
    fallbackIdPrefix = "detailParam",
} = {}) {
    if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
        return null;
    }
    return {
        fieldRef: normalizeString(binding?.fieldRef),
        targetRef: normalizeString(binding?.targetRef),
        navigationMode: normalizeString(binding?.target?.navigationMode || "hostRoute") || "hostRoute",
        title: normalizeString(binding?.target?.title),
        description: normalizeString(binding?.target?.description),
        parameterRows: buildReportBuilderDetailParameterDraftRowsFromParameters(binding?.target?.parameters, {
            fallbackId: `${String(fallbackIdPrefix || "detailParam").trim() || "detailParam"}`,
        }),
    };
}

export function buildReportBuilderDetailTargetDraftFromTarget(target = null, {
    fallbackIdPrefix = "detailParam",
} = {}) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
        return null;
    }
    return {
        targetRef: normalizeString(target?.targetRef),
        navigationMode: normalizeString(target?.navigationMode || "hostRoute") || "hostRoute",
        title: normalizeString(target?.title),
        description: normalizeString(target?.description),
        parameterRows: buildReportBuilderDetailParameterDraftRowsFromParameters(target?.parameters, {
            fallbackId: `${String(fallbackIdPrefix || "detailParam").trim() || "detailParam"}`,
        }),
    };
}

export function validateReportBuilderDetailTargetDraft({
    field = null,
    targetRef = "",
    parameterRows = [],
} = {}) {
    const errors = [];
    const normalizedFieldRef = normalizeString(field?.key || field?.id || field);
    const normalizedTargetRef = normalizeString(targetRef);
    const normalizedRows = normalizeReportBuilderDetailParameterDraftRows(parameterRows);
    if (!normalizedFieldRef) {
        errors.push({
            field: "fieldRef",
            code: "required",
            message: "Choose a breakdown field for the detail action.",
        });
    }
    if (!normalizedTargetRef) {
        errors.push({
            field: "targetRef",
            code: "required",
            message: "Enter a detail target reference.",
        });
    }
    const seenParameters = new Set();
    normalizedRows.forEach((row, index) => {
        const parameter = normalizeString(row?.parameter);
        const valueKind = normalizeString(row?.valueKind || "runtimeValue") || "runtimeValue";
        const valueRef = String(row?.valueRef || "").trim();
        const hasAnyValue = parameter || valueRef || valueKind !== "runtimeValue";
        if (!hasAnyValue) {
            return;
        }
        if (!parameter) {
            errors.push({
                field: `parameterRows.${index}.parameter`,
                code: "required",
                message: "Each configured detail parameter needs a parameter name.",
            });
            return;
        }
        if (seenParameters.has(parameter)) {
            errors.push({
                field: `parameterRows.${index}.parameter`,
                code: "duplicate",
                message: `Detail parameter '${parameter}' is defined more than once.`,
            });
        } else {
            seenParameters.add(parameter);
        }
        if ((valueKind === "rowField" || valueKind === "literal") && !valueRef) {
            errors.push({
                field: `parameterRows.${index}.valueRef`,
                code: "required",
                message: valueKind === "rowField"
                    ? `Choose a row field for detail parameter '${parameter}'.`
                    : `Enter a literal value for detail parameter '${parameter}'.`,
            });
        }
    });
    return {
        valid: errors.length === 0,
        errors,
        parameterRows: normalizedRows,
    };
}

export function upsertReportBuilderDetailTargetState(state = {}, {
    field = null,
    targetRef = "",
    replacedTargetRef = "",
    navigationMode = "hostRoute",
    parameterKey = "",
    parameters = null,
    title = "",
    description = "",
} = {}, {
    currentDetailTargets = null,
    currentFieldActions = null,
} = {}) {
    const normalizedEntry = buildReportBuilderDetailTargetAction(field, {
        targetRef,
        navigationMode,
        parameterKey,
        parameters,
        title,
        description,
    });
    if (!normalizedEntry) {
        return cloneValue(state || {});
    }
    const nextState = cloneValue(state || {});
    const baseDetailTargets = Array.isArray(currentDetailTargets)
        ? normalizeDetailTargets(currentDetailTargets)
        : normalizeDetailTargets(nextState?.drillMetadata?.detailTargets);
    const baseFieldActions = Array.isArray(currentFieldActions)
        ? normalizeFieldActionEntries(currentFieldActions)
        : normalizeFieldActionEntries(nextState?.drillMetadata?.fieldActions);
    const normalizedFieldRef = normalizeString(normalizedEntry.fieldAction.fieldRef);
    const normalizedReplacedTargetRef = normalizeString(replacedTargetRef);
    const detailTargetIndex = baseDetailTargets.findIndex(
        (entry) => normalizeString(entry?.targetRef) === normalizedEntry.detailTarget.targetRef,
    );
    const nextDetailTargets = detailTargetIndex >= 0
        ? baseDetailTargets.map((entry, index) => (index === detailTargetIndex ? normalizedEntry.detailTarget : entry))
        : [...baseDetailTargets, normalizedEntry.detailTarget];
    const nextFieldActions = baseFieldActions
        .map((entry) => ({
            fieldRef: normalizeString(entry?.fieldRef),
            actions: normalizeRefinementActions(
                (Array.isArray(entry?.actions) ? entry.actions : []).filter(
                    (action) => !(normalizeString(action?.kind) === "detail" && (
                        normalizeString(action?.targetRef) === normalizedEntry.detailTarget.targetRef
                        || (normalizedReplacedTargetRef && normalizeString(action?.targetRef) === normalizedReplacedTargetRef)
                    )),
                ),
            ),
        }))
        .map((entry) => (
            entry.fieldRef !== normalizedFieldRef
                ? entry
                : {
                    fieldRef: normalizedFieldRef,
                    actions: normalizeRefinementActions([
                        ...(entry.actions || []),
                        ...(normalizedEntry.fieldAction.actions || []),
                    ]),
                }
        ))
        .filter((entry) => Array.isArray(entry?.actions) && entry.actions.length > 0);
    if (!nextFieldActions.some((entry) => entry.fieldRef === normalizedFieldRef)) {
        nextFieldActions.push(normalizedEntry.fieldAction);
    }
    nextState.drillMetadata = buildNextDrillMetadataOverride(nextState?.drillMetadata, {
        detailTargets: nextDetailTargets,
        fieldActions: nextFieldActions,
    });
    return nextState;
}

export function removeReportBuilderDetailTargetState(state = {}, targetRef = "", {
    currentDetailTargets = null,
    currentFieldActions = null,
} = {}) {
    const normalizedTargetRef = normalizeString(targetRef);
    if (!normalizedTargetRef) {
        return cloneValue(state || {});
    }
    const nextState = cloneValue(state || {});
    const baseDetailTargets = Array.isArray(currentDetailTargets)
        ? normalizeDetailTargets(currentDetailTargets)
        : normalizeDetailTargets(nextState?.drillMetadata?.detailTargets);
    const baseFieldActions = Array.isArray(currentFieldActions)
        ? normalizeFieldActionEntries(currentFieldActions)
        : normalizeFieldActionEntries(nextState?.drillMetadata?.fieldActions);
    nextState.drillMetadata = buildNextDrillMetadataOverride(nextState?.drillMetadata, {
        detailTargets: baseDetailTargets.filter((entry) => normalizeString(entry?.targetRef) !== normalizedTargetRef),
        fieldActions: baseFieldActions
            .map((entry) => ({
                fieldRef: entry.fieldRef,
                actions: normalizeRefinementActions(
                    (Array.isArray(entry?.actions) ? entry.actions : []).filter(
                        (action) => normalizeString(action?.targetRef) !== normalizedTargetRef,
                    ),
                ),
            }))
            .filter((entry) => entry.actions.length > 0),
    });
    return nextState;
}
