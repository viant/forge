import { stripReportBuilderHydratedDocumentSessionState } from "./reportBuilderHydratedReportDocument.js";
import { applyReportBuilderPersistedRuntimePreviewInteraction } from "./reportBuilderRuntimePreviewInteractionPersistence.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function buildReportBuilderStarterAppliedState(state = {}) {
    const baseState = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    delete baseState.explorationSession;
    return applyReportBuilderPersistedRuntimePreviewInteraction(
        stripReportBuilderHydratedDocumentSessionState(baseState),
        null,
    );
}

export function resolveAutoAppliedReportStarterId({
    requestedReportStarterId = "",
    prefillReportStarterId = "",
    hasPrefill = false,
    currentTemplateId = "",
    authoredBlockCount = 0,
    availableTemplateIds = [],
} = {}) {
    const explicitStarterId = normalizeString(requestedReportStarterId);
    if (explicitStarterId) {
        return explicitStarterId;
    }
    if (!hasPrefill) {
        return "";
    }
    if (normalizeString(currentTemplateId)) {
        return "";
    }
    if (Math.max(0, Number(authoredBlockCount || 0) || 0) > 0) {
        return "";
    }
    const configuredStarterId = normalizeString(prefillReportStarterId);
    if (!configuredStarterId) {
        return "";
    }
    const available = new Set(
        (Array.isArray(availableTemplateIds) ? availableTemplateIds : [])
            .map((entry) => normalizeString(entry))
            .filter(Boolean),
    );
    return available.has(configuredStarterId) ? configuredStarterId : "";
}
