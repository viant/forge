const formatUtcWallClock = (date, locale, kind) => {
    const year = date.getUTCFullYear();
    const day = date.getUTCDate();
    const hour24 = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const month = new Intl.DateTimeFormat(locale, {month: 'short', timeZone: 'UTC'}).format(date);

    if (kind === 'wallClockDate') {
        return `${month} ${day}, ${year}`;
    }

    const hour12 = hour24 % 12 || 12;
    const meridiem = hour24 >= 12 ? 'PM' : 'AM';
    if (kind === 'wallClockHour') {
        return `${hour12} ${meridiem}`;
    }
    return `${month} ${day}, ${year} ${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`;
};

export const formatDisplayValue = (value, format, locale = 'en-US', options = {}) => {
    if (value == null) return '-';
    if (typeof value === 'string' && value.trim() === '') return '';

    if (format === 'date' || format === 'dateTime' || format === 'wallClockHour' || format === 'wallClockDate') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            if (format === 'wallClockHour' || format === 'wallClockDate') {
                return formatUtcWallClock(date, locale, format);
            }

            const timeZone = typeof options?.timeZone === 'string' && options.timeZone.trim() !== ''
                ? options.timeZone
                : undefined;
            if (format === 'date') {
                return new Intl.DateTimeFormat(locale, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    ...(timeZone ? {timeZone} : {}),
                }).format(date);
            }
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                ...(timeZone ? {timeZone} : {}),
            }).format(date);
        }
        return typeof value === 'string' && value.trim() !== '' ? value : '-';
    }

    const numeric = Number(value);
    const isNumeric = Number.isFinite(numeric);

    if (!isNumeric) {
        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }
        return '-';
    }

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat(locale, {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(numeric);
        case 'compactNumber':
            return new Intl.NumberFormat(locale, {notation: 'compact', maximumFractionDigits: 1}).format(numeric);
        case 'percent':
            return `${numeric.toFixed(1)}%`;
        case 'percentFraction':
            return `${(numeric * 100).toFixed(1)}%`;
        case 'number':
            return new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(numeric);
        default:
            return new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(numeric);
    }
};
