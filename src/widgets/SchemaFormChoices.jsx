import React from 'react';

export default function SchemaFormChoices({ field, value, onChange, disabled = false, error }) {
    const selected = Array.isArray(value) ? value : [];
    return <fieldset disabled={disabled || field.disabled || field.readOnly} className="forge-schema-choices" aria-describedby={error ? `${field.name}-error` : undefined}>
        <legend>{field.label}{field.required ? ' (required)' : ''}</legend>
        <div className="forge-schema-choices-options" role="group" aria-label={field.label}>
        {field.options?.map((option, index) => <label key={index}>
            <input type="checkbox" name={field.name} value={String(option.value)} checked={selected.includes(option.value)} onChange={(event) => {
                onChange(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value));
            }} />
            <span>{option.label}</span>
        </label>)}
        </div>
        {error ? <span id={`${field.name}-error`} role="alert">{error}</span> : null}
    </fieldset>;
}
