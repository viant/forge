export function shouldDispatchSelectionEvent(selectionMode, selection = {}, {selfReference = false} = {}) {
    if (selectionMode === 'multi') {
        // Empty is meaningful for assignment pickers: it represents removing
        // the final selected row and must reach dirty/resource-model handlers.
        return Array.isArray(selection?.selection);
    }
    if (selfReference) {
        return !!(selection?.selected && Array.isArray(selection?.nodePath) && selection.nodePath.length > 0);
    }
    return !!(selection?.selected && (selection?.rowIndex ?? -1) >= 0);
}
