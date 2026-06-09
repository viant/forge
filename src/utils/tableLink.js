import { resolveLinkTarget } from './linkTarget.js';
import { formatDisplayValue } from './formatValue.js';

function inferTableCellFormat(column = {}) {
    if (column?.format) {
        return column.format;
    }
    const label = String(column?.label || column?.name || '');
    const id = String(column?.id || '');
    if (/\bID\b/i.test(label) || /(^|[._])id$/i.test(id) || /Id$/i.test(id)) {
        return 'raw';
    }
    return undefined;
}

export function resolveTableLink({row, column, value} = {}) {
    const resolved = resolveLinkTarget({
        row,
        value: column?.type === 'link' ? value : value,
        linkConfig: column?.link,
    });
    return resolved;
}

export function resolveTableCellText({row, column, value} = {}) {
    const link = resolveTableLink({row, column, value});
    if (link) {
        return link.text;
    }
    if (value == null) {
        return column?.emptyText ?? value;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return formatDisplayValue(value, inferTableCellFormat(column));
    }
    return '';
}
