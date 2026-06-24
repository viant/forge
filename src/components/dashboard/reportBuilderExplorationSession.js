import { resolveReportRuntimeChartSelectionSummary } from "./reportRuntimeChartActionModel.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableSerialize(value) {
    return JSON.stringify(value == null ? null : value);
}

function normalizeTimestamp(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function resolveExplorationNow(options = {}) {
    return normalizeTimestamp(options?.nowMs, Date.now());
}

function resolveExplorationTtl(options = {}) {
    const numeric = Number(options?.ttlMs);
    if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
    }
    return 1000 * 60 * 60;
}

function snapshotExplorationState(state = {}) {
    const snapshot = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    delete snapshot.explorationSession;
    return snapshot;
}

function restoreExplorationSnapshot(session = {}, snapshot = null) {
    const nextSnapshot = cloneValue(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {});
    if (!session || typeof session !== "object" || Array.isArray(session)) {
        return nextSnapshot;
    }
    return {
        ...nextSnapshot,
        explorationSession: cloneValue(session),
    };
}

function buildExplorationSourceRef({
    container = {},
    state = {},
    sourceKind = "reportBuilder.result",
    sourceContext = null,
} = {}) {
    const next = {
        kind: normalizeString(sourceKind) || "reportBuilder.result",
        containerId: normalizeString(container?.id),
        stateKey: normalizeString(container?.stateKey || container?.id),
        viewMode: normalizeString(state?.viewMode || "table") || "table",
    };
    const chartTitle = normalizeString(state?.chartSpec?.title);
    if (chartTitle) {
        next.chartTitle = chartTitle;
    }
    const primaryMeasure = normalizeString(state?.primaryMeasure);
    if (primaryMeasure) {
        next.primaryMeasure = primaryMeasure;
    }
    if (sourceContext && typeof sourceContext === "object" && !Array.isArray(sourceContext)) {
        const contextLabel = normalizeString(sourceContext?.label);
        const metadata = sourceContext?.metadata && typeof sourceContext.metadata === "object" && !Array.isArray(sourceContext.metadata)
            ? cloneValue(sourceContext.metadata)
            : null;
        if (contextLabel) {
            next.contextLabel = contextLabel;
        }
        if (metadata) {
            next.context = metadata;
        }
    }
    return next;
}

export function buildReportBuilderExplorationSourceContextFromChartSelection({
    chartTitle = "",
    selection = null,
} = {}) {
    const summary = normalizeString(resolveReportRuntimeChartSelectionSummary({
        blockTitle: normalizeString(chartTitle) || "Selected chart value",
        selection,
    }));
    const label = summary || normalizeString(chartTitle) || "Selected chart value";
    return {
        label,
        metadata: {
            chartTitle: normalizeString(chartTitle),
            selection: cloneValue(selection),
        },
    };
}

export function buildReportBuilderExplorationSourceContextFromTableRow({
    row = null,
    rowIndex = 0,
    labelSelectors = ["eventDate", "channelV2", "channelId"],
    metadataSelectors = [],
    fallbackLabel = "Selected row",
} = {}) {
    const record = row && typeof row === "object" && !Array.isArray(row)
        ? row
        : {};
    const selectors = (Array.isArray(labelSelectors) ? labelSelectors : [])
        .map((selector) => normalizeString(selector))
        .filter(Boolean);
    const metadataKeys = (Array.isArray(metadataSelectors) && metadataSelectors.length > 0
        ? metadataSelectors
        : selectors)
        .map((selector) => normalizeString(selector))
        .filter(Boolean);
    const seenValues = new Set();
    const labelParts = [];
    selectors.forEach((selector) => {
        const value = normalizeString(record?.[selector]);
        if (!value || seenValues.has(value)) {
            return;
        }
        seenValues.add(value);
        labelParts.push(value);
    });
    const dimensionValues = {};
    metadataKeys.forEach((selector) => {
        const value = record?.[selector];
        if (value === undefined || value === null || value === "") {
            return;
        }
        dimensionValues[selector] = cloneValue(value);
    });
    return {
        label: labelParts.length > 0
            ? labelParts.join(" • ")
            : (normalizeString(fallbackLabel) || "Selected row"),
        metadata: {
            rowIndex: Math.max(0, Number(rowIndex || 0) || 0),
            ...(Object.keys(dimensionValues).length > 0 ? { dimensionValues } : {}),
        },
    };
}

