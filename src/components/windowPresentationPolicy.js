export function windowFillsAllocatedSpace(window, hosted = false) {
    return window?.fillParent === true || hosted || window?.isInTab !== false;
}
export function showWindowSelectionFooter(window) {
    return window?.isInTab === false && window?.footer?.hide !== true
        && (window?.isModal === true || window?.footer != null || window?.onSelect != null);
}
