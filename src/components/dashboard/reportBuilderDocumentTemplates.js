import { normalizeReportBuilderDocumentBlocks } from "../../reporting/reportDocumentModel.js";
import {
    getScopeParamValue,
    hasScopeParamValues,
    listScopeParamValues,
    resolveScopeParamId,
    scopeParamStatePath,
    scopeParamStateSlice,
} from "../../reporting/scopeStateModel.js";
import { buildReportBuilderCalculatedFieldConfig } from "./reportBuilderCalculatedFieldAuthoring.js";
import {
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderDocumentCompileValidation,
    normalizeReportBuilderDocumentLayoutState,
} from "./reportBuilderDocumentBlocks.js";
import {
    buildReportBuilderDefaultState,
    buildReportBuilderChartFields,
    getSelectableReportBuilderMeasures,
    getVisibleReportBuilderDimensions,
    mergeReportBuilderState,
    normalizeReportBuilderChartSpec,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";
import { resolveReportBuilderScopeParamFilters } from "./reportBuilderPredicates.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeTemplateStatePatch(statePatch = null) {
    if (!isPlainObject(statePatch)) {
        return {};
    }
    const next = cloneValue(statePatch);
    delete next.reportDocumentBlocks;
    delete next.reportDocumentLayout;
    delete next.reportDocumentTitle;
    delete next.reportDocumentSubtitle;
    delete next.reportDocumentDescription;
    return next;
}

function normalizeTemplateDocumentPatch(documentPatch = null) {
    if (!isPlainObject(documentPatch)) {
        return {
            title: "",
            subtitle: "",
            description: "",
            blocks: [],
            layout: null,
        };
    }
    const blocks = normalizeReportBuilderDocumentBlocks(documentPatch.blocks);
    return {
        title: normalizeString(documentPatch.title),
        subtitle: normalizeString(documentPatch.subtitle),
        description: normalizeString(documentPatch.description),
        blocks,
        layout: blocks.length > 0
            ? normalizeReportBuilderDocumentLayoutState(documentPatch.layout, blocks)
            : null,
    };
}

function stableStringify(value) {
    return JSON.stringify(value == null ? null : value);
}

function isPreservableStaticFilterValue(filter = {}, value = null) {
    if (value == null) {
        return false;
    }
    if (filter?.type === "dateRange") {
        return !!normalizeString(value?.start) && !!normalizeString(value?.end);
    }
    if (filter?.multiple) {
        return Array.isArray(value) && value.length > 0;
    }
    return normalizeString(value) !== "";
}

function preserveMeaningfulScopeParamValues(config = {}, templateScopeValues = null, baseScopeValues = null) {
    const defaults = buildReportBuilderDefaultState(config);
    const scopeParamFilterIndex = new Map(
        resolveReportBuilderScopeParamFilters(config)
            .map((filter) => [resolveScopeParamId(filter), filter]),
    );
    const nextScopeValues = isPlainObject(templateScopeValues)
        ? cloneValue(templateScopeValues)
        : {};
    if (!isPlainObject(baseScopeValues)) {
        return nextScopeValues;
    }
    Object.entries(baseScopeValues).forEach(([filterId, baseValue]) => {
        const normalizedFilterId = normalizeString(filterId);
        if (!normalizedFilterId) {
            return;
        }
        const filter = scopeParamFilterIndex.get(normalizedFilterId) || null;
        if (filter && !isPreservableStaticFilterValue(filter, baseValue)) {
            return;
        }
        const defaultValue = getScopeParamValue(defaults, normalizedFilterId);
        if (stableStringify(baseValue) === stableStringify(defaultValue)) {
            return;
        }
        nextScopeValues[normalizedFilterId] = cloneValue(baseValue);
    });
    return nextScopeValues;
}

function preserveMeaningfulDynamicGroups(config = {}, templateDynamicGroups = null, baseDynamicGroups = null) {
    const defaults = buildReportBuilderDefaultState(config);
    const nextDynamicGroups = isPlainObject(templateDynamicGroups)
        ? cloneValue(templateDynamicGroups)
        : {};
    if (!isPlainObject(baseDynamicGroups)) {
        return nextDynamicGroups;
    }
    Object.entries(baseDynamicGroups).forEach(([groupId, baseRows]) => {
        const normalizedGroupId = normalizeString(groupId);
        if (!normalizedGroupId) {
            return;
        }
        const defaultRows = defaults?.dynamicGroups?.[normalizedGroupId];
        if (stableStringify(baseRows) === stableStringify(defaultRows)) {
            return;
        }
        nextDynamicGroups[normalizedGroupId] = cloneValue(baseRows);
    });
    return nextDynamicGroups;
}