function buildReportBuilderExplorationHintItems(sourceRef = {}) {
    const kind = normalizeString(sourceRef?.kind);
    switch (kind) {
        case "reportBuilder.chartResult":
            return [
                "Swap chart presets or edit the chart locally.",
                "Switch to the table to inspect the same result rows.",
                "Keep the draft only if the changes are worth saving.",
            ];
        case "reportBuilder.chartSelection":
            return [
                "Use the selected chart value as a starting point.",
                "Switch to the table to inspect matching rows locally.",
                "Keep the draft only if the changes are worth saving.",
            ];
        case "reportBuilder.tableRow":
            return [
                "Use the selected row as a starting point.",
                "Switch to chart view to compare the same scope visually.",
                "Keep the draft only if the changes are worth saving.",
            ];
        default:
            return [
                "Change chart/table view without affecting the source report.",
                "Adjust measures, breakdowns, or filters locally.",
                "Keep the draft only if the result is worth saving.",
            ];
    }
}

function formatExplorationTtlRemaining(expiresAt = 0, nowMs = 0) {
    const remainingMs = Math.max(0, Number(expiresAt || 0) - Number(nowMs || 0));
    if (!remainingMs) {
        return "Expired";
    }
    const totalMinutes = Math.ceil(remainingMs / (1000 * 60));
    if (totalMinutes < 60) {
        return `${totalMinutes}m left`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
}

export function normalizeReportBuilderExplorationSession(session = null, {
    nowMs = Date.now(),
} = {}) {
    if (!session || typeof session !== "object" || Array.isArray(session)) {
        return null;
    }
    const sessionId = normalizeString(session?.sessionId);
    const sourceRef = session?.sourceRef && typeof session.sourceRef === "object" && !Array.isArray(session.sourceRef)
        ? cloneValue(session.sourceRef)
        : null;
    const baseSnapshot = session?.baseSnapshot && typeof session.baseSnapshot === "object" && !Array.isArray(session.baseSnapshot)
        ? cloneValue(session.baseSnapshot)
        : null;
    const history = (Array.isArray(session?.history) ? session.history : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
            snapshot: snapshotExplorationState(entry.snapshot || {}),
            timestamp: normalizeTimestamp(entry.timestamp, normalizeTimestamp(session?.startedAt, nowMs)),
        }));
    const historyIndex = Math.max(0, Math.min(history.length - 1, Number(session?.historyIndex || 0) || 0));
    const startedAt = normalizeTimestamp(session?.startedAt, nowMs);
    const updatedAt = normalizeTimestamp(session?.updatedAt, startedAt);
    const ttlMs = resolveExplorationTtl(session);
    const expiresAt = normalizeTimestamp(session?.expiresAt, startedAt + ttlMs);
    if (!sessionId || !sourceRef || !baseSnapshot || history.length === 0) {
        return null;
    }
    return {
        sessionId,
        sourceRef,
        baseSnapshot,
        history,
        historyIndex,
        startedAt,
        updatedAt,
        ttlMs,
        expiresAt,
        dirty: historyIndex > 0 || stableSerialize(history[historyIndex]?.snapshot || {}) !== stableSerialize(baseSnapshot),
    };
}

export function beginReportBuilderExplorationSession(state = {}, {
    container = {},
    sourceKind = "reportBuilder.result",
    sourceContext = null,
    nowMs = Date.now(),
    ttlMs,
} = {}) {
    const snapshot = snapshotExplorationState(state);
    const startedAt = resolveExplorationNow({ nowMs });
    const resolvedTtl = resolveExplorationTtl({ ttlMs });
    return {
        ...cloneValue(snapshot),
        explorationSession: {
            sessionId: `rbexplore_${startedAt}`,
            sourceRef: buildExplorationSourceRef({ container, state, sourceKind, sourceContext }),
            baseSnapshot: cloneValue(snapshot),
            history: [
                {
                    snapshot: cloneValue(snapshot),
                    timestamp: startedAt,
                },
            ],
            historyIndex: 0,
            startedAt,
            updatedAt: startedAt,
            ttlMs: resolvedTtl,
            expiresAt: startedAt + resolvedTtl,
            dirty: false,
        },
    };
}

export function isReportBuilderExplorationActive(state = {}, options = {}) {
    const session = normalizeReportBuilderExplorationSession(state?.explorationSession, options);
    if (!session) {
        return false;
    }
    return session.expiresAt > resolveExplorationNow(options);
}

export function normalizeReportBuilderExplorationState(state = {}, options = {}) {
    const session = normalizeReportBuilderExplorationSession(state?.explorationSession, options);
    if (!session) {
        const next = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
        delete next.explorationSession;
        return next;
    }
    const nowMs = resolveExplorationNow(options);
    if (session.expiresAt <= nowMs) {
        return cloneValue(session.baseSnapshot);
    }
    return {
        ...snapshotExplorationState(state),
        explorationSession: session,
    };
}

