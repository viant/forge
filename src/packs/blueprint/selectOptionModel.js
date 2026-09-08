export function isSelectOptionDisabled(item) {
    return item?.disabled === true;
}

export function commitSelectOption(item, onChange) {
    if (!item || isSelectOptionDisabled(item)) return false;
    onChange?.(item.value);
    return true;
}
