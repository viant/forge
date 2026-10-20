import React from 'react';
import CardRail from './CardRail.jsx';
import {contentRecords} from './contentModel.js';

export default function CardRailGroup({id,context,value=[],onClick,onTagClick,onCountClick,disabled,className='',style,emptyText='No items match these filters.'}) {
    const sections=contentRecords(value);
    const forward=(handler,section)=>event=>handler?.({...event,detail:{...event.detail,section}});
    return <div id={id} className={`forge-card-rail-group ${className}`} style={style}>
        {sections.map((section,index)=><CardRail key={section.id ?? index} {...section} context={context} id={id?`${id}-${section.id ?? index}`:undefined} disabled={disabled || section.disabled} onClick={forward(onClick,section)} onTagClick={onTagClick?forward(onTagClick,section):undefined} onCountClick={onCountClick?forward(onCountClick,section):undefined}/>)}
        {!sections.length && emptyText?<p role="status">{emptyText}</p>:null}
    </div>;
}
