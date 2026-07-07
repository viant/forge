import assert from "node:assert/strict";

import { buildReportBuilderSemanticResultSurfaceState } from "./reportBuilderSemanticResultSurfaceState.js";

assert.equal(buildReportBuilderSemanticResultSurfaceState(), null);

assert.equal(buildReportBuilderSemanticResultSurfaceState({
    designWorkspaceMode: true,
    semanticWorkspacePanelState: {
        semanticBindingChips: ["Model Ad Delivery"],
    },
}), null);

assert.deepEqual(buildReportBuilderSemanticResultSurfaceState({
    semanticWorkspacePanelState: {
        title: "Semantic Binding",
        description: "Dimensions are mapped even when summary chips are unavailable.",
        semanticBindingChips: [],
        semanticBindingFieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (1)",
                fields: [
                    { id: "event_date", title: "Event Date" },
                ],
            },
        ],
    },
}), {
    level: "info",
    label: "Semantic context",
    value: "Semantic Binding",
    description: "Dimensions are mapped even when summary chips are unavailable.",
    metaChips: [],
    semanticBindingChips: [],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", title: "Event Date" },
            ],
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticResultSurfaceState({
    semanticWorkspacePanelState: {
        tone: "warning",
        title: "Semantic Binding",
        description: "Ad Delivery • Entity: Line Delivery",
        metaChips: ["Binding ready", "1 diagnostic", "1 governance note"],
        semanticBindingChips: [
            "Model Ad Delivery",
            "Entity Line Delivery",
            "Measures Available Impressions, Household Uniques",
        ],
        semanticBindingFieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (2)",
                fields: [
                    { id: "event_date", title: "Event Date" },
                    { id: "channel", title: "Channel" },
                ],
            },
        ],
    },
}), {
    level: "warning",
    label: "Semantic context",
    value: "Semantic Binding",
    description: "Ad Delivery • Entity: Line Delivery",
    metaChips: ["1 diagnostic", "1 governance note"],
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Measures Available Impressions, Household Uniques",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", title: "Event Date" },
                { id: "channel", title: "Channel" },
            ],
        },
    ],
});

console.log("reportBuilderSemanticResultSurfaceState ✓ derives compact semantic context for preview and report surfaces");
