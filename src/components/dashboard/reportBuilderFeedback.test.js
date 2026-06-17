import assert from "node:assert/strict";

import {
    buildReportBuilderPresetApplyFeedback,
    resolveCompactChartSheetNotice,
} from "./reportBuilderFeedback.js";

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "table",
    presetTitle: "Delivery Grid",
    selectionChanged: false,
}), {
    level: "info",
    message: "Applied Delivery Grid.",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "table",
    presetTitle: "Delivery Grid",
    selectionChanged: true,
    didFetchPreparedState: true,
}), {
    level: "info",
    message: "Applied Delivery Grid. Refreshing results.",
    action: "",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "tableCalc",
    presetTitle: "Reach Rank",
    selectionChanged: true,
    didFetchPreparedState: false,
    preparedReadiness: { canRun: true },
    requiresManualRun: true,
}), {
    level: "info",
    message: "Added Reach Rank. Run to refresh results.",
    action: "runReport",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "chart",
    changedParts: ["measures", "breakdowns"],
    selectionChanged: true,
    didFetchPreparedState: false,
    preparedReadiness: { canRun: false, reason: "semantic", message: "Validating the semantic selection against the provider." },
    requiresManualRun: false,
}), {
    level: "info",
    message: "Applied this preset's required measures and breakdowns. Validating the semantic selection against the provider.",
    action: "",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "chart",
    changedParts: ["measures"],
    selectionChanged: true,
    didFetchPreparedState: false,
    preparedReadiness: { canRun: true },
    requiresManualRun: true,
}), {
    level: "info",
    message: "Applied this preset's required measures. Run to refresh results.",
    action: "runReport",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    chartApplyFeedback: {
        level: "info",
        message: "Applied Delivery Grid.",
    },
    semanticSelectedIssueCount: 2,
    readinessReason: "semantic",
}), {
    level: "info",
    message: "Applied Delivery Grid.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    chartApplyFeedback: null,
    semanticSelectedIssueCount: 1,
    semanticFieldValidationMessage: "Audience Age Group is not allowed here.",
    readinessReason: "semantic",
}), {
    level: "danger",
    message: "Semantic selection issue: Audience Age Group is not allowed here.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    semanticSelectedIssueCount: 0,
    readinessReason: "semantic",
    readinessMessage: "Validating the semantic selection against the provider.",
    semanticStatusLevel: "info",
    semanticSelectionValidationError: "",
    semanticSelectionValidationValid: null,
}), {
    level: "info",
    message: "Semantic validation: Validating the semantic selection against the provider.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    semanticSelectedIssueCount: 0,
    readinessReason: "semantic",
    readinessMessage: "The semantic provider rejected this selection.",
    semanticStatusLevel: "info",
    semanticSelectionValidationError: "boom",
    semanticSelectionValidationValid: false,
}), {
    level: "danger",
    message: "Semantic validation: The semantic provider rejected this selection.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    showingChartView: false,
    activeTablePresetTitle: "Delivery Grid",
}), {
    level: "info",
    message: "Active table preset: Delivery Grid",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    showingChartView: false,
    modifiedTablePresetTitle: "Delivery Grid",
}), {
    level: "warning",
    message: "Modified from Delivery Grid. Use Quick view to restore the named table preset.",
});

assert.equal(resolveCompactChartSheetNotice({
    showingChartView: true,
    activeTablePresetTitle: "Delivery Grid",
}), null);

console.log("reportBuilderFeedback ✓ compact chart-sheet notice precedence");
