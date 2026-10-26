import React from 'react';
import {Button} from '@blueprintjs/core';
import {resolveSelector} from '../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import RecordDetailsPopover from './RecordDetailsPopover.jsx';
import './GroupedSelection.css';

const dragType = 'application/x-forge-grouped-selection';
const display = value => Array.isArray(value) ? value.join(' / ') : String(value ?? '');
const same = (left,right) => left === right;

// Controlled grouped editing. The owning action applies domain rules and writes
// the model; this primitive emits identities and never persists records itself.
export default function GroupedSelection({container,context}) {
  const spec=container.groupedSelection||{},ref=spec.dataSourceRef||container.dataSourceRef;
  const scoped=!ref||context.identity?.dataSourceRef===ref?context:context.Context?.(ref);
  usePredicateSignals(scoped);
  const owner=React.useId();
  const form=spec.scope==='windowForm'?scoped?.signals?.windowForm?.value:scoped?.signals?.form?.value||scoped?.handlers?.dataSource?.getFormData?.();
  const model=resolveSelector(form||{},spec.field)||{};
  const handler=spec.onAction&&scoped?.lookupHandler?.(spec.onAction);
  const readonly=()=>spec.readOnly===true||!!(spec.readOnlyWhen&&evaluatePlainVisibleWhen(spec.readOnlyWhen,scoped));
  const disabled=readonly()||typeof handler!=='function';
  const groupID=group=>resolveSelector(group,spec.groupIdentityField||'id');
  const itemID=item=>resolveSelector(item,spec.itemIdentityField||'id');
  const itemLabel=item=>display(resolveSelector(item,spec.itemLabelField||'name'))||display(itemID(item));
  const items=group=>resolveSelector(group,spec.itemsField||'items')||[];
  const sections=(spec.sections||[]).map(section=>({...section,groups:resolveSelector(model,section.groupsField||section.id)||[]}));
  const active=resolveSelector(model,spec.activeGroupField||'activeGroup');
  const invoke=(operation,payload,mutates=true)=>{
    if(typeof handler!=='function'||(mutates&&readonly()))return false;
    return handler({context:scoped,operation,...payload});
  };
  const drop=(event,toSectionId,toGroupId,index)=>{
    event.preventDefault();event.stopPropagation();
    if(disabled||toGroupId===null||toGroupId===undefined)return;
    let dragged;try{dragged=JSON.parse(event.dataTransfer.getData(dragType));}catch{return;}
    if(dragged?.owner!==owner)return;
    const sourceGroup=sections.find(section=>section.id===dragged.sectionId)?.groups.find(group=>same(groupID(group),dragged.groupId));
    if(!sourceGroup||!items(sourceGroup).some(item=>same(itemID(item),dragged.itemId)))return;
    invoke('moveItem',{sectionId:dragged.sectionId,groupId:dragged.groupId,itemId:dragged.itemId,toSectionId,toGroupId,index});
  };
  return <div className="forge-grouped-selection" data-forge-primitive="groupedSelection">
    {sections.map(section=><section key={section.id} className="forge-grouped-selection__section" aria-label={section.label||section.id}>
      <header className="forge-grouped-selection__section-header">
        <h3>{section.label||section.id}</h3>
        <Button small minimal icon="add" disabled={disabled} aria-label={`Add group to ${section.label||section.id}`} onClick={()=>invoke('addGroup',{sectionId:section.id})}>{section.addLabel||spec.addGroupLabel||'Add group'}</Button>
      </header>
      {section.groups.map((group,groupIndex)=>{
        const id=groupID(group),label=display(resolveSelector(group,spec.groupLabelField||'label'))||`Group ${groupIndex+1}`;
        const collapsed=!!resolveSelector(group,spec.collapsedField||'collapsed');
        const selected=active?.section===section.id&&same(active?.id,id);
        const rows=items(group),valid=id!==null&&id!==undefined;
        return <article key={String(id??groupIndex)} className={`forge-grouped-selection__group${selected?' is-active':''}`} aria-label={`${section.label||section.id} ${label}`}
          onDragOver={event=>{if(!disabled)event.preventDefault();}} onDrop={event=>drop(event,section.id,id,rows.length)}>
          <header className="forge-grouped-selection__group-header">
            <button type="button" className="forge-grouped-selection__activate" aria-pressed={selected} disabled={!valid||typeof handler!=='function'} onClick={()=>invoke('activateGroup',{sectionId:section.id,groupId:id},false)}>{label}</button>
            <span className="forge-grouped-selection__count">{rows.length}</span>
            <Button small minimal icon={collapsed?'chevron-down':'chevron-up'} aria-label={`${collapsed?'Expand':'Collapse'} ${label}`} aria-expanded={!collapsed} disabled={!valid||typeof handler!=='function'} onClick={()=>invoke('collapseGroup',{sectionId:section.id,groupId:id,collapsed:!collapsed},false)}/>
            {spec.allowRemoveGroups!==false?<Button small minimal icon="cross" aria-label={`Remove ${label}`} disabled={disabled||!valid} onClick={()=>invoke('removeGroup',{sectionId:section.id,groupId:id})}/>:null}
          </header>
          <div className="forge-grouped-selection__items" hidden={collapsed}>
            {!rows.length?<p className="forge-grouped-selection__empty">{spec.emptyMessage||'Select items to add to this group.'}</p>:null}
            {rows.map((item,index)=>{
              const key=itemID(item),name=itemLabel(item),validItem=key!==null&&key!==undefined;
              const description=spec.itemDescriptionField?display(resolveSelector(item,spec.itemDescriptionField)):'';
              return <div key={String(key??index)} className="forge-grouped-selection__item" draggable={!disabled&&valid&&validItem} data-item-id={key}
                onDragStart={event=>{if(disabled||!validItem||readonly()){event.preventDefault();return;}event.dataTransfer.setData(dragType,JSON.stringify({owner,sectionId:section.id,groupId:id,itemId:key}));event.dataTransfer.effectAllowed='move';}}
                onDragOver={event=>{if(!disabled)event.preventDefault();}} onDrop={event=>drop(event,section.id,id,index)}>
                <div className="forge-grouped-selection__item-content"><span className="forge-grouped-selection__item-label">{name}</span>{description?<span className="forge-grouped-selection__description">{description}</span>:null}</div>
                <div className="forge-grouped-selection__item-actions">
                  {(spec.detailFields||[]).length?<RecordDetailsPopover context={scoped} record={item} identity={key} label={name} fields={spec.detailFields} path={resolveSelector(item,spec.detailPathField||'detailPath')||[]} onPath={(pathValue,pathIndex)=>invoke('activatePath',{sectionId:section.id,groupId:id,itemId:key,pathValue,pathIndex},false)}/>:null}
                  <label className="forge-grouped-selection__move-label"><span className="forge-grouped-selection__sr-only">Move {name} to group</span>
                    <select aria-label={`Move ${name} to group`} value={JSON.stringify([section.id,id])} disabled={disabled||!valid||!validItem} onChange={event=>{
                      const [toSectionId,toGroupId]=JSON.parse(event.currentTarget.value);
                      const target=sections.find(entry=>entry.id===toSectionId)?.groups.find(entry=>same(groupID(entry),toGroupId));
                      if(target)invoke('moveItem',{sectionId:section.id,groupId:id,itemId:key,toSectionId,toGroupId,index:items(target).length});
                    }}>{sections.flatMap(targetSection=>targetSection.groups.map((target,targetIndex)=><option key={JSON.stringify([targetSection.id,groupID(target)])} value={JSON.stringify([targetSection.id,groupID(target)])}>{targetSection.label||targetSection.id} — {display(resolveSelector(target,spec.groupLabelField||'label'))||`Group ${targetIndex+1}`}</option>))}</select>
                  </label>
                  <Button small minimal icon="arrow-up" aria-label={`Move ${name} up`} disabled={disabled||!valid||!validItem||index===0} onClick={()=>invoke('moveItem',{sectionId:section.id,groupId:id,itemId:key,toSectionId:section.id,toGroupId:id,index:index-1})}/>
                  <Button small minimal icon="arrow-down" aria-label={`Move ${name} down`} disabled={disabled||!valid||!validItem||index===rows.length-1} onClick={()=>invoke('moveItem',{sectionId:section.id,groupId:id,itemId:key,toSectionId:section.id,toGroupId:id,index:index+1})}/>
                  <Button small minimal icon="cross" aria-label={`Remove ${name}`} disabled={disabled||!valid||!validItem} onClick={()=>invoke('removeItem',{sectionId:section.id,groupId:id,itemId:key})}/>
                </div>
              </div>;
            })}
          </div>
        </article>;
      })}
    </section>)}
  </div>;
}
