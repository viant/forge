import {describe, expect, it} from 'vitest';
import {resolveButtonIcon, resolveButtonPressed} from './buttonIcon.js';

describe('resolveButtonIcon', () => {
    it('uses the computed cell value when requested', () => {
        expect(resolveButtonIcon({iconFromValue: true}, 'star', 'star-empty')).toBe('star');
    });

    it('preserves the configured icon by default', () => {
        expect(resolveButtonIcon({}, 'star', 'star-empty')).toBe('star-empty');
    });
});

describe('resolveButtonPressed', () => {
    it('maps a declared toggle value to accessible pressed state', () => {
        expect(resolveButtonPressed({pressedWhenValue: 'star'}, 'star')).toBe(true);
        expect(resolveButtonPressed({pressedWhenValue: 'star'}, 'star-empty')).toBe(false);
        expect(resolveButtonPressed({}, 'star')).toBeUndefined();
    });
});
