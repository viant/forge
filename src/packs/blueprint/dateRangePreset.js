const formatUtcDate = (value) => value.toISOString().slice(0, 10);
const civilDate = (year, month, day) => {
    const date = new Date(0);
    date.setUTCFullYear(year, month, day);
    date.setUTCHours(0, 0, 0, 0);
    return date;
};

export function requireCalendarTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || timeZone.length > 128 || !/^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)*$/.test(timeZone)) throw new Error('An authorized named calendar timezone is required.');
    try { new Intl.DateTimeFormat('en-US', {timeZone}).format(new Date(0)); }
    catch (_) { throw new Error('The authorized calendar timezone is invalid.'); }
    return timeZone;
}

export function normalizeRelativeDaysRange(range) {
    if (!range || typeof range !== 'object' || Array.isArray(range)
        || Object.keys(range).some(key => !['kind', 'startOffset', 'endOffset'].includes(key))
        || range.kind !== 'relativeDays'
        || ![range.startOffset, range.endOffset].every(value => Number.isSafeInteger(value) && value >= -36600 && value <= 0)
        || range.startOffset > range.endOffset) throw new Error('Invalid relative-days preset definition.');
    return {kind: 'relativeDays', startOffset: range.startOffset, endOffset: range.endOffset};
}

export function normalizeLifetimeStart(value, fallback = '2026-01-01') {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return formatUtcDate(value);
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return fallback;
}

function calendarDateInTimeZone(now, timeZone = 'UTC') {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(now);
        const values = Object.fromEntries(parts.map(({type, value}) => [type, value]));
        return civilDate(Number(values.year), Number(values.month) - 1, Number(values.day));
    } catch (_) {
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
}

export function resolveDateRangePreset(value, now = new Date(), lifetimeStart = '2026-01-01', timeZone = 'UTC', range = null) {
    if (range) { normalizeRelativeDaysRange(range); requireCalendarTimeZone(arguments[3]); }
    const normalized = String(value || '').trim().toLowerCase();
    const today = calendarDateInTimeZone(now, timeZone);
    const addDays = (days) => new Date(today.getTime() + days * 86400000);
    const monthStart = civilDate(today.getUTCFullYear(), today.getUTCMonth(), 1);
    const startOfQuarter = civilDate(today.getUTCFullYear(), Math.floor(today.getUTCMonth() / 3) * 3, 1);
    const sameDayPreviousMonth = civilDate(
        today.getUTCFullYear(),
        today.getUTCMonth() - 1,
        Math.min(today.getUTCDate(), new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)).getUTCDate()),
    );
    let start;
    let end = today;
    if (range) {
        start = addDays(range.startOffset);
        end = addDays(range.endOffset);
    } else switch (normalized) {
        case 'today': start = today; break;
        case 'yesterday': start = end = addDays(-1); break;
        case 'week': start = addDays(-6); break;
        case 'month': start = sameDayPreviousMonth; break;
        case 'month_to_date': start = monthStart; break;
        case 'last_month':
            start = civilDate(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
            end = civilDate(today.getUTCFullYear(), today.getUTCMonth(), 0);
            break;
        case 'quarter_to_date': start = startOfQuarter; break;
        case 'year_to_date': start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1)); break;
        case 'year': start = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate())); break;
        case 'last_year':
            start = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
            end = new Date(Date.UTC(today.getUTCFullYear() - 1, 11, 31));
            break;
        case 'lifetime':
            return {start: lifetimeStart, end: formatUtcDate(today), granularity: 'day'};
        default: return null;
    }
    const durationDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return {
        start: formatUtcDate(start),
        end: formatUtcDate(end),
        granularity: durationDays <= 2 ? 'hour' : 'day',
    };
}

// Authored report controls require explicit context before entering legacy
// default arguments. Existing window-form consumers retain their old contract.
export function resolveDeclaredDateRangePreset(option, now, timeZone) {
    requireCalendarTimeZone(timeZone);
    if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || now.getUTCFullYear() < 1 || now.getUTCFullYear() > 9999) throw new Error('Invalid calendar instant.');
    if (!option?.range && !['yesterday', 'month_to_date', 'last_month'].includes(option?.value)) throw new Error('The date preset must declare its relative-days range.');
    const resolved = resolveDateRangePreset(option?.value, now, undefined, timeZone, option?.range || null);
    if (!resolved || ![resolved.start, resolved.end].every(value => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && !value.startsWith('0000-')) || resolved.start > resolved.end) throw new Error('The date preset is unavailable or outside the supported calendar.');
    return resolved;
}

export function resolveDateRangePresetSyncPatch(current = {}, resolved = null, {
    startField = 'customDateStart',
    endField = 'customDateEnd',
    granularityField = 'granularity',
} = {}) {
    if (!resolved) return null;
    if (current?.[startField] === resolved.start && current?.[endField] === resolved.end) return null;
    return {
        [startField]: resolved.start,
        [endField]: resolved.end,
        [granularityField]: resolved.granularity,
    };
}