export function recordReportBuilderExplorationHistory(previousState = {}, nextState = {}, options = {}) {
    const previousSession = normalizeReportBuilderExplorationSession(previousState?.explorationSession, options);
    if (!previousSession) {
        return nextState;
    }
    const normalizedNext = normalizeReportBuilderExplorationState(nextState, options);
    const currentSnapshot = snapshotExplorationState(normalizedNext);
    const activeSnapshot = cloneValue(previousSession.history[previousSession.historyIndex]?.snapshot || previousSession.baseSnapshot);
    if (stableSerialize(activeSnapshot) === stableSerialize(currentSnapshot)) {
        return {
            ...currentSnapshot,
            explorationSession: previousSession,
        };
    }
    const nowMs = resolveExplorationNow(options);
    const maxEntries = Math.max(2, Number(options?.maxEntries || 20) || 20);
    const retainedHistory = previousSession.history.slice(0, previousSession.historyIndex + 1);
    retainedHistory.push({
        snapshot: cloneValue(currentSnapshot),
        timestamp: nowMs,
    });
    const trimmedHistory = retainedHistory.slice(-maxEntries);
    const historyIndex = trimmedHistory.length - 1;
    const nextSession = {
        ...previousSession,
        history: trimmedHistory,
        historyIndex,
        updatedAt: nowMs,
        expiresAt: nowMs + previousSession.ttlMs,
        dirty: stableSerialize(currentSnapshot) !== stableSerialize(previousSession.baseSnapshot),
    };
    return {
        ...currentSnapshot,
        explorationSession: nextSession,
    };
}

export function undoReportBuilderExplorationState(state = {}, options = {}) {
    const session = normalizeReportBuilderExplorationSession(state?.explorationSession, options);
    if (!session || session.historyIndex <= 0) {
        return state;
    }
    const nextIndex = session.historyIndex - 1;
    const nextSession = {
        ...session,
        historyIndex: nextIndex,
        updatedAt: resolveExplorationNow(options),
        dirty: nextIndex > 0 || stableSerialize(session.history[nextIndex]?.snapshot || {}) !== stableSerialize(session.baseSnapshot),
    };
    return restoreExplorationSnapshot(nextSession, session.history[nextIndex]?.snapshot || session.baseSnapshot);
}

export function redoReportBuilderExplorationState(state = {}, options = {}) {
    const session = normalizeReportBuilderExplorationSession(state?.explorationSession, options);
    if (!session || session.historyIndex >= session.history.length - 1) {
        return state;
    }
    const nextIndex = session.historyIndex + 1;
    const nextSession = {
        ...session,
        historyIndex: nextIndex,
        updatedAt: resolveExplorationNow(options),
        dirty: nextIndex > 0 || stableSerialize(session.history[nextIndex]?.snapshot || {}) !== stableSerialize(session.baseSnapshot),
    };
    return restoreExplorationSnapshot(nextSession, session.history[nextIndex]?.snapshot || session.baseSnapshot);
}

export function discardReportBuilderExplorationState(state = {}) {
    const session = normalizeReportBuilderExplorationSession(state?.explorationSession);
    if (!session) {
        return state;
    }
    return cloneValue(session.baseSnapshot);
}

export function keepReportBuilderExplorationState(state = {}) {
    return snapshotExplorationState(state);
}

export function buildReportBuilderExplorationBannerState(state = {}, options = {}) {
    const session = normalizeReportBuilderExplorationSession(state?.explorationSession, options);
    if (!session) {
        return null;
    }
    const nowMs = resolveExplorationNow(options);
    const canUndo = session.historyIndex > 0;
    const canRedo = session.historyIndex < session.history.length - 1;
    return {
        active: true,
        sessionId: session.sessionId,
        title: "Local Draft",
        description: session.dirty
            ? `Working locally from ${normalizeString(session.sourceRef?.contextLabel) || "the current result state"}. Undo, redo, keep, or discard without changing the source report.`
            : `No local changes are active for ${normalizeString(session.sourceRef?.contextLabel) || "the current result state"}. Edit the result to create a draft you can keep or save, or discard this empty draft.`,
        hintItems: buildReportBuilderExplorationHintItems(session.sourceRef),
        dirty: session.dirty,
        canUndo,
        canRedo,
        canKeep: session.dirty,
        canSaveArtifact: session.dirty,
        sourceRef: session.sourceRef,
        ttlMs: session.ttlMs,
        expiresAt: session.expiresAt,
        ttlLabel: formatExplorationTtlRemaining(session.expiresAt, nowMs),
    };
}
