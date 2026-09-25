import React from 'react';
import {Icon} from '@blueprintjs/core';
import './SectionTabRail.css';

export function revealSelectedTab(rail, selected, behavior) {
    if (!selected) return false;
    const hasOverflow = !!rail && rail.scrollWidth > rail.clientWidth + 1;
    if (hasOverflow) {
        const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
        const centered = selected.offsetLeft - ((rail.clientWidth - selected.offsetWidth) / 2);
        rail.scrollTo?.({left: Math.max(0, Math.min(maxLeft, centered)), ...(behavior ? {behavior} : {})});
        return true;
    }
    selected.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
    return true;
}

/** Shared visual navigation primitive used by report sections and form panels. */
export default function SectionTabRail({items = [], selectedId = '', onChange, onRename, onReorder, onEditingChange, ariaLabel = 'Sections', showIcons = false, compact = false, idPrefix = '', panelId = ''}) {
    const [editingId, setEditingId] = React.useState('');
    const [editingLabel, setEditingLabel] = React.useState('');
    const draggingId = React.useRef('');
    const cancelledRename = React.useRef(false);
    const beginRename = (item) => {
        if (!onRename || item.editable === false) return;
        cancelledRename.current = false;
        setEditingId(item.id);
        setEditingLabel(item.label || item.title || item.id);
        onEditingChange?.(true);
    };
    const finishRename = (id) => {
        if (!cancelledRename.current && editingLabel.trim()) onRename?.(id, editingLabel.trim());
        setEditingId('');
        onEditingChange?.(false);
    };
    const tabRefs = React.useRef([]);
    const railRef = React.useRef(null);
    const [overflow, setOverflow] = React.useState({left: false, right: false});
    const generatedId = React.useId().replace(/:/g, '');
    const baseId = String(idPrefix || generatedId).replace(/[^A-Za-z0-9_-]/g, '-');
    const selectedIndex = Math.max(0, items.findIndex((item) => String(item?.id || '') === String(selectedId || '')));
    const revealSelected = React.useCallback((behavior) => {
        revealSelectedTab(railRef.current, tabRefs.current[selectedIndex], behavior);
    }, [selectedIndex]);
    React.useLayoutEffect(() => {
        const frame = requestAnimationFrame(() => revealSelected());
        return () => cancelAnimationFrame(frame);
    }, [revealSelected, items.length, compact]);
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
        // Cue visibility changes the rail width. Re-centering selection here
        // would undo an explicit scroll-button action on every cue transition.
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(rail);
        return () => {
            cancelAnimationFrame(frame);
            rail.removeEventListener('scroll', update);
            observer?.disconnect();
        };
    }, [items.length, compact, revealSelected]);
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
                if (editingId === item.id) return <input key={item.id} autoFocus
                    className="forge-section-tab-rename" aria-label={`Rename ${item.label || item.title || 'tab'}`}
                    value={editingLabel} onFocus={(event) => event.target.select()}
                    onChange={(event) => setEditingLabel(event.target.value)}
                    onBlur={() => finishRename(item.id)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                        if (event.key === 'Escape') { cancelledRename.current = true; setEditingId(''); onEditingChange?.(false); }
                    }} />;
                return (
                    <button key={item.id} ref={(node) => { tabRefs.current[index] = node; }} id={`${baseId}-tab-${index}`}
                        type="button" role="tab" aria-selected={selected} aria-controls={panelId || undefined}
                        tabIndex={selected || (selectedId === '' && index === selectedIndex) ? 0 : -1}
                        className={`forge-section-tab${selected ? ' is-selected' : ''}`}
                        title={onRename && item.editable !== false ? 'Double-click or press F2 to rename. Drag or Alt+Arrow to reorder.' : undefined}
                        draggable={!!onReorder && item.editable !== false}
                        onDragStart={(event) => { draggingId.current = item.id; event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; }}
                        onDragEnd={() => { draggingId.current = ''; }}
                        onDragOver={(event) => { if (onReorder && draggingId.current && item.editable !== false) event.preventDefault(); }}
                        onDrop={(event) => {
                            event.preventDefault();
                            if (item.editable !== false && draggingId.current) onReorder?.(draggingId.current, item.id);
                            draggingId.current = '';
                        }}
                        onDoubleClick={() => beginRename(item)}
                        onKeyDown={(event) => {
                            if (event.key === 'F2' && onRename) { event.preventDefault(); beginRename(item); return; }
                            if (event.altKey && onReorder && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                                event.preventDefault();
                                const target = items[index + (event.key === 'ArrowLeft' ? -1 : 1)];
                                if (item.editable !== false && target && target.editable !== false) onReorder(item.id, target.id);
                                return;
                            }
                            onTabKeyDown(event, index);
                        }}
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
