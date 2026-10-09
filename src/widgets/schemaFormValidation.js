export function validateSchemaFormFields(fields, values) {
    const errors = {};
    for (const field of fields) {
        const value = values[field.name];
        if (field.required && (value == null || value === '' || (Array.isArray(value) && value.length === 0))) {
            errors[field.name] = 'Required';
        }
        if (field.itemEnum && value != null) {
            if (!Array.isArray(value) || value.some((item) => !field.itemEnum.includes(item))) errors[field.name] = 'Invalid value';
            else if (field.uniqueItems && new Set(value).size !== value.length) errors[field.name] = 'Choose each option only once';
            else if (field.minItems != null && value.length < field.minItems) errors[field.name] = `Select at least ${field.minItems}`;
            else if (field.maxItems != null && value.length > field.maxItems) errors[field.name] = `Select at most ${field.maxItems}`;
        } else if (field.enum && value != null && value !== '' && !field.enum.includes(value)) {
            errors[field.name] = 'Invalid value';
        }
    }
    return errors;
}
