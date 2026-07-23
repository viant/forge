function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function normalizeReportBuilderLifecycleSourceKind(value = "") {
    const normalized = normalizeString(value).toLowerCase();
    if (!normalized) {
        return "";
    }
    if (normalized === "preset") {
        return "preset";
    }
    if (["report", "savedpayload", "savedview", "publishedsnapshot", "reopened", "selected"].includes(normalized)) {
        return "report";
    }
    if (["inline", "draft", "imported", "materialized"].includes(normalized)) {
        return "inline";
    }
    return normalized;
}

export function resolveReportBuilderEventHandler(builderContext = {}) {
    const candidate = builderContext?.handlers?.reportEvents || null;
    return typeof candidate?.emit === "function" ? candidate : null;
}

export function buildReportBuilderEventFilters(request = null, runtimeRequest = null) {
    const params = Array.isArray(request?.reportSpec?.scope?.params)
        ? request.reportSpec.scope.params
        : [];
    const filters = {};
    params.forEach((param) => {
        const id = normalizeString(param?.id || param?.label);
        if (!id || param?.value === undefined) {
            return;
        }
        filters[id] = cloneValue(param.value);
    });
    const refinements = Array.isArray(request?.reportSpec?.refinements)
        ? request.reportSpec.refinements
        : [];
    refinements.forEach((refinement, index) => {
        const id = normalizeString(refinement?.id || refinement?.field || `refinement${index + 1}`);
        const value = refinement?.value ?? refinement?.values;
        if (id && value !== undefined) {
            filters[id] = cloneValue(value);
        }
    });
    const runtimeFilters = runtimeRequest?.filters && typeof runtimeRequest.filters === "object" && !Array.isArray(runtimeRequest.filters)
        ? runtimeRequest.filters
        : {};
    Object.entries(runtimeFilters).forEach(([key, value]) => {
        const id = normalizeString(key);
        if (id && value !== undefined) {
            filters[id] = cloneValue(value);
        }
    });
    return filters;
}

export function buildReportBuilderExportEventDetail({
    request = null,
    sourceKind = "",
    job = null,
    artifact = null,
    runtimeRequest = null,
    reportId = "",
    reportName = "",
} = {}) {
    const source = request?.source && typeof request.source === "object" ? request.source : {};
    const explicitSourceKind = normalizeReportBuilderLifecycleSourceKind(sourceKind);
    const lifecycleSourceKind = normalizeReportBuilderLifecycleSourceKind(
        explicitSourceKind && explicitSourceKind !== "runtime"
            ? explicitSourceKind
            : (source?.from || source?.sourceKind || explicitSourceKind),
    );
    const targetUrl = normalizeString(
        artifact?.sourceUrl
        || artifact?.sourceURL
        || job?.targetUrl
        || job?.targetURL
        || job?.sourceUrl
        || job?.sourceURL,
    );
    return {
        reportName: normalizeString(reportName || source.title || request?.reportSpec?.title || "Report") || "Report",
        reportId: normalizeString(reportId || source.reportId),
        artifactRef: normalizeString(job?.artifactRef || source.artifactRef),
        sourceKind: lifecycleSourceKind,
        format: normalizeString(job?.format || request?.target?.format).toLowerCase(),
        filters: buildReportBuilderEventFilters(request, runtimeRequest),
        ...(normalizeString(job?.jobId) ? { jobId: normalizeString(job.jobId) } : {}),
        ...(normalizeString(job?.artifactId || artifact?.artifactId)
            ? { artifactId: normalizeString(job?.artifactId || artifact?.artifactId) }
            : {}),
        ...(targetUrl ? { targetUrl } : {}),
    };
}

export function buildReportBuilderRunEvent({
    kind = "report.run",
    request = null,
    sourceKind = "runtime",
    runId = "",
    status = "",
    rowCount = null,
    runtimeRequest = null,
    reportId = "",
    reportName = "",
} = {}) {
    const normalizedKind = normalizeString(kind);
    const normalizedRunId = normalizeString(runId);
    const normalizedStatus = normalizeString(status).toLowerCase();
    const numericRowCount = rowCount == null ? Number.NaN : Number(rowCount);
    const detail = buildReportBuilderExportEventDetail({
        request,
        sourceKind,
        runtimeRequest,
        reportId,
        reportName,
    });
    const normalizedReportId = normalizeString(reportId);
    const normalizedReportName = normalizeString(reportName);
    return {
        kind: normalizedKind || "report.run",
        detail: {
            ...detail,
            ...(normalizedReportName ? { reportName: normalizedReportName } : {}),
            ...(normalizedReportId ? { reportId: normalizedReportId } : {}),
            ...(normalizedRunId ? { runId: normalizedRunId } : {}),
            ...(normalizedStatus ? { status: normalizedStatus } : {}),
            ...(Number.isFinite(numericRowCount) && numericRowCount >= 0
                ? { rowCount: numericRowCount }
                : {}),
        },
    };
}

export async function emitReportBuilderUIEvent(handler = null, event = {}) {
    if (typeof handler?.emit !== "function") {
        return false;
    }
    try {
        await handler.emit(event);
        return true;
    } catch (error) {
        // Telemetry must never interrupt report execution or export.
        globalThis.console?.warn?.(
            `[forge-reporting] could not emit ${normalizeString(event?.kind) || "report lifecycle event"}`
            + ` for window ${normalizeString(event?.windowId) || "(none)"}`
            + ` [${normalizeString(event?.windowKey) || "no-key"}]: ${normalizeString(error?.message || error) || "unknown error"}`,
        );
        return false;
    }
}
