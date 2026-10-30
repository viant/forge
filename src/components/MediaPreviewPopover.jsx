import Popover from './Popover.jsx';
import React,{useEffect,useState} from 'react';

import MediaPreview from './MediaPreview.jsx';
import {normalizeMediaPreview} from './mediaPreview.js';

// Neutral media-card popover shared by desktop cells and responsive card rows.
export default function MediaPreviewPopover({value,label='Preview',ariaLabel='Content preview',className='',popoverClassName=''}) {
    const preview=normalizeMediaPreview(value);
    const identity=JSON.stringify(preview);
    const [open,setOpen]=useState(false);
    useEffect(()=>setOpen(false),[identity]);
    return <Popover popupKind="dialog" isOpen={open} onInteraction={setOpen} placement="right" autoFocus={false}
        popoverClassName={['forge-media-preview-popover',popoverClassName].filter(Boolean).join(' ')}
        content={<div role="dialog" aria-label={ariaLabel} onKeyDown={event=>{
            if(event.key==='Escape'){event.preventDefault();setOpen(false);}
        }}><MediaPreview value={preview} className={className} onClose={()=>setOpen(false)}/></div>}>
        <button type="button" className="forge-media-preview-trigger" aria-label={ariaLabel}
            aria-expanded={open} onClick={event=>{event.stopPropagation();setOpen(current=>!current);}}
            onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);}}}>{label}</button>
    </Popover>;
}
