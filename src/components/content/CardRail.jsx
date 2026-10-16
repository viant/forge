import React, {useEffect, useId, useRef, useState} from 'react';
import ContentImage from './ContentImage.jsx';
import {contentAction, contentRecords} from './contentModel.js';
import './content.css';

export default function CardRail({id, value = [], heading, description, onClick, disabled, className = '', style, emptyText = 'No items match these filters.', 'aria-label': ariaLabel}) {
    const rows = contentRecords(value), generatedId = useId(), track = useRef(null);
    const [edges, setEdges] = useState({start: true, end: true});
    const headingId = `${id || generatedId}-heading`, trackId = `${id || generatedId}-items`;
    const update = () => {
        const node = track.current;if (!node) return;
        const offset = Math.abs(node.scrollLeft), max = Math.max(0, node.scrollWidth - node.clientWidth);
        setEdges(previous => previous.start === (offset < 1) && previous.end === (offset >= max - 1) ? previous : {start: offset < 1, end: offset >= max - 1});
    };
    useEffect(() => {
        const node = track.current;if (!node) return;
        update();const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(node);window.addEventListener('resize', update);
        return () => {observer?.disconnect();window.removeEventListener('resize', update);};
    }, [rows.length]);
    const scroll = direction => {
        const node = track.current;if (!node) return;
        const rtl = window.getComputedStyle(node).direction === 'rtl';
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        node.scrollBy({left: direction * (rtl ? -1 : 1) * node.clientWidth * .85, behavior: reduced ? 'auto' : 'smooth'});
    };
    return <section id={id} className={`forge-card-rail ${className}`} style={style} aria-label={ariaLabel || (!heading ? 'Content' : undefined)} aria-labelledby={heading ? headingId : undefined}>
        <header className="forge-card-rail__header">
            <div>{heading ? <h2 id={headingId}>{heading} <span className="forge-card-rail__count">{rows.length}</span></h2> : null}{description ? <p>{description}</p> : null}</div>
            {rows.length ? <div className="forge-card-rail__controls"><button type="button" aria-label="Scroll left" aria-controls={trackId} disabled={edges.start || disabled} onClick={() => scroll(-1)}>‹</button><button type="button" aria-label="Scroll right" aria-controls={trackId} disabled={edges.end || disabled} onClick={() => scroll(1)}>›</button></div> : null}
        </header>
        {rows.length ? <div id={trackId} className="forge-card-rail__track" ref={track} role="list" onScroll={update}>{rows.map((row, position) => <article key={row.id ?? position} className="forge-content-card" role="listitem">
            <button type="button" className="forge-content-card__open" disabled={disabled || row.disabled} onClick={event => onClick?.(contentAction(row, event))} aria-label={row.title || `Open item ${position + 1}`}>
                <ContentImage src={row.image} alt={row.imageAlt || ''} className="forge-content-card__image"/>
                <div className="forge-content-card__body">{row.subtitle ? <span className="forge-content-card__subtitle">{row.subtitle}</span> : null}<h3>{row.title}</h3>{row.description ? <p>{row.description}</p> : null}
                    {Array.isArray(row.facts) ? <dl>{row.facts.map((fact, i) => <div key={i}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
                    {Array.isArray(row.tags) ? <span className="forge-content-card__tags">{row.tags.map((tag, i) => <span key={i}>{typeof tag === 'object' ? tag.label : tag}</span>)}</span> : null}
                </div>
            </button>
        </article>)}</div> : <p className="forge-card-rail__empty" role="status">{emptyText}</p>}
    </section>;
}
