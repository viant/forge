import {resolvePagingValues,withPagingInputs,withPagingSize} from './paging.js';

// A host can execute connector operations through MCP or another supported
// transport. A configured transport owns the request; failures never fall back
// to the descriptor's HTTP URL.
export function createTransportConnector(dataSource, runtime) {
    if (typeof runtime.transport !== 'function') throw new Error('Invalid datasource transport');
    const invoke = async (operation, options = {}) => {
        if (options.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
        const paging = String(dataSource?.paginationMode || '').toLowerCase() === 'client'
            ? null : resolvePagingValues(options.page, withPagingSize(dataSource?.paging, options.pageSize), options.cursor);
        const result = await runtime.transport({operation, dataSource, dataSourceRef: runtime.dataSourceRef || dataSource?.id || dataSource?.dataSourceRef,
            targetContext: runtime.targetContext || {},
            options: {...options, inputParameters: withPagingInputs(options.inputParameters || {}, paging)}});
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
