import {
    createSemanticModelProvider,
    hasSemanticModelProvider,
} from "../../semantic/modelProvider.js";
import { normalizeReportCalculatedFields } from "../../reporting/calculatedFieldModel.js";
import {
    normalizeSemanticBinding,
    validateSemanticBinding,
    validateSemanticModel,
} from "../../semantic/modelValidation.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function semanticLookupKeys(field = {}) {
    const keys = [
        normalizeString(field?.semanticRef),
        normalizeString(field?.id),
        normalizeString(field?.key),
    ].filter(Boolean);
    return Array.from(new Set(keys));
}

function semanticFieldId(field = {}) {
    return normalizeString(field?.semanticRef);
}

function isLocalComputedMeasure(field = {}) {
    return !!field
        && typeof field === "object"
        && !Array.isArray(field)
        && (
            (!!field.compute
                && typeof field.compute === "object"
                && !Array.isArray(field.compute))
            || normalizeString(field?.expr)
        )
        && !semanticFieldId(field);
}

function semanticSelectableMeasureFields(config = {}) {
    return [
        ...(Array.isArray(config?.measures) ? config.measures : []),
        ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []).filter((field) => !isLocalComputedMeasure(field)),
        ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []).filter((field) => !isLocalComputedMeasure(field)),
        ...(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []).filter((field) => !isLocalComputedMeasure(field)),
    ];
}

function buildSemanticFieldIndex(fields = []) {
    const index = new Map();
    (Array.isArray(fields) ? fields : []).forEach((field) => {
        semanticLookupKeys(field).forEach((key) => {
            if (!key || index.has(key)) {
                return;
            }
            index.set(key, field);
        });
    });
    return index;
}

function resolveSemanticField(index = new Map(), field = {}) {
    const keys = semanticLookupKeys(field);
    for (const key of keys) {
        if (index.has(key)) {
            return index.get(key);
        }
    }
    return null;
}

function buildSemanticSelectionIds(fields = [], selectedIds = []) {
    const fieldIndex = new Map(
        (Array.isArray(fields) ? fields : [])
            .map((field) => [normalizeString(field?.id || field?.key), field])
            .filter(([, field]) => !!field),
    );
    return Array.from(new Set(
        (Array.isArray(selectedIds) ? selectedIds : [])
            .map((id) => fieldIndex.get(normalizeString(id)))
            .map((field) => semanticFieldId(field))
            .filter(Boolean),
    ));
}

function buildSemanticSelectionRawIds(fields = [], selectedIds = []) {
    const fieldIndex = new Map(
        (Array.isArray(fields) ? fields : [])
            .map((field) => [normalizeString(field?.id || field?.key), field])
            .filter(([, field]) => !!field),
    );
    return Array.from(new Set(
        (Array.isArray(selectedIds) ? selectedIds : [])
            .map((id) => normalizeString(id))
            .filter(Boolean)
            .filter((id) => !!semanticFieldId(fieldIndex.get(id))),
    ));
}

function normalizeFieldSelectionIds(selectedIds = []) {
    return Array.from(new Set(
        (Array.isArray(selectedIds) ? selectedIds : [])
            .map((id) => normalizeString(id))
            .filter(Boolean),
    ));
}

function resolveGroupByDimensionId(config = {}, state = {}) {
    const groupByValue = normalizeString(state?.groupBy);
    if (!groupByValue) {
        return "";
    }
    const option = (Array.isArray(config?.groupBy?.options) ? config.groupBy.options : [])
        .find((entry) => normalizeString(entry?.value) === groupByValue);
    return normalizeString(option?.dimensionId || groupByValue);
}

function resolveTableCalculationDimensionIds(config = {}, state = {}) {
    const selectedMeasureIds = new Set(normalizeFieldSelectionIds(state?.selectedMeasures));
    const calculations = [
        ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []),
        ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []),
        ...(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []),
    ].filter((field) => selectedMeasureIds.has(normalizeString(field?.id || field?.key)));
    const next = [];
    calculations.forEach((field) => {
        const compute = field?.compute && typeof field.compute === "object" ? field.compute : {};
        [
            ...(Array.isArray(compute.partitionBy) ? compute.partitionBy : []),
            ...(Array.isArray(compute.orderBy) ? compute.orderBy.map((entry) => entry?.field) : []),
        ].forEach((fieldKey) => {
            const normalizedFieldKey = normalizeString(fieldKey);
            if (!normalizedFieldKey) {
                return;
            }
            const dimension = (Array.isArray(config?.dimensions) ? config.dimensions : [])
                .find((entry) => semanticLookupKeys(entry).includes(normalizedFieldKey));
            const dimensionId = normalizeString(dimension?.id || dimension?.key);
            if (dimensionId && !next.includes(dimensionId)) {
                next.push(dimensionId);
            }
        });
    });
    return next;
}

