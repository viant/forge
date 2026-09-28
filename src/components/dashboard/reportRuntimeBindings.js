import {resolveKey} from '../../utils/selector.js';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';

// Bind an authored report to the enclosing window's existing datasource signals.
// The ordinary window lifecycle owns fetching, authorization, and refresh.
export function resolveBoundReportRuntime(config = {}, context = {}) {
    const bindings = config.datasetBindings;
    if (!bindings || !Object.keys(bindings).length) return {reportFill: config.reportFill || {}, status: 'ready'};
    const payloads = {};
    let status = 'ready';
    for (const [datasetId, binding] of Object.entries(bindings)) {
        const source = binding.dataSourceRef ? context.Context?.(binding.dataSourceRef) : context;
        const control = source?.signals?.control?.value || {};
        if (!source || control.error) status = 'error';
        else if (status !== 'error' && (control.loading || control.loaded === false)) status = 'loading';
        const scope = binding.scope === 'metrics' ? 'metrics' : 'collection';
        const value = source?.signals?.[scope]?.value;
        const selected = binding.selector ? resolveKey(value, binding.selector) : value;
        payloads[datasetId] = {rows: Array.isArray(selected) ? selected : selected && typeof selected === 'object' ? [selected] : []};
    }
    // Never show a prior advertiser/date's rows while its replacement is pending.
    if (status !== 'ready') return {reportFill: null, status};
    return {reportFill: buildReportFillFromReportSpec(config.reportSpec || {}, payloads), status};
}
