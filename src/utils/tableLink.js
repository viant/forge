import {resolveKey} from './selector.js';

function normalizeString(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
}

function isObjectValue(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLinkText(value, fallbackHref) {
    if (value == null) {
        return fallbackHref;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const text = String(value);
        return text || fallbackHref;
    }
    return fallbackHref;
}

export function resolveTableLink({row, column, value} = {}) {
    const linkConfig = isObjectValue(column?.link) ? column.link : null;
    const objectValue = isObjectValue(value) ? value : null;
    const href = normalizeString(
        linkConfig?.href
            ? resolveKey(row, linkConfig.href)
            : objectValue?.href ?? (column?.type === 'link' ? value : '')
    );

    if (!href) {
        return null;
    }

    const textSource = linkConfig?.label
        ? resolveKey(row, linkConfig.label)
        : objectValue?.label ?? objectValue?.text ?? value;
    const text = normalizeLinkText(textSource, href);

    const target = normalizeString(objectValue?.target || linkConfig?.target) || '_blank';
    const rel = normalizeString(objectValue?.rel || linkConfig?.rel) || 'noopener noreferrer';
    const title = normalizeString(objectValue?.title);

    return {href, text, target, rel, title};
}

export function resolveTableCellText({row, column, value} = {}) {
    const link = resolveTableLink({row, column, value});
    if (link) {
        return link.text;
    }
    if (value == null) {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return '';
}
