function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function normalizeDiagnostics(values = []) {
    return (Array.isArray(values) ? values : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => cloneValue(entry));
}

function normalizeExportDiagnostic(entry = {}, index = 0) {
    const message = normalizeString(entry?.message);
    if (!message) {
        return null;
    }
    return {
        id: normalizeString(entry?.id || `${normalizeString(entry?.code || "diagnostic")}:${index}`),
        code: normalizeString(entry?.code),
        severity: normalizeString(entry?.severity || "warning").toLowerCase() || "warning",
        path: normalizeString(entry?.path),
        message,
        suggestedFix: normalizeString(entry?.suggestedFix),
    };
}

function decodeBase64Bytes(value = "") {
    const source = normalizeString(value);
    if (!source) {
        return new Uint8Array();
    }
    if (typeof globalThis.atob === "function") {
        const decoded = globalThis.atob(source);
        const bytes = new Uint8Array(decoded.length);
        for (let index = 0; index < decoded.length; index += 1) {
            bytes[index] = decoded.charCodeAt(index) & 0xff;
        }
        return bytes;
    }
    return Uint8Array.from(Buffer.from(source, "base64"));
}

export function buildReportBuilderExportRequestIdentity(request = null) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return "";
    }
    const serialized = JSON.stringify(request);
    if (!serialized || serialized === "{}") {
        return "";
    }
    return serialized;
}

export function normalizeReportBuilderExportJob(job = null) {
    if (!job || typeof job !== "object" || Array.isArray(job)) {
        return null;
    }
    const jobId = normalizeString(job?.jobId);
    const status = normalizeString(job?.status).toLowerCase();
    if (!jobId || !status) {
        return null;
    }
    return {
        jobId,
        status,
        artifactId: normalizeString(job?.artifactId),
        artifactRef: normalizeString(job?.artifactRef),
        format: normalizeString(job?.format).toLowerCase(),
        scope: normalizeString(job?.scope),
        error: normalizeString(job?.error),
        diagnostics: normalizeDiagnostics(job?.diagnostics),
    };
}

export function isReportBuilderExportJobTerminal(job = null) {
    const status = normalizeString(job?.status).toLowerCase();
    return status === "succeeded" || status === "failed";
}

export function normalizeReportBuilderExportArtifact(artifact = null) {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
        return null;
    }
    const artifactId = normalizeString(artifact?.artifactId);
    const contentType = normalizeString(artifact?.contentType);
    if (!artifactId || !contentType) {
        return null;
    }
    let bytes = null;
    if (artifact?.bytes instanceof Uint8Array) {
        bytes = new Uint8Array(artifact.bytes);
    } else if (Array.isArray(artifact?.bytes)) {
        bytes = Uint8Array.from(artifact.bytes);
    } else if (typeof artifact?.data === "string" && normalizeString(artifact.data)) {
        bytes = decodeBase64Bytes(artifact.data);
    }
    return {
        artifactId,
        contentType,
        ...(bytes ? { bytes } : {}),
        ...(normalizeString(artifact?.artifactRef) ? { artifactRef: normalizeString(artifact.artifactRef) } : {}),
        ...(normalizeString(artifact?.jobId) ? { jobId: normalizeString(artifact.jobId) } : {}),
        ...(normalizeString(artifact?.format) ? { format: normalizeString(artifact.format).toLowerCase() } : {}),
    };
}

export function buildReportBuilderExportArtifactDownload(artifact = null, {
    title = "",
    format = "",
} = {}) {
    const normalizedArtifact = normalizeReportBuilderExportArtifact(artifact);
    const bytes = normalizedArtifact?.bytes instanceof Uint8Array ? normalizedArtifact.bytes : null;
    if (!normalizedArtifact || !bytes || bytes.length === 0) {
        return null;
    }
    const normalizedFormat = normalizeString(format || normalizedArtifact.format).toLowerCase();
    const extension = normalizedFormat || (
        normalizedArtifact.contentType === "application/pdf"
            ? "pdf"
            : normalizedArtifact.contentType === "text/csv"
                ? "csv"
                : normalizedArtifact.contentType.includes("spreadsheet")
                    ? "xlsx"
                    : "bin"
    );
    const baseTitle = sanitizeFilenameSegment(title || normalizedArtifact.artifactId || "report-export");
    return {
        filename: `${baseTitle}.${extension}`,
        mimeType: normalizedArtifact.contentType,
        bytes,
    };
}

export function buildReportBuilderExportJobSummary(job = null) {
    const normalizedJob = normalizeReportBuilderExportJob(job);
    if (!normalizedJob) {
        return null;
    }
    const diagnostics = normalizeDiagnostics(normalizedJob.diagnostics)
        .map((entry, index) => normalizeExportDiagnostic(entry, index))
        .filter(Boolean);
    return {
        jobId: normalizedJob.jobId,
        status: normalizedJob.status,
        artifactId: normalizedJob.artifactId,
        artifactRef: normalizedJob.artifactRef,
        format: normalizedJob.format,
        hasArtifact: !!normalizedJob.artifactId,
        canRefresh: !isReportBuilderExportJobTerminal(normalizedJob),
        hasFailure: normalizedJob.status === "failed",
        error: normalizedJob.error,
        diagnostics,
        hasDiagnostics: diagnostics.length > 0,
        diagnosticCount: diagnostics.length,
        primaryDiagnosticMessage: diagnostics[0]?.message || "",
    };
}

export function buildReportBuilderExportFailureNotice(job = null, {
    label = "Export",
} = {}) {
    const summary = buildReportBuilderExportJobSummary(job);
    if (!summary?.hasFailure) {
        return null;
    }
    const normalizedLabel = normalizeString(label || "Export") || "Export";
    return {
        title: `${normalizedLabel} failed`,
        description: normalizeString(summary.error || summary.primaryDiagnosticMessage || `${normalizedLabel} failed.`) || `${normalizedLabel} failed.`,
        diagnostics: summary.diagnostics,
    };
}
