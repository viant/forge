export function resolveToolbarSelectOption(options = [], value) {
    return (Array.isArray(options) ? options : []).find((option) => String(option?.value) === String(value));
}

export function toolbarSelectLabel(options = [], value, fallback = 'Select') {
    const selected = resolveToolbarSelectOption(options, value);
    return String(selected?.label ?? selected?.text ?? selected?.value ?? fallback);
}

export function dispatchToolbarSelectChange(event, directChange, onChange) {
    if (typeof directChange === 'function') directChange(event);
    if (typeof onChange === 'function') return onChange(event);
    return undefined;
}
