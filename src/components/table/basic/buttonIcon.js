export function resolveButtonIcon(column = {}, value, fallback = undefined) {
    if (column?.iconFromValue === true && value != null && String(value).trim() !== '') {
        return String(value);
    }
    return fallback;
}
