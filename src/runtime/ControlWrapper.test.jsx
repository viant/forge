import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';

import ControlWrapper from './ControlWrapper.jsx';

describe('ControlWrapper', () => {
    it('keeps validation feedback visible when a grid supplies its own label wrapper', () => {
        const html = renderToStaticMarkup(
            <ControlWrapper
                item={{id: 'domain', wrapper: 'none', validationError: 'Enter a valid domain.'}}
                container={{}}
                context={{}}
            >
                <input aria-label="Domain" />
            </ControlWrapper>,
        );

        expect(html).toContain('forge-control-validation-shell');
        expect(html).toContain('role="alert"');
        expect(html).toContain('Enter a valid domain.');
    });

    it('keeps a disabled control explanation keyboard-accessible', () => {
        const html = renderToStaticMarkup(
            <ControlWrapper
                item={{id: 'save', label: 'Save', tooltip: 'Disabled until sparse updates are safe.'}}
                container={{}}
                context={{}}
                disabled
            >
                <button disabled>Save</button>
            </ControlWrapper>,
        );

        expect(html).toContain('title="Disabled until sparse updates are safe."');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('aria-label="Save. Disabled until sparse updates are safe."');
    });

    it('renders control-only anatomy without duplicating a grid-owned label', () => {
        const html = renderToStaticMarkup(
            <ControlWrapper
                item={{
                    id: 'objective',
                    label: 'Objective',
                    wrapper: 'control-only',
                    required: true,
                    helperText: 'Choose one campaign objective.',
                }}
                container={{layout: {kind: 'grid', appearance: 'field-tracks'}}}
                context={{}}
            >
                <input />
            </ControlWrapper>,
        );

        expect(html).toContain('class="forge-control-track-content"');
        expect(html).toContain('data-forge-control-id="objective"');
        expect(html).toContain('<input id="objective"');
        expect(html).toContain('aria-required="true"');
        expect(html).toContain('aria-describedby=');
        expect(html).toContain('data-forge-part="helper-text"');
        expect(html).toContain('Choose one campaign objective.');
        expect(html).not.toContain('<label');
    });

    it('connects control-only validation feedback to the control semantics', () => {
        const html = renderToStaticMarkup(
            <ControlWrapper
                item={{
                    id: 'advertiserId',
                    wrapper: 'control-only',
                    validationError: 'Choose an advertiser.',
                }}
                container={{layout: {kind: 'grid', appearance: 'field-tracks'}}}
                context={{}}
            >
                <input />
            </ControlWrapper>,
        );

        expect(html).toContain('<input id="advertiserId"');
        expect(html).toContain('aria-describedby=');
        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('data-forge-part="validation-message"');
        expect(html).toContain('role="alert"');
        expect(html).toContain('Choose an advertiser.');
    });
});
