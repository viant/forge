function normalizeString(value = "") {
    return String(value || "").trim();
}

export function buildReportBuilderImportedArtifactSourceLabel(importedArtifactKind = "") {
    switch (normalizeString(importedArtifactKind)) {
        case "reportBuilder.savedReportRecord":
            return "imported report record";
        case "reportBuilder.savedReportPayload":
            return "imported report file";
        case "reportBuilder.savedView":
            return "imported saved-view";
        case "reportBuilder.publishedSnapshot":
            return "imported published-snapshot";
        case "reportBuilder.explorationArtifact":
            return "imported draft-snapshot";
        case "getReportDocumentResponse":
            return "imported reopen bundle";
        case "createReportDocumentPayload":
            return "imported create request";
        case "updateReportDocumentPayload":
            return "imported update request";
        case "reportDocument":
            return "imported report document";
        default:
            return "";
    }
}
