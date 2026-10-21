import NativeControlTarget from '../../../runtime/NativeControlTarget.jsx';
import React, { useRef } from 'react';
import { Button } from '@blueprintjs/core';
import { resolveQuickFilterSet, isQuickFiltersActive } from './QuickFilterHelpers.js';

export default function QuickFilterToggle({ context }) {
    const { handlers } = context || {};

    const set = resolveQuickFilterSet(context);
    if (!set) return null;

    const filters = set.filters || [];

    const currentFilter = handlers?.dataSource?.peekFilter?.() || {};
    const active = isQuickFiltersActive(context, filters);

    const cacheRef = useRef({});

    const fetch = () => handlers?.dataSource?.fetchCollection?.();

    const setSilentVals = (vals) => handlers?.dataSource?.setSilentFilterValues?.({ filter: vals });

    const toggle = () => {
        if (active) {
            const snapshot = {};
            filters.forEach((f) => (snapshot[f.field] = currentFilter[f.field]));
            cacheRef.current = snapshot;

            const cleared = { ...currentFilter };
            filters.forEach((f) => (cleared[f.field] = ''));
            setSilentVals(cleared);
            return fetch();
        } else {
            const restored = { ...currentFilter, ...cacheRef.current };
            setSilentVals(restored);
            return fetch();
        }
    };

    return (
        <NativeControlTarget context={context} item={{id:'quickFilterToggle',type:'button',label:'Toggle quick filters'}} actions={{click:toggle}}><Button
            icon={active ? 'filter-remove' : 'filter'}
            minimal
            small
            onClick={toggle}
            title={active ? 'Disable quick filters' : 'Enable quick filters'}
        /></NativeControlTarget>
    );
}
