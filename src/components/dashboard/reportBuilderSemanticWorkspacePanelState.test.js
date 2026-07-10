import assert from "node:assert/strict";

import { buildReportBuilderSemanticWorkspacePanelState } from "./reportBuilderSemanticWorkspacePanelState.js";

assert.deepEqual(buildReportBuilderSemanticWorkspacePanelState(), {
    tone: "info",
    eyebrow: "Data model",
    title: "No data model configured",
    description: "This report is not using a data model yet.",
    metaChips: [
        "No data model",
        "Data model source unavailable",
    ],
    semanticBindingTitle: "",
    semanticBindingChips: [],
    semanticBindingFieldGroups: [],
    diagnosticsTitle: "",
    diagnosticsDescription: "",
    diagnostics: [],
    governanceTitle: "",
    governanceItems: [],
});

assert.deepEqual(buildReportBuilderSemanticWorkspacePanelState({
    providerAvailable: true,
}), {
    tone: "info",
    eyebrow: "Data model",
    title: "No data model configured",
    description: "This report is not using a data model yet.",
    metaChips: [
        "No data model",
        "Data model source available",
    ],
    semanticBindingTitle: "",
    semanticBindingChips: [],
    semanticBindingFieldGroups: [],
    diagnosticsTitle: "",
    diagnosticsDescription: "",
    diagnostics: [],
    governanceTitle: "",
    governanceItems: [],
});

assert.deepEqual(buildReportBuilderSemanticWorkspacePanelState({
    binding: {
        mode: "semantic",
        modelRef: "model://example/reporting/performance@v1",
        entity: "line_delivery",
    },
    modelLoading: true,
}), {
    tone: "info",
    eyebrow: "Data model",
    title: "Semantic Binding",
    description: "Mapped fields, runtime validation, and governance are visible here.",
    metaChips: [],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model model://example/reporting/performance@v1",
        "Entity line_delivery",
        "0 dimensions",
        "0 measures",
    ],
    semanticBindingFieldGroups: [],
    diagnosticsTitle: "Data model diagnostics",
    diagnosticsDescription: "",
    diagnostics: [],
    governanceTitle: "",
    governanceItems: [],
});

assert.deepEqual(buildReportBuilderSemanticWorkspacePanelState({
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/reporting/performance@v1",
        modelLabel: "Performance Model",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time", definitionRef: "semantic://example/event_date" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "spend", label: "Spend", category: "Metrics" },
        ],
        selectedParameters: [
            { id: "date_range", rawId: "dateRange", label: "Date Range", category: "Scope" },
        ],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/reporting/performance@v1",
        entity: "line_delivery",
    },
    semanticStatus: {
        level: "info",
        title: "Semantic binding",
        message: "Performance Model • Entity: Line Delivery",
    },
    semanticDiagnosticsNotice: {
        level: "warning",
        title: "Semantic provider diagnostics",
        description: "The semantic provider returned 1 diagnostic for the current selection.",
        diagnostics: [
            {
                code: "unsupportedParameterValue",
                severity: "warning",
                path: "selection.parameters.date_range",
                message: "Date Range is outside the supported reporting window.",
                suggestedFix: "Adjust the date range to a supported window.",
            },
        ],
    },
    semanticGovernanceNotice: {
        level: "warning",
        items: [
            "One selected field is still draft.",
        ],
    },
}), {
    tone: "warning",
    eyebrow: "Data model",
    title: "Semantic binding",
    description: "Performance Model • Entity: Line Delivery",
    metaChips: [
        "Binding ready",
        "1 diagnostic",
        "1 governance note",
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Performance Model",
        "Entity Line Delivery",
        "Dimensions Delivery Date",
        "Measures Spend",
        "Parameters Date Range",
        "Categories Time, Metrics +1",
        "Lineage semantic://example/event_date",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time", definitionRef: "semantic://example/event_date" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "spend", rawId: "spend", label: "Spend", category: "Metrics" },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (1)",
            fields: [
                { id: "date_range", rawId: "dateRange", label: "Date Range", category: "Scope" },
            ],
        },
    ],
    diagnosticsTitle: "Semantic provider diagnostics",
    diagnosticsDescription: "The semantic provider returned 1 diagnostic for the current selection.",
    diagnostics: [
        {
            id: "unsupportedParameterValue_1",
            severity: "warning",
            code: "unsupportedParameterValue",
            path: "selection.parameters.date_range",
            message: "Date Range is outside the supported reporting window.",
            suggestedFix: "Adjust the date range to a supported window.",
        },
    ],
    governanceTitle: "Governance notes",
    governanceItems: [
        "One selected field is still draft.",
    ],
});

console.log("reportBuilderSemanticWorkspacePanelState ✓ builds a builder-facing semantic model panel state");
