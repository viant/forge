import {parseDocument, stringify} from 'yaml';
import {assertSafeAssignmentKeys} from '../utils/selector.js';

export function formatEditorValue(value, format = 'text') {
    if (value === undefined) return '';
    if (format === 'json') return JSON.stringify(value, null, 2);
    if (format === 'yaml') return stringify(value);
    return value == null ? '' : String(value);
}

export function parseEditorValue(text, format = 'text') {
    if (format !== 'json' && format !== 'yaml') return text;
    let value;
    try {
        if (format === 'json') value = JSON.parse(text);
        else {
            const document = parseDocument(text, {uniqueKeys: true});
            if (document.errors.length) throw new Error('Invalid YAML');
            value = document.toJS();
        }
        assertSafeAssignmentKeys(value);
    } catch {
        throw new Error(`Enter valid ${format.toUpperCase()}.`);
    }
    return value;
}