function resolveLocalCalculatedFieldDependencies(config = {}, state = {}) {
    const selectedMeasureIds = new Set(normalizeFieldSelectionIds(state?.selectedMeasures));
    const localCalculatedFields = normalizeReportCalculatedFields([
        ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []),
        ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []),
        ...(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []),
    ]).filter((field) => isLocalComputedMeasure(field));
    const calculatedFieldIndex = new Map();
    localCalculatedFields.forEach((field) => {
        [normalizeString(field?.id), normalizeString(field?.key)].filter(Boolean).forEach((alias) => {
            if (!calculatedFieldIndex.has(alias)) {
                calculatedFieldIndex.set(alias, field);
            }
        });
    });

    const measureIds = new Set();
    const dimensionIds = new Set();
    const visited = new Set();
    const resolveDependency = (fieldKey = "") => {
        const normalizedFieldKey = normalizeString(fieldKey);
        if (!normalizedFieldKey || visited.has(normalizedFieldKey)) {
            return;
        }
        visited.add(normalizedFieldKey);
        const measure = (Array.isArray(config?.measures) ? config.measures : [])
            .find((entry) => semanticLookupKeys(entry).includes(normalizedFieldKey));
        if (measure) {
            const measureId = normalizeString(measure?.id || measure?.key);
            if (measureId) {
                measureIds.add(measureId);
            }
            return;
        }
        const dimension = (Array.isArray(config?.dimensions) ? config.dimensions : [])
            .find((entry) => semanticLookupKeys(entry).includes(normalizedFieldKey));
        if (dimension) {
            const dimensionId = normalizeString(dimension?.id || dimension?.key);
            if (dimensionId) {
                dimensionIds.add(dimensionId);
            }
            return;
        }
        const calculatedField = calculatedFieldIndex.get(normalizedFieldKey);
        if (calculatedField) {
            (calculatedField.dependencies || []).forEach((dependencyId) => {
                resolveDependency(dependencyId);
            });
        }
    };

    localCalculatedFields
        .filter((field) => selectedMeasureIds.has(normalizeString(field?.id || field?.key)))
        .forEach((field) => {
            (field.dependencies || []).forEach((dependencyId) => {
                resolveDependency(dependencyId);
            });
        });

    return {
        measureIds: Array.from(measureIds),
        dimensionIds: Array.from(dimensionIds),
    };
}

function resolveSemanticSelectedDimensions(config = {}, state = {}) {
    const ids = normalizeFieldSelectionIds(state?.selectedDimensions);
    const groupByDimensionId = resolveGroupByDimensionId(config, state);
    if (groupByDimensionId && !ids.includes(groupByDimensionId)) {
        ids.push(groupByDimensionId);
    }
    resolveTableCalculationDimensionIds(config, state).forEach((dimensionId) => {
        if (!ids.includes(dimensionId)) {
            ids.push(dimensionId);
        }
    });
    resolveLocalCalculatedFieldDependencies(config, state).dimensionIds.forEach((dimensionId) => {
        if (!ids.includes(dimensionId)) {
            ids.push(dimensionId);
        }
    });
    return ids;
}

function resolveSemanticSelectedFields(config = {}, state = {}) {
    const measuresById = new Map(
        (semanticSelectableMeasureFields(config) || [])
            .map((field) => [normalizeString(field?.id || field?.key), field])
            .filter(([, field]) => !!field),
    );
    const dimensionsById = new Map(
        (config.dimensions || [])
            .map((field) => [normalizeString(field?.id || field?.key), field])
            .filter(([, field]) => !!field),
    );
    const fields = [];
    const seen = new Set();

    normalizeFieldSelectionIds(state?.selectedMeasures).forEach((id) => {
        const field = measuresById.get(id);
        if (!field || seen.has(`measure:${id}`)) {
            return;
        }
        seen.add(`measure:${id}`);
        fields.push({ kind: "measure", id, field });
    });

    resolveSemanticSelectedDimensions(config, state).forEach((id) => {
        const field = dimensionsById.get(id);
        if (!field || seen.has(`dimension:${id}`)) {
            return;
        }
        seen.add(`dimension:${id}`);
        fields.push({ kind: "dimension", id, field });
    });

    return fields;
}

function buildUnmappedSelectionIds(fields = [], selectedIds = [], {
    ignoreIds = [],
} = {}) {
    const fieldIndex = new Map(
        (Array.isArray(fields) ? fields : [])
            .map((field) => [normalizeString(field?.id || field?.key), field])
            .filter(([, field]) => !!field),
    );
    const ignored = new Set(
        (Array.isArray(ignoreIds) ? ignoreIds : [])
            .map((id) => normalizeString(id))
            .filter(Boolean),
    );
    return Array.from(new Set(
        (Array.isArray(selectedIds) ? selectedIds : [])
            .map((id) => normalizeString(id))
            .filter(Boolean)
            .filter((id) => !ignored.has(id))
            .filter((id) => !semanticFieldId(fieldIndex.get(id))),
    ));
}

function buildRawFieldSelection(fields = [], semanticIds = []) {
    const rawIndex = new Map();
    (Array.isArray(fields) ? fields : []).forEach((field) => {
        const rawId = normalizeString(field?.id || field?.key);
        const semanticRef = semanticFieldId(field);
        if (!rawId) {
            return;
        }
        if (!semanticRef || rawIndex.has(semanticRef)) {
            return;
        }
        rawIndex.set(semanticRef, rawId);
    });
    return Array.from(new Set(
        (Array.isArray(semanticIds) ? semanticIds : [])
            .map((id) => rawIndex.get(normalizeString(id)))
            .filter(Boolean),
    ));
}

function buildSemanticFieldIssues(fields = [], validSemanticIds = new Set(), selectedIds = []) {
    const selected = new Set(normalizeFieldSelectionIds(selectedIds));
    const issues = [];
    const issueIndex = {};
    (Array.isArray(fields) ? fields : []).forEach((field) => {
        const rawId = normalizeString(field?.id || field?.key);
        if (!rawId || issueIndex[rawId]) {
            return;
        }
        const label = normalizeString(field?.label || rawId);
        const semanticRef = semanticFieldId(field);
        let issue = null;
        if (!semanticRef) {
            issue = {
                id: rawId,
                label,
                semanticRef: "",
                code: "missingSemanticRef",
                selected: selected.has(rawId),
                message: `${label} is not mapped to the current semantic model.`,
            };
        } else if (!validSemanticIds.has(semanticRef)) {
            issue = {
                id: rawId,
                label,
                semanticRef,
                code: "unknownSemanticRef",
                selected: selected.has(rawId),
                message: `${label} maps to semantic field '${semanticRef}', which is not available in the current semantic entity.`,
            };
        }
        if (!issue) {
            return;
        }
        issues.push(issue);
        issueIndex[rawId] = issue;
    });
    return {
        issues,
        issueIndex,
        selectedIssues: issues.filter((issue) => issue.selected),
    };
}

