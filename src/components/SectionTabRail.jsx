import React from 'react';
import {Icon} from '@blueprintjs/core';
import './SectionTabRail.css';

/** Shared visual navigation primitive used by report sections and form panels. */
export default function SectionTabRail({items = [], selectedId = '', onChange, ariaLabel = 'Sections', showIcons = false}) {
    return (
        <div className="forge-section-tab-rail" role="tablist" aria-label={ariaLabel}>
            {items.map((item) => {
                const selected = String(item?.id || '') === String(selectedId || '');
                return (
                    <button key={item.id} type="button" role="tab" aria-selected={selected}
                        className={`forge-section-tab${selected ? ' is-selected' : ''}`}
                        onClick={() => onChange?.(item.id)}>
                        {showIcons && item.icon ? <Icon icon={item.icon} size={14}/> : null}
                        <span>{item.label || item.title || item.id}</span>
                    </button>
                );
            })}
        </div>
    );
}
