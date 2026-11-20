import React from 'react';
import {Tag} from '@blueprintjs/core';
import Button from './Button.jsx';
import './removableChip.css';

// Extracted from the existing List Page composition. The caller owns the value,
// count label and removal; the native ghost Button owns activation and focus.
export default function RemovableChip({label, category, onRemove, removeLabel,
    disabled = false, className = '', ...rest}) {
    return <Tag {...rest} minimal
        className={['forge-removable-chip', className].filter(Boolean).join(' ')}
        data-disabled={disabled || undefined}>
        {category && <><span className="forge-removable-chip__category">{category}:</span>{' '}</>}
        <span className="forge-removable-chip__value">{label}</span>
        <Button variant="ghost" size="compact" icon="lucide:x" hideLabel
            aria-label={removeLabel || `Remove ${category || label}`}
            disabled={disabled} onClick={onRemove}/>
    </Tag>;
}
