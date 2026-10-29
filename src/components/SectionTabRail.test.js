import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';

import SectionTabRail, {revealSelectedTab} from './SectionTabRail.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(async () => {if (root) await act(async () => root.unmount()); host?.remove(); root = null; vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe('section overflow menu', () => {
    const items = [{id:'overview',label:'Overview'},{id:'unavailable',label:'Unavailable section',disabled:true},{id:'history',label:'Complete revision history'}];
    async function setup(props = {}) {
        let width = 260, resize;
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
        vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(620);
        vi.stubGlobal('requestAnimationFrame', callback => {callback(); return 1;});
        vi.stubGlobal('cancelAnimationFrame', () => {});
        vi.stubGlobal('ResizeObserver', class {constructor(callback) {resize = callback;} observe() {} disconnect() {}});
        host = document.createElement('div'); document.body.append(host); root = createRoot(host);
        const render = async selectedId => act(async () => root.render(React.createElement(SectionTabRail, {items, selectedId, ariaLabel:'Example sections', panelId:'active-panel', ...props})));
        await render('overview');
        return {render, resize: async value => {width = value; await act(async () => resize());}};
    }
    it('retains selected identity and disabled options while switching between menu and tabs', async () => {
        const change = vi.fn();
        const view = await setup({overflowBehavior:'menu',onChange:change});
        expect(host.querySelector('[role=tablist]').getAttribute('aria-hidden')).toBe('true');
        const select = host.querySelector('select');
        expect(select.getAttribute('aria-label')).toBe('Example sections');
        expect(select.getAttribute('aria-controls')).toBe('active-panel');
        expect([...select.options].map(option => option.textContent)).toEqual(items.map(item => item.label));
        expect(select.options[1].disabled).toBe(true);
        await act(async () => {select.value = 'history'; select.dispatchEvent(new Event('change', {bubbles:true}));});
        expect(change).toHaveBeenCalledWith('history');
        await view.render('history');
        await view.resize(800);
        expect(host.querySelector('select')).toBeNull();
        expect(host.querySelector('[role=tab][aria-selected=true]').textContent).toBe('Complete revision history');
        await view.resize(260);
        expect(host.querySelector('select').value).toBe('history');
    });
    it.each([{}, {overflowBehavior:'menu',onRename:vi.fn()}, {overflowBehavior:'menu',onReorder:vi.fn()}])('preserves scroll navigation and editing controls for %j', async props => {
        await setup(props);
        expect(host.querySelector('select')).toBeNull();
        expect(host.querySelector('[role=tablist]').getAttribute('aria-hidden')).toBeNull();
        expect(host.querySelector('[aria-label="Scroll tabs right"]')).not.toBeNull();
    });
});

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
