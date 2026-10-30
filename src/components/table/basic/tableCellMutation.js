import {resolveSelector} from '../../../utils/selector.js';

// Reuse the datasource's declared identity, without its read-only JSON/index
// fallback. Typed tuples avoid collisions between compound key components.
export function tableCellMutation(context, column, row) {
    const source = context?.identity?.dataSourceRef;
    const keys = context?.metadata?.dataSource?.[source]?.uniqueKey;
    if (!Array.isArray(keys) || !keys.length) return null;
    const values = keys.map(key => key.field ? resolveSelector(row, key.field) : undefined);
    if (values.some(value => value == null || value === '' || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)))) return null;
    const spec = column.mutationCommand;
    return {...spec, label: spec.label || column.name || column.id,
        commandId: JSON.stringify(['table-cell', context?.identity?.windowId || '', source, column.id, spec.commandId || spec.dataSourceRef, values])};
}
