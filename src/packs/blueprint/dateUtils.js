import { enUS } from 'date-fns/locale';
import { format, parse } from 'date-fns';
import {defaultDateInputMaxDate, defaultDateInputMinDate} from './dateInputBounds.js';
import {parseCivilDateInput} from './civilDate.js';

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
    const civil = item.valueMode === 'civil';

    merged.formatDate = (d) => {
        if (!d) return '';
        return fmt ? format(d, fmt, { locale: enUS }) : d.toLocaleDateString();
    };

    merged.parseDate = (str) => {
        if (!str) return undefined;
        if (civil && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return parseCivilDateInput(str);
        }
        return fmt ? parse(str, fmt, new Date(), { locale: enUS }) : new Date(str);
    };

    merged.locale = enUS;
    merged.disabled = readOnly;

    return merged;
}
