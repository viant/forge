import {resolvePagingValues,withPagingInputs,withPagingSize} from './paging.js';
import {applyParameterCodec} from './parameters.js';
import {resolveSelector,setSelector} from '../utils/selector.js';

// Authored `in: filter` parameters are invocation-time mappings. A quick
// filter changes after the window's static parameters were resolved, so it
// must be projected before transport rather than passed as a stray root key.
export function withMappedFilterInputs(dataSource, options = {}) {
    let inputParameters = {...(options.inputParameters || {})};
    const filter = {...(options.filter || {})};
    for (const parameter of dataSource?.parameters || []) {
        if (parameter?.in !== 'filter' || !parameter?.name || !parameter?.location
            || String(parameter.location).includes('.')) continue;
        const value = resolveSelector(filter, parameter.location);
        if (value === undefined || value === null || value === '') continue;
        inputParameters = setSelector(inputParameters, parameter.name, applyParameterCodec(value, parameter.codec));
        delete filter[parameter.location];
    }
    return {...options, filter, inputParameters};
}

// A host can execute connector operations through MCP or another supported
// transport. A configured transport owns the request; failures never fall back
// to the descriptor's HTTP URL.
export function createTransportConnector(dataSource, runtime) {
    if (typeof runtime.transport !== 'function') throw new Error('Invalid datasource transport');
    const invoke = async (operation, options = {}) => {
        if (options.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
        const mapped = withMappedFilterInputs(dataSource, options);
        const paging = String(dataSource?.paginationMode || '').toLowerCase() === 'client'
            ? null : resolvePagingValues(mapped.page, withPagingSize(dataSource?.paging, mapped.pageSize), mapped.cursor);
        const result = await runtime.transport({operation, dataSource, dataSourceRef: runtime.dataSourceRef || dataSource?.id || dataSource?.dataSourceRef,
            targetContext: runtime.targetContext || {},
            options: {...mapped, inputParameters: withPagingInputs(mapped.inputParameters || {}, paging)}});
        if (options.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
        return result;
    };
    return {
        get: options => invoke('get', options),
        request: async options => {const result = await invoke('request', options);return typeof result === 'string' ? result : JSON.stringify(result);},
        post: options => invoke('post', options),
        patch: options => invoke('patch', options),
        put: options => invoke('put', options),
        del: options => invoke('delete', options),
    };
}
