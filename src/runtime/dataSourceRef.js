import {resolveSelector} from '../utils/selector.js';

function dynamicRefScope(context, source = 'windowForm') {
    switch (String(source || 'windowForm').trim().toLowerCase()) {
        case 'form':
            return context?.handlers?.dataSource?.getFormData?.() || context?.signals?.form?.value || {};
        case 'filter':
        case 'filters':
            return context?.signals?.input?.value?.filter || {};
        case 'input':
            return context?.signals?.input?.value || {};
        case 'windowform':
        default:
            return context?.signals?.windowForm?.value || {};
    }
}

export function resolveDynamicDataSourceRef(entry = {}, context = {}, fallbackRef = '') {
    const refs = entry?.dataSourceRefs;
    const selector = String(entry?.dataSourceRefSelector || entry?.dataSourceSelector || '').trim();
    if (selector && refs && typeof refs === 'object' && !Array.isArray(refs)) {
        const key = resolveSelector(dynamicRefScope(context, entry?.dataSourceRefSource), selector);
        const mapped = key != null ? String(refs[key] || '').trim() : '';
        if (mapped) return mapped;
    }
    return String(entry?.dataSourceRef || fallbackRef || '').trim();
}
