import { resolveKey } from "../../utils/selector.js";
import {
    applyReportBuilderFilterAliases,
    projectLookupSelections,
} from "./reportBuilderUtils.js";

export function resolveReportBuilderNotices(config = {}, state = {}) {
    const notices = Array.isArray(config?.notices) ? config.notices : [];
    return notices.map((notice) => {
        const sourcePath = String(notice?.sourcePath || "").trim();
        const rawValue = sourcePath ? resolveKey(state, sourcePath) : undefined;
        const items = Array.isArray(rawValue)
            ? rawValue.filter((entry) => entry !== undefined && entry !== null && entry !== "").map((entry) => String(entry))
            : [];
        return {
            id: String(notice?.id || "").trim(),
            level: String(notice?.level || "info").trim().toLowerCase() || "info",
            title: String(notice?.title || "").trim(),
            description: String(notice?.description || "").trim(),
            items,
        };
    }).filter((notice) => notice.id && notice.items.length > 0);
}

export function resolveReportBuilderHookHandler(builderContext, handlerName = "") {
    const directName = String(handlerName || "").trim();
    if (!directName || !builderContext?.lookupHandler) {
        return null;
    }
    try {
        return builderContext.lookupHandler(directName);
    } catch (error) {
        const namespace = String(builderContext?.metadata?.namespace || "").trim();
        const namespacedName = namespace && !directName.startsWith(`${namespace}.`)
            ? `${namespace}.${directName}`
            : "";
        if (!namespacedName) {
            throw error;
        }
        return builderContext.lookupHandler(namespacedName);
    }
}

export function applyReportBuilderStateHook(builderContext, config = {}, state = {}, windowForm = {}) {
    const handlerName = String(config?.hooks?.initializeState || "").trim();
    if (!handlerName || !builderContext?.lookupHandler) {
        return state;
    }
    try {
        const handler = resolveReportBuilderHookHandler(builderContext, handlerName);
        const result = handler({
            context: builderContext,
            state,
            config,
            windowForm,
        });
        return (result && typeof result === "object" && !Array.isArray(result)) ? result : state;
    } catch (error) {
        console.error("reportBuilder state hook failed", error);
        return state;
    }
}

export function applyReportBuilderRequestHook(builderContext, config = {}, state = {}, request = {}) {
    const handlerName = String(config?.hooks?.buildRequest || "").trim();
    if (!handlerName || !builderContext?.lookupHandler) {
        return applyReportBuilderFilterAliases(request);
    }
    try {
        const handler = resolveReportBuilderHookHandler(builderContext, handlerName);
        const result = handler({
            context: builderContext,
            request,
            state,
            config,
        });
        return applyReportBuilderFilterAliases(
            (result && typeof result === "object" && !Array.isArray(result)) ? result : request,
        );
    } catch (error) {
        console.error("reportBuilder request hook failed", error);
        return applyReportBuilderFilterAliases(request);
    }
}

export function prefillSignature(windowForm = {}) {
    const prefill = windowForm?.prefill;
    if (!prefill || typeof prefill !== "object" || Array.isArray(prefill)) {
        return "";
    }
    const revision = Number(windowForm?.__forge?.prefillRevision || 0);
    return JSON.stringify({
        revision: Number.isFinite(revision) ? revision : 0,
        prefill,
    });
}

export function shouldDeferReportBuilderRequestForPrefill({
    currentPrefillSignature = "",
    appliedPrefillSignature = "",
} = {}) {
    const current = String(currentPrefillSignature || "").trim();
    if (!current) {
        return false;
    }
    return String(appliedPrefillSignature || "").trim() !== current;
}

function findDialogDefinition(builderContext, dialogId = "") {
    const id = String(dialogId || "").trim();
    if (!id) return null;
    const dialogs = Array.isArray(builderContext?.metadata?.dialogs) ? builderContext.metadata.dialogs : [];
    return dialogs.find((entry) => String(entry?.id || "").trim() === id) || null;
}

function inferDialogResolveInput(dialog = {}) {
    const properties = dialog?.properties && typeof dialog.properties === "object" ? dialog.properties : {};
    const quickFilters = Array.isArray(properties.quickFilters) && properties.quickFilters.length > 0
        ? properties.quickFilters
        : (properties.quickFilter ? [properties.quickFilter] : []);
    for (const entry of quickFilters) {
        const field = String(entry?.field || "").trim();
        if (field) {
            return field;
        }
    }
    return "";
}

