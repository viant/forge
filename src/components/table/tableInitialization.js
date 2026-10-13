export function shouldInitializeEmptyTable(data = [], renderedCollection = [], control = {}) {
    if (control?.loading === true || control?.loaded === true || control?.inactive === true) return false;
    // The empty-table onInit hook is an implicit fetch. A terminal dataset
    // denial must remain visible until a user invokes an explicit retry.
    if (Number(control?.error?.status) === 403
        && control?.error?.code === 'datasource_denied'
        && control?.error?.scope === 'dataset') return false;
    return (!Array.isArray(data) || data.length === 0)
        && (!Array.isArray(renderedCollection) || renderedCollection.length === 0);
}
