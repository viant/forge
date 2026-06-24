import {
    normalizeReportCalculatedField,
    normalizeReportCalculatedFields,
    parseReportCalculatedFieldExpression,
} from "../../reporting/calculatedFieldModel.js";
import {
    listReportCalculatedFieldTableCalculationSpecs,
} from "../../reporting/calculationContracts.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStringArray(values = []) {
    return (Array.isArray(values) ? values : [])
        .map((value) => normalizeString(value))
        .filter(Boolean);
}

function normalizeMeasureSections(measureSections = []) {
    return (Array.isArray(measureSections) ? measureSections : [])
        .filter((section) => section && typeof section === "object" && !Array.isArray(section))
        .map((section, index) => ({
            ...cloneValue(section),
            id: normalizeString(section?.id),
            label: normalizeString(section?.label),
            order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index,
        }))
        .filter((section) => section.id);
}

function normalizeFieldAliases(field = {}, {
    includeDisplayKey = false,
} = {}) {
    const aliases = [
        normalizeString(field?.id),
        normalizeString(field?.key),
    ];
    if (includeDisplayKey) {
        aliases.push(normalizeString(field?.displayKey || field?.displayPath));
    }
    return Array.from(new Set(aliases.filter(Boolean)));
}

function normalizeFieldLabel(field = {}) {
    return normalizeString(field?.label || field?.id || field?.key);
}

function buildLocalCalculatedFieldSectionConfig(config = {}, localCalculatedFields = []) {
    const normalizedSections = normalizeMeasureSections(config?.measureSections);
    if ((localCalculatedFields || []).length === 0) {
        return normalizedSections;
    }
    const existingCalculatedSection = normalizedSections.find((section) => section.id === "calculated");
    if (existingCalculatedSection) {
        return normalizedSections;
    }
    return [
        ...normalizedSections,
        {
            id: "calculated",
            label: "Calculated",
            order: Number.MAX_SAFE_INTEGER,
        },
    ];
}

export function normalizeReportBuilderLocalCalculatedFields(calculatedFields = []) {
    return normalizeReportCalculatedFields(calculatedFields)
        .filter((field) => field?.kind === "rowCalc" && normalizeString(field?.expr))
        .map((field) => cloneValue(field));
}

export function normalizeReportBuilderLocalTableCalculations(calculatedFields = []) {
    return normalizeReportCalculatedFields(calculatedFields)
        .filter((field) => field?.kind === "tableCalc" && field?.compute)
        .map((field) => cloneValue(field));
}

function mergeAuthoringFieldSets(baseFields = [], localFields = [], {
    authoringScope = "",
    authoringKind = "",
    defaultSection = "calculated",
} = {}) {
    const localById = new Map(
        (Array.isArray(localFields) ? localFields : [])
            .map((field) => [normalizeString(field?.id || field?.key), field])
            .filter(([id, field]) => !!id && !!field),
    );
    const merged = [];
    const seen = new Set();
    (Array.isArray(baseFields) ? baseFields : []).forEach((field) => {
        const fieldId = normalizeString(field?.id || field?.key);
        if (!fieldId || seen.has(fieldId)) {
            return;
        }
        const localOverride = localById.get(fieldId);
        if (localOverride) {
            merged.push({
                ...localOverride,
                section: normalizeString(localOverride?.section) || defaultSection,
                authoringScope,
                authoringEditable: true,
                ...(authoringKind ? { authoringKind } : {}),
            });
        } else {
            merged.push(field);
        }
        seen.add(fieldId);
    });
    (Array.isArray(localFields) ? localFields : []).forEach((field) => {
        const fieldId = normalizeString(field?.id || field?.key);
        if (!fieldId || seen.has(fieldId)) {
            return;
        }
        merged.push({
            ...field,
            section: normalizeString(field?.section) || defaultSection,
            authoringScope,
            authoringEditable: true,
            ...(authoringKind ? { authoringKind } : {}),
        });
        seen.add(fieldId);
    });
    return merged;
}

