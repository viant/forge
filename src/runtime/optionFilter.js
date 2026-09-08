import {resolveSelector} from '../utils/selector.js';

export function resolveOptionFilterScope(context, source = 'form', filter = {}) {
    switch (String(source || 'form').trim().toLowerCase()) {
        case 'windowform':
            return context?.signals?.windowForm?.value || {};
        case 'authorization':
        case 'auth':
            return context?.authorization || context?.windowState?.authorizationSnapshot || {};
        case 'datasource':
        case 'data': {
            const target = filter?.dataSourceRef && context?.Context?.(filter.dataSourceRef);
            const collection = target?.signals?.collection?.value || target?.signals?.collection?.peek?.() || [];
            if (Array.isArray(collection) && collection.length === 1) return collection[0] || {};
            return target?.signals?.form?.value || target?.signals?.form?.peek?.() || {rows: collection};
        }
        case 'input':
        case 'filter':
        case 'filters':
            return context?.signals?.input?.value || {};
        case 'selection': {
            const selection = context?.handlers?.dataSource?.getSelection?.()
                || context?.signals?.selection?.value
                || {};
            return selection?.selected ?? selection?.selection ?? selection;
        }
        case 'form':
        default:
            return context?.handlers?.dataSource?.getFormData?.()
                || context?.signals?.form?.value
                || {};
    }
}

export function filterDataSourceOptions(rows, optionFilter, context) {
    const filters = Array.isArray(optionFilter) ? optionFilter : optionFilter ? [optionFilter] : [];
    if (filters.length === 0) return rows;
    return rows.filter((row) => filters.every((filter) => {
        const expected = Object.prototype.hasOwnProperty.call(filter || {}, 'value')
			? filter.value
			: resolveSelector(
				resolveOptionFilterScope(context, filter?.source, filter),
				filter?.selector || filter?.valueSelector || '',
			);
        if (expected === undefined || expected === null || expected === '') return true;
        const actual = resolveSelector(row, filter?.field || filter?.rowSelector || '');
        const operator = String(filter?.operator || filter?.op || 'equals').trim().toLowerCase();
		if (operator === 'optionalrowequals') {
			if (actual === undefined || actual === null || actual === '') return true;
			return actual === expected;
		}
        if (operator === 'optionalrowvalueinexpected') {
            if (actual === undefined || actual === null || actual === '') return true;
            const expectedValues = Array.isArray(expected) ? expected : [expected];
            return expectedValues.map(String).includes(String(actual));
        }
        if (operator === 'optionalrowvaluesintersectexpected') {
            const actualValues = Array.isArray(actual) ? actual : (actual === undefined || actual === null || actual === '' ? [] : [actual]);
            if (actualValues.length === 0) return true;
            const expectedValues = new Set((Array.isArray(expected) ? expected : [expected]).map((value) => String(value).toUpperCase()));
            return actualValues.some((value) => expectedValues.has(String(value).toUpperCase()));
        }
        if (operator === 'rowvaluenotinexpected') {
            const expectedValues = Array.isArray(expected) ? expected : [expected];
            return !expectedValues.map(String).includes(String(actual));
        }
        if (filter?.caseInsensitive === true) {
            return String(actual ?? '').toLowerCase() === String(expected).toLowerCase();
        }
        return actual === expected;
    }));
}

function rowsFromDataSource(context, dataSourceRef, selector = '') {
	if (!dataSourceRef || typeof context?.Context !== 'function') return [];
	const target = context.Context(dataSourceRef);
	const collection = target?.signals?.collection?.value || target?.signals?.collection?.peek?.() || [];
	const form = target?.signals?.form?.value || target?.signals?.form?.peek?.() || {};
	if (!selector) return Array.isArray(collection) ? collection : [];
	const root = Array.isArray(collection) && collection.length === 1 ? collection[0] : (form && Object.keys(form).length ? form : collection);
	const selected = resolveSelector(root, selector);
	return Array.isArray(selected) ? selected : [];
}

export function resolveDataSourceOptionRows(item = {}, context = {}) {
	const primaryRef = String(item?.optionsDataSourceRef || '').trim();
	const primaryTarget = primaryRef && typeof context?.Context === 'function' ? context.Context(primaryRef) : null;
	const primary = rowsFromDataSource(context, primaryRef, item?.optionsDataSelector || item?.optionsSelector || '');
	if (primary.length > 0) return primary;
	const primaryControl = primaryTarget?.signals?.control?.value || primaryTarget?.signals?.control?.peek?.() || {};
	if (primaryControl.loading === true) return [];
	const primaryCollection = primaryTarget?.signals?.collection?.value || primaryTarget?.signals?.collection?.peek?.() || [];
	const primaryForm = primaryTarget?.signals?.form?.value || primaryTarget?.signals?.form?.peek?.() || {};
	const hasPrimaryPayload = (Array.isArray(primaryCollection) && primaryCollection.length > 0)
		|| (primaryForm && typeof primaryForm === 'object' && Object.keys(primaryForm).length > 0);
	if (hasPrimaryPayload && !primaryControl.error) return [];
	return rowsFromDataSource(
		context,
		String(item?.fallbackOptionsDataSourceRef || '').trim(),
		item?.fallbackOptionsDataSelector || item?.fallbackOptionsSelector || '',
	);
}
