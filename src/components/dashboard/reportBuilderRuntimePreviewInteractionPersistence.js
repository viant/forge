import { normalizeReportRuntimeInteractionState } from "./reportRuntimeInteractionStateModel.js";

export const REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY = "reportDocumentRuntimePreviewInteraction";

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function resolveReportBuilderPersistedRuntimePreviewInteraction(state = {}) {
    return normalizeReportRuntimeInteractionState(
        state?.[REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY],
        { allowEmpty: false },
    );
}

export function applyReportBuilderPersistedRuntimePreviewInteraction(state = {}, runtimePreviewInteraction = null) {
    const next = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    const normalizedRuntimePreviewInteraction = normalizeReportRuntimeInteractionState(
        runtimePreviewInteraction,
        { allowEmpty: false },
    );
    if (!normalizedRuntimePreviewInteraction) {
        delete next[REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY];
        return next;
    }
    next[REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY] = normalizedRuntimePreviewInteraction;
    return next;
}
