import assert from "node:assert/strict";

import {
    buildIdleReportBuilderSemanticValidationState,
    buildPendingReportBuilderSemanticValidationState,
    buildPendingReportBuilderSemanticValidationStateForRequest,
    buildRejectedReportBuilderSemanticValidationState,
    buildResolvedReportBuilderSemanticValidationState,
    hasReportBuilderSemanticValidationStateValue,
    resolveReportBuilderSemanticValidationSettledState,
    resolveReportBuilderSemanticValidationStateTransition,
} from "./reportBuilderSemanticValidationState.js";

assert.deepEqual(buildIdleReportBuilderSemanticValidationState(), {
    fingerprint: "",
    requestKey: "",
    loading: false,
    error: "",
    valid: null,
    diagnostics: [],
});

assert.equal(hasReportBuilderSemanticValidationStateValue({}), false);
assert.equal(hasReportBuilderSemanticValidationStateValue({
    fingerprint: "semantic::1",
}), true);

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "raw",
    providerAvailable: true,
    hasValidationRequest: true,
    currentState: {
        fingerprint: "semantic::1",
        loading: false,
        error: "",
        valid: true,
        diagnostics: [],
    },
}), {
    type: "reset",
    nextState: buildIdleReportBuilderSemanticValidationState(),
});

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "semantic",
    providerAvailable: true,
    hasValidationRequest: true,
    semanticModelState: {
        loading: true,
        error: "",
    },
    semanticStatusLevel: "info",
    semanticFieldValidationCanRun: true,
    currentState: {
        fingerprint: "semantic::1",
        requestKey: "semantic::1::0",
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    },
    validationFingerprint: "semantic::1",
    validationRequestKey: "semantic::1::0",
}), {
    type: "reset",
    nextState: buildIdleReportBuilderSemanticValidationState(),
});

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "semantic",
    providerAvailable: true,
    hasValidationRequest: true,
    semanticModelState: {
        loading: false,
        error: "",
    },
    semanticStatusLevel: "warning",
    semanticFieldValidationCanRun: true,
    currentState: {},
    validationFingerprint: "semantic::1",
}), {
    type: "noop",
    nextState: buildIdleReportBuilderSemanticValidationState(),
});

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "semantic",
    providerAvailable: true,
    hasValidationRequest: true,
    semanticModelState: {
        loading: false,
        error: "",
    },
    semanticStatusLevel: "info",
    semanticFieldValidationCanRun: false,
    currentState: {
        fingerprint: "semantic::1",
        requestKey: "semantic::1::0",
        loading: false,
        error: "",
        valid: false,
        diagnostics: [{ message: "Invalid" }],
    },
    validationFingerprint: "semantic::1",
    validationRequestKey: "semantic::1::0",
}), {
    type: "reset",
    nextState: buildIdleReportBuilderSemanticValidationState(),
});

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "semantic",
    providerAvailable: true,
    hasValidationRequest: true,
    semanticModelState: {
        loading: false,
        error: "",
    },
    semanticStatusLevel: "info",
    semanticFieldValidationCanRun: true,
    currentState: {
        fingerprint: "semantic::1",
        requestKey: "semantic::1::0",
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    },
    validationFingerprint: "semantic::1",
    validationRequestKey: "semantic::1::0",
}), {
    type: "noop",
    nextState: {
        fingerprint: "semantic::1",
        requestKey: "semantic::1::0",
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    },
});

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "semantic",
    providerAvailable: true,
    hasValidationRequest: true,
    semanticModelState: {
        loading: false,
        error: "",
    },
    semanticStatusLevel: "info",
    semanticFieldValidationCanRun: true,
    currentState: {
        fingerprint: "semantic::1",
        requestKey: "semantic::1::0",
        loading: false,
        error: "",
        valid: true,
        diagnostics: [],
    },
    validationFingerprint: "semantic::1",
    validationRequestKey: "semantic::1::0",
}), {
    type: "noop",
    nextState: {
        fingerprint: "semantic::1",
        requestKey: "semantic::1::0",
        loading: false,
        error: "",
        valid: true,
        diagnostics: [],
    },
});

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "semantic",
    providerAvailable: true,
    hasValidationRequest: true,
    semanticModelState: {
        loading: false,
        error: "",
    },
    semanticStatusLevel: "info",
    semanticFieldValidationCanRun: true,
    currentState: {},
    validationFingerprint: "semantic::2",
    validationRequestKey: "",
}), {
    type: "start",
    nextState: buildPendingReportBuilderSemanticValidationStateForRequest({
        fingerprint: "semantic::2",
        requestKey: "",
    }),
});

