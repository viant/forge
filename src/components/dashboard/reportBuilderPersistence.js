import equal from "fast-deep-equal";
import { setSelector } from "../../utils/selector.js";

const REPORT_BUILDER_STATE_PREFIX = "reportBuilder.state";

function normalizeScopeValue(value = "") {
    return String(value || "").trim();
}

export function reportBuilderStateStorageKey(storageScope = "") {
    const scope = String(storageScope || "").trim();
    return `${REPORT_BUILDER_STATE_PREFIX}.${scope || "default"}`;
}

function normalizeScopeList(scopes = []) {
    return Array.from(new Set((Array.isArray(scopes) ? scopes : [scopes])
        .map((entry) => normalizeScopeValue(entry))
        .filter(Boolean)));
}

function listStoredReportBuilderStateEntries(storagePrefix = "") {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }
    const normalizedPrefix = normalizeScopeValue(storagePrefix);
    if (!normalizedPrefix) {
        return [];
    }
    const keyPrefix = `${REPORT_BUILDER_STATE_PREFIX}.${normalizedPrefix}.`;
    const storage = window.localStorage;
    const next = [];
    if (typeof storage.length === "number" && typeof storage.key === "function") {
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (!normalizeScopeValue(key).startsWith(keyPrefix)) {
                continue;
            }
            next.push(key);
        }
    }
    return next;
}

function listAllStoredReportBuilderStateEntries() {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }
    const storage = window.localStorage;
    const next = [];
    if (typeof storage.length === "number" && typeof storage.key === "function") {
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (!normalizeScopeValue(key).startsWith(`${REPORT_BUILDER_STATE_PREFIX}.`)) {
                continue;
            }
            next.push(key);
        }
    }
    return next;
}

export function resolveLegacyReportBuilderStateStorageScopes({
    stateKey = "",
    stateStorageScope = "",
} = {}) {
    const normalizedStateKey = normalizeScopeValue(stateKey);
    const normalizedScope = normalizeScopeValue(stateStorageScope);
    return normalizeScopeList(
        normalizedStateKey && normalizedStateKey !== normalizedScope
            ? [normalizedStateKey]
            : [],
    );
}

export function resolveReportBuilderStateStorageScope({
    stateKey = "",
    windowId = "",
    dataSourceRef = "",
    containerId = "",
} = {}) {
    const normalizedStateKey = normalizeScopeValue(stateKey) || "default";
    const normalizedWindowId = normalizeScopeValue(windowId);
    if (normalizedWindowId) {
        return `${normalizedStateKey}.${normalizedWindowId}`;
    }
    const normalizedDataSourceRef = normalizeScopeValue(dataSourceRef);
    const normalizedContainerId = normalizeScopeValue(containerId);
    const parts = [normalizedStateKey, normalizedDataSourceRef, normalizedContainerId].filter(Boolean);
    return parts.length > 0 ? parts.join(".") : normalizedStateKey;
}

export function hasStoredReportBuilderState(value) {
    return !!value
        && typeof value === "object"
        && !Array.isArray(value)
        && Object.keys(value).length > 0;
}

function hasHydratedReportBuilderSessionState(value) {
    return !!value
        && typeof value === "object"
        && !Array.isArray(value)
        && !!value.reportDocumentReopenSession
        && typeof value.reportDocumentReopenSession === "object"
        && !Array.isArray(value.reportDocumentReopenSession)
        && (
            !!normalizeScopeValue(value.reportDocumentReopenSession.reportId)
            || (Number(value.reportDocumentReopenSession.documentVersion || 0) || 0) > 0
            || (
                !!value.reportDocumentReopenSession.reopenedConfig
                && typeof value.reportDocumentReopenSession.reopenedConfig === "object"
                && !Array.isArray(value.reportDocumentReopenSession.reopenedConfig)
            )
            || !!normalizeScopeValue(value.reportDocumentReopenSession.reopenedSemanticFingerprint)
        );
}

function summarizeHydratedReportBuilderSessionState(value) {
    const session = hasHydratedReportBuilderSessionState(value)
        ? value.reportDocumentReopenSession
        : null;
    if (!session) {
        return null;
    }
    const authoredBlocks = Array.isArray(value?.reportDocumentBlocks) ? value.reportDocumentBlocks : [];
    const authoredBlockCount = authoredBlocks.filter((block) => (
        block && typeof block === "object" && !Array.isArray(block)
    )).length;
    const authoredTableColumnCount = authoredBlocks.reduce((total, block) => {
        if (!block || typeof block !== "object" || Array.isArray(block)) {
            return total;
        }
        if (normalizeScopeValue(block?.kind) !== "tableBlock") {
            return total;
        }
        if (Array.isArray(block?.columns)) {
            return total + block.columns.filter((column) => column && typeof column === "object" && !Array.isArray(column)).length;
        }
        if (Array.isArray(block?.columnKeys)) {
            return total + block.columnKeys.filter((entry) => normalizeScopeValue(entry)).length;
        }
        return total;
    }, 0);
    return {
        reportId: normalizeScopeValue(session?.reportId),
        documentVersion: Number(session?.documentVersion || 0) || 0,
        hasSemanticModel: !!session?.reopenedConfig?.semanticModel
            && typeof session.reopenedConfig.semanticModel === "object"
            && !Array.isArray(session.reopenedConfig.semanticModel),
        hasTruncatedSemanticModel: JSON.stringify(session?.reopenedConfig?.semanticModel || {}).includes("[MaxDepth]"),
        semanticModelRef: normalizeScopeValue(session?.reopenedConfig?.semanticModel?.modelRef),
        bindingEntity: normalizeScopeValue(session?.reopenedConfig?.binding?.entity),
        hasLiveSnapshot: !!session?.liveSnapshot?.config
            && typeof session.liveSnapshot.config === "object"
            && !Array.isArray(session.liveSnapshot.config)
            && !!session?.liveSnapshot?.state
            && typeof session.liveSnapshot.state === "object"
            && !Array.isArray(session.liveSnapshot.state),
        authoredBlockCount,
        authoredTableColumnCount,
    };
}

