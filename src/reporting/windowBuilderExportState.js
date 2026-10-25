import {applyReportBuilderRuntimeFieldCatalog} from '../components/dashboard/reportBuilderRuntimeFieldCatalog.js';
import {mergeReportBuilderState} from '../components/dashboard/reportBuilderUtils.js';
import {normalizeReportBuilderPredicates} from '../components/dashboard/reportBuilderPredicates.js';
import {normalizeReportBuilderOptionDefinitions} from '../components/dashboard/reportBuilderOptions.js';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {getReportBlockDatasetRefs} from './reportDatasetRefModel.js';
import {declaredReportRequestFields, validateReportRequestOptions} from './reportRequestEnvelope.js';

const keys = new Set([
    'selectedMeasures', 'primaryMeasure', 'selectedDimensions', 'viewMode', 'chartSpec',
    'groupBy', 'page', 'pageSize', 'orderField', 'orderDir', 'scopeParams', 'staticFilters',
    'dynamicGroups', 'reportOptions', 'reportDocumentBlocks', 'reportDocumentLayout',
    'reportDocumentTitle', 'reportDocumentSubtitle', 'reportDocumentDescription',
    'reportDocumentThemeAccent', 'reportDocumentBadgePalette', 'reportDocumentViewer',
    'activeTablePreset',
]);
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'backend', 'credentials', 'secretRef',
    'dataSourceRef', 'dataSources', 'dataSourceResources', 'reportSpec', 'reportFill', 'reportPrint',
    'rows', 'reportStaticDatasets', 'binding', 'source', 'request', 'baseParameters']);
const fieldKeys = new Set(['field', 'xField', 'yField', 'seriesField', 'valueField', 'colorField', 'sourceKey', 'displayKey', 'metricField', 'labelField', 'secondaryField', 'secondaryDisplayKey']);
const fieldLists = new Set(['yFields', 'selectedMeasures', 'selectedDimensions', 'dimensions', 'measures']);
const blockKinds = new Set(['sectionBlock', 'tabGroupBlock', 'compositeBlock', 'stepperBlock',
    'markdownBlock', 'infoPanelBlock', 'calloutBlock', 'chartBlock', 'tableBlock', 'kpiBlock',
    'geoMapBlock', 'filterBarBlock', 'refinementBarBlock', 'collectionBlock']);

function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function copy(value, depth = 0) {
    if (depth > 24) throw new Error('The builder export selection is nested too deeply.');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value) && value.length <= 2048) return value.map(item => copy(item, depth + 1));
    if (!object(value)) throw new Error('The builder export selection must contain bounded JSON values.');
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (forbidden.has(key)) throw new Error(`Builder export cannot replace ${key}.`);
        result[key] = copy(item, depth + 1);
    }
    return result;
}

// This client projection is convenience only. The trusted lowerer repeats all
// validation against the server-selected container and current field catalog.
export function snapshotWindowBuilderExportSelection(container = {}, state = {}) {
    for (const key of ['reportStaticDatasets', 'localCalculatedFields', 'localTableCalculations']) {
        if (Array.isArray(state[key]) && state[key].length) throw new Error(`Current window export does not support ${key}.`);
    }
    const selected = {};
    for (const [key, value] of Object.entries(state)) {
        if (keys.has(key) && value !== undefined) selected[key] = value;
    }
    return checkedSelection({version: 1, containerId: container.id, state: selected});
}

export function snapshotWindowBuilderParameters(metadata = {}, windowForm = {}) {
    const declarations=metadata.parameters ?? [];
    if (!Array.isArray(declarations) || declarations.length>128) throw new Error('The window parameter declarations are unavailable.');
    const result={};
    for (const parameter of declarations) {
        if (!object(parameter) || typeof parameter.name!=='string' || !parameter.name || forbidden.has(parameter.name)) throw new Error('Invalid window parameter declaration.');
        const path=typeof parameter.bindTo==='string' && parameter.bindTo ? parameter.bindTo : parameter.name;
        const parts=path.split('.');
        if (parts.length>8 || parts.some(part=>!/^[A-Za-z][A-Za-z0-9_]*$/.test(part) || forbidden.has(part))) throw new Error('Invalid window parameter binding.');
        let value=windowForm;
        for (const part of parts) value=object(value) && Object.hasOwn(value,part) ? value[part] : undefined;
        if (value===undefined && Object.hasOwn(parameter,'default')) value=parameter.default;
        if (value!==undefined) result[parameter.name]=copy(value);
    }
    if (JSON.stringify(result).length>256*1024) throw new Error('The window parameter selection exceeds the size limit.');
    return result;
}

function checkedSelection(selection) {
    if (!object(selection) || Object.keys(selection).some(key => !['version', 'containerId', 'state'].includes(key))
        || selection.version !== 1 || typeof selection.containerId !== 'string'
        || !selection.containerId.trim() || selection.containerId.length > 256 || !object(selection.state)
        || Object.keys(selection.state).some(key => !keys.has(key))) throw new Error('Invalid window builder export selection.');
    const result = copy(selection);
    if (JSON.stringify(result).length > 256 * 1024) throw new Error('The builder export selection exceeds the size limit.');
    return result;
}

