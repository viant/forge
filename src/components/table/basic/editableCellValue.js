import {validateWidgetControlValue} from '../../../core/ui/controlValueValidation.js';

export const editableCellKind = (properties = {}) => ['email','number'].includes(properties.type) ? properties.type : 'text';

// All three paths use the existing control validator. Numeric format patterns
// are producer-authored text constraints on the canonical numeric value.
export function editableCellError(value, properties = {}) {
    const kind = editableCellKind(properties);
    if (properties.required && (value == null || value === '')) return 'This field is required.';
    const error = validateWidgetControlValue(value, {item: {type: kind}, props: properties})
        || (kind === 'number' && value != null && properties.pattern
            ? validateWidgetControlValue(String(value), {item: {type: 'text'}, props: {pattern: properties.pattern}}) : null);
    if (!error) return null;
    if (error === 'valid email address required') return 'Enter a valid email address.';
    if (error === 'finite number required') return 'Enter a valid number.';
    if (error === 'value is required') return 'This field is required.';
    if (error === 'maximum length exceeded') return `Use ${properties.maxLength} characters or fewer.`;
    if (error === 'minimum length not met') return `Use at least ${properties.minLength} characters.`;
    if (error === 'number is outside allowed bounds') {
        if (properties.min != null && properties.max != null) return `Enter a number between ${properties.min} and ${properties.max}.`;
        return properties.min != null ? `Enter ${properties.min} or more.` : `Enter ${properties.max} or less.`;
    }
    if (error === 'pattern does not match') return properties['aria-description'] || 'Use the format required for this field.';
    return 'Review this value.';
}
