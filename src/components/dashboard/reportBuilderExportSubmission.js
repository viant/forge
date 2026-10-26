function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function resolveReportBuilderExportSubmission({
    request = null,
    sourceKind = "",
    conversationId = "",
    reportExportHandler = null,
    runReference = null,
    requireRunReference = false,
    builderSelection = null,
    signal = undefined,
    tableBlockId = undefined,
    windowParameters = null,
    tablePresentations = null,
} = {}) {
    if (!requireRunReference && builderSelection && typeof reportExportHandler?.exportCurrent === "function") {
        const input = {
            builder: cloneValue(typeof builderSelection === "function" ? builderSelection() : builderSelection),
            ...(windowParameters ? {parameters:cloneValue(typeof windowParameters === "function" ? windowParameters() : windowParameters)} : {}),
            ...(tablePresentations ? {tablePresentations:cloneValue(tablePresentations)} : {}),
            format: normalizeString(request?.target?.format).toLowerCase(),
            ...((tableBlockId ?? request?.target?.tableBlockId) !== undefined
                ? { tableBlockId: normalizeString(tableBlockId ?? request.target.tableBlockId) } : {}),
        };
        return {
            mode: "current",
            input,
            execute: () => reportExportHandler.exportCurrent(input, { signal }),
        };
    }
    const reportRunId = normalizeString(runReference?.reportRunId);
    const isPdf = normalizeString(request?.target?.format).toLowerCase() === "pdf";
    if (reportRunId && isPdf) {
        if (typeof reportExportHandler?.submitRun !== "function") {
            return null;
        }
        const input = {
            reportRunId,
            format: "pdf",
            conversationId: normalizeString(conversationId),
            source: normalizeString(sourceKind),
        };
        return {
            mode: "run",
            input,
            execute: () => reportExportHandler.submitRun(input),
        };
    }
    if (requireRunReference) {
        return null;
    }
    if (typeof reportExportHandler?.submitRequest === "function") {
        const input = {
            request: cloneValue(request),
            source: normalizeString(sourceKind),
        };
        return {
            mode: "legacy",
            input,
            execute: () => reportExportHandler.submitRequest(input),
        };
    }
    return null;
}