export function buildReportBuilderCalculatedFieldConfig(config = {}, state = {}) {
    const localCalculatedFields = normalizeReportBuilderLocalCalculatedFields(state?.localCalculatedFields)
    ;
    const localTableCalculations = normalizeReportBuilderLocalTableCalculations(state?.localTableCalculations);
    if (localCalculatedFields.length === 0 && localTableCalculations.length === 0) {
        return config;
    }
    const mergedCalculatedFields = mergeAuthoringFieldSets(
        Array.isArray(config?.calculatedFields) ? config.calculatedFields : [],
        localCalculatedFields,
        {
            authoringScope: "builderState.localCalculatedFields",
            authoringKind: "rowCalc",
        },
    );
    const mergedTableCalculations = mergeAuthoringFieldSets(
        Array.isArray(config?.tableCalculations) ? config.tableCalculations : [],
        localTableCalculations,
        {
            authoringScope: "builderState.localTableCalculations",
            authoringKind: "tableCalc",
        },
    );
    return {
        ...config,
        calculatedFields: mergedCalculatedFields,
        tableCalculations: mergedTableCalculations,
        measureSections: buildLocalCalculatedFieldSectionConfig(config, [...localCalculatedFields, ...localTableCalculations]),
    };
}

function buildCalculatedFieldDraftInput(draft = {}) {
    return {
        id: normalizeString(draft?.id || draft?.key),
        key: normalizeString(draft?.key || draft?.id),
        label: normalizeString(draft?.label),
        dataType: normalizeString(draft?.dataType || "number") || "number",
        format: normalizeString(draft?.format),
        expr: String(draft?.expr || ""),
    };
}

function buildCalculatedFieldReferenceCatalog(config = {}) {
    const aliases = new Map();
    const addEntry = (field, kind, options = {}) => {
        const entry = {
            id: normalizeString(field?.id || field?.key),
            label: normalizeFieldLabel(field),
            kind,
            isRowCalculated: options.isRowCalculated === true,
            isTableCalculated: options.isTableCalculated === true,
        };
        normalizeFieldAliases(field, { includeDisplayKey: kind === "dimension" }).forEach((alias) => {
            if (!aliases.has(alias)) {
                aliases.set(alias, entry);
            }
        });
    };

    (Array.isArray(config?.dimensions) ? config.dimensions : []).forEach((field) => {
        addEntry(field, "dimension");
    });
    (Array.isArray(config?.measures) ? config.measures : []).forEach((field) => {
        addEntry(field, "measure");
    });

    normalizeReportCalculatedFields([
        ...(Array.isArray(config?.calculatedFields) ? config.calculatedFields : []),
        ...(Array.isArray(config?.computedMeasures) ? config.computedMeasures : []),
    ]).forEach((field) => {
        if (field?.kind === "rowCalc") {
            addEntry(field, "measure", { isRowCalculated: true });
        }
    });
    normalizeReportCalculatedFields(Array.isArray(config?.tableCalculations) ? config.tableCalculations : []).forEach((field) => {
        if (field?.kind === "tableCalc") {
            addEntry(field, "measure", { isTableCalculated: true });
        }
    });
    return aliases;
}

function buildCalculatedFieldReservedAliases(config = {}, editingId = "") {
    const ignored = new Set(normalizeStringArray([editingId]));
    const aliases = new Set();
    const addField = (field, options = {}) => {
        normalizeFieldAliases(field, options).forEach((alias) => {
            if (ignored.has(alias)) {
                return;
            }
            aliases.add(alias);
        });
    };
    (Array.isArray(config?.dimensions) ? config.dimensions : []).forEach((field) => addField(field, { includeDisplayKey: true }));
    (Array.isArray(config?.measures) ? config.measures : []).forEach((field) => addField(field));
    (Array.isArray(config?.calculatedFields) ? config.calculatedFields : []).forEach((field) => addField(field));
    (Array.isArray(config?.computedMeasures) ? config.computedMeasures : []).forEach((field) => addField(field));
    (Array.isArray(config?.tableCalculations) ? config.tableCalculations : []).forEach((field) => addField(field));
    return aliases;
}

function formatCalculatedFieldValidationError(error = {}) {
    return {
        field: normalizeString(error?.field),
        code: normalizeString(error?.code),
        message: normalizeString(error?.message),
    };
}

