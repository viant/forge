import assert from "node:assert/strict";

import {
    buildReportBuilderSemanticWorkspaceImportFeedback,
    hasSemanticWorkspaceImportActivation,
    resolveReportBuilderSemanticWorkspaceImportRevealState,
    shouldAutoActivateReportBuilderImport,
} from "./reportBuilderSemanticWorkspaceImportState.js";

assert.equal(hasSemanticWorkspaceImportActivation(), false);
assert.equal(hasSemanticWorkspaceImportActivation({ message: "Imported report file." }), false);
assert.equal(hasSemanticWorkspaceImportActivation({
    semanticBindingChips: ["Model Performance Delivery"],
}), true);

assert.equal(shouldAutoActivateReportBuilderImport({
    imported: { importedArtifactKind: "forge.reporting.reportFile" },
    semanticWorkspaceTitle: "Performance Delivery",
    activationResponse: { document: { id: "delivery" } },
}), true);
assert.equal(shouldAutoActivateReportBuilderImport({
    imported: { importedArtifactKind: "reportBuilder.savedReportPayload" },
    feedback: { semanticBindingChips: ["Model Performance Delivery"] },
    semanticWorkspaceTitle: "Performance Delivery",
    activationResponse: { document: { id: "delivery" } },
}), false);
assert.equal(shouldAutoActivateReportBuilderImport({
    imported: { importedArtifactKind: "reportBuilder.savedReportPayload" },
    feedback: { semanticBindingChips: ["Model Performance Delivery"] },
    semanticWorkspaceTitle: "No data model configured",
    activationResponse: { document: { id: "delivery" } },
}), true);
assert.equal(shouldAutoActivateReportBuilderImport({
    imported: { importedArtifactKind: "forge.reporting.reportFile" },
}), false);

assert.deepEqual(
    buildReportBuilderSemanticWorkspaceImportFeedback({
        level: "success",
        message: "Imported semantic report file.",
        semanticBindingChips: ["Model Performance Delivery"],
    }),
    {
        level: "success",
        message: "Imported semantic report file. Semantic activation is now available from the Model panel.",
        semanticBindingChips: ["Model Performance Delivery"],
        hideWhenHydratedSessionActive: true,
    },
);

assert.deepEqual(
    buildReportBuilderSemanticWorkspaceImportFeedback({
        level: "success",
        message: "Imported semantic report file.",
        semanticBindingFieldGroups: [{ id: "measures", title: "Selected measures (1)", fields: [{ id: "spend" }] }],
    }, {
        compactMode: true,
    }),
    {
        level: "success",
        message: "Imported semantic report file. Semantic activation is now available from Raw mode.",
        semanticBindingFieldGroups: [{ id: "measures", title: "Selected measures (1)", fields: [{ id: "spend" }] }],
        hideWhenHydratedSessionActive: true,
    },
);

assert.deepEqual(
    resolveReportBuilderSemanticWorkspaceImportRevealState(),
    {
        settingsOpen: false,
        reportMetadataPanelOpen: false,
        semanticPanelOpen: true,
        compactSheetOpen: false,
        compactChartSheetOpen: false,
        compactSemanticSheetOpen: false,
    },
);

assert.deepEqual(
    resolveReportBuilderSemanticWorkspaceImportRevealState({
        compactMode: true,
    }),
    {
        settingsOpen: false,
        reportMetadataPanelOpen: false,
        semanticPanelOpen: false,
        compactSheetOpen: false,
        compactChartSheetOpen: false,
        compactSemanticSheetOpen: true,
    },
);

console.log("reportBuilderSemanticWorkspaceImportState ✓ promotes semantic-capable imports into the model activation flow");