function shouldPreferStoredHydratedReportBuilderSessionState(windowState, storedState) {
    const windowSession = summarizeHydratedReportBuilderSessionState(windowState);
    const storedSession = summarizeHydratedReportBuilderSessionState(storedState);
    if (!storedSession) {
        return false;
    }
    if (!windowSession) {
        return true;
    }
    if (
        storedSession.reportId
        && windowSession.reportId
        && storedSession.reportId !== windowSession.reportId
    ) {
        return false;
    }
    if (
        storedSession.documentVersion > 0
        && windowSession.documentVersion > 0
        && storedSession.documentVersion < windowSession.documentVersion
    ) {
        return false;
    }
    if (storedSession.documentVersion > windowSession.documentVersion) {
        return true;
    }
    if (!storedSession.hasTruncatedSemanticModel && windowSession.hasTruncatedSemanticModel) {
        return true;
    }
    if (storedSession.hasSemanticModel && !windowSession.hasSemanticModel) {
        return true;
    }
    if (storedSession.semanticModelRef && !windowSession.semanticModelRef) {
        return true;
    }
    if (storedSession.bindingEntity && !windowSession.bindingEntity) {
        return true;
    }
    if (storedSession.hasLiveSnapshot && !windowSession.hasLiveSnapshot) {
        return true;
    }
    const sameReportId = storedSession.reportId && windowSession.reportId && storedSession.reportId === windowSession.reportId;
    const sameDocumentVersion = storedSession.documentVersion > 0
        && storedSession.documentVersion === windowSession.documentVersion;
    if (sameReportId && sameDocumentVersion) {
        if (storedSession.authoredTableColumnCount > windowSession.authoredTableColumnCount) {
            return true;
        }
        if (
            storedSession.authoredTableColumnCount === windowSession.authoredTableColumnCount
            && storedSession.authoredBlockCount > windowSession.authoredBlockCount
        ) {
            return true;
        }
    }
    return false;
}

export function resolveEffectiveReportBuilderState(windowState = null, storedState = null) {
    if (
        hasHydratedReportBuilderSessionState(storedState)
        && shouldPreferStoredHydratedReportBuilderSessionState(windowState, storedState)
    ) {
        return storedState;
    }
    return hasStoredReportBuilderState(windowState) ? windowState : storedState;
}

export function shouldHydrateStoredReportBuilderWindowState(windowState = null, storedState = null) {
    if (
        hasHydratedReportBuilderSessionState(storedState)
        && shouldPreferStoredHydratedReportBuilderSessionState(windowState, storedState)
    ) {
        return true;
    }
    return !hasStoredReportBuilderState(windowState) && hasStoredReportBuilderState(storedState);
}

export function shouldPersistReportBuilderWindowState(currentState = null, nextState = null) {
    return !equal(currentState || null, nextState || null);
}

export function replaceReportBuilderWindowState(previousWindowForm = {}, stateKey = "", nextState = null) {
    return setSelector(
        previousWindowForm && typeof previousWindowForm === "object" ? previousWindowForm : {},
        String(stateKey || "").trim(),
        nextState,
    );
}

export function loadStoredReportBuilderState(storageScope = "", legacyScopes = []) {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }
    try {
        const scopes = normalizeScopeList([storageScope, ...normalizeScopeList(legacyScopes)]);
        if (scopes.length === 0) {
            scopes.push("");
        }
        for (const scope of scopes) {
            const raw = window.localStorage.getItem(reportBuilderStateStorageKey(scope));
            if (!raw) {
                continue;
            }
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                return parsed;
            }
        }
        const scopePrefixes = Array.from(new Set(
            scopes
                .map((scope) => normalizeScopeValue(scope).split(".")[0])
                .filter(Boolean),
        ));
        for (const prefix of scopePrefixes) {
            const matchingKeys = listStoredReportBuilderStateEntries(prefix);
            if (matchingKeys.length !== 1) {
                continue;
            }
            const raw = window.localStorage.getItem(matchingKeys[0]);
            if (!raw) {
                continue;
            }
            const parsed = JSON.parse(raw);
            if (
                parsed
                && typeof parsed === "object"
                && hasHydratedReportBuilderSessionState(parsed)
            ) {
                return parsed;
            }
        }
        return null;
    } catch (_) {
        return null;
    }
}

export function persistStoredReportBuilderState(storageScope = "", state = null, legacyScopes = []) {
    if (typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        const key = reportBuilderStateStorageKey(storageScope);
        const legacyKeys = normalizeScopeList(legacyScopes)
            .filter((scope) => scope !== normalizeScopeValue(storageScope))
            .map((scope) => reportBuilderStateStorageKey(scope));
        if (!state || typeof state !== "object") {
            window.localStorage.removeItem(key);
            legacyKeys.forEach((legacyKey) => window.localStorage.removeItem(legacyKey));
            return;
        }
        window.localStorage.setItem(key, JSON.stringify(state));
        legacyKeys.forEach((legacyKey) => window.localStorage.removeItem(legacyKey));
    } catch (_) {
        // Ignore storage write failures.
    }
}