export const REPORT_BUILDER_TABLE_CALC_FUNCTIONS = listReportCalculatedFieldTableCalculationSpecs()
    .map((entry) => ({
        value: normalizeString(entry?.name),
        label: normalizeString(entry?.label || entry?.name),
        supportsPartition: entry?.supportsPartition === true,
        // Rank always orders by its source field in the current authoring UX,
        // so it only needs a direction/tie-breaker control rather than a
        // separate order-by field selector.
        requiresOrder: entry?.requiresOrder === true && normalizeString(entry?.name) !== "rank",
        supportsRankDirection: entry?.supportsRankDirection === true,
        supportsTieBreaker: entry?.supportsTieBreaker === true,
        requiresWindowSize: entry?.requiresWindowSize === true,
        supportsDecimals: entry?.supportsDecimals === true,
        defaultFormat: normalizeString(entry?.defaultFormat),
    }))
    .filter((entry) => entry.value && entry.label);

function tableCalculationFunctionMeta(functionId = "") {
    const normalizedFunctionId = normalizeString(functionId);
    return REPORT_BUILDER_TABLE_CALC_FUNCTIONS.find((entry) => entry.value === normalizedFunctionId) || null;
}

export function buildReportBuilderCalculatedFieldDraft(seed = null) {
    const normalized = normalizeReportCalculatedField(seed || {});
    if (normalized?.kind === "rowCalc" && normalizeString(normalized?.expr)) {
        return buildCalculatedFieldDraftInput(normalized);
    }
    return {
        id: "",
        key: "",
        label: "",
        dataType: "number",
        format: "",
        expr: "",
    };
}

export function buildReportBuilderTableCalculationDraft(seed = null) {
    const normalized = normalizeReportCalculatedField(seed || {});
    if (normalized?.kind === "tableCalc" && normalized?.compute) {
        const compute = normalized.compute || {};
        const functionId = normalizeString(compute?.type);
        return {
            id: normalizeString(normalized?.id || normalized?.key),
            key: normalizeString(normalized?.key || normalized?.id),
            label: normalizeString(normalized?.label),
            format: normalizeString(normalized?.format),
            functionId,
            sourceField: normalizeString(compute?.sourceField),
            partitionBy: normalizeStringArray(compute?.partitionBy),
            orderByField: functionId === "rank"
                ? ""
                : normalizeString(Array.isArray(compute?.orderBy) ? compute.orderBy[0]?.field : ""),
            orderDir: functionId === "rank"
                ? normalizeString(Array.isArray(compute?.orderBy) ? compute.orderBy[0]?.direction : "desc") || "desc"
                : normalizeString(Array.isArray(compute?.orderBy) ? compute.orderBy[0]?.direction : "asc") || "asc",
            tieBreakerField: functionId === "rank"
                ? normalizeString(Array.isArray(compute?.orderBy) ? compute.orderBy[1]?.field : "")
                : "",
            windowSize: compute?.windowSize != null ? String(compute.windowSize) : "",
            decimals: compute?.decimals != null ? String(compute.decimals) : "",
        };
    }
    return {
        id: "",
        key: "",
        label: "",
        format: "",
        functionId: "",
        sourceField: "",
        partitionBy: [],
        orderByField: "",
        orderDir: "asc",
        tieBreakerField: "",
        windowSize: "",
        decimals: "",
    };
}

export function buildReportBuilderCalculatedFieldReferenceOptions(config = {}, {
    editingId = "",
} = {}) {
    const ignored = new Set(normalizeStringArray([editingId]));
    const entries = Array.from(buildCalculatedFieldReferenceCatalog(config).values())
        .filter((entry) => entry?.id && !ignored.has(entry.id) && !entry.isTableCalculated)
        .reduce((acc, entry) => {
            if (acc.some((candidate) => candidate.id === entry.id)) {
                return acc;
            }
            return [...acc, entry];
        }, [])
        .sort((left, right) => {
            const kindWeight = (kind = "") => {
                if (kind === "dimension") {
                    return 0;
                }
                if (kind === "measure") {
                    return 1;
                }
                return 2;
            };
            if (kindWeight(left.kind) !== kindWeight(right.kind)) {
                return kindWeight(left.kind) - kindWeight(right.kind);
            }
            return `${left.label} ${left.id}`.localeCompare(`${right.label} ${right.id}`);
        });
    return entries;
}

