import { normalizeReportBuilderDocumentBlocks } from "../../reporting/reportDocumentModel.js";
import { buildReportBuilderCalculatedFieldConfig } from "./reportBuilderCalculatedFieldAuthoring.js";
import {
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderDocumentCompileValidation,
    normalizeReportBuilderDocumentLayoutState,
} from "./reportBuilderDocumentBlocks.js";
import {
    buildReportBuilderChartFields,
    getSelectableReportBuilderMeasures,
    getVisibleReportBuilderDimensions,
    mergeReportBuilderState,
    normalizeReportBuilderChartSpec,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";

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
        (Array.isArray(config?.staticFilters) ? config.staticFilters : [])
            .map((filter) => normalizeString(filter?.id || filter?.field))
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
    Object.keys(isPlainObject(statePatch?.staticFilters) ? statePatch.staticFilters : {}).forEach((filterId) => {
        const normalizedFilterId = normalizeString(filterId);
        if (!normalizedFilterId || availableStaticFilterIds.has(normalizedFilterId)) {
            return;
        }
        diagnostics.push({
            id: `templateFilterUnavailable:${normalizedTemplate.id}:${normalizedFilterId}`,
            code: "templateFilterUnavailable",
            severity: "error",
            path: `template.state.staticFilters.${normalizedFilterId}`,
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
    return {
        id,
        label,
        description: normalizeString(template.description),
        statePatch: normalizeTemplateStatePatch(template.statePatch || template.state),
        documentPatch: normalizeTemplateDocumentPatch(template.documentPatch || template.document),
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

export function instantiateReportBuilderDocumentTemplate(config = {}, template = null) {
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

    const nextState = mergeReportBuilderState(config, normalizedTemplate.statePatch);
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
