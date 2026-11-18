// @vitest-environment jsdom
import React, {act, createRef} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import ScrollArea from './ScrollArea.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from './ThemeBoundary.jsx';

async function fixture() {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host), ref = createRef(), animations = [];
    const original = document.getAnimations;
    document.getAnimations = () => animations.filter(a => !a.cancelled);
    const render = themeId => root.render(<ForgeThemeProvider themeId={themeId}><ForgeThemeBoundary><ScrollArea ref={ref} className="example-scroll" tabIndex={0} role="region" aria-label="Example records"><div>Independently authored example content</div></ScrollArea></ForgeThemeBoundary></ForgeThemeProvider>);
    await act(async () => render('design-system-2'));
    const viewport = ref.current, area = viewport.parentElement;
    Object.defineProperties(viewport, {clientWidth: {value: 200}, clientHeight: {value: 100}, scrollWidth: {configurable:true,value: 600}, scrollHeight: {configurable:true,value: 1000}});
    for (const track of area.querySelectorAll('.forge-scroll-area__track')) {
        Object.defineProperties(track, {clientWidth: {value: 188}, clientHeight: {value: 88}});
        const thumb = track.firstElementChild;
        thumb.style.minWidth = thumb.style.minHeight = '24px';
        Object.defineProperties(thumb, {offsetWidth: {get: () => parseFloat(thumb.style.width) || 12}, offsetHeight: {get: () => parseFloat(thumb.style.height) || 12}});
        thumb.getAnimations = () => animations.filter(a => a.target === thumb && !a.cancelled);
        thumb.animate = vi.fn(frames => {const a = {target: thumb, frames, id: '', currentTime: 0, cancelled: false, effect: {setKeyframes: vi.fn()}, play: vi.fn(), cancel: vi.fn(() => {a.cancelled = true;})}; animations.push(a); return a;});
        thumb.setPointerCapture = vi.fn(); thumb.hasPointerCapture = () => true; thumb.releasePointerCapture = vi.fn();
    }
    const cleanup = async () => {await act(async () => root.unmount());host.remove();if (original) document.getAnimations = original;else delete document.getAnimations;};
    return {host, area, viewport, render, animations, cleanup};
}

it('uses the one theme activity owner to position and fade both overlay thumbs', async () => {
    const f = await fixture();
    try {
        expect(f.viewport.tabIndex).toBe(0);
        expect(f.viewport.getAttribute('aria-label')).toBe('Example records');
        await act(async () => {f.viewport.scrollTop = 450;f.viewport.scrollLeft = 200;f.viewport.dispatchEvent(new Event('scroll'));});
        const thumbs = [...f.area.querySelectorAll('.forge-scroll-area__thumb')];
        expect(thumbs[0].style.height).toBe('24px');
        expect(thumbs[0].style.transform).toBe('translateY(32px)');
        expect(parseFloat(thumbs[1].style.width)).toBeCloseTo(188 / 3);
        expect(f.animations).toHaveLength(2);
        expect(f.animations.every(a => a.id === 'forge-scrollbar-activity')).toBe(true);
        expect(f.animations[0].frames.at(-1)).toEqual({opacity: 0, visibility: 'hidden'});
        f.animations.forEach(a => {a.currentTime = 700;});
        await act(async () => {f.viewport.scrollTop = 600;f.viewport.scrollLeft = 300;f.viewport.dispatchEvent(new Event('scroll'));});
        expect(f.animations.every(a => !a.cancelled && a.currentTime === 0)).toBe(true);
        expect(f.animations).toHaveLength(2);
        expect(thumbs[0].style.transform).toMatch(/^translateY\(42\.666/);
        expect(f.animations.every(a => a.play.mock.calls.length === 1)).toBe(true);
        await act(async () => f.render('baseline'));
        expect(f.host.querySelector('.forge-scroll-area')).toBeNull();
        expect(f.host.querySelector('.example-scroll').textContent).toContain('Independently authored');
        expect(f.animations.every(a => a.cancelled)).toBe(true);
    } finally {await f.cleanup();}
});

it.each(['vertical', 'horizontal'])('drags the %s thumb through native scroll position without changing content', async axis => {
    const f = await fixture();
    const pointer = (type, x, y) => {const e = new MouseEvent(type, {bubbles: true, button: 0, clientX: x, clientY: y});Object.defineProperty(e, 'pointerId', {value: 3});return e;};
    try {
        await act(async () => f.viewport.dispatchEvent(new Event('scroll')));
        const thumb = f.area.querySelector(`[data-forge-scrollbar=${axis}]>.forge-scroll-area__thumb`);
        await act(async () => thumb.dispatchEvent(pointer('pointerdown', 20, 20)));
        expect(f.area.dataset.scrollbarDragging).toBe(axis);
        expect(thumb.setPointerCapture).toHaveBeenCalledWith(3);
        await act(async () => thumb.dispatchEvent(pointer('pointermove', 1020, 1020)));
        expect(axis === 'vertical' ? f.viewport.scrollTop : f.viewport.scrollLeft).toBe(axis === 'vertical' ? 900 : 400);
        await act(async () => thumb.dispatchEvent(pointer('pointerup', 1020, 1020)));
        expect(f.area.dataset.scrollbarDragging).toBeUndefined();
        expect(thumb.releasePointerCapture).toHaveBeenCalledWith(3);
        expect(f.viewport.textContent).toBe('Independently authored example content');
    } finally {await f.cleanup();}
});

it.each(['vertical','horizontal'])('keeps %s dragging anchored when more content loads',async axis=>{
    const f=await fixture(),vertical=axis==='vertical';
    const pointer=(type,point)=>{const e=new MouseEvent(type,{bubbles:true,button:0,clientX:point,clientY:point});Object.defineProperty(e,'pointerId',{value:7});return e;};
    try {
        await act(async()=>{f.viewport[vertical?'scrollTop':'scrollLeft']=100;f.viewport.dispatchEvent(new Event('scroll'));});
        const thumb=f.area.querySelector(`[data-forge-scrollbar=${axis}]>.forge-scroll-area__thumb`);
        await act(async()=>thumb.dispatchEvent(pointer('pointerdown',20)));
        Object.defineProperty(f.viewport,vertical?'scrollHeight':'scrollWidth',{configurable:true,value:2000});
        // The native viewport stays at its current reading position while a page appends.
        await act(async()=>f.viewport.dispatchEvent(new Event('scroll')));
        await act(async()=>thumb.dispatchEvent(pointer('pointermove',20)));
        expect(f.viewport[vertical?'scrollTop':'scrollLeft']).toBe(100);
        await act(async()=>thumb.dispatchEvent(pointer('pointermove',60)));
        expect(f.viewport[vertical?'scrollTop':'scrollLeft']).toBeGreaterThan(vertical?600:400);
        await act(async()=>thumb.dispatchEvent(pointer('pointermove',1020)));
        expect(f.viewport[vertical?'scrollTop':'scrollLeft']).toBe(vertical?1900:1800);
        await act(async()=>thumb.dispatchEvent(pointer('pointerup',1020)));
    } finally {await f.cleanup();}
});