export function buildReportBuilderTableCalculationFieldOptions(config = {}, {
    editingId = "",
} = {}) {
    const ignored = new Set(normalizeStringArray([editingId]));
    const referenceEntries = Array.from(buildCalculatedFieldReferenceCatalog(config).values())
        .filter((entry) => entry?.id && !ignored.has(entry.id) && !entry.isTableCalculated)
        .reduce((acc, entry) => {
            if (acc.some((candidate) => candidate.id === entry.id)) {
                return acc;
            }
            return [...acc, entry];
        }, []);
    const sourceFields = referenceEntries
        .filter((entry) => entry.kind === "measure")
        .sort((left, right) => `${left.label} ${left.id}`.localeCompare(`${right.label} ${right.id}`));
    const orderFields = referenceEntries
        .sort((left, right) => {
            const weight = (kind = "") => (kind === "dimension" ? 0 : 1);
            if (weight(left.kind) !== weight(right.kind)) {
                return weight(left.kind) - weight(right.kind);
            }
            return `${left.label} ${left.id}`.localeCompare(`${right.label} ${right.id}`);
        });
    const partitionDimensions = (Array.isArray(config?.dimensions) ? config.dimensions : [])
        .map((field) => ({
            id: normalizeString(field?.id || field?.key),
            label: normalizeFieldLabel(field),
        }))
        .filter((field) => field.id)
        .sort((left, right) => `${left.label} ${left.id}`.localeCompare(`${right.label} ${right.id}`));
    return {
        sourceFields,
        orderFields,
        partitionDimensions,
    };
}

export function validateReportBuilderCalculatedFieldDraft(draft = {}, config = {}, {
    editingId = "",
} = {}) {
    const normalizedDraft = buildCalculatedFieldDraftInput(draft);
    const errors = [];
    const pushError = (field, code, message) => {
        errors.push(formatCalculatedFieldValidationError({ field, code, message }));
    };

    if (!normalizedDraft.id) {
        pushError("id", "required", "Field ID is required.");
    }
    if (!normalizedDraft.label) {
        pushError("label", "required", "Label is required.");
    }
    if (!normalizedDraft.expr.trim()) {
        pushError("expr", "required", "Expression is required.");
    }
    if (!["number", "string", "boolean"].includes(normalizedDraft.dataType)) {
        pushError("dataType", "invalid", "Data type must be number, string, or boolean.");
    }

    const reservedAliases = buildCalculatedFieldReservedAliases(config, editingId);
    if (normalizedDraft.id && reservedAliases.has(normalizedDraft.id)) {
        pushError("id", "duplicate", "Field ID must be unique across measures, dimensions, and calculations.");
    }

    let parsedExpression = null;
    if (normalizedDraft.expr.trim()) {
        try {
            parsedExpression = parseReportCalculatedFieldExpression(normalizedDraft.expr);
        } catch (error) {
            pushError("expr", "invalidSyntax", error?.message || "Expression syntax is invalid.");
        }
    }

    const referenceCatalog = buildCalculatedFieldReferenceCatalog(config);
    const selfAliases = new Set(normalizeStringArray([normalizedDraft.id, editingId]));
    if (parsedExpression?.dependencies) {
        const unknownDependencies = [];
        const unsupportedDependencies = [];
        const selfDependencies = [];
        normalizeStringArray(parsedExpression.dependencies).forEach((dependencyId) => {
            if (selfAliases.has(dependencyId)) {
                selfDependencies.push(dependencyId);
                return;
            }
            const entry = referenceCatalog.get(dependencyId);
            if (!entry) {
                unknownDependencies.push(dependencyId);
                return;
            }
            if (entry.isTableCalculated) {
                unsupportedDependencies.push(dependencyId);
            }
        });
        if (selfDependencies.length > 0) {
            pushError("expr", "selfReference", "Calculated fields cannot reference themselves.");
        }
        if (unknownDependencies.length > 0) {
            pushError("expr", "unknownDependency", `Unknown fields in expression: ${unknownDependencies.join(", ")}.`);
        }
        if (unsupportedDependencies.length > 0) {
            pushError("expr", "tableCalcDependency", `Row calculations cannot depend on table calculations: ${unsupportedDependencies.join(", ")}.`);
        }
    }

    if (errors.length > 0) {
        return {
            valid: false,
            errors,
            field: null,
        };
    }

    const field = normalizeReportCalculatedField({
        id: normalizedDraft.id,
        key: normalizedDraft.id,
        label: normalizedDraft.label,
        dataType: normalizedDraft.dataType,
        ...(normalizedDraft.format ? { format: normalizedDraft.format } : {}),
        expr: normalizedDraft.expr,
    });
    if (!field) {
        return {
            valid: false,
            errors: [
                formatCalculatedFieldValidationError({
                    field: "expr",
                    code: "invalid",
                    message: "Calculated field could not be normalized.",
                }),
            ],
            field: null,
        };
    }
    return {
        valid: true,
        errors: [],
        field,
    };
}

