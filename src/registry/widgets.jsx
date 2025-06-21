// Widget registry – maps a `widget` (or fallback `type`) string to a React component factory.
// Every factory receives { value, onChange, field } and should render a controlled component.

import React from 'react';

// Simple input versions. Blueprint or custom widgets can later replace these.

const StringInput = ({ value, onChange, field }) => (
    <input
        type="text"
        className="bp4-input"
        value={value ?? ''}
        placeholder={field.placeholder || ''}
        onChange={(e) => onChange(e.target.value)}
    />
);

const SelectInput = ({ value, onChange, field }) => (
    <select
        className="bp4-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
    >
        <option value="" disabled>{field.placeholder || 'Select...'}</option>
        {field.enum?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
        ))}
    </select>
);

const NumberInput = ({ value, onChange }) => (
    <input
        type="number"
        className="bp4-input"
        value={value ?? ''}
        onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? '' : Number(v));
        }}
    />
);

const BooleanSwitch = ({ value = false, onChange }) => (
    <label className="bp4-control bp4-switch">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span className="bp4-control-indicator" />
    </label>
);

const DateInput = ({ value, onChange }) => (
    <input
        type="date"
        className="bp4-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
    />
);

export const widgetRegistry = {
    text: StringInput,
    string: StringInput,
    select: SelectInput,
    enum: SelectInput,
    number: NumberInput,
    integer: NumberInput,
    checkbox: BooleanSwitch,
    boolean: BooleanSwitch,
    date: DateInput,
};

export function getWidget(field) {
    const key = field.widget || (field.enum?.length ? 'select' : field.type) || 'string';
    return widgetRegistry[key] || StringInput;
}
