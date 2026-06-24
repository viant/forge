import {
    buildReportBuilderDraftExportExecutionConfig,
    buildReportBuilderReopenedExportExecutionConfig,
    buildReportBuilderSavedPayloadExportExecutionConfig,
    buildReportBuilderSelectedListEntryExportExecutionConfig,
} from "./reportBuilderSavedArtifactViewState.js";
import {
    buildImportedPipelineExportExecutionConfig,
    buildImportedStandaloneExportExecutionConfig,
} from "./reportBuilderImportedArtifactViewState.js";

export function buildReportBuilderExportExecutionConfigs({
    draftRequest = null,
    importedStandaloneRequest = null,
    importedPipelineRequest = null,
    savedPayloadRequest = null,
    reopenedRequest = null,
    selectedListEntryRequest = null,
    localSavedPayloads = [],
    reportExportHandler = null,
    reportAuditHandler = null,
    reportAuditActorRef = "",
    reportAuditMetadata = {},
    setFeedback = () => {},
} = {}) {
    const auditConfig = {
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
    };
    return {
        draft: {
            ...buildReportBuilderDraftExportExecutionConfig({
            request: draftRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
        },
        importedStandalone: {
            ...buildImportedStandaloneExportExecutionConfig({
            request: importedStandaloneRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
        },
        importedPipeline: {
            ...buildImportedPipelineExportExecutionConfig({
            request: importedPipelineRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
        },
        savedPayload: {
            ...buildReportBuilderSavedPayloadExportExecutionConfig({
            request: savedPayloadRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
        },
        reopened: {
            ...buildReportBuilderReopenedExportExecutionConfig({
            request: reopenedRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
        },
        selectedListEntry: {
            ...buildReportBuilderSelectedListEntryExportExecutionConfig({
            request: selectedListEntryRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
        },
    };
}
