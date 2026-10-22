// A report materialization can request its primary dataset through both row and
// authored-block hooks. Share only concurrent body reads inside that explicit
// materialization; keep every caller's result extraction and lifecycle separate.
const owners = new WeakMap();
const references = new WeakMap();
let referenceSequence = 0;
const reference = value => {
    if (!value || typeof value !== 'object') return null;
    if (!references.has(value)) references.set(value, ++referenceSequence);
    return references.get(value);
};
export function reportDatasetReadContextIdentity(owner) {
    const windowState = owner?.windowState || owner?.services?.windowState;
    const metadata = owner?.metadata || windowState?.metadata;
    // Keep opaque pins/context objects by identity, never serialize authority
    // bindings, execution proofs, tokens, or host credentials into a key.
    return [reference(windowState), reference(metadata?.resource), reference(windowState?.resource),
        reference(metadata?.resourceTarget), reference(windowState?.resourceTarget),
        owner?.identity?.windowId, owner?.identity?.dataSourceRef, owner?.identity?.accountId,
        owner?.accountId, owner?.conversationId, windowState?.accountId, windowState?.conversationId,
        windowState?.contextRevision, windowState?.operationRevision, metadata?.resource?.revision,
        metadata?.resource?.contentFingerprint];
}
const aborted = () => new DOMException('Report dataset read was cancelled.', 'AbortError');

export function readConcurrentReportDataset({owner, transport, scope, dataSourceRef, parameters, omitConversationId = false, signal, read}) {
    if (!owner || !transport || !scope) return read(signal);
    if (signal?.aborted) return Promise.reject(aborted());
    let transports = owners.get(owner);
    if (!transports) owners.set(owner, transports = new WeakMap());
    let pending = transports.get(transport);
    if (!pending) transports.set(transport, pending = new Map());
    const key = JSON.stringify([reportDatasetReadContextIdentity(owner), scope, dataSourceRef, parameters, omitConversationId]);
    let entry = pending.get(key);
    if (!entry) {
        const controller = new AbortController();
        entry = {controller, consumers: new Set(), settled: false};
        pending.set(key, entry);
        entry.promise = Promise.resolve().then(() => read(controller.signal)).finally(() => {
            entry.settled = true;
            if (pending.get(key) === entry) pending.delete(key);
        });
    }
    return new Promise((resolve, reject) => {
        const consumer = {};
        entry.consumers.add(consumer);
        let done = false;
        const release = () => {
            signal?.removeEventListener('abort', cancel);
            entry.consumers.delete(consumer);
        };
        const cancel = () => {
            if (done) return;
            done = true;
            release();
            if (!entry.settled && entry.consumers.size === 0) {
                if (pending.get(key) === entry) pending.delete(key);
                entry.controller.abort();
            }
            reject(aborted());
        };
        signal?.addEventListener('abort', cancel, {once: true});
        // A signal may have been cancelled while the listener was installed.
        if (signal?.aborted) cancel();
        entry.promise.then(value => {
            if (done) return;
            done = true;
            release();
            try { resolve(value == null ? value : structuredClone(value)); }
            catch (error) { reject(error); }
        }, error => {
            if (done) return;
            done = true;
            release();
            reject(error);
        });
    });
}
