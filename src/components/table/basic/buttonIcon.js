export function resolveButtonIcon(column = {}, value, fallback = undefined) {
    if (column?.iconFromValue === true && value != null && String(value).trim() !== '') {
        return String(value);
    }
    return fallback;
}

export function resolveButtonPressed(column = {}, value) {
    if (column?.pressedWhenValue === undefined) return undefined;
    return String(value ?? '') === String(column.pressedWhenValue ?? '');
}