function buildTemplateStateDiagnostics(config = {}, template = null, nextState = {}) {
    const diagnostics = [];
    const normalizedTemplate = template && typeof template === "object" ? template : null;
    if (!normalizedTemplate) {
        return diagnostics;
    }
    const templateLabel = normalizeString(normalizedTemplate.label || normalizedTemplate.id || "Template") || "Template";
    const statePatch = normalizedTemplate.statePatch && typeof normalizedTemplate.statePatch === "object"
        ? normalizedTemplate.statePatch
        : {};
    const calculatedFieldConfig = buildReportBuilderCalculatedFieldConfig(config, nextState);
    const availableDimensionIds = new Set(
        getVisibleReportBuilderDimensions(calculatedFieldConfig)
            .map((dimension) => normalizeString(dimension?.id))
            .filter(Boolean),
    );
    const availableMeasureIds = new Set(
        getSelectableReportBuilderMeasures(calculatedFieldConfig)
            .map((measure) => normalizeString(measure?.id))
            .filter(Boolean),
    );
    const availableStaticFilterIds = new Set(
        resolveReportBuilderScopeParamFilters(config)
            .map((filter) => resolveScopeParamId(filter))
            .filter(Boolean),
    );

    (Array.isArray(statePatch?.selectedDimensions) ? statePatch.selectedDimensions : []).forEach((dimensionId, index) => {
        const normalizedDimensionId = normalizeString(dimensionId);
        if (!normalizedDimensionId || availableDimensionIds.has(normalizedDimensionId)) {
            return;
        }
        diagnostics.push({
            id: `templateDimensionUnavailable:${normalizedTemplate.id}:${normalizedDimensionId}`,
            code: "templateDimensionUnavailable",
            severity: "error",
            path: `template.state.selectedDimensions[${index}]`,
            message: `${templateLabel} references unavailable dimension '${normalizedDimensionId}'.`,
            suggestedFix: "Update the template to use one of the current builder dimensions or restore the missing dimension in the builder config.",
        });
    });
    (Array.isArray(statePatch?.selectedMeasures) ? statePatch.selectedMeasures : []).forEach((measureId, index) => {
        const normalizedMeasureId = normalizeString(measureId);
        if (!normalizedMeasureId || availableMeasureIds.has(normalizedMeasureId)) {
            return;
        }
        diagnostics.push({
            id: `templateMeasureUnavailable:${normalizedTemplate.id}:${normalizedMeasureId}`,
            code: "templateMeasureUnavailable",
            severity: "error",
            path: `template.state.selectedMeasures[${index}]`,
            message: `${templateLabel} references unavailable measure '${normalizedMeasureId}'.`,
            suggestedFix: "Update the template to use one of the current builder measures or restore the missing measure in the builder config.",
        });
    });
    Object.keys(listScopeParamValues(statePatch)).forEach((filterId) => {
        const normalizedFilterId = normalizeString(filterId);
        if (!normalizedFilterId || availableStaticFilterIds.has(normalizedFilterId)) {
            return;
        }
        diagnostics.push({
            id: `templateFilterUnavailable:${normalizedTemplate.id}:${normalizedFilterId}`,
            code: "templateFilterUnavailable",
            severity: "error",
            path: `template.state.${scopeParamStatePath(normalizedFilterId)}`,
            message: `${templateLabel} references unavailable static filter '${normalizedFilterId}'.`,
            suggestedFix: "Update the template to use one of the current builder filters or restore the missing filter in the builder config.",
        });
    });
    const requestedChartSpec = isPlainObject(statePatch?.chartSpec)
        ? normalizeReportBuilderChartSpec(statePatch.chartSpec)
        : null;
    if (requestedChartSpec) {
        const chartFields = buildReportBuilderChartFields(calculatedFieldConfig, nextState);
        const validation = validateReportBuilderChartSpec(calculatedFieldConfig, requestedChartSpec, chartFields);
        validation.errors.forEach((error, index) => {
            diagnostics.push({
                id: `templateChartInvalid:${normalizedTemplate.id}:${normalizeString(error?.field || "chartSpec")}:${index + 1}`,
                code: "templateChartInvalid",
                severity: "error",
                path: `template.state.chartSpec.${normalizeString(error?.field || "chartSpec")}`,
                message: `${templateLabel} contains an invalid chart preset for the current builder selection.`,
                suggestedFix: "Update the template chart settings to match the current selected dimensions and measures.",
            });
        });
    }
    return diagnostics;
}

export function normalizeReportBuilderDocumentTemplate(template = null) {
    if (!template || typeof template !== "object" || Array.isArray(template)) {
        return null;
    }
    const id = normalizeString(template.id);
    const label = normalizeString(template.label || id);
    if (!id || !label) {
        return null;
    }
    const documentPatch = normalizeTemplateDocumentPatch(template.documentPatch || template.document);
    const datasetRefs = Array.from(
        new Set(
            documentPatch.blocks
                .map((block) => normalizeString(block?.datasetRef))
                .filter(Boolean),
        ),
    );
    return {
        id,
        label,
        description: normalizeString(template.description),
        statePatch: normalizeTemplateStatePatch(template.statePatch || template.state),
        documentPatch,
        datasetRefs,
        datasetCount: datasetRefs.length,
        blockCount: documentPatch.blocks.length,
    };
}

