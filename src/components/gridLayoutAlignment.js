export const GRID_ALIGNMENT_VALUES = Object.freeze(['baseline', 'center', 'start']);

const gridAlignmentValues = new Set(GRID_ALIGNMENT_VALUES);

export function normalizeGridAlignment(value) {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    return gridAlignmentValues.has(normalized) ? normalized : undefined;
}

export function resolveGridAlignment(labels = {}, labelMode = 'left', target = 'container') {
    const authoredAlignment = normalizeGridAlignment(labels?.align);
    if (authoredAlignment) return authoredAlignment;
    if (labelMode === 'left') return 'baseline';
    return target === 'cell' ? 'center' : 'start';
}
