import React from 'react';
import {Button} from '@blueprintjs/core';
import {getWidget} from '../../runtime/widgetRegistry.jsx';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';

// Inline editing of an array already owned by a form. No fetches, persistence,
// domain permissions, or private nested datasource state are introduced here.
export default function ArrayFields({value, onChange, fields=[], newRow={}, minRows=0,
    addLabel='Add row', removeLabel='Remove row', rowLabel='Row', rowKey='id',
    rowReadOnlyWhen, removeWhen, readOnly=false, disabled=false, timezone,
    context={}, className=''}) {
    const rows=Array.isArray(value)?value:[];
    const locked=readOnly||disabled;
    const update=(index,field,next)=>{
        if(locked||(!!rowReadOnlyWhen&&evaluatePlainVisibleWhen(rowReadOnlyWhen,context,rows[index])))return;
        onChange?.(rows.map((row,i)=>i===index?{...row,[field]:next}:row));
    };
    const rowLocked=row=>locked||(!!rowReadOnlyWhen&&evaluatePlainVisibleWhen(rowReadOnlyWhen,context,row));
    return <div className={`forge-array-fields ${className}`} data-forge-primitive="arrayFields">
        <div className="forge-array-fields__rows">
            {rows.map((row,index)=><div className="forge-array-fields__row" key={row?.[rowKey]??`draft-${index}`}>
                <span className="forge-array-fields__number" aria-label={`${rowLabel} ${index+1}`}>{index+1}</span>
                {fields.map(field=>{
                    const Control=getWidget(field.type||'text');
                    const read=field.readHandler?context.lookupHandler?.(field.readHandler):null;
                    const write=field.writeHandler?context.lookupHandler?.(field.writeHandler):null;
                    const boundValue=read?read({value:row?.[field.field],row,field,context}):row?.[field.field];
                    const change=next=>{if(!fieldLocked)update(index,field.field,write?write({value:next,row,field,context}):next);};
                    const fieldLocked=rowLocked(row)||(!!field.readOnlyWhen&&evaluatePlainVisibleWhen(field.readOnlyWhen,context,row));
                    return <div className="forge-array-fields__field" key={field.field}>
                        <label>{field.label||field.field}</label>
                        <Control {...field.properties} value={boundValue??null}
                            aria-label={`${field.label||field.field} ${index+1}`} inputProps={{...field.properties?.inputProps,'aria-label':`${field.label||field.field} ${index+1}`}} timezone={timezone}
                            readOnly={fieldLocked} disabled={fieldLocked}
                            onChange={change}
                            onValueChange={change}/>
                    </div>;
                })}
                {!locked&&rows.length>minRows&&(!removeWhen||evaluatePlainVisibleWhen(removeWhen,context,row))&&
                    <Button minimal icon="cross" aria-label={`${removeLabel} ${index+1}`}
                        onClick={()=>onChange?.(rows.filter((_,i)=>i!==index))}/>}
            </div>)}
        </div>
        {!locked&&<Button minimal icon="add" className="forge-array-fields__add"
            onClick={()=>onChange?.([...rows,structuredClone(newRow)])}>{addLabel}</Button>}
    </div>;
}