function normalizeTableCalculationDraftInput(draft = {}) {
    return {
        id: normalizeString(draft?.id || draft?.key),
        key: normalizeString(draft?.key || draft?.id),
        label: normalizeString(draft?.label),
        format: normalizeString(draft?.format),
        functionId: normalizeString(draft?.functionId || draft?.function),
        sourceField: normalizeString(draft?.sourceField),
        partitionBy: normalizeStringArray(draft?.partitionBy),
        orderByField: normalizeString(draft?.orderByField),
        orderDir: normalizeString(draft?.orderDir || "asc").toLowerCase() === "desc" ? "desc" : "asc",
        tieBreakerField: normalizeString(draft?.tieBreakerField),
        windowSize: normalizeString(draft?.windowSize),
        decimals: normalizeString(draft?.decimals),
    };
}

export function validateReportBuilderTableCalculationDraft(draft = {}, config = {}, {
    editingId = "",
} = {}) {
    const normalizedDraft = normalizeTableCalculationDraftInput(draft);
    const errors = [];
    const pushError = (field, code, message) => {
        errors.push(formatCalculatedFieldValidationError({ field, code, message }));
    };

    if (!normalizedDraft.id) {
        pushError("id", "required", "Field ID is required.");
    }
    if (!normalizedDraft.label) {
        pushError("label", "required", "Label is required.");
    }
    const functionMeta = tableCalculationFunctionMeta(normalizedDraft.functionId);
    if (!functionMeta) {
        pushError("functionId", "required", "Table calculation function is required.");
    }

    const reservedAliases = buildCalculatedFieldReservedAliases(config, editingId);
    if (normalizedDraft.id && reservedAliases.has(normalizedDraft.id)) {
        pushError("id", "duplicate", "Field ID must be unique across measures, dimensions, and calculations.");
    }

    const fieldOptions = buildReportBuilderTableCalculationFieldOptions(config, { editingId });
    const sourceFieldIds = new Set(fieldOptions.sourceFields.map((entry) => entry.id));
    const orderFieldIds = new Set(fieldOptions.orderFields.map((entry) => entry.id));
    const partitionDimensionIds = new Set(fieldOptions.partitionDimensions.map((entry) => entry.id));

    if (!normalizedDraft.sourceField) {
        pushError("sourceField", "required", "Source field is required.");
    } else if (!sourceFieldIds.has(normalizedDraft.sourceField)) {
        pushError("sourceField", "unknownSourceField", `Unknown source field '${normalizedDraft.sourceField}'.`);
    }

    if (functionMeta?.requiresOrder && !normalizedDraft.orderByField) {
        pushError("orderByField", "required", "Order-by field is required.");
    } else if (normalizedDraft.orderByField && !orderFieldIds.has(normalizedDraft.orderByField)) {
        pushError("orderByField", "unknownOrderField", `Unknown order-by field '${normalizedDraft.orderByField}'.`);
    }

    if (functionMeta?.supportsTieBreaker && normalizedDraft.tieBreakerField) {
        if (!orderFieldIds.has(normalizedDraft.tieBreakerField)) {
            pushError("tieBreakerField", "unknownOrderField", `Unknown tie-breaker field '${normalizedDraft.tieBreakerField}'.`);
        } else if (normalizedDraft.tieBreakerField === normalizedDraft.sourceField) {
            pushError("tieBreakerField", "duplicateOrderField", "Tie-breaker field must differ from the source field.");
        }
    }

    const invalidPartitionBy = normalizedDraft.partitionBy.filter((entry) => !partitionDimensionIds.has(entry));
    if (invalidPartitionBy.length > 0) {
        pushError("partitionBy", "unknownPartitionField", `Unknown partition fields: ${invalidPartitionBy.join(", ")}.`);
    }

    if (functionMeta?.requiresWindowSize) {
        const windowSize = Number(normalizedDraft.windowSize);
        if (!Number.isInteger(windowSize) || windowSize <= 0) {
            pushError("windowSize", "required", "Window size must be a positive integer.");
        }
    } else if (normalizedDraft.windowSize) {
        pushError("windowSize", "notSupported", "Window size is only supported for moving averages.");
    }

    if (normalizedDraft.decimals) {
        const decimals = Number(normalizedDraft.decimals);
        if (!functionMeta?.supportsDecimals) {
            pushError("decimals", "notSupported", "Decimals are not supported for this table calculation.");
        } else if (!Number.isInteger(decimals) || decimals < 0) {
            pushError("decimals", "invalid", "Decimals must be a non-negative integer.");
        }
    }

    if (errors.length > 0 || !functionMeta) {
        return {
            valid: false,
            errors,
            field: null,
        };
    }

    const compute = (() => {
        switch (functionMeta.value) {
            case "percentOfTotal":
                return {
                    type: "percentOfTotal",
                    sourceField: normalizedDraft.sourceField,
                    ...(normalizedDraft.partitionBy.length > 0 ? { partitionBy: normalizedDraft.partitionBy } : {}),
                    scale: 100,
                    ...(normalizedDraft.decimals ? { decimals: Number(normalizedDraft.decimals) } : {}),
                };
            case "runningTotal":
            case "deltaFromPrevious":
                return {
                    type: functionMeta.value,
                    sourceField: normalizedDraft.sourceField,
                    orderBy: [
                        { field: normalizedDraft.orderByField, direction: normalizedDraft.orderDir },
                    ],
                    ...(normalizedDraft.partitionBy.length > 0 ? { partitionBy: normalizedDraft.partitionBy } : {}),
                };
            case "movingAverage":
                return {
                    type: "movingAverage",
                    sourceField: normalizedDraft.sourceField,
                    orderBy: [
                        { field: normalizedDraft.orderByField, direction: normalizedDraft.orderDir },
                    ],
                    windowSize: Number(normalizedDraft.windowSize),
                    ...(normalizedDraft.decimals ? { decimals: Number(normalizedDraft.decimals) } : {}),
                    ...(normalizedDraft.partitionBy.length > 0 ? { partitionBy: normalizedDraft.partitionBy } : {}),
                };
            case "rank":
                return {
                    type: "rank",
                    sourceField: normalizedDraft.sourceField,
                    orderBy: [
                        { field: normalizedDraft.sourceField, direction: normalizedDraft.orderDir },
                        ...(normalizedDraft.tieBreakerField
                            ? [{ field: normalizedDraft.tieBreakerField, direction: "asc" }]
                            : []),
                    ],
                    tieMode: "dense",
                    ...(normalizedDraft.partitionBy.length > 0 ? { partitionBy: normalizedDraft.partitionBy } : {}),
                };
            default:
                return null;
        }
    })();

    const format = normalizedDraft.format || functionMeta.defaultFormat || "";
    const field = compute
        ? normalizeReportCalculatedField({
            id: normalizedDraft.id,
            key: normalizedDraft.id,
            label: normalizedDraft.label,
            dataType: "number",
            ...(format ? { format } : {}),
            compute,
        })
        : null;
    if (!field) {
        return {
            valid: false,
            errors: [
                formatCalculatedFieldValidationError({
                    field: "functionId",
                    code: "invalid",
                    message: "Table calculation could not be normalized.",
                }),
            ],
            field: null,
        };
    }
    return {
        valid: true,
        errors: [],
        field,
    };
}

