export function hasRequiredControlValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.some((entry) => hasRequiredControlValue(entry));
    if (typeof value === 'object') return Object.values(value).some((entry) => hasRequiredControlValue(entry));
    return true;
}

export function resolveRequiredControlState({required, readOnly, disabled, value, validationError, widgetKey} = {}) {
    if (!required || readOnly || disabled) return '';
    if (validationError) return 'invalid';
    if (widgetKey === 'radio' && !hasRequiredControlValue(value)) return '';
    return hasRequiredControlValue(value) ? 'resolved' : 'missing';
}

export function usesResolvedRequiredPastel({widgetKey, item} = {}) {
    return !!item?.optionsDataSourceRef;
}
