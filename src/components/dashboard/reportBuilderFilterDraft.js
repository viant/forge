import {projectManualSelection} from './reportBuilderDynamicRows.js';

// Only editable filter slices cross the draft boundary. Report design, results,
// and run identity always come from the latest applied state.
export function draftReportFilters(state = {}) {
    return Object.fromEntries(['scopeParams', 'staticFilters', 'dynamicGroups', 'reportOptions', 'filterDatasetScopeParams']
        .filter(key => Object.prototype.hasOwnProperty.call(state, key))
        .map(key => [key, state[key]]));
}

export function applyReportFilterDraft(state = {}, draft = {}, groups = []) {
    let error = '';
    const dynamicGroups = Object.fromEntries(Object.entries(draft.dynamicGroups || {}).map(([id, rows]) => {
        const group = groups.find(entry => entry.id === id);
        return [id, rows.map(row => {
            const {manualValue, ...next} = row;
            if (!String(manualValue || '').trim() || row.enabled === false) return next;
            const filter = group?.filters?.find(entry => entry.id === row.filterId);
            const selection = filter && projectManualSelection(filter, manualValue);
            if (!selection) {
                error = `Enter a valid value for ${filter?.label || row.filterId}.`;
                return next;
            }
            return {...next, selections: filter.multiple === false ? [selection] : [
                ...(row.selections || []).filter(entry => entry.value !== selection.value), selection,
            ]};
        })];
    }));
    const {filterDatasetScopeParams, ...filters} = draft;
    return {state: {...state, ...filters, ...(draft.dynamicGroups ? {dynamicGroups} : {}), page: 1}, datasetScopeParams: filterDatasetScopeParams, error};
}
