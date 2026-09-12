import React, {useLayoutEffect, useRef, useState} from 'react';
import {Button, InputGroup} from '@blueprintjs/core';
import {batch} from '@preact/signals-react';
import {useSignals} from '@preact/signals-react/runtime';

export function updateQuickSearch(context, field, value) {
    const current = context?.signals?.input?.peek?.() || {};
    const filter = {...(current.filter || {})};
    if (String(value).trim()) filter[field] = value;
    else delete filter[field];
    batch(() => {
        context.handlers.dataSource.setFilter({filter});
        context.handlers.dataSource.setPage(1);
    });
}

export default function QuickSearch({context, item, disabled = false}) {
    useSignals();
    const field = String(item?.properties?.field || '').trim();
    const label = item?.properties?.label || 'Name contains';
    const trigger = item?.properties?.requestTrigger === 'change' ? 'change' : 'blur';
    const [expanded, setExpanded] = useState(false);
    const input = useRef(null), button = useRef(null);
    const value = String(context?.signals?.input?.value?.filter?.[field] ?? '');
    const [draft, setDraft] = useState(value);
    const committed = useRef(value);
    useLayoutEffect(() => { committed.current = value; setDraft(value); }, [value]);
    const commit = next => {
        if (next === committed.current) return;
        committed.current = next;
        updateQuickSearch(context, field, next);
    };
    useLayoutEffect(() => { if (expanded) input.current?.focus(); }, [expanded]);
    if (!field) return null;
    const close = () => {
        setDraft('');
        commit('');
        setExpanded(false);
        button.current?.focus();
    };
    return <div className="forge-quick-search">
        <Button type="button" icon="search" minimal elementRef={button}
            className="forge-toolbar-action is-icon-only"
            disabled={disabled} aria-label={expanded ? 'Close quick search' : `Search: ${label}`}
            title={expanded ? 'Clear and close quick search' : label}
            aria-expanded={expanded} aria-pressed={expanded || !!value}
            onClick={() => expanded ? close() : setExpanded(true)}/>
        {expanded ? <InputGroup inputRef={input} type="search" value={draft}
            className="forge-quick-search-input" data-forge-part="input"
            aria-label={label} placeholder={`${label}…`} disabled={disabled}
            onChange={event => { setDraft(event.target.value); if (trigger === 'change') commit(event.target.value); }}
            onBlur={event => { if (event.relatedTarget !== button.current) commit(event.target.value); }}
            onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); commit(draft);} if (event.key === 'Escape') {event.preventDefault(); close();}}}/> : null}
    </div>;
}
