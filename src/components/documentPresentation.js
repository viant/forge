import {createContext} from 'react';

export const DocumentPresentationContext = createContext(false);

const appearances = new Set(['document', 'document-header', 'document-summary', 'document-scope']);

export function documentAppearance(container = {}) {
    const value = container.appearance;
    if (!value) return '';
    if (!appearances.has(value)) throw new Error(`Unsupported container appearance: ${value}`);
    if (container.style && Object.keys(container.style).length) throw new Error('Document containers use shared geometry and semantic tokens, not inline style');
    return value;
}

export function documentAttributes(container = {}) {
    const appearance = documentAppearance(container);
    return appearance ? {'data-forge-appearance': appearance} : {};
}
