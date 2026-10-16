// Presentation-only records. Domain data is mapped by the authored window.
export function safeContentImage(value) {
    const url = String(value || '').trim();
    if (/^\/(?!\/)/.test(url)) return url;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch { return ''; }
}

export function contentRecords(value) {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

export function toggleChipValue(current, value, selected) {
    const values = Array.isArray(current) ? current : [];
    const exists = values.some(entry => Object.is(entry, value));
    if (selected === exists) return values.slice();
    return selected ? [...values, value] : values.filter(entry => !Object.is(entry, value));
}

export function contentAction(item, originalEvent) {
    return {target: {value: item.id}, detail: {item}, originalEvent};
}
