const dateTypes = new Set(['date', 'datetime', 'datetime24', 'timestamp']);
const missing = value => value === null || value === undefined || value === '';

export function compareDashboardTableValues(a, b, column = {}, direction = 'asc') {
    const date = dateTypes.has(String(column.format || '').toLowerCase())
        || dateTypes.has(String(column.type || '').toLowerCase());
    const av = date && !missing(a) ? new Date(a).getTime() : a;
    const bv = date && !missing(b) ? new Date(b).getTime() : b;
    const am = missing(a) || (date && !Number.isFinite(av));
    const bm = missing(b) || (date && !Number.isFinite(bv));
    // Missing observations stay last independently of sort direction. In
    // particular, do not coerce null/empty to a measured numeric zero.
    if (am || bm) return am === bm ? 0 : am ? 1 : -1;
    const an = Number(av), bn = Number(bv);
    const numeric = Number.isFinite(an) && Number.isFinite(bn);
    const compared = numeric ? an - bn : String(av).localeCompare(String(bv));
    return direction === 'desc' ? -compared : compared;
}
