import {describe, expect, it} from 'vitest';
import {resolveButtonIcon} from './buttonIcon.js';

describe('resolveButtonIcon', () => {
    it('uses the computed cell value when requested', () => {
        expect(resolveButtonIcon({iconFromValue: true}, 'star', 'star-empty')).toBe('star');
    });

    it('preserves the configured icon by default', () => {
        expect(resolveButtonIcon({}, 'star', 'star-empty')).toBe('star-empty');
    });
});
