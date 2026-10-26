import React from 'react';
import {resolveSelector} from '../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import RecordDetailsPopover,{pathLabel,pathValue} from './RecordDetailsPopover.jsx';
import './ChoiceBrowser.css';

export default function ChoiceBrowser({container,context}) {
  const spec=container.choiceBrowser||{},ref=spec.dataSourceRef||container.dataSourceRef;
  const scoped=!ref||context.identity?.dataSourceRef===ref?context:context.Context?.(ref);
  usePredicateSignals(scoped);
  const form=spec.scope==='windowForm'?scoped?.signals?.windowForm?.value:scoped?.signals?.form?.value;
  const source=spec.scope==='windowForm'||spec.scope==='form'?resolveSelector(form||{},spec.field):scoped?.signals?.collection?.value;
  const rows=Array.isArray(source)?source:[],handler=spec.onAction&&scoped?.lookupHandler?.(spec.onAction);
  const [expanded,setExpanded]=React.useState(new Set());
  const condition=value=>!!(value&&evaluatePlainVisibleWhen(value,scoped));
  const loading=condition(spec.loadingWhen),disabled=()=>spec.disabled===true||condition(spec.disabledWhen)||condition(spec.loadingWhen)||typeof handler!=='function';
  const readonly=()=>spec.readOnly===true||condition(spec.readOnlyWhen);
  const field=(row,name,fallback)=>resolveSelector(row,name||fallback);
  const activate=(operation,row,extra={})=>{
    const selectable=!!field(row,spec.selectableField,'selectable');
    const mutation=operation==='toggleItem'||operation==='activateItem'&&selectable;
    if(disabled()||field(row,spec.disabledField,'disabled')||mutation&&(readonly()||field(row,spec.selectionDisabledField,'selectionDisabled'))||!mutation&&field(row,spec.navigationDisabledField,'navigationDisabled'))return false;
    return handler({context:scoped,operation,record:row,id:field(row,spec.identityField,'id'),...extra});
  };
  return <div className="forge-choice-browser" data-forge-primitive="choiceBrowser" aria-label={spec.label||'Choices'} aria-busy={loading}>
    {loading?<div role="status" className="forge-choice-browser__empty">{spec.loadingMessage||'Loading…'}</div>:rows.length===0?<div className="forge-choice-browser__empty">{(spec.emptyMessageField&&resolveSelector(form||{},spec.emptyMessageField))||spec.emptyMessage||'No results'}</div>:<ul>{rows.map((row,index)=>{
      const id=field(row,spec.identityField,'id'),label=String(field(row,spec.labelField,'name')??id??''),selectable=!!field(row,spec.selectableField,'selectable'),selected=!!field(row,spec.selectedField,'selected');
      const blocked=disabled()||!!field(row,spec.disabledField,'disabled');
      const selectionBlocked=blocked||readonly()||!!field(row,spec.selectionDisabledField,'selectionDisabled');
      const navigationBlocked=blocked||!!field(row,spec.navigationDisabledField,'navigationDisabled');
      const reason=field(row,spec.disabledReasonField,'disabledReason'),path=field(row,spec.pathField,'path');
      const paths=Array.isArray(path)?path:[],collapse=Number(spec.maxPathItems)>0&&paths.length>Number(spec.maxPathItems)&&!expanded.has(id);
      const shown=collapse?[{entry:paths[0],index:0},{ellipsis:true},{entry:paths.at(-1),index:paths.length-1}]:paths.map((entry,index)=>({entry,index}));
      const secondary=spec.secondaryField?field(row,spec.secondaryField):null;
      const details=(spec.detailFields||[]).length>0&&(!spec.detailEnabledField||field(row,spec.detailEnabledField));
      const detailPath=spec.detailPathField?field(row,spec.detailPathField):paths;
      return <li key={String(id??index)} className={`forge-choice-browser__item${selected?' is-selected':''}${reason?' has-reason':''}`} title={reason||undefined}>
        <div className="forge-choice-browser__row">
          {selectable?<input type="checkbox" aria-label={`Select ${label}`} checked={selected} disabled={selectionBlocked} onChange={()=>activate('toggleItem',row)}/>:null}
          <button type="button" className="forge-choice-browser__label" disabled={selectable?selectionBlocked:navigationBlocked} aria-pressed={selectable?selected:undefined} onClick={()=>activate('activateItem',row)}>{label}</button>
          {details?<RecordDetailsPopover context={scoped} record={row} identity={id} label={label} trigger={secondary==null||secondary===''?undefined:secondary} fields={spec.detailFields} path={Array.isArray(detailPath)?detailPath:[]} disabled={blocked} onPath={(pathValue,pathIndex)=>activate('activatePath',row,{pathValue,pathIndex,details:true})}/>:secondary!=null&&secondary!==''?<span className="forge-choice-browser__secondary">{String(secondary)}</span>:null}
          {!selectable?<span className="forge-choice-browser__chevron" aria-hidden="true">›</span>:null}
        </div>
        {shown.length?<nav className="forge-choice-browser__path" aria-label={`Path for ${label}`}>{shown.map((part,i)=><React.Fragment key={i}>{i?<span aria-hidden="true"> / </span>:null}{part.ellipsis?<button type="button" aria-label={`Expand path for ${label}`} disabled={navigationBlocked} onClick={()=>setExpanded(previous=>new Set([...previous,id]))}>…</button>:part.entry?.current?<span>{pathLabel(part.entry)}</span>:<button type="button" disabled={navigationBlocked||!!part.entry?.disabled} onClick={()=>activate('activatePath',row,{pathValue:pathValue(part.entry,part.index),pathIndex:part.index})}>{pathLabel(part.entry)}</button>}</React.Fragment>)}</nav>:null}
      </li>;
    })}</ul>}
  </div>;
}
