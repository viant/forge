import React from 'react';

// Shared native switch shell; appearance comes from the active workspace theme.
export default function SwitchControl({ value = false, onChange, readOnly, disabled, id, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy, 'data-forge-type': typeRole, item, title, trueLabel, falseLabel }) {
        const checked = !!value;
        const unavailable = readOnly || disabled;
        const controlId = id || item?.id;
        const control = (
            <button
                id={controlId}
                className={['forge-switch', className].filter(Boolean).join(' ')}
                data-forge-widget="switch"
                data-forge-control-id={controlId}
                data-forge-part="switch-control"
                data-forge-type={typeRole}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={ariaLabel || item?.ariaLabel || item?.label || 'Toggle'}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                title={title || item?.label}
                disabled={unavailable}
                onClick={() => onChange?.(!checked)}
            >
                <span aria-hidden="true" className="forge-switch__thumb"/>
            </button>
        );
        const stateLabel = checked ? trueLabel : falseLabel;
        if (!stateLabel) return control;
        return (
            <span className={['forge-switch-field', className].filter(Boolean).join(' ')}>
                {control}
                <span className="forge-switch-field__state">{stateLabel}</span>
            </span>
        );
    }
