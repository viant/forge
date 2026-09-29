// Report fan-out shares a small pool. Ordinary table, lookup, navigation and
// history requests do not use it, so a slow report cannot fill their connections.
export function createReportDatasetScheduler(limit = 2) {
    let active = 0;
    const waiting = [];
    const groups = new Set();
    const abortError = signal => signal?.reason || new DOMException('Report request cancelled.','AbortError');
    const drain = () => {
        while (active < limit) {
            const index = waiting.findIndex(entry => !groups.has(entry.group));
            if (index < 0) return;
            const entry = waiting.splice(index,1)[0];
            entry.start();
        }
    };
    return async function schedule(operation, {signal = null, group = Symbol()} = {}) {
        if (signal?.aborted) throw abortError(signal);
        let acquired = false;
        await new Promise(resolve => {
            const entry = {group, start: () => {
                signal?.removeEventListener('abort',cancel);
                acquired = true; active++; groups.add(group); resolve();
            }};
            const cancel = () => {
                const index = waiting.indexOf(entry);
                if (index >= 0) { waiting.splice(index,1); resolve(); }
            };
            signal?.addEventListener('abort',cancel,{once:true});
            waiting.push(entry); drain();
        });
        if (!acquired) throw abortError(signal);
        let cancel;
        try {
            if (signal?.aborted) throw abortError(signal);
            if (!signal) return await operation();
            const aborted = new Promise((_,reject) => {
                cancel = () => reject(abortError(signal));
                signal.addEventListener('abort',cancel,{once:true});
            });
            return await Promise.race([operation(),aborted]);
        }
        finally {
            if (cancel) signal?.removeEventListener('abort',cancel);
            active--; groups.delete(group); drain();
        }
    };
}

export const scheduleReportDataset = createReportDatasetScheduler();
