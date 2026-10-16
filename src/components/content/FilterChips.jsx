import React from 'react';
import {toggleChipValue} from './contentModel.js';
import './content.css';

export default function FilterChips({id, value = [], options = [], onChange, disabled, readOnly, className = '', label, 'aria-label': ariaLabel}) {
    const selected = Array.isArray(value) ? value : [];
    return <div id={id} className={`forge-filter-chips ${className}`} role="group" aria-label={ariaLabel || label || 'Filters'}>
        {options.map(option => {
            const active = selected.some(entry => Object.is(entry, option.value));
            return <button key={`${typeof option.value}:${String(option.value)}`} type="button" aria-pressed={active}
                disabled={disabled || readOnly || option.disabled}
                onClick={() => onChange?.(toggleChipValue(selected, option.value, !active))}>
                {option.label}{option.count != null ? <span className="forge-filter-chips__count">{option.count}</span> : null}
            </button>;
        })}
    </div>;
}
