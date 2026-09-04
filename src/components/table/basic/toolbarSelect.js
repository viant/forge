export function resolveToolbarSelectOption(options = [], value) {
    return (Array.isArray(options) ? options : []).find((option) => String(option?.value) === String(value));
}

export function toolbarSelectLabel(options = [], value, fallback = 'Select') {
    const selected = resolveToolbarSelectOption(options, value);
    return String(selected?.label ?? selected?.text ?? selected?.value ?? fallback);
}
