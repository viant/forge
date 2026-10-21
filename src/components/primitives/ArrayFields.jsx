import React from 'react';
import {Button} from '@blueprintjs/core';
import {getWidget} from '../../runtime/widgetRegistry.jsx';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {registerControlActions,invalidateControlActionState,isLiveControlVisible,validateWidgetControlValue} from '../../core/ui/controlActions.js';

// Inline editing remains owned by the form; registered operations share these
// exact field/add/remove callbacks and never submit a replacement array directly.
export default function ArrayFields({value, onChange, fields=[], newRow={}, minRows=0,
    addLabel='Add row', removeLabel='Remove row', rowLabel='Row', rowKey='id',
    rowReadOnlyWhen, removeWhen, readOnly=false, disabled=false, timezone,
    context={}, item={}, className=''}) {
    const rows=Array.isArray(value)?value:[];
    const locked=readOnly||disabled||typeof onChange!=='function';
    const root=React.useRef(null),fieldNodes=React.useRef(new Map()),current=React.useRef(new Map());
    const baseId=item.id || 'arrayFields';
    const rowLocked=row=>locked||(!!rowReadOnlyWhen&&evaluatePlainVisibleWhen(rowReadOnlyWhen,context,row));
    const emit=(next,strict=false)=>(strict && onChange?.operate ? onChange.operate : onChange)?.(next);
    const changeField=(index,field,next,strict=false)=>{
        const row=rows[index];
        if(!row || rowLocked(row) || field.readOnlyWhen&&evaluatePlainVisibleWhen(field.readOnlyWhen,context,row))return false;
        const write=field.writeHandler?context.lookupHandler?.(field.writeHandler):null;
        const changed=write?write({value:next,row,field,context}):next;
        return emit(rows.map((entry,i)=>i===index?{...entry,[field.field]:changed}:entry),strict);
    };
    const add=(strict=false)=>locked?false:emit([...rows,structuredClone(newRow)],strict);
    const remove=(index,strict=false)=>locked||rows.length<=minRows||removeWhen&&!evaluatePlainVisibleWhen(removeWhen,context,rows[index])?false:emit(rows.filter((_,i)=>i!==index),strict);
    const records=new Map();
    const rendered=rows.map((row,index)=>{
        const identity=row?.[rowKey]!==undefined && row?.[rowKey]!==0?String(row[rowKey]):`draft-${index}`;
        const controls=fields.map(field=>{
            const id=`${baseId}:${identity}:${field.field}`,Control=getWidget(field.type||'text');
            const read=field.readHandler?context.lookupHandler?.(field.readHandler):null;
            const boundValue=read?read({value:row?.[field.field],row,field,context}):row?.[field.field];
            const fieldLocked=rowLocked(row)||(!!field.readOnlyWhen&&evaluatePlainVisibleWhen(field.readOnlyWhen,context,row));
            const focus=()=>{const el=fieldNodes.current.get(id)?.querySelector?.('input,textarea,select,button');el?.focus?.();return !!el&&document.activeElement===el;};
            const passive={visible:()=>isLiveControlVisible(fieldNodes.current.get(id)),disabled:fieldLocked,readOnly:fieldLocked,value:boundValue,
                constraints:field.properties || {},sensitive:field.sensitive===true||/password/i.test(field.type||''),
                actions:{setValue:({value})=>changeField(index,field,value,true),focus}};
            records.set(id,{meta:{windowId:context?.identity?.windowId,dataSourceRef:context?.identity?.dataSourceRef,controlId:id,type:field.type||'text',dataField:field.field},
                read:()=>({...passive,visible:passive.visible()}),
                invoke:()=>({...passive,visible:passive.visible(),disabled:rowLocked(row)||field.readOnlyWhen&&evaluatePlainVisibleWhen(field.readOnlyWhen,context,row),readOnly:rowLocked(row)||field.readOnlyWhen&&evaluatePlainVisibleWhen(field.readOnlyWhen,context,row),
                    validate:next=>validateWidgetControlValue(next,{item:{type:field.type||'text'},props:field.properties || {}})})});
            return {field,id,Control,boundValue,fieldLocked,change:next=>changeField(index,field,next)};
        });
        const removeId=`${baseId}:${identity}:remove`,canRemove=!locked&&rows.length>minRows&&(!removeWhen||evaluatePlainVisibleWhen(removeWhen,context,row));
        records.set(removeId,{meta:{windowId:context?.identity?.windowId,dataSourceRef:context?.identity?.dataSourceRef,controlId:removeId,type:'button'},
            read:()=>({visible:canRemove&&isLiveControlVisible(root.current),disabled:!canRemove,readOnly:false,actions:{click:()=>remove(index,true)}})});
        return {row,index,identity,controls,canRemove};
    });
    const addId=`${baseId}:add`;
    records.set(addId,{meta:{windowId:context?.identity?.windowId,dataSourceRef:context?.identity?.dataSourceRef,controlId:addId,type:'button'},
        read:()=>({visible:!locked&&isLiveControlVisible(root.current),disabled:locked,readOnly:locked,actions:{click:()=>add(true)}})});
    current.current=records;
    const keys=[...records.keys()].join('|');
    React.useEffect(()=>{
        if(!context?.identity?.windowId)return;
        const cleanups=[...current.current.entries()].map(([id,record])=>registerControlActions(record.meta,()=>{
            const entry=current.current.get(id);return entry?.invoke?.() || entry?.read?.() || {visible:false,actions:{}};
        },()=>current.current.get(id)?.read?.() || {visible:false,actions:{}}));
        return ()=>cleanups.forEach(cleanup=>cleanup());
    },[context?.identity?.windowId,context?.identity?.dataSourceRef,keys]);
    React.useEffect(()=>{if(context?.identity?.windowId)invalidateControlActionState(context.identity.windowId);},[context?.identity?.windowId,locked]);
    return <div ref={root} className={`forge-array-fields ${className}`} data-forge-primitive="arrayFields">
        <div className="forge-array-fields__rows">
            {rendered.map(({row,index,identity,controls,canRemove})=><div className="forge-array-fields__row" key={row?.[rowKey]??`draft-${index}`}>
                <span className="forge-array-fields__number" aria-label={`${rowLabel} ${index+1}`}>{index+1}</span>
                {controls.map(({field,id,Control,boundValue,fieldLocked,change})=><div className="forge-array-fields__field" key={field.field} ref={node=>{if(node)fieldNodes.current.set(id,node);else fieldNodes.current.delete(id);}}>
                    <label>{field.label||field.field}</label>
                    <Control {...field.properties} value={boundValue??null}
                        aria-label={`${field.label||field.field} ${index+1}`} inputProps={{...field.properties?.inputProps,'aria-label':`${field.label||field.field} ${index+1}`}} timezone={timezone}
                        readOnly={fieldLocked} disabled={fieldLocked} onChange={change} onValueChange={change}/>
                </div>)}
                {canRemove&&<Button minimal icon="cross" aria-label={`${removeLabel} ${index+1}`} onClick={()=>remove(index)}/>}
            </div>)}
        </div>
        {!locked&&<Button minimal icon="add" className="forge-array-fields__add" onClick={()=>add()}>{addLabel}</Button>}
    </div>;
}