// Only trusted host input supplies config, definition and attached datasource
// IDs. No metadata-provided script is evaluated by this official adapter.
export function prepareWindowBuilderExport({container, config, selection, definition = null, windowParameters = {}, attachedDataSourceIds = []}) {
    const input = checkedSelection(selection);
    if (!object(container) || container.id !== input.containerId || !object(config)) throw new Error('The selected window builder is unavailable.');
    if (config.hooks?.buildRequest) throw new Error('This window requires a declarative export request binding; metadata request hooks cannot run during server export.');
    if (config.request?.envelope && (!definition || !config.request.definitionIdentity)) throw new Error('The current server report definition identity is unavailable.');
    if (config.runtimeFieldCatalog?.enabled === true && !Array.isArray(definition?.fieldCatalog?.columns)) {
        throw new Error('The current server field catalog is unavailable.');
    }
    const trustedConfig = applyReportBuilderRuntimeFieldCatalog(config, {...windowParameters,reportDefinition: definition || {}});
    const fields = declaredReportRequestFields(trustedConfig);
    const requireField = value => {
        if (value !== '' && value !== null && value !== undefined && (typeof value !== 'string' || !fields.has(value))) throw new Error('The export selection references an unknown field.');
    };
    const visit = (value, parent = '') => {
        if (Array.isArray(value)) return value.forEach(item => visit(item, parent));
        if (!object(value)) return;
        for (const [key, item] of Object.entries(value)) {
            if (fieldKeys.has(key)) requireField(item);
            if (fieldLists.has(key)) {
                if (!Array.isArray(item)) throw new Error('Selected export fields must be arrays.');
                item.forEach(field=>{
                    if (typeof field!=='string' || !field) throw new Error('Selected export fields must contain declared field names.');
                    requireField(field);
                });
            }
            if (parent === 'columns' && key === 'key') requireField(item);
            visit(item, key);
        }
    };
    visit(input.state);
    const predicates = normalizeReportBuilderPredicates(trustedConfig);
    const predicateIds = new Set(predicates.map(predicate => predicate.id));
    const optionNames = new Set(normalizeReportBuilderOptionDefinitions(trustedConfig.reportOptions).map(option => option.name));
    for (const key of ['scopeParams', 'staticFilters', 'reportOptions']) {
        if (input.state[key] !== undefined && !object(input.state[key])) throw new Error('The export scope and options must be objects.');
        const allowed = key === 'reportOptions' ? optionNames : predicateIds;
        if (Object.keys(input.state[key] || {}).some(id => !allowed.has(id))) throw new Error('The export selection references an undeclared scope or option.');
    }
    if (input.state.reportOptions!==undefined) validateReportRequestOptions(input.state.reportOptions,trustedConfig);
    for (const predicate of predicates) {
        if (predicate.kind!=='dateRange') continue;
        const value=input.state.scopeParams?.[predicate.id] ?? input.state.staticFilters?.[predicate.id];
        if (value===undefined || value===null) continue;
        if (!object(value) || Object.entries(value).some(([key,item])=>!['start','end','from','to','preset'].includes(key) || item!==null && typeof item!=='string')) throw new Error('The export date range has an invalid shape.');
    }
    for (const key of ['primaryMeasure', 'orderField', 'groupBy']) requireField(input.state[key]);
    const seen = new Set(['primaryBuilder']);
    for (const block of input.state.reportDocumentBlocks || []) {
        if (!object(block) || !blockKinds.has(block.kind) || typeof block.id !== 'string' || !block.id || forbidden.has(block.id) || seen.has(block.id)) throw new Error('The export selection contains an unknown or duplicate report block.');
        seen.add(block.id);
    }
    const state = mergeReportBuilderState(trustedConfig, input.state);
    const reportDocument = buildReportBuilderReportDocument({container, config: trustedConfig, state});
    const reportSpec = lowerReportDocumentToReportSpec(reportDocument);
    const attached = new Set(attachedDataSourceIds);
    if (!attached.has(reportSpec.source?.dataSourceRef)) throw new Error('The export primary datasource is not attached to this window.');
    const datasets = new Set();
    for (const dataset of reportSpec.datasets || []) {
        if (!dataset.id || datasets.has(dataset.id) || !attached.has(dataset.dataSourceRef) || Object.hasOwn(dataset, 'rows')) throw new Error('The export references an unattached or static dataset.');
        datasets.add(dataset.id);
    }
    for (const block of reportSpec.blocks || []) {
        if (getReportBlockDatasetRefs(block).some(id => !datasets.has(id))) throw new Error('The export references an unknown logical dataset.');
    }
    return {config: trustedConfig, state, reportDocument, reportSpec};
}