export function upsertReportBuilderLocalCalculatedFieldState(state = {}, draft = {}, config = {}, {
    editingId = "",
    selectOnCreate = true,
} = {}) {
    const validation = validateReportBuilderCalculatedFieldDraft(draft, config, { editingId });
    if (!validation.valid || !validation.field) {
        return {
            valid: false,
            errors: validation.errors,
            nextState: state,
            field: null,
        };
    }
    const field = validation.field;
    const currentFields = normalizeReportBuilderLocalCalculatedFields(state?.localCalculatedFields);
    const targetId = normalizeString(editingId || field.id);
    const hasExisting = currentFields.some((entry) => normalizeString(entry?.id) === targetId);
    const nextFields = hasExisting
        ? currentFields.map((entry) => (normalizeString(entry?.id) === targetId ? field : entry))
        : [...currentFields, field];
    const currentMeasures = normalizeStringArray(state?.selectedMeasures);
    const nextMeasures = hasExisting || !selectOnCreate || currentMeasures.includes(field.id)
        ? currentMeasures
        : [...currentMeasures, field.id];
    const primaryMeasure = hasExisting
        ? normalizeString(state?.primaryMeasure)
        : field.id;
    return {
        valid: true,
        errors: [],
        field,
        nextState: {
            ...state,
            localCalculatedFields: nextFields,
            selectedMeasures: nextMeasures,
            primaryMeasure: primaryMeasure || nextMeasures[0] || "",
        },
    };
}

