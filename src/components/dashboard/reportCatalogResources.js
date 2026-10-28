const text = (value) => String(value || "").trim();
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const ACTIONS = ["open", "run", "edit", "rename", "duplicate", "runRange", "export", "delete"];

export function normalizeReportCatalogResources(value) {
    const reports = Array.isArray(value) ? value : (Array.isArray(value?.reports) ? value.reports : []);
    return reports.filter(object).flatMap((entry) => {
        const resourceUri = text(entry.resourceUri || entry.resource?.uri);
        const match = /^report:\/\/([A-Za-z0-9._-]{1,64})\/([A-Za-z0-9._-]{1,64})$/.exec(resourceUri);
        if (!match || [match[1], match[2]].some((name) => name === "." || name === "..")
            || (entry.namespace && entry.namespace !== match[1]) || (entry.name && entry.name !== match[2])
            || (entry.resource?.uri && entry.resource.uri !== resourceUri)) return [];
        return [{
            ...entry,
            resourceUri,
            namespace: text(entry.namespace) || match[1],
            name: text(entry.name) || match[2],
            resource: object(entry.resource) ? entry.resource : null,
            ownedByCurrentUser: entry.ownedByCurrentUser === true,
            capabilities: Object.fromEntries(ACTIONS.map((action) => [action, entry.capabilities?.[action] === true])),
            artifactId: text(entry.artifactId),
            reportId: text(entry.reportId),
            title: text(entry.title || entry.name || match[2]) || "Untitled report",
            description: text(entry.description),
            ownerId: text(entry.ownerId),
            builderRef: text(entry.builderRef),
            builderWindow: text(entry.builderWindow),
            orderIds: (Array.isArray(entry.orderIds) ? entry.orderIds : []).map(text).filter(Boolean),
            defaultFrom: text(entry.defaultFrom),
            defaultTo: text(entry.defaultTo),
            createdAt: text(entry.createdAt),
            updatedAt: text(entry.updatedAt),
            lastRunAt: text(entry.lastRunAt),
        }];
    });
}

export function buildReportCatalogListRequest(scope) {
    return { limit: 0, currentUserOnly: scope === "user" };
}

export function filterReportCatalogResources(reports, {scope = "all", orderId = "", query = ""} = {}) {
    const search = text(query).toLowerCase();
    return reports.filter((report) => {
        if (scope === "user" && report.ownedByCurrentUser !== true) return false;
        if (scope === "order" && (!orderId || !report.orderIds.includes(text(orderId)))) return false;
        return !search || [report.title, report.description, report.namespace, report.name, ...report.orderIds]
            .join(" ").toLowerCase().includes(search);
    });
}

// The report ref selects bytes. The resolved pin retains the server's authority,
// content, binding, identity, and lease evidence without reconstructing it here.
export function buildReportCatalogResourceRequest(report) {
    const resource = { uri: report.resourceUri };
    const revision = report.resource?.kind === "working" ? "working" : report.resource?.revision;
    if (revision !== undefined && revision !== null && revision !== "") resource.revision = String(revision);
    return {
        resourceUri: report.resourceUri,
        resource,
        ...(report.resource ? { resolvedResource: report.resource } : {}),

    };
}

export async function readReportCatalogResource(report, reportStore) {
    if (typeof reportStore?.getReport !== "function") {
        throw new Error("Report reading is unavailable in this workspace.");
    }
    const result = await reportStore.getReport(buildReportCatalogResourceRequest(report));
    const resolved = result?.resource;
    if (!object(resolved) || resolved.uri !== report.resourceUri
        || !["working", "stamped", "published"].includes(resolved.kind)
        || (resolved.kind === "published" && !!resolved.revision)
        || !resolved.contentFingerprint || !resolved.authorityBinding || !resolved.validUntil) {
        throw new Error("The report service did not return the selected resource. Refresh and try again.");
    }
    if (report.resource && ["kind", "revision", "contentFingerprint", "authorityBinding"]
        .some((field) => (report.resource[field] ?? "") !== (resolved[field] ?? ""))) {
        throw new Error("The selected report changed. Refresh and try again.");
    }
    return { ...report, resource: resolved, rowEtag: result.rowEtag, draftRevision: result.draftRevision, latestStamp: result.latestStamp, workspaceId: result.workspaceId, resourceDefinition: result.resourceDefinition };
}

export function buildReportCatalogMutationRequest(report, action, idempotencyKey = globalThis.crypto?.randomUUID?.()) {
    if (!idempotencyKey) throw new Error("Report mutation identity is unavailable.");
    const request = {...buildReportCatalogResourceRequest(report), idempotencyKey};
    if (!Number.isSafeInteger(report.rowEtag) || report.rowEtag <= 0) throw new Error("Refresh the report before changing it.");
    request.expectedRowEtag = report.rowEtag;
    if (action === "update") {
        if (report.resource?.kind !== "working" || !Number.isSafeInteger(report.draftRevision) || report.draftRevision <= 0) throw new Error("Only a current report draft can be edited.");
        request.expectedDraftRevision = report.draftRevision;
        request.expectedContentFingerprint = report.resource.contentFingerprint;
    }
    if (action === "duplicate") {
        if (!text(report.workspaceId)) throw new Error("The report workspace is unavailable.");
        const suffix = `-copy-${idempotencyKey.replace(/[^A-Za-z0-9]/g, "").slice(0,12)}`;
        request.targetUri = `report://${report.namespace}/${report.name.slice(0,64-suffix.length)}${suffix}`;
        request.targetWorkspaceId = report.workspaceId;
        request.title = `Copy of ${report.title}`;
    }
    return request;
}

export function formatReportCatalogDate(value = "", {relative = false} = {}) {
    const raw = text(value);
    if (!raw || /^0001-01-01(?:T00:00:00(?:\.0+)?(?:Z|[+]00:00)?|$)/.test(raw)) return "—";
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) return "—";
    if (relative) {
        const minutes = Math.round((Date.now()-timestamp)/60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes/60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.round(hours/24);
        if (days < 30) return `${days}d ago`;
    }
    return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(timestamp));
}
