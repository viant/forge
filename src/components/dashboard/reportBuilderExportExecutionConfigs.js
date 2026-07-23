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
    reportEventHandler = null,
    reportEventContext = {},
    setFeedback = () => {},
} = {}) {
    const auditConfig = {
        reportAuditHandler,
        reportAuditActorRef,
        reportAuditMetadata,
    };
    const eventConfig = reportEventHandler ? {
        reportEventHandler,
        reportEventContext,
    } : {};
    return {
        draft: {
            ...buildReportBuilderDraftExportExecutionConfig({
            request: draftRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
            ...eventConfig,
        },
        importedStandalone: {
            ...buildImportedStandaloneExportExecutionConfig({
            request: importedStandaloneRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
            ...eventConfig,
        },
        importedPipeline: {
            ...buildImportedPipelineExportExecutionConfig({
            request: importedPipelineRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
            ...eventConfig,
        },
        savedPayload: {
            ...buildReportBuilderSavedPayloadExportExecutionConfig({
            request: savedPayloadRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
            ...eventConfig,
        },
        reopened: {
            ...buildReportBuilderReopenedExportExecutionConfig({
            request: reopenedRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
            ...eventConfig,
        },
        selectedListEntry: {
            ...buildReportBuilderSelectedListEntryExportExecutionConfig({
            request: selectedListEntryRequest,
            localSavedPayloads,
            reportExportHandler,
            setFeedback,
            }),
            ...auditConfig,
            ...eventConfig,
        },
    };
}