export function upsertReportBuilderLocalTableCalculationState(state = {}, config = {}, tableCalculationId = "", {
    selectOnCreate = true,
} = {}) {
    const calculationId = normalizeString(tableCalculationId);
    if (!calculationId) {
        return {
            valid: false,
            errors: [formatCalculatedFieldValidationError({
                field: "id",
                code: "required",
                message: "Table calculation ID is required.",
            })],
            nextState: state,
            field: null,
        };
    }
    const definition = normalizeReportCalculatedFields(Array.isArray(config?.tableCalculations) ? config.tableCalculations : [])
        .find((field) => normalizeString(field?.id || field?.key) === calculationId && field?.kind === "tableCalc");
    if (!definition) {
        return {
            valid: false,
            errors: [formatCalculatedFieldValidationError({
                field: "id",
                code: "missingTableCalculation",
                message: "This table calculation is unavailable.",
            })],
            nextState: state,
            field: null,
        };
    }
    const currentFields = normalizeReportBuilderLocalTableCalculations(state?.localTableCalculations);
    const hasExisting = currentFields.some((entry) => normalizeString(entry?.id) === calculationId);
    const nextFields = hasExisting
        ? currentFields.map((entry) => (normalizeString(entry?.id) === calculationId ? definition : entry))
        : [...currentFields, definition];
    const currentMeasures = normalizeStringArray(state?.selectedMeasures);
    const nextMeasures = hasExisting || !selectOnCreate || currentMeasures.includes(calculationId)
        ? currentMeasures
        : [...currentMeasures, calculationId];
    return {
        valid: true,
        errors: [],
        field: definition,
        nextState: {
            ...state,
            localTableCalculations: nextFields,
            selectedMeasures: nextMeasures,
            primaryMeasure: normalizeString(state?.primaryMeasure) || nextMeasures[0] || calculationId,
        },
    };
}

export function upsertReportBuilderLocalTableCalculationDraftState(state = {}, draft = {}, config = {}, {
    editingId = "",
    selectOnCreate = true,
} = {}) {
    const validation = validateReportBuilderTableCalculationDraft(draft, config, { editingId });
    if (!validation.valid || !validation.field) {
        return {
            valid: false,
            errors: validation.errors,
            nextState: state,
            field: null,
        };
    }
    const field = validation.field;
    const currentFields = normalizeReportBuilderLocalTableCalculations(state?.localTableCalculations);
    const targetId = normalizeString(editingId || field.id);
    const hasExisting = currentFields.some((entry) => normalizeString(entry?.id) === targetId);
    const nextFields = hasExisting
        ? currentFields.map((entry) => (normalizeString(entry?.id) === targetId ? field : entry))
        : [...currentFields, field];
    const currentMeasures = normalizeStringArray(state?.selectedMeasures);
    const nextMeasures = hasExisting || !selectOnCreate || currentMeasures.includes(field.id)
        ? currentMeasures
        : [...currentMeasures, field.id];
    const primaryMeasure = hasExisting
        ? normalizeString(state?.primaryMeasure)
        : field.id;
    return {
        valid: true,
        errors: [],
        field,
        nextState: {
            ...state,
            localTableCalculations: nextFields,
            selectedMeasures: nextMeasures,
            primaryMeasure: primaryMeasure || nextMeasures[0] || field.id,
        },
    };
}

