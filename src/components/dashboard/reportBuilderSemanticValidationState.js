import { normalizeReportBuilderSemanticDiagnostics } from "./reportBuilderSemantic.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function buildIdleReportBuilderSemanticValidationState() {
    return {
        fingerprint: "",
        requestKey: "",
        loading: false,
        error: "",
        valid: null,
        diagnostics: [],
    };
}

function normalizeReportBuilderSemanticValidationState(state = {}) {
    return {
        fingerprint: normalizeString(state?.fingerprint),
        requestKey: normalizeString(state?.requestKey),
        loading: !!state?.loading,
        error: normalizeString(state?.error),
        valid: state?.valid === true ? true : (state?.valid === false ? false : null),
        diagnostics: Array.isArray(state?.diagnostics) ? state.diagnostics : [],
    };
}

export function hasReportBuilderSemanticValidationStateValue(state = {}) {
    const normalized = normalizeReportBuilderSemanticValidationState(state);
    return !!(
        normalized.fingerprint
        || normalized.loading
        || normalized.error
        || normalized.valid !== null
        || normalized.diagnostics.length > 0
    );
}

export function buildPendingReportBuilderSemanticValidationState(fingerprint = "") {
    return {
        fingerprint: normalizeString(fingerprint),
        requestKey: "",
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    };
}

export function buildPendingReportBuilderSemanticValidationStateForRequest({
    fingerprint = "",
    requestKey = "",
} = {}) {
    return {
        fingerprint: normalizeString(fingerprint),
        requestKey: normalizeString(requestKey),
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    };
}

export function buildResolvedReportBuilderSemanticValidationState({
    fingerprint = "",
    requestKey = "",
    payload = null,
} = {}) {
    return {
        fingerprint: normalizeString(fingerprint),
        requestKey: normalizeString(requestKey),
        loading: false,
        error: "",
        valid: payload?.valid === true,
        diagnostics: normalizeReportBuilderSemanticDiagnostics(payload?.diagnostics),
    };
}

export function buildRejectedReportBuilderSemanticValidationState({
    fingerprint = "",
    requestKey = "",
    error = null,
} = {}) {
    return {
        fingerprint: normalizeString(fingerprint),
        requestKey: normalizeString(requestKey),
        loading: false,
        error: normalizeString(error?.message || error) || "Failed to validate the semantic selection.",
        valid: null,
        diagnostics: [],
    };
}

export function resolveReportBuilderSemanticValidationSettledState({
    currentState = {},
    fingerprint = "",
    requestKey = "",
    payload = undefined,
    error = undefined,
} = {}) {
    const normalizedCurrentState = normalizeReportBuilderSemanticValidationState(currentState);
    const normalizedFingerprint = normalizeString(fingerprint);
    const normalizedRequestKey = normalizeString(requestKey);
    if (
        normalizedCurrentState.fingerprint !== normalizedFingerprint
        || normalizedCurrentState.requestKey !== normalizedRequestKey
        || !normalizedCurrentState.loading
    ) {
        return normalizedCurrentState;
    }
    if (error !== undefined && error !== null) {
        return buildRejectedReportBuilderSemanticValidationState({
            fingerprint: normalizedFingerprint,
            requestKey: normalizedRequestKey,
            error,
        });
    }
    return buildResolvedReportBuilderSemanticValidationState({
        fingerprint: normalizedFingerprint,
        requestKey: normalizedRequestKey,
        payload,
    });
}

export function resolveReportBuilderSemanticValidationStateTransition({
    bindingMode = "",
    providerAvailable = false,
    hasValidationRequest = false,
    semanticModelState = {},
    semanticStatusLevel = "",
    semanticFieldValidationCanRun = true,
    currentState = {},
    validationFingerprint = "",
    validationRequestKey = "",
} = {}) {
    const normalizedBindingMode = normalizeString(bindingMode).toLowerCase();
    const normalizedStatusLevel = normalizeString(semanticStatusLevel).toLowerCase();
    const normalizedCurrentState = normalizeReportBuilderSemanticValidationState(currentState);
    const shouldReset = normalizedBindingMode !== "semantic"
        || !providerAvailable
        || !hasValidationRequest
        || !!semanticModelState?.loading
        || !!normalizeString(semanticModelState?.error)
        || normalizedStatusLevel !== "info"
        || semanticFieldValidationCanRun === false;

    if (shouldReset) {
        return hasReportBuilderSemanticValidationStateValue(normalizedCurrentState)
            ? {
                type: "reset",
                nextState: buildIdleReportBuilderSemanticValidationState(),
            }
            : {
                type: "noop",
                nextState: normalizedCurrentState,
            };
    }

    const normalizedFingerprint = normalizeString(validationFingerprint);
    const normalizedRequestKey = normalizeString(validationRequestKey);
    if (normalizedCurrentState.requestKey === normalizedRequestKey) {
        if (normalizedCurrentState.loading) {
            return {
                type: "noop",
                nextState: normalizedCurrentState,
            };
        }
        if (
            normalizedCurrentState.valid !== null
            || normalizedCurrentState.error
            || normalizedCurrentState.diagnostics.length > 0
        ) {
            return {
                type: "noop",
                nextState: normalizedCurrentState,
            };
        }
    }

    return {
        type: "start",
        nextState: buildPendingReportBuilderSemanticValidationStateForRequest({
            fingerprint: normalizedFingerprint,
            requestKey: normalizedRequestKey,
        }),
    };
}
