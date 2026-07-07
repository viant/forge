import {
    applyReportBuilderHydratedDocumentSessionState,
    buildHydratedReportBuilderDocument,
    buildReportBuilderHydratedDocumentSession,
} from "./reportBuilderHydratedReportDocument.js";
import { buildReportBuilderHydratedReportDocumentDiagnostic } from "./reportBuilderHydratedReportDocumentDiagnostic.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function buildReportBuilderImportedResponseActivation({
    response = null,
    container = null,
    builderIdentity = null,
    localSavedPayloads = [],
    priorSession = null,
    liveConfig = null,
    liveState = null,
    hydrateDocument = buildHydratedReportBuilderDocument,
    buildSession = buildReportBuilderHydratedDocumentSession,
    applySessionState = applyReportBuilderHydratedDocumentSessionState,
    buildDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic,
} = {}) {
    const hydrated = hydrateDocument(response, {
        container,
        builderIdentity,
        localSavedPayloads,
    });
    if (!hydrated?.valid) {
        return {
            valid: false,
            hydrated,
            diagnostic: typeof buildDiagnostic === "function"
                ? buildDiagnostic(response, hydrated, { builderIdentity })
                : null,
            message: normalizeString(hydrated?.message || "Could not reopen the imported ReportDocument in the builder."),
        };
    }
    const session = buildSession(hydrated, {
        liveConfig,
        liveState,
        priorSession,
    });
    if (!session) {
        return {
            valid: false,
            hydrated,
            diagnostic: null,
            message: "Could not persist the imported reopen session for this ReportDocument.",
        };
    }
    return {
        valid: true,
        hydrated,
        session,
        nextConfig: hydrated.config,
        nextState: applySessionState(hydrated.state, session),
        title: normalizeString(hydrated.title || hydrated.reportId || "Report") || "Report",
    };
}
