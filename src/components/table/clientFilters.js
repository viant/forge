import {resolveKey} from '../../utils/selector.js';

export function applyClientFilters(collection = [], filterSet = null, filter = {}) {
    const rows = Array.isArray(collection) ? collection : [];
    const templates = Array.isArray(filterSet?.template) ? filterSet.template : [];
    const active = templates.filter((template) => {
        const value = filter?.[template.id];
        return value !== undefined && value !== null && String(value).trim() !== '';
    });
    if (active.length === 0) return rows;
    return rows.filter((row) => active.every((template) => {
        const actual = resolveKey(row, template.field || template.dataField || template.id);
        const expected = filter[template.id];
        const operator = String(template.operator || 'contains').toLowerCase();
        if (operator === 'equal' || operator === 'equals') return String(actual ?? '').toLowerCase() === String(expected).trim().toLowerCase();
        if (operator === 'in') {
            const values = Array.isArray(expected) ? expected : String(expected).split(',');
            return values.map((value) => String(value).trim().toLowerCase()).includes(String(actual ?? '').toLowerCase());
        }
        return String(actual ?? '').toLowerCase().includes(String(expected).trim().toLowerCase());
    }));
}
