import {applyParameterCodec} from '../../hooks/parameters.js';

function parseTextList(value) {
    const values = [];
    let current = '', quoted = false;
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (char === '"') {
            if (quoted && value[index + 1] === '"') {current += '"'; index++;}
            else quoted = !quoted;
        } else if (char === ',' && !quoted) {
            if (current.trim()) values.push(current.trim());
            current = '';
        } else current += char;
    }
    if (quoted) return [value.trim()];
    if (current.trim()) values.push(current.trim());
    return values;
}

export function normalizeSubmittedFilterValue(field = {}, value, filterMode = '', {textInput = false} = {}) {
    if (String(filterMode).toLowerCase() !== 'server') return value;
    const codec = field.codec || field.type;
    const name = String(typeof codec === 'string' ? codec : codec?.name || '').trim().toLowerCase();
    const input = textInput && typeof value === 'string' && name.endsWith('[]')
        ? parseTextList(value)
        : value;
    return applyParameterCodec(input, codec);
}
