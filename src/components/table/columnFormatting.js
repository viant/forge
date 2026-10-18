import {useMemo} from 'react';
import {computed} from '@preact/signals-react';
import {resolveStateAdapter} from '../../runtime/binding.js';

// Export uses the same resolved binding as the rendered cells. Keep explicit
// per-column/per-row timezone overrides authoritative in the shared formatter.
export function withBoundColumnTimeZones(columns, timeZones) {
    return columns.map((column, index) => timeZones[index]
        ? {...column, boundTimeZone: timeZones[index]}
        : column);
}

// Presentation only: read an existing bound value; never fetch or mutate data.
export function resolveColumnTimeZone(column, context) {
    const binding = column?.timeZoneBinding;
    if (!binding) return undefined;
    let target;
    try {
        target = binding.dataSourceRef ? context?.Context?.(binding.dataSourceRef) : context;
    } catch {
        return undefined;
    }
    const adapter = resolveStateAdapter(binding.scope || 'metrics');
    const value = adapter?.(target, binding)?.get?.();
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function useTableColumnTimeZones(columns, context) {
    // Project to scalar values so unrelated edits in the bound source do not
    // notify the table or invalidate its prepared cells.
    const selection = useMemo(() => computed(() => JSON.stringify(
        columns.map(column => resolveColumnTimeZone(column, context)),
    )), [columns, context]);
    const signature = selection.value;
    return useMemo(() => JSON.parse(signature), [signature]);
}