function overlayField(baseField = {}, semanticField = null) {
    if (!semanticField || typeof semanticField !== "object") {
        return baseField;
    }
    return {
        ...baseField,
        label: semanticField.label || baseField.label || baseField.id,
        ...(semanticField.description ? { description: semanticField.description } : {}),
        ...(semanticField.category ? { category: semanticField.category } : {}),
        ...(semanticField.format ? { format: semanticField.format } : {}),
        ...(semanticField.governance ? { governance: semanticField.governance } : {}),
        ...(semanticField.dataType ? { semanticDataType: semanticField.dataType } : {}),
        semanticRef: semanticField.id || semanticField.key || baseField.semanticRef || "",
    };
}

export function resolveReportBuilderSemanticModelProvider(builderContext = {}) {
    const candidate = builderContext?.handlers?.semanticModel || null;
    if (!candidate || !hasSemanticModelProvider(candidate)) {
        return null;
    }
    return createSemanticModelProvider(candidate);
}

export function resolveReportBuilderSemanticEntity(model = null, binding = null) {
    const normalizedBinding = normalizeSemanticBinding(binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    const validatedModel = validateSemanticModel(model);
    if (!validatedModel.valid || !validatedModel.normalizedModel) {
        return null;
    }
    return validatedModel.normalizedModel.entities.find((entry) => entry.id === normalizedBinding.entity) || null;
}

export function applyReportBuilderSemanticConfig(config = {}, binding = null, model = null) {
    const normalizedBinding = normalizeSemanticBinding(binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return config;
    }
    const entity = resolveReportBuilderSemanticEntity(model, normalizedBinding);
    if (!entity) {
        return config;
    }
    const measureIndex = buildSemanticFieldIndex(entity.measures || []);
    const dimensionIndex = buildSemanticFieldIndex(entity.dimensions || []);
    const nextMeasures = Array.isArray(config.measures)
        ? config.measures.map((entry) => overlayField(entry, resolveSemanticField(measureIndex, entry)))
        : config.measures;
    const nextCalculatedFields = Array.isArray(config.calculatedFields)
        ? config.calculatedFields.map((entry) => overlayField(entry, resolveSemanticField(measureIndex, entry)))
        : config.calculatedFields;
    const nextComputed = Array.isArray(config.computedMeasures)
        ? config.computedMeasures.map((entry) => overlayField(entry, resolveSemanticField(measureIndex, entry)))
        : config.computedMeasures;
    const nextTableCalculations = Array.isArray(config.tableCalculations)
        ? config.tableCalculations.map((entry) => overlayField(entry, resolveSemanticField(measureIndex, entry)))
        : config.tableCalculations;
    const rawDimensionIndex = new Map(
        (Array.isArray(config.dimensions) ? config.dimensions : [])
            .map((entry) => [normalizeString(entry?.id || entry?.key), entry])
            .filter(([, entry]) => !!entry),
    );
    const nextDimensions = Array.isArray(config.dimensions)
        ? config.dimensions.map((entry) => overlayField(entry, resolveSemanticField(dimensionIndex, entry)))
        : config.dimensions;
    const nextGroupBy = config?.groupBy && Array.isArray(config.groupBy.options)
        ? {
            ...config.groupBy,
            options: config.groupBy.options.map((entry) => {
                const rawDimension = rawDimensionIndex.get(normalizeString(entry?.dimensionId || entry?.value));
                const semantic = resolveSemanticField(dimensionIndex, rawDimension || entry);
                return semantic?.label ? { ...entry, label: semantic.label } : entry;
            }),
        }
        : config.groupBy;
    return {
        ...config,
        measures: nextMeasures,
        calculatedFields: nextCalculatedFields,
        computedMeasures: nextComputed,
        tableCalculations: nextTableCalculations,
        dimensions: nextDimensions,
        groupBy: nextGroupBy,
    };
}

export function resolveReportBuilderSemanticSelections(config = {}, binding = null) {
    const normalizedBinding = normalizeSemanticBinding(binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    const source = binding && typeof binding === "object" ? binding : {};
    return {
        hasExplicitDimensions: Object.prototype.hasOwnProperty.call(source, "selectedDimensions"),
        hasExplicitMeasures: Object.prototype.hasOwnProperty.call(source, "selectedMeasures"),
        selectedDimensions: buildRawFieldSelection(config.dimensions, normalizedBinding.selectedDimensions),
        selectedMeasures: buildRawFieldSelection(semanticSelectableMeasureFields(config), normalizedBinding.selectedMeasures),
    };
}

export function buildReportBuilderSemanticSelection(config = {}, state = {}) {
    const normalizedBinding = normalizeSemanticBinding(state?.binding || config?.binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    const localComputedMeasureIds = (Array.isArray(config?.computedMeasures) ? config.computedMeasures : [])
        .concat(Array.isArray(config?.calculatedFields) ? config.calculatedFields : [])
        .concat(Array.isArray(config?.tableCalculations) ? config.tableCalculations : [])
        .filter((field) => isLocalComputedMeasure(field))
        .map((field) => normalizeString(field?.id || field?.key))
        .filter(Boolean);
    const localCalculatedDependencies = resolveLocalCalculatedFieldDependencies(config, state);
    const selectedDimensionIds = resolveSemanticSelectedDimensions(config, state);
    const selectedDimensions = buildSemanticSelectionIds(config.dimensions, selectedDimensionIds);
    const selectedMeasures = buildSemanticSelectionIds(semanticSelectableMeasureFields(config), [
        ...(Array.isArray(state?.selectedMeasures) ? state.selectedMeasures : []),
        ...localCalculatedDependencies.measureIds,
    ]);
    const unmappedDimensions = buildUnmappedSelectionIds(config.dimensions, selectedDimensionIds);
    const unmappedMeasures = buildUnmappedSelectionIds(semanticSelectableMeasureFields(config), state?.selectedMeasures, {
        ignoreIds: localComputedMeasureIds,
    });
    return {
        modelRef: normalizedBinding.modelRef,
        entity: normalizedBinding.entity,
        selection: {
            dimensions: selectedDimensions,
            measures: selectedMeasures,
        },
        ...((unmappedDimensions.length > 0 || unmappedMeasures.length > 0)
            ? {
                unmapped: {
                    ...(unmappedDimensions.length > 0 ? { dimensions: unmappedDimensions } : {}),
                    ...(unmappedMeasures.length > 0 ? { measures: unmappedMeasures } : {}),
                },
            }
            : {}),
        refinements: [],
        parameters: {},
    };
}

export function buildReportBuilderSemanticValidationRequest(config = {}, state = {}, binding = null) {
    const normalizedBinding = normalizeSemanticBinding(binding || state?.binding || config?.binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    const semanticSelection = buildReportBuilderSemanticSelection(config, {
        ...state,
        binding: normalizedBinding,
    });
    if (!semanticSelection) {
        return null;
    }
    return {
        modelRef: semanticSelection.modelRef,
        selection: {
            entity: semanticSelection.entity,
            dimensions: semanticSelection?.selection?.dimensions || [],
            measures: semanticSelection?.selection?.measures || [],
            parameters: semanticSelection?.parameters || {},
        },
    };
}

export function buildReportBuilderSemanticDiagnosticTargets({
    config = {},
    state = {},
    binding = null,
    diagnostics = [],
} = {}) {
    const normalizedBinding = normalizeSemanticBinding(binding || state?.binding || config?.binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return {
            measureDiagnosticsById: {},
            dimensionDiagnosticsById: {},
            groupByDiagnostics: [],
            unmatchedDiagnostics: [],
        };
    }
    const selectedDimensionRawIds = buildSemanticSelectionRawIds(config.dimensions, resolveSemanticSelectedDimensions(config, state));
    const selectedMeasureRawIds = buildSemanticSelectionRawIds(semanticSelectableMeasureFields(config), state?.selectedMeasures);
    const groupByDimensionId = resolveGroupByDimensionId(config, state);
    const normalizedDiagnostics = normalizeReportBuilderSemanticDiagnostics(diagnostics);
    const measureDiagnosticsById = {};
    const dimensionDiagnosticsById = {};
    const groupByDiagnostics = [];
    const unmatchedDiagnostics = [];

    const pushTargeted = (bucket, key, diagnostic) => {
        if (!key) {
            return;
        }
        if (!Array.isArray(bucket[key])) {
            bucket[key] = [];
        }
        bucket[key].push(diagnostic);
    };

    normalizedDiagnostics.forEach((diagnostic) => {
        const path = normalizeString(diagnostic.path);
        const measureMatch = /^selection\.measures\[(\d+)\](?:$|[.\[])/.exec(path);
        if (measureMatch) {
            const rawId = selectedMeasureRawIds[Number(measureMatch[1])];
            if (rawId) {
                pushTargeted(measureDiagnosticsById, rawId, diagnostic);
                return;
            }
        }
        const dimensionMatch = /^selection\.dimensions\[(\d+)\](?:$|[.\[])/.exec(path);
        if (dimensionMatch) {
            const rawId = selectedDimensionRawIds[Number(dimensionMatch[1])];
            if (rawId) {
                pushTargeted(dimensionDiagnosticsById, rawId, diagnostic);
                if (groupByDimensionId && rawId === groupByDimensionId) {
                    groupByDiagnostics.push(diagnostic);
                }
                return;
            }
        }
        unmatchedDiagnostics.push(diagnostic);
    });

    return {
        measureDiagnosticsById,
        dimensionDiagnosticsById,
        groupByDiagnostics,
        unmatchedDiagnostics,
    };
}

export function normalizeReportBuilderSemanticDiagnostics(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : [])
        .map((diagnostic) => {
            if (!diagnostic || typeof diagnostic !== "object") {
                return null;
            }
            const code = normalizeString(diagnostic.code);
            const severity = normalizeString(diagnostic.severity || "error").toLowerCase() || "error";
            const path = normalizeString(diagnostic.path);
            const message = normalizeString(diagnostic.message);
            const suggestedFix = normalizeString(diagnostic.suggestedFix);
            if (!message) {
                return null;
            }
            return {
                ...(code ? { code } : {}),
                severity,
                ...(path ? { path } : {}),
                message,
                ...(suggestedFix ? { suggestedFix } : {}),
            };
        })
        .filter(Boolean);
}

export function summarizeReportBuilderSemanticDiagnostics(diagnostics = []) {
    const normalized = normalizeReportBuilderSemanticDiagnostics(diagnostics);
    if (normalized.length === 0) {
        return "";
    }
    const first = normalized[0];
    return first.suggestedFix
        ? `${first.message} ${first.suggestedFix}`
        : first.message;
}

export function buildReportBuilderSemanticDiagnosticsNotice({
    validationState = {},
} = {}) {
    const error = normalizeString(validationState?.error);
    const diagnostics = normalizeReportBuilderSemanticDiagnostics(validationState?.diagnostics);
    if (!error && diagnostics.length === 0) {
        return null;
    }
    const level = error || diagnostics.some((entry) => entry.severity === "error")
        ? "danger"
        : (diagnostics.some((entry) => entry.severity === "warning") ? "warning" : "info");
    return {
        level,
        title: error ? "Semantic validation error" : "Semantic provider diagnostics",
        description: error || (diagnostics.length === 1
            ? "The semantic provider returned 1 diagnostic for the current selection."
            : `The semantic provider returned ${diagnostics.length} diagnostics for the current selection.`),
        diagnostics: diagnostics.map((entry, index) => ({
            id: `${entry.code || "diagnostic"}_${index + 1}`,
            severity: entry.severity || "error",
            code: entry.code || "",
            path: entry.path || "",
            message: entry.message,
            suggestedFix: entry.suggestedFix || "",
        })),
    };
}

function semanticLevelToRuntimeSeverity(level = "") {
    const normalized = normalizeString(level).toLowerCase();
    if (normalized === "danger") {
        return "error";
    }
    if (normalized === "warning") {
        return "warning";
    }
    return "info";
}

function normalizeSemanticRuntimeDiagnostic(diagnostic = {}) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return null;
    }
    const code = normalizeString(diagnostic.code);
    const severity = normalizeString(diagnostic.severity || "warning").toLowerCase();
    const path = normalizeString(diagnostic.path);
    const message = normalizeString(diagnostic.message);
    const suggestedFix = normalizeString(diagnostic.suggestedFix);
    if (!message) {
        return null;
    }
    return {
        ...(code ? { code } : {}),
        severity: severity || "warning",
        ...(path ? { path } : {}),
        message,
        ...(suggestedFix ? { suggestedFix } : {}),
    };
}

export function buildReportBuilderSemanticRuntimeDiagnostics({
    binding = null,
    semanticStatus = null,
    semanticDiagnosticsNotice = null,
    semanticGovernanceNotice = null,
    semanticFieldValidation = null,
} = {}) {
    const normalizedBinding = normalizeSemanticBinding(binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return [];
    }
    const diagnostics = [];
    const statusLevel = normalizeString(semanticStatus?.level).toLowerCase();
    const statusMessage = normalizeString(semanticStatus?.message);
    if (statusLevel && statusLevel !== "info" && statusMessage) {
        diagnostics.push({
            code: normalizeString(semanticStatus?.title).replace(/\s+/g, "") || "semanticStatus",
            severity: semanticLevelToRuntimeSeverity(statusLevel),
            message: statusMessage,
        });
    }

    const providerDiagnostics = normalizeReportBuilderSemanticDiagnostics(semanticDiagnosticsNotice?.diagnostics);
    if (providerDiagnostics.length > 0) {
        diagnostics.push(...providerDiagnostics);
    } else {
        const noticeDescription = normalizeString(semanticDiagnosticsNotice?.description);
        if (noticeDescription) {
            diagnostics.push({
                code: "semanticProviderDiagnostics",
                severity: semanticLevelToRuntimeSeverity(semanticDiagnosticsNotice?.level),
                message: noticeDescription,
            });
        }
    }

    const selectedIssues = Array.isArray(semanticFieldValidation?.selectedIssues)
        ? semanticFieldValidation.selectedIssues
        : [];
    selectedIssues.forEach((issue) => {
        const message = normalizeString(issue?.message);
        if (!message) {
            return;
        }
        diagnostics.push({
            code: normalizeString(issue?.code) || "semanticFieldValidation",
            severity: "error",
            path: normalizeString(issue?.id),
            message,
            suggestedFix: "Remove it or add a valid semantic mapping before running the report.",
        });
    });

    const governanceItems = Array.isArray(semanticGovernanceNotice?.items) ? semanticGovernanceNotice.items : [];
    governanceItems.forEach((item) => {
        const message = normalizeString(item);
        if (!message) {
            return;
        }
        diagnostics.push({
            code: "semanticGovernance",
            severity: semanticLevelToRuntimeSeverity(semanticGovernanceNotice?.level),
            message,
        });
    });

    const deduped = [];
    const seen = new Set();
    diagnostics.forEach((diagnostic) => {
        const normalized = normalizeSemanticRuntimeDiagnostic(diagnostic);
        if (!normalized) {
            return;
        }
        const key = [
            normalizeString(normalized.code),
            normalizeString(normalized.severity),
            normalizeString(normalized.path),
            normalizeString(normalized.message),
            normalizeString(normalized.suggestedFix),
        ].join("::");
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        deduped.push(normalized);
    });

    return deduped;
}

export function buildReportBuilderSemanticGovernanceNotice({
    config = {},
    state = {},
    binding = null,
} = {}) {
    const normalizedBinding = normalizeSemanticBinding(binding || state?.binding || config?.binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    const selectedFields = resolveSemanticSelectedFields(config, state);
    const draftFields = [];
    const deprecatedFields = [];

    selectedFields.forEach(({ field }) => {
        const governance = field?.governance && typeof field.governance === "object" ? field.governance : {};
        const status = normalizeString(governance.status).toLowerCase();
        const label = normalizeString(field?.label || field?.id);
        if (!label) {
            return;
        }
        if (status === "draft") {
            draftFields.push(label);
        } else if (status === "deprecated") {
            deprecatedFields.push(label);
        }
    });

    if (draftFields.length === 0 && deprecatedFields.length === 0) {
        return null;
    }

    const uniqueDraft = Array.from(new Set(draftFields));
    const uniqueDeprecated = Array.from(new Set(deprecatedFields));
    const items = [
        ...uniqueDeprecated.map((label) => `${label} • Deprecated`),
        ...uniqueDraft.map((label) => `${label} • Draft`),
    ];

    if (uniqueDeprecated.length > 0 && uniqueDraft.length > 0) {
        return {
            id: "semanticGovernance",
            level: "warning",
            title: "Selected Semantic Governance Warnings",
            description: "Some selected semantic fields are deprecated or still in draft status. Review them before sharing or publishing this report.",
            items,
        };
    }
    if (uniqueDeprecated.length > 0) {
        return {
            id: "semanticGovernance",
            level: "warning",
            title: "Selected Deprecated Semantic Fields",
            description: "These selected semantic fields are deprecated in the provider metadata. Replace them before sharing or publishing this report.",
            items,
        };
    }
    return {
        id: "semanticGovernance",
        level: "info",
        title: "Selected Draft Semantic Fields",
        description: "These selected semantic fields are still marked as draft in the provider metadata.",
        items,
    };
}

export function buildReportBuilderSemanticFieldValidation({
    config = {},
    state = {},
    binding = null,
    model = null,
} = {}) {
    const normalizedBinding = normalizeSemanticBinding(binding || state?.binding || config?.binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    const modelValidation = validateSemanticModel(model);
    const bindingValidation = validateSemanticBinding(normalizedBinding, modelValidation.normalizedModel);
    if (!modelValidation.valid || !bindingValidation.valid) {
        return {
            canRun: true,
            issues: [],
            selectedIssues: [],
            measureIssuesById: {},
            dimensionIssuesById: {},
            message: "",
        };
    }
    const entity = resolveReportBuilderSemanticEntity(modelValidation.normalizedModel, normalizedBinding);
    if (!entity) {
        return {
            canRun: true,
            issues: [],
            selectedIssues: [],
            measureIssuesById: {},
            dimensionIssuesById: {},
            message: "",
        };
    }
    const selectedDimensionIds = resolveSemanticSelectedDimensions(config, state);
    const selectedMeasureIds = normalizeFieldSelectionIds(state?.selectedMeasures);
    const dimensionResult = buildSemanticFieldIssues(
        config.dimensions,
        new Set((entity.dimensions || []).map((field) => normalizeString(field?.id || field?.key))),
        selectedDimensionIds,
    );
    const measureResult = buildSemanticFieldIssues(
        semanticSelectableMeasureFields(config),
        new Set((entity.measures || []).map((field) => normalizeString(field?.id || field?.key))),
        selectedMeasureIds,
    );
    const selectedIssues = [...dimensionResult.selectedIssues, ...measureResult.selectedIssues];
    const issues = [...dimensionResult.issues, ...measureResult.issues];
    let message = "";
    if (selectedIssues.length === 1) {
        const issue = selectedIssues[0];
        message = `${issue.message} Remove it or add a valid semantic mapping before running the report.`;
    } else if (selectedIssues.length > 1) {
        message = `${selectedIssues.length} selected fields are not valid for the current semantic entity. Remove them or add valid semantic mappings before running the report.`;
    }
    return {
        canRun: selectedIssues.length === 0,
        issues,
        selectedIssues,
        measureIssuesById: measureResult.issueIndex,
        dimensionIssuesById: dimensionResult.issueIndex,
        message,
    };
}

function normalizeSemanticSummaryGovernance(governance = {}) {
    if (!governance || typeof governance !== "object" || Array.isArray(governance)) {
        return null;
    }
    const status = normalizeString(governance.status).toLowerCase();
    const certification = normalizeString(governance.certification).toLowerCase();
    const ownerRef = normalizeString(governance.ownerRef);
    const classification = normalizeString(governance.classification);
    const deprecation = normalizeString(governance.deprecation);
    const next = {};
    if (status) {
        next.status = status;
    }
    if (certification) {
        next.certification = certification;
    }
    if (ownerRef) {
        next.ownerRef = ownerRef;
    }
    if (classification) {
        next.classification = classification;
    }
    if (deprecation) {
        next.deprecation = deprecation;
    }
    return Object.keys(next).length > 0 ? next : null;
}

function buildReportBuilderSemanticSummaryField(semanticId = "", configIndex = new Map(), entityIndex = new Map()) {
    const normalizedSemanticId = normalizeString(semanticId);
    if (!normalizedSemanticId) {
        return null;
    }
    const configField = resolveSemanticField(configIndex, {
        semanticRef: normalizedSemanticId,
        id: normalizedSemanticId,
        key: normalizedSemanticId,
    });
    const entityField = resolveSemanticField(entityIndex, {
        semanticRef: normalizedSemanticId,
        id: normalizedSemanticId,
        key: normalizedSemanticId,
    });
    const resolvedField = entityField
        ? {
            ...(configField && typeof configField === "object" ? configField : {}),
            ...entityField,
        }
        : (configField || entityField || {});
    const label = normalizeString(resolvedField?.label || entityField?.label || normalizedSemanticId);
    if (!label) {
        return null;
    }
    const rawId = normalizeString(configField?.id || configField?.key);
    const description = normalizeString(resolvedField?.description || entityField?.description);
    const format = normalizeString(resolvedField?.format || entityField?.format);
    const governance = normalizeSemanticSummaryGovernance(resolvedField?.governance || entityField?.governance);
    return {
        id: normalizedSemanticId,
        ...(rawId ? { rawId } : {}),
        label,
        ...(description ? { description } : {}),
        ...(format ? { format } : {}),
        ...(governance ? { governance } : {}),
    };
}

export function buildReportBuilderSemanticSummary({
    config = {},
    state = {},
    binding = null,
    model = null,
} = {}) {
    const normalizedBinding = normalizeSemanticBinding(binding || state?.binding || config?.binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    const semanticSelection = buildReportBuilderSemanticSelection(config, {
        ...state,
        binding: normalizedBinding,
    });
    if (!semanticSelection) {
        return null;
    }
    const modelValidation = validateSemanticModel(model);
    const normalizedModel = modelValidation.valid ? modelValidation.normalizedModel : null;
    const entity = resolveReportBuilderSemanticEntity(normalizedModel, normalizedBinding);
    const configMeasureIndex = buildSemanticFieldIndex(semanticSelectableMeasureFields(config));
    const configDimensionIndex = buildSemanticFieldIndex(config.dimensions || []);
    const entityMeasureIndex = buildSemanticFieldIndex(entity?.measures || []);
    const entityDimensionIndex = buildSemanticFieldIndex(entity?.dimensions || []);
    const selectedDimensions = (semanticSelection?.selection?.dimensions || [])
        .map((semanticId) => buildReportBuilderSemanticSummaryField(semanticId, configDimensionIndex, entityDimensionIndex))
        .filter(Boolean);
    const selectedMeasures = (semanticSelection?.selection?.measures || [])
        .map((semanticId) => buildReportBuilderSemanticSummaryField(semanticId, configMeasureIndex, entityMeasureIndex))
        .filter(Boolean);
    return {
        kind: "semantic",
        modelRef: normalizedBinding.modelRef,
        ...(normalizeString(normalizedModel?.label) ? { modelLabel: normalizeString(normalizedModel.label) } : {}),
        ...(normalizeString(normalizedModel?.description) ? { modelDescription: normalizeString(normalizedModel.description) } : {}),
        entity: normalizedBinding.entity,
        ...(normalizeString(entity?.label) ? { entityLabel: normalizeString(entity.label) } : {}),
        ...(normalizeString(entity?.description) ? { entityDescription: normalizeString(entity.description) } : {}),
        selectedDimensions,
        selectedMeasures,
    };
}

function normalizeReportBuilderSemanticSummaryField(field = {}) {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
        return null;
    }
    const id = normalizeString(field?.id);
    const label = normalizeString(field?.label || id);
    if (!id || !label) {
        return null;
    }
    const rawId = normalizeString(field?.rawId);
    const description = normalizeString(field?.description);
    const format = normalizeString(field?.format);
    const governance = normalizeSemanticSummaryGovernance(field?.governance);
    return {
        id,
        ...(rawId ? { rawId } : {}),
        label,
        ...(description ? { description } : {}),
        ...(format ? { format } : {}),
        ...(governance ? { governance } : {}),
    };
}

export function normalizeReportBuilderSemanticSummary(summary = null) {
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
        return null;
    }
    const kind = normalizeString(summary?.kind).toLowerCase();
    if (kind !== "semantic") {
        return null;
    }
    const modelRef = normalizeString(summary?.modelRef);
    const entity = normalizeString(summary?.entity);
    if (!modelRef || !entity) {
        return null;
    }
    return {
        kind: "semantic",
        modelRef,
        ...(normalizeString(summary?.modelLabel) ? { modelLabel: normalizeString(summary.modelLabel) } : {}),
        ...(normalizeString(summary?.modelDescription) ? { modelDescription: normalizeString(summary.modelDescription) } : {}),
        entity,
        ...(normalizeString(summary?.entityLabel) ? { entityLabel: normalizeString(summary.entityLabel) } : {}),
        ...(normalizeString(summary?.entityDescription) ? { entityDescription: normalizeString(summary.entityDescription) } : {}),
        selectedDimensions: (Array.isArray(summary?.selectedDimensions) ? summary.selectedDimensions : [])
            .map((field) => normalizeReportBuilderSemanticSummaryField(field))
            .filter(Boolean),
        selectedMeasures: (Array.isArray(summary?.selectedMeasures) ? summary.selectedMeasures : [])
            .map((field) => normalizeReportBuilderSemanticSummaryField(field))
            .filter(Boolean),
    };
}

function mergeSemanticSummaryGovernance(current = null, fallback = null) {
    const normalizedCurrent = normalizeSemanticSummaryGovernance(current);
    const normalizedFallback = normalizeSemanticSummaryGovernance(fallback);
    if (!normalizedCurrent) {
        return normalizedFallback;
    }
    if (!normalizedFallback) {
        return normalizedCurrent;
    }
    return {
        ...normalizedFallback,
        ...normalizedCurrent,
    };
}

function mergeReportBuilderSemanticSummaryFields(currentFields = [], fallbackFields = [], {
    preferFallbackMetadata = false,
} = {}) {
    const normalizedCurrent = (Array.isArray(currentFields) ? currentFields : [])
        .map((field) => normalizeReportBuilderSemanticSummaryField(field))
        .filter(Boolean);
    const normalizedFallback = (Array.isArray(fallbackFields) ? fallbackFields : [])
        .map((field) => normalizeReportBuilderSemanticSummaryField(field))
        .filter(Boolean);
    if (normalizedCurrent.length === 0) {
        return [];
    }
    if (normalizedFallback.length === 0) {
        return normalizedCurrent;
    }
    const fallbackIndex = new Map(
        normalizedFallback
            .map((field) => [field.id, field])
            .filter(([id]) => !!id),
    );
    return normalizedCurrent.map((field) => {
        const fallback = fallbackIndex.get(field.id);
        if (!fallback) {
            return field;
        }
        const governance = mergeSemanticSummaryGovernance(field.governance, fallback.governance);
        const mergedField = preferFallbackMetadata
            ? {
                ...field,
                ...fallback,
            }
            : {
                ...fallback,
                ...field,
            };
        return {
            ...mergedField,
            ...(governance ? { governance } : {}),
        };
    });
}

export function resolveReportBuilderSemanticSummary({
    currentSummary = null,
    fallbackSummary = null,
    currentFingerprint = "",
    fallbackFingerprint = "",
    preferFallbackMetadata = false,
} = {}) {
    const normalizedCurrent = normalizeReportBuilderSemanticSummary(currentSummary);
    const normalizedFallback = normalizeReportBuilderSemanticSummary(fallbackSummary);
    if (!normalizedFallback) {
        return normalizedCurrent;
    }
    const normalizedCurrentFingerprint = normalizeString(currentFingerprint);
    const normalizedFallbackFingerprint = normalizeString(fallbackFingerprint);
    const fingerprintMatches = normalizedCurrentFingerprint
        && normalizedFallbackFingerprint
        && normalizedCurrentFingerprint === normalizedFallbackFingerprint;
    if (!normalizedCurrent) {
        return fingerprintMatches ? normalizedFallback : null;
    }
    if (!fingerprintMatches) {
        return normalizedCurrent;
    }
    const modelLabel = normalizeString(normalizedCurrent?.modelLabel || normalizedFallback?.modelLabel);
    const modelDescription = normalizeString(normalizedCurrent?.modelDescription || normalizedFallback?.modelDescription);
    const entityLabel = normalizeString(normalizedCurrent?.entityLabel || normalizedFallback?.entityLabel);
    const entityDescription = normalizeString(normalizedCurrent?.entityDescription || normalizedFallback?.entityDescription);
    return {
        ...normalizedFallback,
        ...normalizedCurrent,
        ...(modelLabel ? { modelLabel } : {}),
        ...(modelDescription ? { modelDescription } : {}),
        ...(entityLabel ? { entityLabel } : {}),
        ...(entityDescription ? { entityDescription } : {}),
        selectedDimensions: mergeReportBuilderSemanticSummaryFields(
            normalizedCurrent.selectedDimensions,
            normalizedFallback.selectedDimensions,
            { preferFallbackMetadata },
        ),
        selectedMeasures: mergeReportBuilderSemanticSummaryFields(
            normalizedCurrent.selectedMeasures,
            normalizedFallback.selectedMeasures,
            { preferFallbackMetadata },
        ),
    };
}

export function semanticFieldTitle(field = {}) {
    if (!field || typeof field !== "object") {
        return "";
    }
    const parts = [normalizeString(field.label || field.id)];
    const description = normalizeString(field.description);
    if (description) {
        parts.push(description);
    }
    const governance = field.governance && typeof field.governance === "object" ? field.governance : {};
    const governanceParts = [
        normalizeString(governance.status),
        normalizeString(governance.certification),
        normalizeString(governance.ownerRef),
    ].filter(Boolean);
    if (governanceParts.length > 0) {
        parts.push(governanceParts.join(" • "));
    }
    return parts.filter(Boolean).join(" — ");
}

export function resolveSemanticGovernanceBadges(field = {}) {
    const governance = field?.governance && typeof field.governance === "object" ? field.governance : {};
    const certification = normalizeString(governance.certification).toLowerCase();
    const status = normalizeString(governance.status).toLowerCase();
    const badges = [];
    if (certification === "certified") {
        badges.push({ id: "certified", label: "Certified", tone: "certified" });
    } else if (certification === "reviewed") {
        badges.push({ id: "reviewed", label: "Reviewed", tone: "reviewed" });
    }
    if (status === "deprecated") {
        badges.push({ id: "deprecated", label: "Deprecated", tone: "deprecated" });
    } else if (status === "draft") {
        badges.push({ id: "draft", label: "Draft", tone: "draft" });
    } else if (status === "approved" && badges.length === 0) {
        badges.push({ id: "approved", label: "Approved", tone: "approved" });
    }
    return badges;
}

export function resolveSemanticGovernanceOptionLabel(label = "", field = {}) {
    const baseLabel = normalizeString(label || field?.label || field?.id);
    if (!baseLabel) {
        return "";
    }
    const governance = field?.governance && typeof field.governance === "object" ? field.governance : {};
    const status = normalizeString(governance.status).toLowerCase();
    if (status === "deprecated") {
        return `${baseLabel} (Deprecated)`;
    }
    if (status === "draft") {
        return `${baseLabel} (Draft)`;
    }
    return baseLabel;
}

export function buildReportBuilderSemanticStatus({
    binding = null,
    providerAvailable = false,
    loading = false,
    error = "",
    model = null,
} = {}) {
    const normalizedBinding = normalizeSemanticBinding(binding);
    if (!normalizedBinding || normalizedBinding.mode !== "semantic") {
        return null;
    }
    if (loading) {
        return {
            level: "info",
            title: "Semantic model",
            message: "Loading semantic model metadata…",
        };
    }
    if (!providerAvailable && !model) {
        return {
            level: "warning",
            title: "Semantic model unavailable",
            message: "Semantic binding is active, but no semantic model provider is available in the current runtime context.",
        };
    }
    if (error) {
        return {
            level: "danger",
            title: "Semantic model error",
            message: error,
        };
    }
    const modelValidation = validateSemanticModel(model);
    const bindingValidation = validateSemanticBinding(binding, modelValidation.normalizedModel);
    if (!modelValidation.valid || !bindingValidation.valid) {
        const first = [...modelValidation.errors, ...bindingValidation.errors][0];
        return {
            level: "warning",
            title: "Semantic binding issue",
            message: first?.message || "Semantic binding could not be resolved cleanly.",
        };
    }
    const entity = resolveReportBuilderSemanticEntity(modelValidation.normalizedModel, normalizedBinding);
    return {
        level: "info",
        title: "Semantic binding",
        message: [
            normalizeString(modelValidation.normalizedModel?.label || normalizedBinding.modelRef),
            entity?.label ? `Entity: ${entity.label}` : "",
        ].filter(Boolean).join(" • "),
    };
}
