export function shouldFetchDataSourceOnMount({fetchData = true, fetchOnce = false, control = {}} = {}) {
    if (!fetchData || control?.loading === true) return false;
    if (Number(control?.error?.status) === 403
        && control?.error?.code === 'datasource_denied'
        && control?.error?.scope === 'dataset') return false;
    return !(fetchOnce && (control?.loaded === true || !!control?.error));
}
