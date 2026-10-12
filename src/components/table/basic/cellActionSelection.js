export const shouldSelectRowForCellAction = (cellSelection = {}, selected = false) => (
    selected !== true && !['button', 'editabletext'].includes(String(cellSelection?.col?.type || '').toLowerCase())
);
