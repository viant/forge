import {describe, expect, it, vi} from 'vitest';

import {revealSelectedTab} from './SectionTabRail.jsx';

describe('revealSelectedTab', () => {
    it('re-centers the selected tab after the rail narrows', () => {
        const rail = {clientWidth: 300, scrollWidth: 620, scrollTo: vi.fn()};
        const selected = {offsetLeft: 480, offsetWidth: 130};

        expect(revealSelectedTab(rail, selected, 'auto')).toBe(true);
        expect(rail.scrollTo).toHaveBeenCalledWith({left: 320, behavior: 'auto'});
    });

    it('uses nearest visibility when the rail does not overflow', () => {
        const rail = {clientWidth: 620, scrollWidth: 620, scrollTo: vi.fn()};
        const selected = {scrollIntoView: vi.fn()};

        expect(revealSelectedTab(rail, selected)).toBe(true);
        expect(selected.scrollIntoView).toHaveBeenCalledWith({block: 'nearest', inline: 'nearest'});
        expect(rail.scrollTo).not.toHaveBeenCalled();
    });

    it('fails safely when the selected tab is not mounted', () => {
        expect(revealSelectedTab(null, null)).toBe(false);
    });
});
