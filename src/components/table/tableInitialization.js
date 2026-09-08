export function shouldInitializeEmptyTable(data = [], renderedCollection = [], control = {}) {
    if (control?.loading === true || control?.loaded === true || control?.inactive === true) return false;
    return (!Array.isArray(data) || data.length === 0)
        && (!Array.isArray(renderedCollection) || renderedCollection.length === 0);
}