assert.deepEqual(buildResolvedReportBuilderSemanticValidationState({
    fingerprint: "semantic::2",
    requestKey: "semantic::2::0",
    payload: {
        valid: false,
        diagnostics: [
            {
                code: "unsupportedBreakdown",
                severity: "error",
                path: "selection.dimensions[2]",
                message: "Audience Age Group is not supported.",
                suggestedFix: "Remove it.",
            },
        ],
    },
}), {
    fingerprint: "semantic::2",
    requestKey: "semantic::2::0",
    loading: false,
    error: "",
    valid: false,
    diagnostics: [
        {
            code: "unsupportedBreakdown",
            severity: "error",
            path: "selection.dimensions[2]",
            message: "Audience Age Group is not supported.",
            suggestedFix: "Remove it.",
        },
    ],
});

assert.deepEqual(buildRejectedReportBuilderSemanticValidationState({
    fingerprint: "semantic::3",
    requestKey: "semantic::3::0",
    error: new Error("Provider request failed."),
}), {
    fingerprint: "semantic::3",
    requestKey: "semantic::3::0",
    loading: false,
    error: "Provider request failed.",
    valid: null,
    diagnostics: [],
});

assert.deepEqual(resolveReportBuilderSemanticValidationSettledState({
    currentState: {
        fingerprint: "semantic::active",
        requestKey: "semantic::active::0",
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    },
    fingerprint: "semantic::stale",
    requestKey: "semantic::stale::0",
    payload: {
        valid: false,
        diagnostics: [{ message: "stale" }],
    },
}), {
    fingerprint: "semantic::active",
    requestKey: "semantic::active::0",
    loading: true,
    error: "",
    valid: null,
    diagnostics: [],
});

assert.deepEqual(resolveReportBuilderSemanticValidationSettledState({
    currentState: {
        fingerprint: "semantic::done",
        requestKey: "semantic::done::0",
        loading: false,
        error: "",
        valid: true,
        diagnostics: [],
    },
    fingerprint: "semantic::done",
    requestKey: "semantic::done::0",
    error: new Error("late error"),
}), {
    fingerprint: "semantic::done",
    requestKey: "semantic::done::0",
    loading: false,
    error: "",
    valid: true,
    diagnostics: [],
});

assert.deepEqual(resolveReportBuilderSemanticValidationSettledState({
    currentState: {
        fingerprint: "semantic::pending",
        requestKey: "semantic::pending::0",
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    },
    fingerprint: "semantic::pending",
    requestKey: "semantic::pending::0",
    payload: {
        valid: false,
        diagnostics: [
            {
                code: "unsupportedMeasure",
                severity: "error",
                path: "selection.measures[1]",
                message: "Household Uniques is not allowed.",
            },
        ],
    },
}), {
    fingerprint: "semantic::pending",
    requestKey: "semantic::pending::0",
    loading: false,
    error: "",
    valid: false,
    diagnostics: [
        {
            code: "unsupportedMeasure",
            severity: "error",
            path: "selection.measures[1]",
            message: "Household Uniques is not allowed.",
        },
    ],
});

assert.deepEqual(resolveReportBuilderSemanticValidationSettledState({
    currentState: {
        fingerprint: "semantic::pending",
        requestKey: "semantic::pending::1",
        loading: true,
        error: "",
        valid: null,
        diagnostics: [],
    },
    fingerprint: "semantic::pending",
    requestKey: "semantic::pending::1",
    error: new Error("Provider request failed."),
}), {
    fingerprint: "semantic::pending",
    requestKey: "semantic::pending::1",
    loading: false,
    error: "Provider request failed.",
    valid: null,
    diagnostics: [],
});

assert.deepEqual(resolveReportBuilderSemanticValidationStateTransition({
    bindingMode: "semantic",
    providerAvailable: true,
    hasValidationRequest: true,
    semanticModelState: {
        loading: false,
        error: "",
    },
    semanticStatusLevel: "info",
    semanticFieldValidationCanRun: true,
    currentState: {
        fingerprint: "semantic::retry",
        requestKey: "semantic::retry::0",
        loading: false,
        error: "Provider request failed.",
        valid: null,
        diagnostics: [],
    },
    validationFingerprint: "semantic::retry",
    validationRequestKey: "semantic::retry::1",
}), {
    type: "start",
    nextState: buildPendingReportBuilderSemanticValidationStateForRequest({
        fingerprint: "semantic::retry",
        requestKey: "semantic::retry::1",
    }),
});

console.log("reportBuilderSemanticValidationState ✓ transition and settled state helpers");
