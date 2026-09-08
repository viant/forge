import {describe, expect, it} from 'vitest';

import {resolveGridSpacing} from './GridLayoutRenderer.jsx';

describe('resolveGridSpacing', () => {
    it('applies the shared labeled-field rhythm and preserves explicit axis overrides', () => {
        expect(resolveGridSpacing({gap: 4}, 'top')).toEqual({rowGap: 6, columnGap: 12, controlPaddingBottom: 10});
        expect(resolveGridSpacing({gap: 4}, 'left')).toEqual({rowGap: 16, columnGap: 12, controlPaddingBottom: 0});
        expect(resolveGridSpacing({gap: 4, rowGap: 8, columnGap: 9}, 'top')).toEqual({rowGap: 8, columnGap: 9, controlPaddingBottom: 10});
        expect(resolveGridSpacing({gap: 4}, 'none')).toEqual({rowGap: 4, columnGap: 4, controlPaddingBottom: 0});
    });
});
