const text = (value) => String(value || "").trim();
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const canonicalSegment = value => /^[A-Za-z0-9._-]{1,64}$/.test(value) && value !== "." && value !== "..";
const ACTIONS = ["open", "run", "edit", "rename", "duplicate", "runRange", "export", "delete"];

export function normalizeReportCatalogResources(value) {
    const reports = Array.isArray(value) ? value : (Array.isArray(value?.reports) ? value.reports : []);
    return reports.filter(object).flatMap((entry) => {
        const resourceUri = text(entry.resourceUri || entry.resource?.uri);
        const match = /^report:\/\/([^/]+)\/(.+)$/.exec(resourceUri);
        if (!match || !canonicalSegment(match[1]) || match[2].length > 512 || !match[2].split("/").every(canonicalSegment)
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
            defaultFrom: text(entry.defaultFrom),
            defaultTo: text(entry.defaultTo),
            createdAt: text(entry.createdAt),
            updatedAt: text(entry.updatedAt),
            lastRunAt: text(entry.lastRunAt),
        }];
    });
}

export function reportCatalogContext(config, windowState, parameters) {
    const uri = text(windowState?.resourceRef?.uri || windowState?.windowKey);
    const namespace = text(config.namespace) || /^window:\/\/([^/]+)\//.exec(uri)?.[1] || "";
    const definition = config.scope;
    const scalar = value => typeof value === "boolean" || Number.isFinite(value) || typeof value === "string" && value !== "";
    const present = value => scalar(value) || Array.isArray(value) && value.length && value.every(scalar);
    const keys = Array.isArray(definition?.parameters) ? definition.parameters : [definition?.key];
    const parameter = keys.find(key => typeof key === "string" && Object.hasOwn(parameters,key) && present(parameters[key]));
    const scope = namespace && definition?.key && definition?.label && parameter
        ? {key:definition.key, value:parameters[parameter]} : null;
    return {namespace, scope};
}

export function buildReportCatalogListRequest(selection, {namespace="",scope=null,query="",limit=0,cursor=""}={}) {
    if (selection === "context" && (!namespace || !scope)) return null;
    return {limit,currentUserOnly:selection==="user",...(namespace ? {namespace}:{}),
        ...(selection==="context" ? {scope}:{}),...(query.trim()?{search:query.trim()}:{}),...(cursor?{cursor}:{})};
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
    const result = await reportStore.getReport({...buildReportCatalogResourceRequest(report), ...(report.resource?.providerIdentity ? {sourceProvider:report.resource.providerIdentity} : {})});
    const resolved = result?.resource;
    if (!object(resolved) || resolved.uri !== report.resourceUri
        || !["working", "stamped", "published"].includes(resolved.kind)
        || (resolved.kind === "published" && !!resolved.revision)
        || !resolved.contentFingerprint || !resolved.authorityBinding || !resolved.validUntil) {
        throw new Error("The report service did not return the selected resource. Refresh and try again.");
    }
    if (report.resource && ["providerIdentity", "kind", "revision", "contentFingerprint", "authorityBinding"]
        .some((field) => (report.resource[field] ?? "") !== (resolved[field] ?? ""))) {
        throw new Error("The selected report changed. Refresh and try again.");
    }
    return { ...report, resource: resolved, rowEtag: result.rowEtag, draftRevision: result.draftRevision, latestStamp: result.latestStamp, workspaceId: result.workspaceId, resourceDefinition: result.resourceDefinition };
}

export function buildReportCatalogMutationRequest(report, action, idempotencyKey = globalThis.crypto?.randomUUID?.()) {
    if (!idempotencyKey) throw new Error("Report mutation identity is unavailable.");
    const request = {...buildReportCatalogResourceRequest(report), idempotencyKey};
    if (action === "duplicate") return {...request, title:`Copy of ${report.title}`};
    if (!Number.isSafeInteger(report.rowEtag) || report.rowEtag <= 0) throw new Error("Refresh the report before changing it.");
    request.expectedRowEtag = report.rowEtag;
    if (action === "update") {
        if (report.resource?.kind !== "working" || !Number.isSafeInteger(report.draftRevision) || report.draftRevision <= 0) throw new Error("Only a current report draft can be edited.");
        request.expectedDraftRevision = report.draftRevision;
        request.expectedContentFingerprint = report.resource.contentFingerprint;
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
