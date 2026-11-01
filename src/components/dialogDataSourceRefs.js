// Reader plumbing for the contents of an open dialog. Mounting a reader does
// not fetch it: its active container or focused options widget owns that call.
export function dialogDataSourceRefs(dialog = {}, definitions = {}, primary = '', mounted = []) {
    const refs = new Set();
    const owned = new Set(mounted);
    function add(value) {
        const ref = typeof value === 'string' ? value.trim() : '';
        if (ref && definitions[ref] && ref !== primary) refs.add(ref);
    }
    function walk(value, command = false) {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(child => walk(child, command)); return; }
        add(value.dataSourceRef);
        add(value.optionsDataSourceRef);
        Object.values(value.dataSourceRefs || {}).forEach(add);
        for (const [key, child] of Object.entries(value)) {
            // Refresh targets belong to acknowledged command completion. Merely
            // opening a dialog must not remount reader plumbing already owned by
            // this window. An unmounted target still needs its signal consumer.
            if (command && key === 'refresh') {
                for (const refresh of Array.isArray(child) ? child : []) {
                    if (!owned.has(refresh?.dataSourceRef)) walk(refresh);
                }
                continue;
            }
            walk(child, ['submit', 'mutationCommand', 'mutation', 'command'].includes(key));
        }
    }
    walk(dialog.content);
    for (const ref of refs) add(definitions[ref]?.dataSourceRef);
    return [...refs];
}
