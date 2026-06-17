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

export function resolveReportBuilderStateReadiness({
    config = {},
    state = {},
    semanticModelProvider = null,
    semanticModelState = {},
    semanticSelectionValidationState = {},
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
            return {
                canRun: false,
                reason: "semantic",
                message: summarizeReportBuilderSemanticDiagnostics(normalizedValidationState.diagnostics) || "The semantic provider rejected the current selection.",
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
