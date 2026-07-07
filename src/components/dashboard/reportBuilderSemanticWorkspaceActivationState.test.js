import assert from "node:assert/strict";

import { buildReportBuilderSemanticWorkspaceActivationState } from "./reportBuilderSemanticWorkspaceActivationState.js";

assert.equal(buildReportBuilderSemanticWorkspaceActivationState(), null);

assert.deepEqual(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Semantic modeling inactive",
    },
    importedLocalReopenablePanelState: {
        entries: [
            {
                id: "reopenable-1",
                title: "Semantic reopen bundle",
                semanticBindingChips: ["Model Performance Delivery", "Entity Line Delivery"],
                metaChips: ["v4", "getReportDocumentResponse"],
                scopeSummaryText: "Date Range • Channels",
                activateLabel: "Use Semantic reopen bundle",
                removeLabel: "Remove Semantic reopen bundle",
            },
            {
                id: "reopenable-2",
                title: "Raw reopen bundle",
                metaChips: ["v1"],
            },
        ],
    },
    importedLocalSavedRecordPanelState: {
        entries: [
            {
                id: "saved-record-1",
                title: "Semantic saved report",
                semanticBindingFieldGroups: [{ id: "measures", title: "Selected measures (1)", fields: [{ id: "total_spend", label: "Spend" }] }],
                metaChips: ["savedReportPayload", "v2"],
                authoredBlockSummaryText: "2 authored blocks",
                activateLabel: "Use Semantic saved report",
            },
        ],
    },
}), {
    title: "Activate semantic mode",
    description: "Load a semantic report file or activate an imported semantic report to switch this builder from raw mode to model-backed mappings.",
    entries: [
        {
            id: "reopenable::reopenable-1",
            targetIdentity: "reopenable-1",
            kind: "reopenable",
            title: "Semantic reopen bundle",
            description: "Date Range • Channels",
            metaChips: ["v4", "getReportDocumentResponse"],
            semanticBindingChips: ["Model Performance Delivery", "Entity Line Delivery"],
            semanticBindingFieldGroups: [],
            activateLabel: "Use Semantic reopen bundle",
            removeLabel: "Remove Semantic reopen bundle",
        },
        {
            id: "savedRecord::saved-record-1",
            targetIdentity: "saved-record-1",
            kind: "savedRecord",
            title: "Semantic saved report",
            description: "2 authored blocks",
            metaChips: ["savedReportPayload", "v2"],
            semanticBindingChips: [],
            semanticBindingFieldGroups: [{ id: "measures", title: "Selected measures (1)", fields: [{ id: "total_spend", label: "Spend" }] }],
            activateLabel: "Use Semantic saved report",
            removeLabel: "",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Semantic model unavailable",
    },
    importedLocalSavedRecordPanelState: {
        entries: [
            {
                id: "saved-record-1",
                title: "Semantic saved report",
                semanticBindingChips: ["Model Ad Delivery"],
                metaChips: ["savedReportPayload", "v2"],
                activateLabel: "Use Semantic saved report",
            },
        ],
    },
}), {
    title: "Activate semantic mode",
    description: "Load a semantic report file or activate an imported semantic report to restore model-backed mappings in this builder.",
    entries: [
        {
            id: "savedRecord::saved-record-1",
            targetIdentity: "saved-record-1",
            kind: "savedRecord",
            title: "Semantic saved report",
            description: "",
            metaChips: ["savedReportPayload", "v2"],
            semanticBindingChips: ["Model Ad Delivery"],
            semanticBindingFieldGroups: [],
            activateLabel: "Use Semantic saved report",
            removeLabel: "",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Semantic model error",
    },
    importedLocalReopenablePanelState: {
        entries: [
            {
                id: "reopenable-1",
                title: "Semantic reopen bundle",
                semanticBindingChips: ["Model Performance Delivery"],
                removeLabel: "Remove Semantic reopen bundle",
            },
        ],
    },
}), {
    title: "Activate semantic mode",
    description: "Load a semantic report file or activate an imported semantic report to restore model-backed mappings in this builder.",
    entries: [
        {
            id: "reopenable::reopenable-1",
            targetIdentity: "reopenable-1",
            kind: "reopenable",
            title: "Semantic reopen bundle",
            description: "",
            metaChips: [],
            semanticBindingChips: ["Model Performance Delivery"],
            semanticBindingFieldGroups: [],
            activateLabel: "Use",
            removeLabel: "Remove Semantic reopen bundle",
        },
    ],
});

assert.equal(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Semantic Binding",
    },
}), null);

console.log("reportBuilderSemanticWorkspaceActivationState ✓ derives semantic activation options from imported artifacts");
