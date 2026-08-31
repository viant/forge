import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toolbarItemIcon } from './Toolbar.jsx';

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
