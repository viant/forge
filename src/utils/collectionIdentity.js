// A missing, zero, or invalid row key does not identify a stored row.
export function isPersistedCollectionIdentity(value) {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0;
    if (typeof value !== 'string' || value.trim() === '') return false;
    const numeric = Number(value);
    return Number.isNaN(numeric) || (Number.isSafeInteger(numeric) && numeric > 0);
}
