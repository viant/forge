import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toolbarItemIcon, toolbarStatusValue } from './Toolbar.jsx';

describe('toolbarItemIcon', () => {
    it('renders the shared pdf token as a visible PDF glyph', () => {
        const html = renderToStaticMarkup(toolbarItemIcon('pdf'));
        expect(html).toContain('forge-toolbar-pdf-icon');
        expect(html).toContain('PDF');
    });

    it('preserves ordinary Blueprint icon names', () => {
        expect(toolbarItemIcon('refresh')).toBe('refresh');
    });
});

describe('toolbarStatusValue', () => {
    it('resolves a status from the configured form field', () => {
        expect(toolbarStatusValue({id: 'status', dataField: 'mutationMessage'}, {mutationMessage: 'Changes saved.'})).toBe('Changes saved.');
    });

    it('falls back to a configured static value', () => {
        expect(toolbarStatusValue({id: 'status', value: 'No unsaved changes'}, {})).toBe('No unsaved changes');
    });

    it('never reports a saved state while the form is dirty', () => {
        expect(toolbarStatusValue(
            {id: 'status', dataField: 'mutationMessage', dirtyValue: 'Unsaved changes'},
            {mutationMessage: 'Changes saved.'},
            true,
        )).toBe('Unsaved changes');
    });
});
