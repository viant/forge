const dateTypes = new Set(['date', 'datetime', 'datetime24', 'timestamp']);
const missing = value => value === null || value === undefined || value === '';

// Compare integer strings before Number conversion: entity IDs commonly exceed
// JavaScript's safe integer range, where adjacent IDs otherwise compare equal.
const integerText = value => {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value).trim();
    if (!/^[+-]?\d+$/.test(text)) return null;
    const digits = text.replace(/^[+-]/, '').replace(/^0+(?=\d)/, '');
    return {digits, negative: text[0] === '-' && digits !== '0'};
};

function compareIntegers(a, b) {
    if (a.negative !== b.negative) return a.negative ? -1 : 1;
    const magnitude = a.digits.length !== b.digits.length
        ? (a.digits.length < b.digits.length ? -1 : 1)
        : a.digits === b.digits ? 0 : a.digits < b.digits ? -1 : 1;
    return a.negative ? -magnitude : magnitude;
}

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
    const ai = integerText(av), bi = integerText(bv);
    if (ai && bi) {
        const compared = compareIntegers(ai, bi);
        return direction === 'desc' ? -compared : compared;
    }
    const an = Number(av), bn = Number(bv);
    const numeric = Number.isFinite(an) && Number.isFinite(bn);
    const compared = numeric ? an - bn : String(av).localeCompare(String(bv));
    return direction === 'desc' ? -compared : compared;
}
