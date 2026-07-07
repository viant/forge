import { resolveReportBuilderReadiness as resolveBaseReportBuilderReadiness } from "./reportBuilderUtils.js";
import {
    buildReportBuilderSemanticFieldValidation,
    buildReportBuilderSemanticStatus,
    buildReportBuilderSemanticValidationRequest,
    summarizeReportBuilderSemanticDiagnostics,
} from "./reportBuilderSemantic.js";

function normalizeSemanticValidationState(state = {}) {
    return {
        fingerprint: String(state?.fingerprint || "").trim(),
        loading: !!state?.loading,
        error: String(state?.error || "").trim(),
        valid: state?.valid === true ? true : (state?.valid === false ? false : null),
        diagnostics: Array.isArray(state?.diagnostics) ? state.diagnostics : [],
    };
}

export function hasRetryableSemanticValidationDiagnostics(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : []).some((diagnostic) => {
        const code = String(diagnostic?.code || "").trim();
        return code === "semanticModelError"
            || code === "semanticModelUnavailable"
            || code === "unknownModel";
    });
}

export function resolveSemanticValidationIssueKind(diagnostics = []) {
    return hasRetryableSemanticValidationDiagnostics(diagnostics)
        ? "semanticModelResolution"
        : "";
}

export function resolveReportBuilderStateReadiness({
    config = {},
    state = {},
    semanticModelProvider = null,
    semanticModelState = {},
    semanticSelectionValidationState = {},
    semanticModelRetryAvailable = false,
    semanticRetryAvailable = false,
} = {}) {
    const baseReadiness = resolveBaseReportBuilderReadiness(config, state);
    if (!baseReadiness.canRun) {
        return {
            ...baseReadiness,
            message: "",
        };
    }

    const nextBinding = state?.binding || config?.binding;
    if (nextBinding?.mode !== "semantic") {
        return {
            ...baseReadiness,
            message: "",
        };
    }

    const normalizedSemanticModelState = {
        loading: !!semanticModelState?.loading,
        error: String(semanticModelState?.error || "").trim(),
        model: semanticModelState?.model || null,
    };
    const normalizedValidationState = normalizeSemanticValidationState(semanticSelectionValidationState);
    const nextSemanticStatus = buildReportBuilderSemanticStatus({
        binding: nextBinding,
        providerAvailable: !!semanticModelProvider,
        loading: normalizedSemanticModelState.loading,
        error: normalizedSemanticModelState.error,
        model: normalizedSemanticModelState.model,
    });

    if (normalizedSemanticModelState.loading) {
        return {
            canRun: false,
            reason: "semantic",
            message: nextSemanticStatus?.message || "Semantic model metadata is still loading.",
        };
    }
    if (normalizedSemanticModelState.error) {
        return {
            canRun: false,
            reason: "semantic",
            message: nextSemanticStatus?.message || normalizedSemanticModelState.error || "Semantic model metadata could not be loaded.",
            action: semanticModelRetryAvailable ? "retrySemanticModelLoad" : "",
        };
    }
    if (nextSemanticStatus && nextSemanticStatus.level !== "info") {
        return {
            canRun: false,
            reason: "semantic",
            message: nextSemanticStatus.message || "Semantic binding could not be resolved cleanly.",
        };
    }

    const nextFieldValidation = buildReportBuilderSemanticFieldValidation({
        config,
        state,
        binding: nextBinding,
        model: normalizedSemanticModelState.model,
    });
    if (nextFieldValidation && !nextFieldValidation.canRun) {
        return {
            canRun: false,
            reason: "semantic",
            message: nextFieldValidation.message || "Resolve semantic field issues before running the report.",
        };
    }

    const nextSemanticValidationRequest = buildReportBuilderSemanticValidationRequest(config, state, nextBinding);
    const nextSemanticValidationFingerprint = nextSemanticValidationRequest ? JSON.stringify(nextSemanticValidationRequest) : "";
    if (semanticModelProvider && nextSemanticValidationFingerprint) {
        if (normalizedValidationState.fingerprint !== nextSemanticValidationFingerprint || normalizedValidationState.loading) {
            return {
                canRun: false,
                reason: "semantic",
                message: "Validating the semantic selection against the provider.",
            };
        }
        if (normalizedValidationState.error) {
            return {
                canRun: false,
                reason: "semantic",
                message: normalizedValidationState.error,
                action: semanticRetryAvailable ? "retrySemanticValidation" : "",
            };
        }
        if (normalizedValidationState.valid === false) {
            const retryValidation = semanticRetryAvailable
                && hasRetryableSemanticValidationDiagnostics(normalizedValidationState.diagnostics);
            return {
                canRun: false,
                reason: "semantic",
                message: summarizeReportBuilderSemanticDiagnostics(normalizedValidationState.diagnostics) || "The semantic provider rejected the current selection.",
                ...(retryValidation ? { issueKind: resolveSemanticValidationIssueKind(normalizedValidationState.diagnostics) } : {}),
                ...(retryValidation ? { action: "retrySemanticValidation" } : {}),
            };
        }
        if (normalizedValidationState.valid !== true) {
            return {
                canRun: false,
                reason: "semantic",
                message: "Validating the semantic selection against the provider.",
            };
        }
    }

    return {
        ...baseReadiness,
        message: "",
    };
}
