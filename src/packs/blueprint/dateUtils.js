import { enUS } from 'date-fns/locale';
import { format, parse } from 'date-fns';

// Build properties for Blueprint DateInput3 so behaviour matches legacy
export function buildDateProps(item, { readOnly, properties = {} } = {}) {
    const merged = { ...properties };

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
