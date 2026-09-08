function civilDateKey(value) {
    if (typeof value === 'string') {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return '';
    const year = String(value.getFullYear()).padStart(4, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseCivilDateInput(value) {
    const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day, 12);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
        return new Date(Number.NaN);
    }
    return parsed;
}

export function normalizeDateInputValue(value, valueMode) {
    if (valueMode !== 'civil') return value;
    const key = civilDateKey(value);
    if (!key) return value;
    // DateInput3's controlled value is an ISO string. Noon UTC is a stable
    // display instant for a timezone-pinned civil-date control.
    return `${key}T12:00:00.000Z`;
}

export function serializeDateInputValue(value, valueMode) {
    if (valueMode !== 'civil') return value;
    return civilDateKey(value);
}
