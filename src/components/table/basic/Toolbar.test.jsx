import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toolbarDisabledWrapperProps, toolbarItemIcon, toolbarItemLabel, toolbarStatusValue } from './Toolbar.jsx';

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

describe('toolbarItemLabel', () => {
    it('hides icon-only labels while preserving their accessible metadata elsewhere', () => {
        expect(toolbarItemLabel({label: 'Save changes', hideLabel: true})).toBeNull();
        expect(toolbarItemLabel({label: 'Save changes'})).toBe('Save changes');
    });
});

describe('toolbarDisabledWrapperProps', () => {
    it('keeps disabled icon controls focusable and exposes the tooltip name', () => {
        expect(toolbarDisabledWrapperProps({label: 'Save changes', tooltip: 'Save changes'}, true)).toEqual({
            title: 'Save changes',
            'aria-label': 'Save changes',
            tabIndex: 0,
        });
        expect(toolbarDisabledWrapperProps({label: 'Save changes'}, false)).toEqual({});
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
