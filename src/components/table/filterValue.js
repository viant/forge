import {applyParameterCodec} from '../../hooks/parameters.js';

export function normalizeSubmittedFilterValue(field = {}, value, filterMode = '') {
    if (String(filterMode).toLowerCase() !== 'server') return value;
    return applyParameterCodec(value, field.codec || field.type);
}
