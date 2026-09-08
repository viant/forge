export function shouldFetchDataSourceOnMount({fetchData = true, fetchOnce = false, control = {}} = {}) {
    if (!fetchData || control?.loading === true) return false;
    return !(fetchOnce && (control?.loaded === true || !!control?.error));
}
