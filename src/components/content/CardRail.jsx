import React, {useEffect, useId, useRef, useState} from 'react';
import ContentImage from './ContentImage.jsx';
import {contentAction, contentRecords} from './contentModel.js';
import {copyDetailValue} from '../primitives/detailViewModel.js';
import './content.css';

function ContentCard({row,position,onClick,onTagClick,disabled}) {
    const [copyStatus,setCopyStatus]=useState('');
    useEffect(()=>{if(!copyStatus)return;const timer=setTimeout(()=>setCopyStatus(''),1200);return()=>clearTimeout(timer);},[copyStatus]);
    const copy=async()=>setCopyStatus(await copyDetailValue(typeof navigator==='undefined'?null:navigator.clipboard,row.copyLabel || 'identifier',row.copyValue));
    return <article className="forge-content-card" role="listitem" data-record-id={row.id}>
        <button type="button" className="forge-content-card__open" disabled={disabled || row.disabled} onClick={event=>onClick?.(contentAction(row,event))} aria-label={row.title || `Open item ${position+1}`}/>
        <ContentImage src={row.image} fallbackSrc={row.fallbackImage} alt={row.imageAlt || ''} className={`forge-content-card__image${row.imageFit==='contain'?' is-contain':''}`}/>
        <div className="forge-content-card__body">
            {row.copyValue!=null ? <button type="button" className="forge-content-card__copy" aria-label={`Copy ${row.copyLabel || 'identifier'}`} disabled={disabled || row.disabled} onClick={copy}><span>{row.subtitle ?? row.copyValue}</span><span aria-hidden="true">{copyStatus.startsWith('Copied')?'✓':'⧉'}</span></button> : row.subtitle ? <span className="forge-content-card__subtitle">{row.subtitle}</span> : null}
            <h3 title={row.title}>{row.title}</h3>{row.description ? <p>{row.description}</p> : null}
            {Array.isArray(row.facts) ? <dl>{row.facts.map((fact,i)=><div key={i}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
            {Array.isArray(row.tags) ? <span className="forge-content-card__tags">{row.tags.map((tag,i)=>onTagClick ? <button key={`${tag.kind || ''}-${tag.id ?? i}`} type="button" disabled={disabled || row.disabled || tag.disabled} aria-pressed={typeof tag.selected==='boolean'?tag.selected:undefined} onClick={event=>onTagClick({target:{value:tag.id ?? tag.value ?? tag},detail:{item:row,tag},originalEvent:event})}>{typeof tag==='object'?tag.label:tag}</button> : <span key={i}>{typeof tag==='object'?tag.label:tag}</span>)}</span> : null}
            {copyStatus ? <span className="forge-content-card__copy-status" role="status">{copyStatus}</span> : null}
        </div>
    </article>;
}

export default function CardRail({id,value=[],heading,description,icon,totalCount,countHint,onCountClick,onClick,onTagClick,disabled,className='',style,emptyText='No items match these filters.','aria-label':ariaLabel}) {
    const rows=contentRecords(value),generatedId=useId(),track=useRef(null);
    const [edges,setEdges]=useState({start:true,end:true});
    const headingId=`${id || generatedId}-heading`,trackId=`${id || generatedId}-items`;
    const count=Number.isInteger(totalCount)&&totalCount>=0?totalCount:rows.length;
    const update=()=>{const node=track.current;if(!node)return;const offset=Math.abs(node.scrollLeft),max=Math.max(0,node.scrollWidth-node.clientWidth);setEdges(previous=>previous.start===(offset<1)&&previous.end===(offset>=max-1)?previous:{start:offset<1,end:offset>=max-1});};
    useEffect(()=>{const node=track.current;if(!node)return;update();const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;observer?.observe(node);window.addEventListener('resize',update);return()=>{observer?.disconnect();window.removeEventListener('resize',update);};},[rows.length]);
    const scroll=direction=>{const node=track.current;if(!node)return;const rtl=window.getComputedStyle(node).direction==='rtl',reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;node.scrollBy({left:direction*(rtl?-1:1)*node.clientWidth*.85,behavior:reduced?'auto':'smooth'});};
    return <section id={id} className={`forge-card-rail ${className}`} style={style} aria-label={ariaLabel || (!heading?'Content':undefined)} aria-labelledby={heading?headingId:undefined}>
        <header className="forge-card-rail__header">
            {icon ? <ContentImage src={icon} className="forge-card-rail__icon"/> : null}
            <div className="forge-card-rail__heading">{heading?<h2 id={headingId}>{heading} {onCountClick?<button type="button" className="forge-card-rail__count" title={countHint} aria-label={countHint || `Show all ${heading}`} disabled={disabled} onClick={onCountClick}>{count}</button>:<span className="forge-card-rail__count" title={countHint}>{count}</span>}</h2>:null}{description?<p>{description}</p>:null}</div>
            {rows.length?<div className="forge-card-rail__controls"><button type="button" aria-label="Scroll left" aria-controls={trackId} disabled={edges.start || disabled} onClick={()=>scroll(-1)}>‹</button><button type="button" aria-label="Scroll right" aria-controls={trackId} disabled={edges.end || disabled} onClick={()=>scroll(1)}>›</button></div>:null}
        </header>
        {rows.length?<div id={trackId} className="forge-card-rail__track" ref={track} role="list" onScroll={update}>{rows.map((row,position)=><ContentCard key={row.id ?? position} row={row} position={position} onClick={onClick} onTagClick={onTagClick} disabled={disabled}/>)}</div>:emptyText?<p className="forge-card-rail__empty" role="status">{emptyText}</p>:null}
    </section>;
}
