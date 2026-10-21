// Only projection-owned read forwarding opts into this registry. Mutation
// commands and direct datasource dispatches never enter it.
const pendingReads = new WeakMap();
let sequence = 0;
export function sharedReadRequestId() { return `projection-read-${++sequence}`; }
export function pendingSharedRead(owner, signature, requestId) {
    const pending = pendingReads.get(owner);
    return pending?.signature === signature && pending.requestId === requestId ? pending.promise : null;
}
export function registerSharedRead(owner, signature, requestId, promise) {
    const entry = {signature, requestId, promise};
    pendingReads.set(owner, entry);
    const clear = () => { if (pendingReads.get(owner) === entry) pendingReads.delete(owner); };
    promise.then(clear, clear);
}
