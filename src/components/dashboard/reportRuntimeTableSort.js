import {assertSafeAssignmentPath, resolveSelector, setSelector} from '../../utils/selector.js';
import {serverTableSortValues} from '../table/serverSort.js';

// The source owns transport, cancellation, loading and failure state. The viewer
// supplies only a table/column choice; paths and fields come from authored data.
export function boundReportDatasetSortHandler(config, context, fallbackOrders = new Map()) {
    return ({datasetId, blockId, sort}) => {
        const block = config.reportSpec?.blocks?.find(block => block.id === blockId && block.kind === 'tableBlock' && (block.datasetRef || 'primary') === datasetId);
        const column = block?.columns?.find(column => column.key === sort?.key);
        const binding = config.datasetBindings?.[datasetId];
        if (!column || block.hierarchy || block.pivot || !['asc', 'desc'].includes(sort.direction)) throw Error('Invalid report table sort.');
        const field = reportDatasetSortField(config.reportSpec, block, column);
        if (!field) throw Error('Table column requires complete data for sorting.');
        if (!binding?.queryPath || !binding.dataSourceRef) throw Error('Report sorting requires an explicit dataset query binding.');
        assertSafeAssignmentPath(binding.queryPath);
        const source = context.Context?.(binding.dataSourceRef);
        if (!['peekInput', 'setSort'].every(key => typeof source?.handlers?.dataSource?.[key] === 'function')) throw Error('Report sorting datasource is unavailable.');
        const handlers = source.handlers.dataSource;
        const parameters = handlers.peekInput()?.parameters || {};
        const request = resolveSelector(parameters, binding.queryPath) ?? config.reportSpec.datasets?.find(dataset => dataset.id === datasetId)?.request;
        if (!request || typeof request !== 'object' || Array.isArray(request)) throw Error('Report sort request is unavailable.');
        const authored = config.reportSpec.datasets?.find(dataset => dataset.id === datasetId)?.request;
        let fallback = fallbackOrders.get(datasetId);
        if (!fallback || fallback.handlers !== handlers) {
            fallback = {handlers, orderBy: Array.isArray(request.orderBy) ? [...request.orderBy] : []};
            fallbackOrders.set(datasetId, fallback);
        }
        const tieOrder = Array.isArray(authored?.orderBy) ? authored.orderBy : fallback.orderBy;
        const next = setSelector(parameters, binding.queryPath, {...request, offset: 0, orderBy: primaryReportOrder(tieOrder, field, sort.direction)});
        // setSort owns page reset, fetch scheduling, cancellation and failures.
        // Its destination is one top-level input; reconstruct nested authored
        // query paths before passing that ordinary datasource parameter value.
        const parameter = binding.queryPath.split('.')[0];
        handlers.setSort({columnId: field, direction: sort.direction, fetch: true, parameter, value: next[parameter]});
    };
}

export function boundReportDatasetPages(config, context) {
    return Object.fromEntries((config.reportSpec?.datasets || []).map(dataset => {
        const binding = config.datasetBindings?.[dataset.id];
        const source = binding?.dataSourceRef ? context.Context?.(binding.dataSourceRef) : context;
        const info = source?.signals?.collectionInfo?.value;
        const request = binding?.queryPath ? resolveSelector(source?.handlers?.dataSource?.peekInput?.()?.parameters, binding.queryPath) : null;
        // Only a datasource publishing paging metadata owns an admitted page.
        const paged = typeof info?.hasMore === 'boolean' || typeof info?.hasNext === 'boolean';
        return [dataset.id, {offset: paged ? request?.offset || 0 : 0}];
    }));
}

// Presentation relations/maps and local calculations are not producer fields.
// Without native field-level sort metadata these require complete local data.
export function reportDatasetSortField(spec, block, column) {
    if (!column || block?.hierarchy || block?.pivot) return null;
    const field = column.sourceKey || column.key;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field) || (column.displayKey && column.displayKey !== field)
        || Object.keys(column.displayValueMap || {}).length || ['object', 'array'].includes(column.dataType || column.kind)) return null;
    const datasetId = block.datasetRef || 'primary';
    if ((spec?.calculatedFields || []).some(calculation => (!calculation.datasetRef || calculation.datasetRef === datasetId)
        && [calculation.id, calculation.key].some(key => key === field || key === column.key))) return null;
    return field;
}

// Native requests use string[] orderBy. Preserve authored/current secondary
// expressions verbatim, replacing only the selected field's simple order token.
export function primaryReportOrder(orderBy, field, direction) {
    return serverTableSortValues({template:'{{field}} {{direction}}', thenBy:(Array.isArray(orderBy) ? orderBy : []).filter(entry =>
        typeof entry === 'string' && entry.trim() && entry.trim().split(/\s+/)[0] !== field)}, field, direction);
}
