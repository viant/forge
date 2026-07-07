import assert from "node:assert/strict";

import {
    applyReportBuilderPersistedRuntimePreviewInteraction,
    REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY,
    resolveReportBuilderPersistedRuntimePreviewInteraction,
} from "./reportBuilderRuntimePreviewInteractionPersistence.js";

const persisted = applyReportBuilderPersistedRuntimePreviewInteraction({
    selectedDimensions: ["eventDate", "channelV2"],
}, {
    refinements: [
        {
            op: "keep",
            field: "channelV2",
            values: ["Display"],
            sourceBlockId: "detailTable",
            label: "Keep only = Display",
        },
    ],
    drillTransitions: [
        {
            refinementId: "keep:channelV2:detailTable",
            sourceField: "channelV2",
            nextFieldRef: "publisher",
            sourceBlockId: "detailTable",
        },
    ],
    datasetScopeParams: {
        forecast_cube: {
            forecastRegion: ["US/NY"],
        },
    },
    hostIntent: null,
    detailDiagnostic: null,
});

assert.deepEqual(resolveReportBuilderPersistedRuntimePreviewInteraction(persisted), {
    refinements: [
        {
            id: "keep:channelV2:detailTable",
            op: "keep",
            field: "channelV2",
            values: ["Display"],
            sourceBlockId: "detailTable",
            label: "Keep only = Display",
        },
    ],
    drillTransitions: [
        {
            refinementId: "keep:channelV2:detailTable",
            sourceField: "channelV2",
            nextFieldRef: "publisher",
            sourceBlockId: "detailTable",
        },
    ],
    datasetScopeParams: {
        forecast_cube: {
            forecastRegion: ["US/NY"],
        },
    },
    hostIntent: null,
    detailDiagnostic: null,
});

assert.equal(
    Object.prototype.hasOwnProperty.call(persisted, REPORT_DOCUMENT_RUNTIME_PREVIEW_INTERACTION_KEY),
    true,
);

assert.deepEqual(
    applyReportBuilderPersistedRuntimePreviewInteraction(persisted, null),
    {
        selectedDimensions: ["eventDate", "channelV2"],
    },
);

console.log("reportBuilderRuntimePreviewInteractionPersistence ✓ stores local authored runtime interaction snapshots without promoting them into reopened report sessions");
