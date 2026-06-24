import assert from "node:assert/strict";

import { buildReportBuilderExportExecutionConfigs } from "./reportBuilderExportExecutionConfigs.js";

const localSavedPayloads = [{ id: "saved-1" }];
const reportExportHandler = {
    submitRequest() {},
};
const reportAuditHandler = {
    recordEvent() {},
};
const reportAuditActorRef = "user://awitas";
const reportAuditMetadata = { windowId: "metricWindowA" };
const setFeedback = () => {};

const configs = buildReportBuilderExportExecutionConfigs({
    draftRequest: { id: "draft" },
    importedStandaloneRequest: { id: "imported-standalone" },
    importedPipelineRequest: { id: "imported-pipeline" },
    savedPayloadRequest: { id: "saved-payload" },
    reopenedRequest: { id: "reopened" },
    selectedListEntryRequest: { id: "selected-list-entry" },
    localSavedPayloads,
    reportExportHandler,
    reportAuditHandler,
    reportAuditActorRef,
    reportAuditMetadata,
    setFeedback,
});

assert.deepEqual(configs, {
    draft: {
        request: { id: "draft" },
        sourceKind: "draft",
        localSavedPayloads,
        reportExportHandler,
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
        setFeedback,
        missingRequestMessage: "No draft export request is available.",
        missingJobMessage: "No draft export job is available to refresh.",
        missingArtifactMessage: "No completed draft export artifact is available yet.",
    },
    importedStandalone: {
        request: { id: "imported-standalone" },
        sourceKind: "importedRequest",
        localSavedPayloads,
        reportExportHandler,
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
        setFeedback,
        missingRequestMessage: "No imported export request is available.",
        missingJobMessage: "No imported export job is available to refresh.",
        missingArtifactMessage: "No completed imported export artifact is available yet.",
    },
    importedPipeline: {
        request: { id: "imported-pipeline" },
        sourceKind: "imported",
        localSavedPayloads,
        reportExportHandler,
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
        setFeedback,
        missingRequestMessage: "No imported report export request is available.",
        missingJobMessage: "No imported report export job is available to refresh.",
        missingArtifactMessage: "No completed imported report export artifact is available yet.",
    },
    savedPayload: {
        request: { id: "saved-payload" },
        sourceKind: "savedPayload",
        localSavedPayloads,
        reportExportHandler,
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
        setFeedback,
        missingRequestMessage: "No canonical saved export snapshot is available for this report payload yet.",
        missingJobMessage: "No saved export job is available to refresh.",
        missingArtifactMessage: "No completed saved export artifact is available yet.",
        historyEnabled: true,
    },
    reopened: {
        request: { id: "reopened" },
        sourceKind: "reopened",
        localSavedPayloads,
        reportExportHandler,
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
        setFeedback,
        missingRequestMessage: "No canonical export snapshot is available for the reopened ReportDocument.",
        missingJobMessage: "No reopened export job is available to refresh.",
        missingArtifactMessage: "No completed reopened export artifact is available yet.",
    },
    selectedListEntry: {
        request: { id: "selected-list-entry" },
        sourceKind: "listEntry",
        localSavedPayloads,
        reportExportHandler,
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
        setFeedback,
        missingRequestMessage: "No canonical export snapshot is available for the selected catalog entry.",
        missingJobMessage: "No selected export job is available to refresh.",
        missingArtifactMessage: "No completed selected export artifact is available yet.",
    },
});

console.log("reportBuilderExportExecutionConfigs ✓ groups the shared export execution descriptor variants without changing semantics");
