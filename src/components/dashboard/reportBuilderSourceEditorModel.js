function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function parseReportBuilderSourceEditorJSON(value = "", fallback = null) {
    const text = String(value || "").trim();
    if (!text) {
        return fallback;
    }
    return JSON.parse(text);
}

export function buildReportBuilderSourceEditorDraft(datasetOption = null) {
    const normalizedOption = datasetOption && typeof datasetOption === "object" && !Array.isArray(datasetOption)
        ? datasetOption
        : null;
    if (!normalizedOption) {
        return null;
    }
    return {
        value: normalizeString(normalizedOption?.value),
        label: normalizeString(normalizedOption?.label),
        description: normalizeString(normalizedOption?.description),
        toolName: normalizeString(normalizedOption?.source?.toolName || normalizedOption?.source?.tool),
        requestText: JSON.stringify(normalizedOption?.request || {}, null, 2),
        resultShape: normalizeString(normalizedOption?.resultContract?.shape || "rowSet") || "rowSet",
        resultRowPath: normalizeString(normalizedOption?.resultContract?.rowPath),
        resultHasMorePath: normalizeString(normalizedOption?.resultContract?.hasMorePath),
    };
}

export function buildReportBuilderSourceEditorDatasetPatch(draft = null, currentEntry = null) {
    const normalizedDraft = draft && typeof draft === "object" && !Array.isArray(draft)
        ? draft
        : null;
    const normalizedEntry = currentEntry && typeof currentEntry === "object" && !Array.isArray(currentEntry)
        ? currentEntry
        : {};
    if (!normalizedDraft || !normalizeString(normalizedDraft?.value)) {
        return null;
    }
    const nextRequest = parseReportBuilderSourceEditorJSON(normalizedDraft.requestText, {});
    const nextResultShape = normalizeString(normalizedDraft.resultShape || "rowSet") || "rowSet";
    const nextResultRowPath = normalizeString(normalizedDraft.resultRowPath);
    const nextHasMorePath = normalizeString(normalizedDraft.resultHasMorePath);
    const nextResultContract = nextResultRowPath || nextHasMorePath
        ? {
            shape: nextResultShape,
            ...(nextResultRowPath ? { rowPath: nextResultRowPath } : {}),
            ...(nextHasMorePath ? { hasMorePath: nextHasMorePath } : {}),
        }
        : null;
    return {
        label: normalizeString(normalizedDraft.label || normalizedEntry?.label || normalizedDraft.value),
        description: normalizeString(normalizedDraft.description || ""),
        request: nextRequest && typeof nextRequest === "object" && !Array.isArray(nextRequest)
            ? nextRequest
            : cloneValue(normalizedEntry?.request || {}),
        source: {
            ...(normalizedEntry?.source && typeof normalizedEntry.source === "object" && !Array.isArray(normalizedEntry.source)
                ? cloneValue(normalizedEntry.source)
                : {}),
            ...(normalizeString(normalizedDraft.toolName) ? { toolName: normalizeString(normalizedDraft.toolName) } : {}),
        },
        ...(nextResultContract && typeof nextResultContract === "object" && !Array.isArray(nextResultContract)
            ? { resultContract: nextResultContract }
            : {}),
    };
}

export function validateReportBuilderSourceEditorDraft(draft = null) {
    const normalizedDraft = draft && typeof draft === "object" && !Array.isArray(draft)
        ? draft
        : null;
    if (!normalizedDraft) {
        return {
            valid: false,
            errors: [{ field: "draft", message: "Source draft is missing." }],
        };
    }
    const errors = [];
    if (!normalizeString(normalizedDraft?.value)) {
        errors.push({
            field: "value",
            message: "Source identity is missing.",
        });
    }
    if (!normalizeString(normalizedDraft?.label)) {
        errors.push({
            field: "label",
            message: "Enter a source label.",
        });
    }
    const requestText = normalizeString(normalizedDraft?.requestText);
    if (requestText) {
        try {
            const parsed = JSON.parse(requestText);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                errors.push({
                    field: "requestText",
                    message: "Request JSON must decode to an object.",
                });
            }
        } catch (error) {
            errors.push({
                field: "requestText",
                message: `Request JSON is invalid: ${String(error?.message || error || "").trim()}`,
            });
        }
    }
    const rowPath = normalizeString(normalizedDraft?.resultRowPath);
    const hasMorePath = normalizeString(normalizedDraft?.resultHasMorePath);
    const resultShape = normalizeString(normalizedDraft?.resultShape || "rowSet");
    if (!["rowSet", "singleRow"].includes(resultShape)) {
        errors.push({
            field: "resultShape",
            message: "Choose a supported result shape.",
        });
    }
    if (!rowPath && hasMorePath) {
        errors.push({
            field: "resultRowPath",
            message: "Define a row path when a has-more path is set.",
        });
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
