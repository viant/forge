import {
    SEMANTIC_AGGREGATIONS,
    SEMANTIC_BINDING_MODES,
    SEMANTIC_CERTIFICATIONS,
    SEMANTIC_DATA_TYPES,
    SEMANTIC_FIELD_TYPES,
    SEMANTIC_GOVERNANCE_STATUSES,
    SEMANTIC_TIME_GRAINS,
    normalizeSemanticArray,
    normalizeSemanticString,
} from "./modelSchema.js";
import { normalizeSemanticModelRef } from "./modelRef.js";

function pushError(errors, field, code, message) {
    errors.push({ field, code, message });
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeGovernance(governance = {}) {
    if (!isPlainObject(governance)) {
        return null;
    }
    const status = normalizeSemanticString(governance.status).toLowerCase();
    const certification = normalizeSemanticString(governance.certification).toLowerCase();
    const ownerRef = normalizeSemanticString(governance.ownerRef);
    const classification = normalizeSemanticString(governance.classification);
    const deprecation = normalizeSemanticString(governance.deprecation);
    const next = {};
    if (status) next.status = status;
    if (certification) next.certification = certification;
    if (ownerRef) next.ownerRef = ownerRef;
    if (classification) next.classification = classification;
    if (deprecation) next.deprecation = deprecation;
    return Object.keys(next).length > 0 ? next : null;
}

function normalizeSemanticFeatureType(type = "", fallbackType = "") {
    const normalizedType = normalizeSemanticString(type).toLowerCase();
    if (SEMANTIC_FIELD_TYPES.includes(normalizedType)) {
        return normalizedType;
    }
    const normalizedFallbackType = normalizeSemanticString(fallbackType).toLowerCase();
    if (SEMANTIC_FIELD_TYPES.includes(normalizedFallbackType)) {
        return normalizedFallbackType;
    }
    return "";
}

function normalizeSemanticField(field = {}, defaults = {}) {
    if (!isPlainObject(field)) {
        return null;
    }
    const id = normalizeSemanticString(field.id || field.key);
    if (!id) {
        return null;
    }
    const key = normalizeSemanticString(field.key || id);
    const label = normalizeSemanticString(field.label || id);
    const dataType = normalizeSemanticString(field.dataType || defaults.dataType).toLowerCase();
    const format = normalizeSemanticString(field.format);
    const aggregation = normalizeSemanticString(field.aggregation || defaults.aggregation).toLowerCase();
    const timeGrainSupport = normalizeSemanticArray(field.timeGrainSupport).map((entry) => entry.toLowerCase());
    const category = normalizeSemanticString(field.category);
    const description = normalizeSemanticString(field.description);
    const definitionRef = normalizeSemanticString(field.definitionRef);
    const sourceRef = normalizeSemanticString(field.sourceRef);
    const relationshipRef = normalizeSemanticString(field.relationshipRef);
    const governance = normalizeGovernance(field.governance);
    const featureType = normalizeSemanticFeatureType(field.featureType, defaults.featureType);
    return {
        id,
        key,
        label,
        ...(featureType ? { featureType } : {}),
        ...(description ? { description } : {}),
        ...(category ? { category } : {}),
        ...(dataType ? { dataType } : {}),
        ...(format ? { format } : {}),
        ...(aggregation ? { aggregation } : {}),
        ...(timeGrainSupport.length > 0 ? { timeGrainSupport } : {}),
        ...(definitionRef ? { definitionRef } : {}),
        ...(sourceRef ? { sourceRef } : {}),
        ...(relationshipRef ? { relationshipRef } : {}),
        ...(governance ? { governance } : {}),
    };
}

function normalizeSemanticEntity(entity = {}) {
    if (!isPlainObject(entity)) {
        return null;
    }
    const id = normalizeSemanticString(entity.id || entity.name);
    if (!id) {
        return null;
    }
    const label = normalizeSemanticString(entity.label || id);
    const description = normalizeSemanticString(entity.description);
    const flatFields = (Array.isArray(entity.fields) ? entity.fields : [])
        .map((entry) => normalizeSemanticField(entry))
        .filter(Boolean);
    const dimensions = [
        ...(Array.isArray(entity.dimensions) ? entity.dimensions : [])
            .map((entry) => normalizeSemanticField(entry, { dataType: "string", featureType: "dimension" }))
            .filter(Boolean),
        ...flatFields.filter((entry) => entry.featureType === "dimension"),
    ];
    const measures = [
        ...(Array.isArray(entity.measures) ? entity.measures : [])
            .map((entry) => normalizeSemanticField(entry, { dataType: "number", featureType: "measure" }))
            .filter(Boolean),
        ...flatFields.filter((entry) => entry.featureType === "measure"),
    ];
    const parameters = [
        ...(Array.isArray(entity.parameters) ? entity.parameters : [])
            .map((entry) => normalizeSemanticField(entry, { featureType: "parameter" }))
            .filter(Boolean),
        ...flatFields.filter((entry) => entry.featureType === "parameter"),
    ];
    const relationships = (Array.isArray(entity.relationships) ? entity.relationships : [])
        .map((entry) => {
            if (!isPlainObject(entry)) {
                return null;
            }
            const id = normalizeSemanticString(entry.id || entry.relationshipRef);
            const label = normalizeSemanticString(entry.label || id);
            const relationshipRef = normalizeSemanticString(entry.relationshipRef);
            if (!id) {
                return null;
            }
            return {
                id,
                ...(label ? { label } : {}),
                ...(relationshipRef ? { relationshipRef } : {}),
            };
        })
        .filter(Boolean);
    const governance = normalizeGovernance(entity.governance);
    return {
        id,
        label,
        ...(description ? { description } : {}),
        ...(dimensions.length > 0 ? { dimensions } : { dimensions: [] }),
        ...(measures.length > 0 ? { measures } : { measures: [] }),
        ...(parameters.length > 0 ? { parameters } : {}),
        ...(relationships.length > 0 ? { relationships } : {}),
        ...(governance ? { governance } : {}),
    };
}

export function normalizeSemanticModel(model = {}) {
    if (!isPlainObject(model)) {
        return null;
    }
    const modelRef = normalizeSemanticModelRef(model.modelRef || model.id);
    const version = Number(model.version || 0) || undefined;
    const label = normalizeSemanticString(model.label || model.name);
    const description = normalizeSemanticString(model.description);
    const entities = (Array.isArray(model.entities) ? model.entities : [])
        .map((entry) => normalizeSemanticEntity(entry))
        .filter(Boolean);
    return {
        ...(modelRef ? { modelRef } : {}),
        ...(version !== undefined ? { version } : {}),
        ...(label ? { label } : {}),
        ...(description ? { description } : {}),
        entities,
    };
}

export function validateSemanticModel(model = {}) {
    const normalized = normalizeSemanticModel(model);
    const errors = [];
    if (!normalized) {
        pushError(errors, "model", "invalid", "Semantic model must be an object.");
        return { valid: false, errors, normalizedModel: null };
    }
    if (!normalized.modelRef) {
        pushError(errors, "modelRef", "required", "Semantic model requires a valid modelRef.");
    }
    if (!Array.isArray(normalized.entities) || normalized.entities.length === 0) {
        pushError(errors, "entities", "required", "Semantic model requires at least one entity.");
    }
    const entityIds = new Set();
    (normalized.entities || []).forEach((entity, entityIndex) => {
        const rawEntity = Array.isArray(model?.entities) ? model.entities[entityIndex] : null;
        (Array.isArray(rawEntity?.fields) ? rawEntity.fields : []).forEach((field, fieldIndex) => {
            const featureType = normalizeSemanticFeatureType(field?.featureType);
            if (!normalizeSemanticString(field?.featureType)) {
                pushError(
                    errors,
                    `entities[${entityIndex}].fields[${fieldIndex}].featureType`,
                    "required",
                    "Semantic flat field entries require a featureType.",
                );
                return;
            }
            if (!featureType) {
                pushError(
                    errors,
                    `entities[${entityIndex}].fields[${fieldIndex}].featureType`,
                    "invalid",
                    `Unsupported semantic featureType '${field?.featureType}'.`,
                );
            }
        });
        if (entityIds.has(entity.id)) {
            pushError(errors, `entities[${entityIndex}].id`, "duplicate", `Duplicate entity id '${entity.id}'.`);
        } else {
            entityIds.add(entity.id);
        }
        const fieldIds = new Set();
        const checkField = (field, fieldPath) => {
            if (!field?.id) {
                pushError(errors, `${fieldPath}.id`, "required", "Semantic field requires an id.");
                return;
            }
            if (fieldIds.has(field.id)) {
                pushError(errors, `${fieldPath}.id`, "duplicate", `Duplicate field id '${field.id}' in entity '${entity.id}'.`);
            } else {
                fieldIds.add(field.id);
            }
            if (field.dataType && !SEMANTIC_DATA_TYPES.includes(field.dataType)) {
                pushError(errors, `${fieldPath}.dataType`, "invalid", `Unsupported semantic dataType '${field.dataType}'.`);
            }
            if (field.aggregation && !SEMANTIC_AGGREGATIONS.includes(field.aggregation)) {
                pushError(errors, `${fieldPath}.aggregation`, "invalid", `Unsupported aggregation '${field.aggregation}'.`);
            }
            (field.timeGrainSupport || []).forEach((grain, grainIndex) => {
                if (!SEMANTIC_TIME_GRAINS.includes(grain)) {
                    pushError(errors, `${fieldPath}.timeGrainSupport[${grainIndex}]`, "invalid", `Unsupported time grain '${grain}'.`);
                }
            });
            const governance = field.governance || {};
            if (governance.status && !SEMANTIC_GOVERNANCE_STATUSES.includes(governance.status)) {
                pushError(errors, `${fieldPath}.governance.status`, "invalid", `Unsupported governance status '${governance.status}'.`);
            }
            if (governance.certification && !SEMANTIC_CERTIFICATIONS.includes(governance.certification)) {
                pushError(errors, `${fieldPath}.governance.certification`, "invalid", `Unsupported certification '${governance.certification}'.`);
            }
        };
        (entity.dimensions || []).forEach((field, index) => checkField(field, `entities[${entityIndex}].dimensions[${index}]`));
        (entity.measures || []).forEach((field, index) => checkField(field, `entities[${entityIndex}].measures[${index}]`));
        (entity.parameters || []).forEach((field, index) => checkField(field, `entities[${entityIndex}].parameters[${index}]`));
    });
    return {
        valid: errors.length === 0,
        errors,
        normalizedModel: normalized,
    };
}

export function normalizeSemanticBinding(binding = {}) {
    if (!isPlainObject(binding)) {
        return null;
    }
    const mode = normalizeSemanticString(binding.mode).toLowerCase();
    if (!mode || !SEMANTIC_BINDING_MODES.includes(mode)) {
        return null;
    }
    if (mode === "raw") {
        return { mode: "raw" };
    }
    const modelRef = normalizeSemanticModelRef(binding.modelRef);
    const entity = normalizeSemanticString(binding.entity);
    const selectedDimensions = normalizeSemanticArray(binding.selectedDimensions);
    const selectedMeasures = normalizeSemanticArray(binding.selectedMeasures);
    return {
        mode: "semantic",
        ...(modelRef ? { modelRef } : {}),
        ...(entity ? { entity } : {}),
        ...(selectedDimensions.length > 0 ? { selectedDimensions } : { selectedDimensions: [] }),
        ...(selectedMeasures.length > 0 ? { selectedMeasures } : { selectedMeasures: [] }),
    };
}

export function validateSemanticBinding(binding = {}, model = null) {
    const normalized = normalizeSemanticBinding(binding);
    const errors = [];
    if (!normalized) {
        pushError(errors, "binding", "invalid", "Semantic binding must declare a supported mode.");
        return { valid: false, errors, normalizedBinding: null };
    }
    if (normalized.mode === "raw") {
        return { valid: true, errors, normalizedBinding: normalized };
    }
    if (!normalized.modelRef) {
        pushError(errors, "binding.modelRef", "required", "Semantic binding requires a valid modelRef.");
    }
    if (!normalized.entity) {
        pushError(errors, "binding.entity", "required", "Semantic binding requires an entity.");
    }
    if (model) {
        const validatedModel = validateSemanticModel(model);
        const entity = validatedModel.normalizedModel?.entities?.find((entry) => entry.id === normalized.entity);
        if (!entity) {
            pushError(errors, "binding.entity", "unknownEntity", `Unknown semantic entity '${normalized.entity}'.`);
        } else {
            const dimensionIds = new Set((entity.dimensions || []).map((entry) => entry.id));
            const measureIds = new Set((entity.measures || []).map((entry) => entry.id));
            normalized.selectedDimensions.forEach((id, index) => {
                if (!dimensionIds.has(id)) {
                    pushError(errors, `binding.selectedDimensions[${index}]`, "unknownDimension", `Unknown semantic dimension '${id}'.`);
                }
            });
            normalized.selectedMeasures.forEach((id, index) => {
                if (!measureIds.has(id)) {
                    pushError(errors, `binding.selectedMeasures[${index}]`, "unknownMeasure", `Unknown semantic measure '${id}'.`);
                }
            });
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        normalizedBinding: normalized,
    };
}