export function normalizeReportBuilderDocumentTemplates(templates = []) {
    const seen = new Set();
    return (Array.isArray(templates) ? templates : [])
        .map((template) => normalizeReportBuilderDocumentTemplate(template))
        .filter((template) => {
            if (!template || seen.has(template.id)) {
                return false;
            }
            seen.add(template.id);
            return true;
        });
}

export function buildBlankReportBuilderDocumentState(config = {}, {
    baseState = null,
} = {}) {
    const nextBaseState = isPlainObject(baseState) ? cloneValue(baseState) : {};
    Object.assign(nextBaseState, scopeParamStateSlice(preserveMeaningfulScopeParamValues(
        config,
        null,
        listScopeParamValues(nextBaseState),
    )));
    delete nextBaseState.reportDocumentTitle;
    delete nextBaseState.reportDocumentSubtitle;
    delete nextBaseState.reportDocumentDescription;
    delete nextBaseState.reportDocumentBlocks;
    delete nextBaseState.reportDocumentLayout;
    delete nextBaseState.reportDocumentTemplateId;
    delete nextBaseState.reportDocumentTemplateLabel;
    return mergeReportBuilderState(config, nextBaseState);
}

export function instantiateReportBuilderDocumentTemplate(config = {}, template = null, {
    baseState = null,
    preserveInputState = false,
} = {}) {
    const normalizedTemplate = normalizeReportBuilderDocumentTemplate(template);
    if (!normalizedTemplate) {
        return {
            valid: false,
            diagnostics: [{
                id: "templateInvalid",
                code: "templateInvalid",
                severity: "error",
                path: "template",
                message: "The selected report template is invalid.",
                suggestedFix: "Choose a different template or fix the provider-supplied template payload.",
            }],
            nextState: null,
            template: null,
        };
    }

    const baseTemplateState = isPlainObject(baseState) ? cloneValue(baseState) : {};
    const templatePatchScopeValues = hasScopeParamValues(normalizedTemplate.statePatch)
        ? listScopeParamValues(normalizedTemplate.statePatch)
        : null;
    const baseScopeValues = hasScopeParamValues(baseTemplateState)
        ? listScopeParamValues(baseTemplateState)
        : null;
    const seedScopeValues = preserveInputState
        ? preserveMeaningfulScopeParamValues(config, templatePatchScopeValues, baseScopeValues)
        : cloneValue(templatePatchScopeValues ?? baseScopeValues ?? {});
    const mergedTemplateSeed = {
        ...baseTemplateState,
        ...normalizedTemplate.statePatch,
        ...scopeParamStateSlice(seedScopeValues),
        dynamicGroups: preserveInputState
            ? preserveMeaningfulDynamicGroups(
                config,
                normalizedTemplate.statePatch?.dynamicGroups,
                baseTemplateState?.dynamicGroups,
            )
            : (
                isPlainObject(normalizedTemplate.statePatch?.dynamicGroups)
                    ? cloneValue(normalizedTemplate.statePatch.dynamicGroups)
                    : (isPlainObject(baseTemplateState?.dynamicGroups) ? cloneValue(baseTemplateState.dynamicGroups) : undefined)
            ),
    };
    const nextState = mergeReportBuilderState(config, mergedTemplateSeed);
    if (normalizedTemplate.documentPatch.title) {
        nextState.reportDocumentTitle = normalizedTemplate.documentPatch.title;
    } else {
        delete nextState.reportDocumentTitle;
    }
    if (normalizedTemplate.documentPatch.subtitle) {
        nextState.reportDocumentSubtitle = normalizedTemplate.documentPatch.subtitle;
    } else {
        delete nextState.reportDocumentSubtitle;
    }
    if (normalizedTemplate.documentPatch.description) {
        nextState.reportDocumentDescription = normalizedTemplate.documentPatch.description;
    } else {
        delete nextState.reportDocumentDescription;
    }
    const templateBlocks = normalizedTemplate.documentPatch.blocks;
    if (templateBlocks.length > 0) {
        nextState.reportDocumentBlocks = cloneValue(templateBlocks);
        nextState.reportDocumentLayout = cloneValue(
            normalizedTemplate.documentPatch.layout
            || normalizeReportBuilderDocumentLayoutState(null, templateBlocks),
        );
    } else {
        delete nextState.reportDocumentBlocks;
        delete nextState.reportDocumentLayout;
    }
    nextState.reportDocumentTemplateId = normalizedTemplate.id;
    nextState.reportDocumentTemplateLabel = normalizedTemplate.label;

    const diagnostics = [
        ...buildTemplateStateDiagnostics(config, normalizedTemplate, nextState),
        ...buildReportBuilderDocumentCompileDiagnostics({
            config,
            state: nextState,
        }),
    ];
    const validation = buildReportBuilderDocumentCompileValidation(diagnostics);
    return {
        valid: validation.valid,
        diagnostics,
        validation,
        nextState,
        template: normalizedTemplate,
    };
}
