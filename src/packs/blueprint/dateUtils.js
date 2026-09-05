import { enUS } from 'date-fns/locale';
import { format, parse } from 'date-fns';
import {defaultDateInputMaxDate, defaultDateInputMinDate} from './dateInputBounds.js';

// Build properties for Blueprint DateInput3 so behaviour matches legacy
export function buildDateProps(item, { readOnly, properties = {} } = {}) {
    const merged = { ...properties };
    if (!('minDate' in merged)) merged.minDate = defaultDateInputMinDate();
    if (!('maxDate' in merged)) merged.maxDate = defaultDateInputMaxDate();

    const placeholderProp = merged.placeholder;

    switch (item.type) {
        case 'datetime':
            if (!('timePrecision' in merged)) merged.timePrecision = 'minute';
            merged.inputProps = {
                name: item.id,
                placeholder: placeholderProp || 'Select a time...',
            };
            delete merged.placeholder;
            break;
        case 'date':
        default:
            merged.inputProps = {
                name: item.id,
                placeholder: placeholderProp || 'Select a date...',
            };
            break;
    }

    const fmt = item.dateFnsFormat;

    merged.formatDate = (d) => {
        if (!d) return '';
        return fmt ? format(d, fmt, { locale: enUS }) : d.toLocaleDateString();
    };

    merged.parseDate = (str) => {
        if (!str) return undefined;
        return fmt ? parse(str, fmt, new Date(), { locale: enUS }) : new Date(str);
    };

    merged.locale = enUS;
    merged.disabled = readOnly;

    return merged;
}
