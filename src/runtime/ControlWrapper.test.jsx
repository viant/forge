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
});