function pruneCalculatedFieldFromChartSpec(chartSpec = null, fieldId = "") {
    if (!chartSpec || typeof chartSpec !== "object" || Array.isArray(chartSpec)) {
        return chartSpec;
    }
    const normalizedFieldId = normalizeString(fieldId);
    if (!normalizedFieldId) {
        return cloneValue(chartSpec);
    }
    const nextChartSpec = cloneValue(chartSpec);
    if (Array.isArray(nextChartSpec?.yFields)) {
        nextChartSpec.yFields = nextChartSpec.yFields
            .map((entry) => normalizeString(entry))
            .filter((entry) => entry && entry !== normalizedFieldId);
    }
    if (nextChartSpec?.seriesOptions && typeof nextChartSpec.seriesOptions === "object" && !Array.isArray(nextChartSpec.seriesOptions)) {
        delete nextChartSpec.seriesOptions[normalizedFieldId];
        if (Object.keys(nextChartSpec.seriesOptions).length === 0) {
            delete nextChartSpec.seriesOptions;
        }
    }
    return nextChartSpec;
}

function pruneCalculatedFieldFromPreset(preset = null, fieldId = "") {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
        return preset;
    }
    const normalizedFieldId = normalizeString(fieldId);
    if (!normalizedFieldId) {
        return cloneValue(preset);
    }
    const nextPreset = cloneValue(preset);
    if (Array.isArray(nextPreset?.measures)) {
        nextPreset.measures = nextPreset.measures
            .map((entry) => normalizeString(entry))
            .filter((entry) => entry && entry !== normalizedFieldId);
    }
    if (Array.isArray(nextPreset?.columns)) {
        nextPreset.columns = nextPreset.columns.filter((column) => normalizeString(column?.key) !== normalizedFieldId);
    }
    return nextPreset;
}

export function removeReportBuilderLocalCalculatedFieldState(state = {}, fieldId = "") {
    const normalizedFieldId = normalizeString(fieldId);
    if (!normalizedFieldId) {
        return state;
    }
    const nextFields = normalizeReportBuilderLocalCalculatedFields(state?.localCalculatedFields)
        .filter((entry) => normalizeString(entry?.id) !== normalizedFieldId);
    const nextMeasures = normalizeStringArray(state?.selectedMeasures)
        .filter((entry) => entry !== normalizedFieldId);
    return {
        ...state,
        localCalculatedFields: nextFields,
        selectedMeasures: nextMeasures,
        primaryMeasure: normalizeString(state?.primaryMeasure) === normalizedFieldId
            ? (nextMeasures[0] || "")
            : normalizeString(state?.primaryMeasure),
        orderField: normalizeString(state?.orderField) === normalizedFieldId
            ? ""
            : normalizeString(state?.orderField),
        chartSpec: pruneCalculatedFieldFromChartSpec(state?.chartSpec, normalizedFieldId),
        activeTablePreset: pruneCalculatedFieldFromPreset(state?.activeTablePreset, normalizedFieldId),
        lastTablePreset: pruneCalculatedFieldFromPreset(state?.lastTablePreset, normalizedFieldId),
    };
}

export function removeReportBuilderLocalTableCalculationState(state = {}, fieldId = "") {
    const normalizedFieldId = normalizeString(fieldId);
    if (!normalizedFieldId) {
        return state;
    }
    const nextFields = normalizeReportBuilderLocalTableCalculations(state?.localTableCalculations)
        .filter((entry) => normalizeString(entry?.id) !== normalizedFieldId);
    const nextMeasures = normalizeStringArray(state?.selectedMeasures)
        .filter((entry) => entry !== normalizedFieldId);
    return {
        ...state,
        localTableCalculations: nextFields,
        selectedMeasures: nextMeasures,
        primaryMeasure: normalizeString(state?.primaryMeasure) === normalizedFieldId
            ? (nextMeasures[0] || "")
            : normalizeString(state?.primaryMeasure),
        orderField: normalizeString(state?.orderField) === normalizedFieldId
            ? ""
            : normalizeString(state?.orderField),
        chartSpec: pruneCalculatedFieldFromChartSpec(state?.chartSpec, normalizedFieldId),
        activeTablePreset: pruneCalculatedFieldFromPreset(state?.activeTablePreset, normalizedFieldId),
        lastTablePreset: pruneCalculatedFieldFromPreset(state?.lastTablePreset, normalizedFieldId),
    };
}
