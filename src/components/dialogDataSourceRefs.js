// Reader plumbing for the contents of an open dialog. Mounting a reader does
// not fetch it: its active container or focused options widget owns that call.
export function dialogDataSourceRefs(dialog = {}, definitions = {}, primary = '') {
    const refs = new Set();
    function add(value) {
        const ref = typeof value === 'string' ? value.trim() : '';
        if (ref && definitions[ref] && ref !== primary) refs.add(ref);
    }
    function walk(value) {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(walk); return; }
        add(value.dataSourceRef);
        add(value.optionsDataSourceRef);
        Object.values(value.dataSourceRefs || {}).forEach(add);
        Object.values(value).forEach(walk);
    }
    walk(dialog.content);
    for (const ref of refs) add(definitions[ref]?.dataSourceRef);
    return [...refs];
}
