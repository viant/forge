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

export function resolveEffectiveReportBuilderState(windowState = null, storedState = null) {
    return hasStoredReportBuilderState(windowState) ? windowState : storedState;
}

export function shouldHydrateStoredReportBuilderWindowState(windowState = null, storedState = null) {
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
