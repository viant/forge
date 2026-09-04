import { resolveLinkTarget } from './linkTarget.js';
import { formatDisplayValue } from './formatValue.js';
import { resolveSelector } from './selector.js';

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
    const isMissingLinkValue = value === undefined
        || value === null
        || (typeof value === 'string' && value.trim() === '')
        || (Array.isArray(value) && value.length === 0)
        || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
    if (isMissingLinkValue) {
        return null;
    }
    const resolved = resolveLinkTarget({
        row,
        value: column?.type === 'link' ? value : value,
        linkConfig: column?.link,
    });
    if (resolved && Array.isArray(value) && column?.format === 'relationCount') {
        const singular = column?.singularLabel || 'item';
        const plural = column?.pluralLabel || `${singular}s`;
        resolved.text = `${value.length} ${value.length === 1 ? singular : plural}`;
    }
    return resolved;
}

export function resolveTableCellText({row, column, value} = {}) {
    if (column?.format === 'relationCount') {
        const singular = column?.singularLabel || 'item';
        const plural = column?.pluralLabel || `${singular}s`;
        const count = Array.isArray(value) ? value.length : 0;
        if (count === 0 && column?.emptyText !== undefined) return column.emptyText;
        return `${count} ${count === 1 ? singular : plural}`;
    }
    const link = resolveTableLink({row, column, value});
    if (link) {
        return link.text;
    }
    if (column?.valueMap && Object.prototype.hasOwnProperty.call(column.valueMap, String(value))) {
        return column.valueMap[String(value)];
    }
    if (value == null) {
        return column?.emptyText ?? value;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const timeZone = column?.timeZone
            || (column?.timeZoneSelector ? resolveSelector(row, column.timeZoneSelector) : undefined);
        return formatDisplayValue(value, inferTableCellFormat(column), undefined, {timeZone});
    }
    if (column?.format) {
        return formatDisplayValue(value, inferTableCellFormat(column));
    }
    return '';
}
