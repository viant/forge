function normalizeString(value = "") {
    return String(value || "").trim();
}

function replaceSignal(signal = null, value = null) {
    if (!signal || typeof signal !== "object") return;
    signal.value = value;
}

// Historical hosted windows restore authored report identity and design state, but
// result rows are principal-scoped runtime data. Build a conversation-owned key for
// one fresh datasource read without creating another durable report run.
export function resolveHostedReportRestoreRehydration({
    hostAction = "",
    activationReady = false,
    canRunReport = false,
    reportIdentity = "",
    lifecycleContextKey = "",
    requestFingerprint = "",
    authoredBlockCount = 0,
    consumedKey = "",
} = {}) {
    if (normalizeString(hostAction).toLowerCase() !== "restore"
        || activationReady !== true
        || canRunReport !== true) {
        return { type: "skip", key: "" };
    }
    const identity = normalizeString(reportIdentity);
    const contextKey = normalizeString(lifecycleContextKey);
    const fingerprint = normalizeString(requestFingerprint);
    const blockCount = Math.max(0, Math.trunc(Number(authoredBlockCount) || 0));
    if (!identity || !contextKey || !fingerprint || blockCount === 0) {
        return { type: "skip", key: "" };
    }
    const key = [contextKey, identity, fingerprint, String(blockCount), "restore-read"].join("::");
    if (key === normalizeString(consumedKey)) return { type: "skip", key };
    return { type: "rehydrate", key };
}

// Clear only runtime result state. Authored report/document/filter state and request
// parameters remain intact, and OAuth remains connector-owned rather than becoming
// part of the persisted report contract.
export function invalidateHostedReportRestoredRuntime(builderContext = null) {
    const signals = builderContext?.signals || {};
    replaceSignal(signals.collection, []);
    replaceSignal(signals.collectionInfo, {});
    replaceSignal(signals.metrics, {});
    replaceSignal(signals.selection, { selected: null, rowIndex: -1 });
    const control = signals.control?.peek?.() || signals.control?.value || {};
    replaceSignal(signals.control, {
        ...(control && typeof control === "object" ? control : {}),
        loading: false,
        loaded: false,
        error: null,
        stale: true,
    });
}
