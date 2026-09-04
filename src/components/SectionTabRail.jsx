import React from 'react';
import {Icon} from '@blueprintjs/core';
import './SectionTabRail.css';

/** Shared visual navigation primitive used by report sections and form panels. */
export default function SectionTabRail({items = [], selectedId = '', onChange, ariaLabel = 'Sections', showIcons = false, compact = false, idPrefix = '', panelId = ''}) {
    const tabRefs = React.useRef([]);
    const railRef = React.useRef(null);
    const [overflow, setOverflow] = React.useState({left: false, right: false});
    const generatedId = React.useId().replace(/:/g, '');
    const baseId = String(idPrefix || generatedId).replace(/[^A-Za-z0-9_-]/g, '-');
    const selectedIndex = Math.max(0, items.findIndex((item) => String(item?.id || '') === String(selectedId || '')));
    React.useLayoutEffect(() => {
        const frame = requestAnimationFrame(() => {
            const selected = tabRefs.current[selectedIndex];
            const rail = railRef.current;
            const hasOverflow = !!rail && rail.scrollWidth > rail.clientWidth + 1;
            if (hasOverflow && selectedIndex === 0) {
                rail.scrollTo({left: 0});
            } else if (hasOverflow && selectedIndex === items.length - 1) {
                rail.scrollTo({left: rail.scrollWidth - rail.clientWidth});
            } else {
                selected?.scrollIntoView?.({
                    block: 'nearest',
                    inline: hasOverflow ? 'center' : 'nearest',
                });
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [selectedIndex, items.length, compact]);
    React.useEffect(() => {
        const rail = railRef.current;
        if (!rail) return undefined;
        const update = () => {
            const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
            const edgeTolerance = 8;
            const next = {
                left: rail.scrollLeft > edgeTolerance,
                right: rail.scrollLeft < maxLeft - edgeTolerance,
            };
            setOverflow((previous) => previous.left === next.left && previous.right === next.right ? previous : next);
        };
        const frame = requestAnimationFrame(update);
        rail.addEventListener('scroll', update, {passive: true});
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(rail);
        return () => {
            cancelAnimationFrame(frame);
            rail.removeEventListener('scroll', update);
            observer?.disconnect();
        };
    }, [items.length, compact]);
    const scrollRail = (direction) => {
        const rail = railRef.current;
        if (!rail) return;
        rail.scrollTo({left: rail.scrollLeft + direction * Math.max(180, rail.clientWidth * 0.65), behavior: 'smooth'});
    };
    const activateAt = (index) => {
        if (items.length === 0) return;
        const normalized = (index + items.length) % items.length;
        onChange?.(items[normalized]?.id);
        requestAnimationFrame(() => tabRefs.current[normalized]?.focus());
    };
    const onTabKeyDown = (event, index) => {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            activateAt(index + 1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            activateAt(index - 1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            activateAt(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            activateAt(items.length - 1);
        }
    };
    const showLeftCue = overflow.left && selectedIndex > 0;
    const showRightCue = overflow.right && selectedIndex < items.length - 1;
    return (
        <div className={`forge-section-tab-rail-frame${showLeftCue ? ' has-left-overflow' : ''}${showRightCue ? ' has-right-overflow' : ''}`}>
        {showLeftCue ? <button type="button" className="forge-section-tab-rail-cue is-left" aria-label="Scroll tabs left" onClick={() => scrollRail(-1)}><Icon icon="chevron-left" size={14}/></button> : null}
        <div ref={railRef} className={`forge-section-tab-rail${compact ? ' is-compact' : ''}`} role="tablist" aria-label={ariaLabel}>
            {items.map((item, index) => {
                const selected = String(item?.id || '') === String(selectedId || '');
                return (
                    <button key={item.id} ref={(node) => { tabRefs.current[index] = node; }} id={`${baseId}-tab-${index}`}
                        type="button" role="tab" aria-selected={selected} aria-controls={panelId || undefined}
                        tabIndex={selected || (selectedId === '' && index === selectedIndex) ? 0 : -1}
                        className={`forge-section-tab${selected ? ' is-selected' : ''}`}
                        onKeyDown={(event) => onTabKeyDown(event, index)}
                        onClick={() => onChange?.(item.id)}>
                        {showIcons && item.icon ? <Icon icon={item.icon} size={14}/> : null}
                        <span>{item.label || item.title || item.id}</span>
                    </button>
                );
            })}
        </div>
        {showRightCue ? <button type="button" className="forge-section-tab-rail-cue is-right" aria-label="Scroll tabs right" onClick={() => scrollRail(1)}><Icon icon="chevron-right" size={14}/></button> : null}
        </div>
    );
}
