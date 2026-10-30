import {resolveKey, resolveSelector} from '../../utils/selector.js';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';
import {boundReportScopeSpec, reportScopeSourceAvailable, ReportScopeUnavailableError} from './reportRuntimeScopeControls.js';

// Bind an authored report to the enclosing window's existing datasource signals.
// The ordinary window lifecycle owns fetching, authorization, and refresh.
export function resolveBoundReportRuntime(config = {}, context = {}) {
    const bindings = config.datasetBindings || {};
    const controlDatasets = new Set((config.reportSpec?.scope?.params || []).flatMap(param => (param.filterBindings || []).map(binding => binding.datasetRef)));
    if (!Object.keys(bindings).length && config.reportFill != null) return {reportFill: config.reportFill, status: 'ready', scopeControlsUnavailable: controlDatasets.size > 0};
    if (!Object.keys(bindings).length && !controlDatasets.size) return {reportFill: config.reportFill || {}, status: 'ready'};
    const payloads = {};
    const unavailableDatasets = [];
    let scopeControlsUnavailable = [...controlDatasets].some(datasetId => !bindings[datasetId]);
    let status = scopeControlsUnavailable ? 'error' : 'ready';
    for (const [datasetId, binding] of Object.entries(bindings)) {
        const source = binding.dataSourceRef ? context.Context?.(binding.dataSourceRef) : context;
        const control = source?.signals?.control?.value || {};
        if (controlDatasets.has(datasetId) && !reportScopeSourceAvailable(source)) {
            scopeControlsUnavailable = true;
            status = 'error';
        }
        if (binding.optional && (!source || control.error || control.loading || control.loaded === false)) {
            payloads[datasetId] = {rows: []};
            unavailableDatasets.push(datasetId);
            continue;
        }
        if (!source || control.error) status = 'error';
        else if (status !== 'error' && (control.loading || control.loaded === false)) status = 'loading';
        const scope = binding.scope === 'metrics' ? 'metrics' : 'collection';
        const value = source?.signals?.[scope]?.value;
        const selected = binding.selector ? resolveKey(value, binding.selector) : value;
        payloads[datasetId] = {rows: Array.isArray(selected) ? selected : selected && typeof selected === 'object' ? [selected] : [], hasMore: source?.signals?.collectionInfo?.value?.hasMore === true || source?.signals?.collectionInfo?.value?.hasNext === true};
    }
    // Never show prior scope rows while their replacement is pending.
    let reportSpec = {...config.reportSpec, datasets: (config.reportSpec?.datasets || []).map(dataset => {
        const binding = bindings[dataset.id];
        const source = binding?.dataSourceRef ? context.Context?.(binding.dataSourceRef) : context;
        const request = binding?.queryPath ? resolveSelector(source?.handlers?.dataSource?.peekInput?.()?.parameters, binding.queryPath) : null;
        return request ? {...dataset, request} : dataset;
    })};
    if (!scopeControlsUnavailable) {
        try {
            reportSpec = boundReportScopeSpec({...config, reportSpec}, context);
        } catch (error) {
            if (!(error instanceof ReportScopeUnavailableError)) throw error;
            scopeControlsUnavailable = true;
            status = 'error';
        }
    }
    if (status !== 'ready') {
        const emptyPayloads = Object.fromEntries(Object.keys(bindings).map(id => [id, {rows: []}]));
        return {reportSpec, reportFill: null, pendingReportFill: buildReportFillFromReportSpec(reportSpec, emptyPayloads), status, scopeControlsUnavailable};
    }
    return {reportSpec, reportFill: buildReportFillFromReportSpec(reportSpec, payloads), status, ...(unavailableDatasets.length ? {unavailableDatasets} : {})};
}
