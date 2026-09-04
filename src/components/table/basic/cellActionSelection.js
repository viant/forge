export const shouldSelectRowForCellAction = (cellSelection = {}, selected = false) => (
    selected !== true && String(cellSelection?.col?.type || '').toLowerCase() !== 'button'
);