function resolveLookupHydrationContract({ descriptor = {}, dialog = {}, filterDef = {} } = {}) {
    const resolveInput = String(
        descriptor?.resolveInput
        || filterDef?.lookup?.resolveInput
        || dialog?.properties?.resolveInput
        || inferDialogResolveInput(dialog)
        || "",
    ).trim();
    return {
        resolveInput,
        parameters: descriptor?.parameters && typeof descriptor.parameters === "object"
            ? JSON.parse(JSON.stringify(descriptor.parameters))
            : {},
    };
}

function selectionNeedsLabelHydration(selection = {}) {
    if (!selection || selection.value === undefined || selection.value === null || selection.value === "") {
        return false;
    }
    const valueText = String(selection.value).trim();
    const labelText = String(selection.label ?? "").trim();
    return !labelText || labelText === valueText;
}

export function buildLookupHydrationJobs(builderContext, config = {}, state = {}, resolveLookup) {
    const jobs = [];
    (config.dynamicFilterGroups || []).forEach((group) => {
        const groupId = String(group?.id || "").trim();
        if (!groupId) return;
        (state?.dynamicGroups?.[groupId] || []).forEach((row) => {
            const filterDef = (group.filters || []).find((entry) => String(entry?.id || "").trim() === String(row?.filterId || "").trim());
            if (!filterDef) return;
            const descriptor = resolveLookup?.(group, filterDef, row.id) || {};
            const dialogId = String(descriptor?.dialogId || filterDef?.dialogId || filterDef?.lookup?.dialogId || "").trim();
            const dialog = findDialogDefinition(builderContext, dialogId);
            const dataSourceRef = String(descriptor?.dataSourceRef || filterDef?.lookup?.dataSource || dialog?.dataSourceRef || "").trim();
            const hydration = resolveLookupHydrationContract({ descriptor, dialog, filterDef });
            const resolveInput = String(hydration.resolveInput || "").trim();
            if (!dataSourceRef || !resolveInput) return;
            (row.selections || []).forEach((selection, selectionIndex) => {
                if (!selectionNeedsLabelHydration(selection)) return;
                jobs.push({
                    groupId,
                    rowId: row.id,
                    selectionIndex,
                    value: selection.value,
                    filterDef,
                    dataSourceRef,
                    dataSourceContext: builderContext?.Context?.(dataSourceRef) || null,
                    resolveInput,
                    parameters: hydration.parameters,
                });
            });
        });
    });
    return jobs;
}

async function fetchLookupHydrationRecord(job) {
    const handlers = job?.dataSourceContext?.handlers?.dataSource;
    if (!handlers?.fetchRecords) {
        throw new Error("lookup label resolve unavailable: dataSource fetchRecords handler missing");
    }
    const body = await handlers.fetchRecords({
        parameters: {
            ...(job?.parameters || {}),
            [job.resolveInput]: job.value,
        },
    });
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    return rows[0] || null;
}

export async function hydrateReportBuilderLookupLabels(builderContext, config = {}, state = {}, resolveLookup) {
    const jobs = buildLookupHydrationJobs(builderContext, config, state, resolveLookup);
    if (jobs.length === 0) return null;
    const next = JSON.parse(JSON.stringify(state || {}));
    let changed = false;
    for (const job of jobs) {
        try {
            const record = await fetchLookupHydrationRecord(job);
            if (!record) continue;
            const [projected] = projectLookupSelections(job.filterDef, record);
            if (!projected || !projected.label || String(projected.label).trim() === String(job.value).trim()) {
                continue;
            }
            const rows = next?.dynamicGroups?.[job.groupId] || [];
            const row = rows.find((entry) => entry.id === job.rowId);
            if (!row || !Array.isArray(row.selections) || !row.selections[job.selectionIndex]) {
                continue;
            }
            row.selections[job.selectionIndex] = projected;
            changed = true;
        } catch (error) {
            console.warn("reportBuilder lookup label hydration failed", error);
        }
    }
    return changed ? next : null;
}

export function resolveReportBuilderLookupDescriptor(builderContext, config = {}, state = {}, group = {}, filterDef = {}, rowId = "") {
    const base = filterDef?.lookup && typeof filterDef.lookup === "object"
        ? { ...filterDef.lookup }
        : {};
    const handlerName = String(base?.hook || config?.hooks?.resolveLookup || "").trim();
    if (!handlerName || !builderContext?.lookupHandler) {
        return base;
    }
    try {
        const handler = resolveReportBuilderHookHandler(builderContext, handlerName);
        const resolved = handler({
            context: builderContext,
            config,
            state,
            group,
            filterDef,
            rowId,
        });
        if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
            return base;
        }
        return {
            ...base,
            ...resolved,
        };
    } catch (error) {
        console.error("reportBuilder lookup hook failed", error);
        return base;
    }
}
