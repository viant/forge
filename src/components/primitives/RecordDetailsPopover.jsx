import React from 'react';
import {Button,Popover} from '@blueprintjs/core';
import {resolveSelector} from '../../utils/selector.js';
import {formatDisplayValue} from '../../utils/formatValue.js';
import './RecordDetailsPopover.css';

const activeByOwner=new WeakMap();
export const pathLabel=entry=>typeof entry==='object'&&entry!==null?String(entry.label??''):String(entry??'');
export const pathValue=(entry,index)=>typeof entry==='object'&&entry!==null&&Object.hasOwn(entry,'value')?entry.value:index;
export default function RecordDetailsPopover({context,record,identity,label,trigger,fields=[],path=[],onPath,disabled=false}) {
  const owner=React.useRef({}),timer=React.useRef(null),content=React.useRef(null),focusRequested=React.useRef(false);
  const key=context?.signals?.windowForm||context?.signals?.form||context||owner.current;
  const [open,setOpen]=React.useState(false);
  const pathItems=Array.isArray(path)?path:[];
  const cancel=()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;};
  const close=()=>{cancel();setOpen(false);if(activeByOwner.get(key)?.owner===owner.current)activeByOwner.delete(key);};
  const show=()=>{if(disabled)return;cancel();const previous=activeByOwner.get(key);if(previous&&previous.owner!==owner.current)previous.close();activeByOwner.set(key,{owner:owner.current,close});setOpen(true);};
  const leave=event=>{if(event.pointerType==='mouse'){cancel();timer.current=setTimeout(close,500);}};
  React.useEffect(()=>{close();return()=>{cancel();if(activeByOwner.get(key)?.owner===owner.current)activeByOwner.delete(key);};},[key,identity]);
  React.useEffect(()=>{if(disabled)close();},[disabled]);
  const focusContent=()=>{focusRequested.current=true;content.current?.querySelector('button')?.focus();};
  return <Popover isOpen={open} onInteraction={next=>next?show():close()} placement="right" autoFocus={false} minimal
    popoverClassName="forge-record-details-popover" modifiers={{flip:{enabled:true},preventOverflow:{enabled:true,options:{rootBoundary:'viewport',padding:8}}}}
    content={<div ref={node=>{content.current=node;if(node&&focusRequested.current){focusRequested.current=false;node.querySelector('button')?.focus();}}} className="forge-record-details" role="dialog" aria-hidden={!open} aria-label={`Details for ${label}`} onPointerEnter={cancel} onPointerLeave={leave} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
      <header><strong>{label}</strong><Button small minimal icon="cross" aria-label={`Close details for ${label}`} onClick={close}/></header>
      {pathItems.length?<nav aria-label={`Path for ${label}`} className="forge-record-details__path">{pathItems.map((entry,index)=><React.Fragment key={index}>{index?<span aria-hidden="true"> / </span>:null}{entry?.current||!onPath?<span>{pathLabel(entry)}</span>:<button type="button" disabled={!!entry?.disabled} onClick={()=>{close();onPath(pathValue(entry,index),index);}}>{pathLabel(entry)}</button>}</React.Fragment>)}</nav>:null}
      <dl>{fields.map(field=>{const value=resolveSelector(record,field.field);return <React.Fragment key={field.field}><dt>{field.label||field.field}</dt><dd>{value==null?(field.emptyText??'--'):formatDisplayValue(value,field.format||'text',undefined,{currency:field.currency})}</dd></React.Fragment>;})}</dl>
    </div>}>
    <button type="button" className="forge-record-details-trigger" disabled={disabled} aria-label={`Details for ${label}`} aria-expanded={open}
      onPointerEnter={event=>{if(event.pointerType==='mouse')show();}} onPointerLeave={leave} onFocus={show}
      onBlur={event=>{if(!content.current?.contains(event.relatedTarget))close();}}
      onClick={event=>{event.stopPropagation();show();if(event.detail===0)focusContent();}}
      onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}else if(['Enter',' ','ArrowDown'].includes(event.key)){event.stopPropagation();if(event.key==='ArrowDown'){event.preventDefault();show();focusContent();}}}}>{trigger??'ⓘ'}</button>
  </Popover>;
}
