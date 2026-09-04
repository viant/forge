import React from 'react';
import {Button} from '@blueprintjs/core';
import './ChipList.css';

function normalizeChip(value, index) {
    if (value && typeof value === 'object') {
        return {
            key: String(value.id ?? value.value ?? value.label ?? index),
            label: String(value.label ?? value.name ?? value.value ?? ''),
            excluded: value.excluded === true || String(value.mode || '').toLowerCase() === 'exclude',
            original: value,
        };
    }
    return {key: `${index}:${String(value ?? '')}`, label: String(value ?? ''), excluded: false, original: value};
}

export default function ChipList({value = [], onChange, readOnly = true, maxVisible = 4, emptyText = 'None', compact = true}) {
    const [expanded, setExpanded] = React.useState(false);
    const values = Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);
    const chips = values.map(normalizeChip).filter((chip) => chip.label);
    const visible = expanded ? chips : chips.slice(0, Math.max(1, Number(maxVisible) || 4));
    const hiddenCount = Math.max(0, chips.length - visible.length);
    const remove = (chip) => {
        if (readOnly || typeof onChange !== 'function') return;
        onChange(values.filter((entry) => entry !== chip.original));
    };
    if (chips.length === 0) return <span className="forge-chip-list__empty">{emptyText}</span>;
    return (
        <div className={`forge-chip-list${compact ? ' is-compact' : ''}`}>
            {visible.map((chip) => (
                <span key={chip.key} className={`forge-chip${chip.excluded ? ' is-excluded' : ' is-included'}`} title={`${chip.excluded ? 'Exclude' : 'Include'}: ${chip.label}`}>
                    <span className="forge-chip__mode" aria-hidden="true">{chip.excluded ? '−' : '+'}</span>
                    <span className="forge-chip__label">{chip.label}</span>
                    {!readOnly ? <button type="button" className="forge-chip__remove" aria-label={`Remove ${chip.label}`} onClick={() => remove(chip)}>×</button> : null}
                </span>
            ))}
            {hiddenCount > 0 ? <Button minimal small className="forge-chip-list__more" onClick={() => setExpanded(true)}>+{hiddenCount} more</Button> : null}
            {expanded && chips.length > Math.max(1, Number(maxVisible) || 4) ? <Button minimal small className="forge-chip-list__more" onClick={() => setExpanded(false)}>Show less</Button> : null}
        </div>
    );
}
