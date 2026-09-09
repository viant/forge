export function tableLoadingMode({loading = false, error = null, rowCount = 0} = {}) {
    if (!loading || error) return 'idle';
    return Number(rowCount) > 0 ? 'refresh' : 'initial';
}
