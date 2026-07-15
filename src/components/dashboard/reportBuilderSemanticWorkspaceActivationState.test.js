import assert from "node:assert/strict";

import { buildReportBuilderSemanticWorkspaceActivationState } from "./reportBuilderSemanticWorkspaceActivationState.js";

assert.equal(buildReportBuilderSemanticWorkspaceActivationState(), null);

assert.deepEqual(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "No data model configured",
    },
    importedLocalReopenablePanelState: {
        entries: [
            {
            id: "reopenable-1",
            reportId: "semantic-reopen",
                title: "Semantic reopen bundle",
                semanticBindingChips: ["Model Performance Delivery", "Entity Line Delivery"],
                metaChips: ["v4", "getReportDocumentResponse"],
                scopeSummaryText: "Date Range • Channels",
                activateLabel: "Use Semantic reopen bundle",
                removeLabel: "Remove Semantic reopen bundle",
            },
            {
            id: "reopenable-2",
            reportId: "raw-reopen",
                title: "Raw reopen bundle",
                metaChips: ["v1"],
            },
        ],
    },
    importedLocalSavedRecordPanelState: {
        entries: [
            {
            id: "saved-record-1",
            reportId: "semantic-saved",
                title: "Semantic saved report",
                semanticBindingFieldGroups: [{ id: "measures", title: "Selected measures (1)", fields: [{ id: "total_spend", label: "Spend" }] }],
                metaChips: ["savedReportPayload", "v2"],
                authoredBlockSummaryText: "2 authored blocks",
                activateLabel: "Use Semantic saved report",
            },
        ],
    },
}), {
    title: "Activate data model",
    description: "Load a report file or use an imported report to connect this report to a data model.",
    entries: [
        {
            id: "reopenable::reopenable-1",
            targetIdentity: "reopenable-1",
            kind: "reopenable",
            reportId: "semantic-reopen",
            title: "Semantic reopen bundle",
            description: "Date Range • Channels",
            active: false,
            metaChips: [],
            semanticBindingChips: ["Model Performance Delivery", "Entity Line Delivery"],
            semanticBindingFieldGroups: [],
            activateLabel: "Use",
            removeLabel: "Remove",
        },
        {
            id: "savedRecord::saved-record-1",
            targetIdentity: "saved-record-1",
            kind: "savedRecord",
            reportId: "semantic-saved",
            title: "Semantic saved report",
            description: "2 authored blocks",
            active: false,
            metaChips: [],
            semanticBindingChips: [],
            semanticBindingFieldGroups: [{ id: "measures", title: "Selected measures (1)", fields: [{ id: "total_spend", label: "Spend" }] }],
            activateLabel: "Use",
            removeLabel: "",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Data model unavailable",
    },
    importedLocalSavedRecordPanelState: {
        entries: [
            {
            id: "saved-record-1",
            reportId: "semantic-saved",
                title: "Semantic saved report",
                semanticBindingChips: ["Model Ad Delivery"],
                metaChips: ["savedReportPayload", "v2"],
                activateLabel: "Use Semantic saved report",
            },
        ],
    },
}), {
    title: "Activate data model",
    description: "Load a report file or use an imported report to restore data-model mappings.",
    entries: [
        {
            id: "savedRecord::saved-record-1",
            targetIdentity: "saved-record-1",
            kind: "savedRecord",
            reportId: "semantic-saved",
            title: "Semantic saved report",
            description: "",
            active: false,
            metaChips: [],
            semanticBindingChips: ["Model Ad Delivery"],
            semanticBindingFieldGroups: [],
            activateLabel: "Use",
            removeLabel: "",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Data model failed to load",
    },
    importedLocalReopenablePanelState: {
        entries: [
            {
            id: "reopenable-1",
            reportId: "semantic-reopen",
                title: "Semantic reopen bundle",
                semanticBindingChips: ["Model Performance Delivery"],
                removeLabel: "Remove Semantic reopen bundle",
            },
        ],
    },
}), {
    title: "Activate data model",
    description: "Load a report file or use an imported report to restore data-model mappings.",
    entries: [
        {
            id: "reopenable::reopenable-1",
            targetIdentity: "reopenable-1",
            kind: "reopenable",
            reportId: "semantic-reopen",
            title: "Semantic reopen bundle",
            description: "",
            active: false,
            metaChips: [],
            semanticBindingChips: ["Model Performance Delivery"],
            semanticBindingFieldGroups: [],
            activateLabel: "Use",
            removeLabel: "Remove",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "No data model configured",
    },
    importedLocalSavedRecordPanelState: {
        entries: [
            {
            id: "saved-record-active",
            reportId: "active-semantic-report",
                title: "Active semantic report",
                active: true,
                semanticBindingChips: ["Model Ad Delivery"],
                activateLabel: "",
                removeLabel: "Remove Active semantic report",
            },
        ],
    },
}), {
    title: "Activate data model",
    description: "Load a report file or use an imported report to connect this report to a data model.",
    entries: [
        {
            id: "savedRecord::saved-record-active",
            targetIdentity: "saved-record-active",
            kind: "savedRecord",
            reportId: "active-semantic-report",
            title: "Active semantic report",
            description: "",
            active: true,
            metaChips: ["In use"],
            semanticBindingChips: ["Model Ad Delivery"],
            semanticBindingFieldGroups: [],
            activateLabel: "",
            removeLabel: "Remove",
        },
    ],
});

assert.equal(buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Semantic Binding",
    },
}), null);

const deduplicatedActivationState = buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "No data model configured",
    },
    importedLocalReopenablePanelState: {
        entries: [{
            id: "reopenable-1",
            reportId: "same-report",
            title: "Same semantic report",
            active: true,
            semanticBindingChips: ["Model Delivery"],
            removeLabel: "Remove Same semantic report",
        }],
    },
    importedLocalSavedRecordPanelState: {
        entries: [{
            id: "saved-record-1",
            reportId: "same-report",
            title: "Same semantic report",
            active: true,
            semanticBindingChips: ["Model Delivery"],
            removeLabel: "Remove Same semantic report",
        }],
    },
});
assert.equal(deduplicatedActivationState.entries.length, 1);
assert.equal(deduplicatedActivationState.entries[0].kind, "savedRecord");

const activationStateRequiresHydratedSession = buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "No data model configured",
    },
    activeReportId: "",
    useExplicitActivationState: true,
    importedLocalSavedRecordPanelState: {
        entries: [{
            id: "imported-record",
            reportId: "incompatible-import",
            title: "Incompatible import",
            active: true,
            semanticBindingChips: ["Model Delivery"],
            removeLabel: "Remove Incompatible import",
        }],
    },
});
assert.equal(activationStateRequiresHydratedSession.entries[0].active, false);
assert.equal(activationStateRequiresHydratedSession.entries[0].activateLabel, "Use");

const activationStateFromHydratedSession = buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState: {
        title: "Data model unavailable",
    },
    activeReportId: "compatible-import",
    useExplicitActivationState: true,
    importedLocalSavedRecordPanelState: {
        entries: [{
            id: "imported-record",
            reportId: "compatible-import",
            title: "Compatible import",
            active: false,
            semanticBindingChips: ["Model Delivery"],
            removeLabel: "Remove Compatible import",
        }],
    },
});
assert.equal(activationStateFromHydratedSession.entries[0].active, true);
assert.equal(activationStateFromHydratedSession.entries[0].activateLabel, "");

console.log("reportBuilderSemanticWorkspaceActivationState ✓ derives semantic activation options from imported artifacts");
