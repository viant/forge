import { stripReportBuilderHydratedDocumentSessionState } from "./reportBuilderHydratedReportDocument.js";
import { applyReportBuilderPersistedRuntimePreviewInteraction } from "./reportBuilderRuntimePreviewInteractionPersistence.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function starterReferenceKeys(value = "") {
    const raw = normalizeString(value);
    if (!raw) {
        return new Set();
    }
    const normalized = raw.toLowerCase();
    const snake = raw
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-z0-9]+/g, "_")
        .toLowerCase()
        .replace(/^_+|_+$/g, "");
    const compact = snake.replace(/_/g, "");
    return new Set([normalized, snake, compact].filter(Boolean));
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function findReportBuilderStarterTemplate(reference = "", availableTemplates = []) {
    const referenceKeys = starterReferenceKeys(reference);
    if (referenceKeys.size === 0) {
        return null;
    }
    return (Array.isArray(availableTemplates) ? availableTemplates : [])
        .find((template) => {
            const templateKeys = new Set([
                ...starterReferenceKeys(template?.id),
                ...starterReferenceKeys(template?.label),
            ]);
            return [...referenceKeys].some((key) => templateKeys.has(key));
        }) || null;
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
    availableTemplates = [],
} = {}) {
    const explicitStarterId = normalizeString(requestedReportStarterId);
    if (explicitStarterId) {
        const matchedTemplate = findReportBuilderStarterTemplate(explicitStarterId, availableTemplates);
        return normalizeString(matchedTemplate?.id) || explicitStarterId;
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
