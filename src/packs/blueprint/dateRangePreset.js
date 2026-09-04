const formatUtcDate = (value) => value.toISOString().slice(0, 10);

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
        return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
    } catch (_) {
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
}

export function resolveDateRangePreset(value, now = new Date(), lifetimeStart = '2026-01-01', timeZone = 'UTC') {
    const normalized = String(value || '').trim().toLowerCase();
    const today = calendarDateInTimeZone(now, timeZone);
    const addDays = (days) => new Date(today.getTime() + days * 86400000);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const startOfQuarter = new Date(Date.UTC(today.getUTCFullYear(), Math.floor(today.getUTCMonth() / 3) * 3, 1));
    const sameDayPreviousMonth = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() - 1,
        Math.min(today.getUTCDate(), new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)).getUTCDate()),
    ));
    let start;
    let end = today;
    switch (normalized) {
        case 'today': start = today; break;
        case 'yesterday': start = end = addDays(-1); break;
        case 'week': start = addDays(-6); break;
        case 'month': start = sameDayPreviousMonth; break;
        case 'month_to_date': start = monthStart; break;
        case 'last_month':
            start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
            end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
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
