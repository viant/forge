import {
    buildReportBuilderDocumentBlockDraft,
    upsertReportBuilderDocumentBlockState,
} from "./reportBuilderDocumentBlocks.js";

function normalizeString(value = "") {
    return value == null ? "" : String(value).trim();
}

export function buildRepairableReportBuilderDocumentBlockDraft(block = null, {
    existingBlocks = [],
    tableColumnOptions = [],
} = {}) {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
        return null;
    }
    if (normalizeString(block?.kind) !== "tableBlock") {
        return null;
    }
    const currentColumns = (Array.isArray(block?.columns) ? block.columns : [])
        .filter((column) => column && typeof column === "object" && !Array.isArray(column));
    if (currentColumns.length > 0) {
        return null;
    }
    const nextDraft = buildReportBuilderDocumentBlockDraft("tableBlock", block, {
        existingBlocks,
        tableColumnOptions,
    });
    return Array.isArray(nextDraft?.columnKeys) && nextDraft.columnKeys.length > 0
        ? nextDraft
        : null;
}

export function repairReportBuilderDocumentBlockWithCurrentSelection({
    state = {},
    block = null,
    existingBlocks = [],
    valueFieldOptions = [],
    secondaryFieldOptions = [],
    tableColumnOptions = [],
    scopeParamOptions = [],
    chartConfig = null,
    chartFieldOptions = [],
    resolveStateReadiness = () => ({ canRun: false }),
} = {}) {
    const repairDraft = buildRepairableReportBuilderDocumentBlockDraft(block, {
        existingBlocks,
        tableColumnOptions,
    });
    if (!repairDraft) {
        return {
            applied: false,
            repairDraft: null,
            result: null,
            block: null,
            nextState: state,
            didRefreshResults: false,
        };
    }
    const result = upsertReportBuilderDocumentBlockState(state, repairDraft, {
        editingId: normalizeString(block?.id),
        valueFieldOptions,
        secondaryFieldOptions,
        tableColumnOptions,
        scopeParamOptions,
        chartConfig,
        chartFieldOptions,
    });
    if (!result.valid || !result.block) {
        return {
            applied: false,
            repairDraft,
            result,
            block: null,
            nextState: state,
            didRefreshResults: false,
        };
    }
    const preparedReadiness = resolveStateReadiness(result.nextState);
    const didRefreshResults = preparedReadiness?.canRun === true;
    return {
        applied: true,
        repairDraft,
        result,
        block: result.block,
        nextState: result.nextState,
        didRefreshResults,
        feedbackMessage: didRefreshResults
            ? `${result.block.title || result.block.id || "Authored block"} now uses the current fields. Refreshing results.`
            : `${result.block.title || result.block.id || "Authored block"} now uses the current fields.`,
    };
}
