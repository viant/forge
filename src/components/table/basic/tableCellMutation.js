import {evaluatePlainVisibleWhen, trackVisibleWhen} from '../../visibleWhen.js';
import {resolveSelector} from '../../../utils/selector.js';

// Reuse the datasource's declared identity, without its read-only JSON/index
// fallback. Typed tuples avoid collisions between compound key components.
export function tableCellMutation(context, column, row) {
    const source = context?.identity?.dataSourceRef;
    const keys = context?.metadata?.dataSource?.[source]?.uniqueKey;
    if (!Array.isArray(keys) || !keys.length) return null;
    const values = keys.map(key => key.field ? resolveSelector(row, key.field) : undefined);
    if (values.some(value => value == null || value === '' || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)))) return null;
    const variants = Array.isArray(column.mutationCommands) ? column.mutationCommands : [];
    const matches = variants.map((variant, index) => ({...variant, index})).filter(variant => {
        trackVisibleWhen(variant.when, context);
        return evaluatePlainVisibleWhen(variant.when, context, row);
    });
    if (matches.length > 1) return null;
    const spec = matches.length ? matches[0].command : column.mutationCommand;
    if (!spec?.dataSourceRef) return null;
    return {...spec, label: spec.label || column.name || column.id,
        commandId: JSON.stringify(['table-cell', context?.identity?.windowId || '', source, column.id, spec.commandId || spec.dataSourceRef, values, matches.length ? matches[0].index : null])};
}
