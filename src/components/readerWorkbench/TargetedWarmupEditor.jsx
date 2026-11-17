import React, {useEffect, useRef, useState} from 'react';
import {Button, Callout, FormGroup, HTMLSelect, InputGroup, NumericInput, TextArea} from '@blueprintjs/core';
import {WorkbenchAlert} from './WorkbenchMutationContext.jsx';

// These names describe native argument controls, not policy resolution or merging.
// Everything outside these controls stays in its original authored declaration.
const options = [
  {name:'Name', label:'Plan name'},
  {name:'Priority', label:'Priority', numeric:true},
  {name:'Connector', label:'Warmup connector'},
  {name:'IndexParameter', aliases:['index_param','indexparam'], label:'Index parameter'},
  {name:'MaxCases', aliases:['max_cases'], label:'Max cases', numeric:true},
  {name:'Limit', label:'Row limit', numeric:true},
  {name:'FieldNames', aliases:['field_names','fields'], label:'Selected fields'},
  {name:'CaseRefs', aliases:['case_refs'], label:'Shared case references'},
  {name:'IndexMeta', aliases:['index_meta'], label:'Index metadata'},
];
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
function unquote(value) {
  const text=String(value??'');
  const quote=text[0];
  return ['\'', '"', '`'].includes(quote)&&text.at(-1)===quote ? text.slice(1,-1).replaceAll(quote+quote,quote) : text;
}
const optionName = arg => unquote(arg).split('=',1)[0].trim().toLowerCase();
const matches = (arg,option) => [option.name.toLowerCase(),...(option.aliases??[])].includes(optionName(arg));
function optionValue(arg) {
  if(arg===undefined)return '';
  const value=unquote(arg);return value.slice(value.indexOf('=')+1);
}
function setOption(args,option,value,index) {
  if(index===-1)return value===''?args:[...args,literal(`${option.name}=${value}`)];
  const text=unquote(args[index]);
  return args.flatMap((arg,i)=>i!==index?[arg]:value===''?[]:[literal(`${text.slice(0,text.indexOf('='))}=${value}`)]);
}
const isExtra = arg => !options.some(option=>matches(arg,option));
function withInlineArity(args) {
  // Native Priority=0 is neutral and keeps an option-free declaration inline.
  return args.length<3 ? [...args,literal('Priority=0')] : args;
}

function warmupViews(root) {
  const result=[];
  function visit(view,root,label) {
    if(!view)return;
    const name=view.namespace||view.name;
    // Native execution reports Key.Name (or Name), not a synthesized tree path.
    if(name)result.push({name,effectiveView:root?'':view.key?.name||view.name,label,view});
    for(const relation of view.relations??[]) {
      const child=relation.view;
      const childName=child?.namespace||child?.name;
      if(childName)visit(child,false,`${label} / ${childName}`);
    }
  }
  visit(root,true,`Root (${root?.namespace||root?.name||''})`);
  return result;
}

// Mutate only producer-associated declarations. Descending native occurrences
// keep subsequent identities valid even when a contributor is removed.
function targetedWarmupBatch(plan,definitions,view) {
  const original=plan?.contributors??[];
  const operations=[...original].sort((a,b)=>b.occurrence-a.occurrence).flatMap(call=>{
    const draft=definitions.find(item=>item.call===call);
    if(!draft)return [{type:'removeFunction',function:{name:call.name,occurrence:call.occurrence,expectedArgs:[...call.args]}}];
    const args=withInlineArity(draft.args);
    if(args.length===call.args.length&&args.every((arg,index)=>arg===call.args[index]))return [];
    return [{type:'updateFunction',function:{name:call.name,occurrence:call.occurrence,expectedArgs:[...call.args],args}}];
  });
  for(const definition of definitions.filter(item=>!item.call)) {
    operations.push({type:'addFunction',function:{name:'cache_warmup',args:withInlineArity([view,...definition.args.slice(1)])}});
  }
  return {type:'batch',operations};
}

function DefinitionFields({definition,onChange,disabled,id}) {
  const args=definition.args;
  const setArgs=next=>onChange({...definition,args:next});
  const extra=args.slice(2).filter(isExtra);
  const [extraText,setExtraText]=useState(()=>extra.map(unquote).join('\n'));
  return <>
    <div className="studio-form-grid">
      <FormGroup label="Index column" labelFor={`${id}-index`} helperText="Empty uses native unindexed warmup."><InputGroup id={`${id}-index`} value={unquote(args[1])} disabled={disabled} onChange={event=>setArgs([args[0],literal(event.target.value),...args.slice(2)])}/></FormGroup>
      {options.flatMap(option=>{
        const indices=args.map((arg,index)=>index>=2&&matches(arg,option)?index:-1).filter(index=>index!==-1);
        return (indices.length?indices:[-1]).map((index,occurrence)=>{
          const fieldId=`${id}-${option.name}-${occurrence}`;
          return <FormGroup key={`${option.name}-${occurrence}`} label={`${option.label}${indices.length>1?` ${occurrence+1}`:''}`} labelFor={fieldId} helperText={['MaxCases','Limit'].includes(option.name)?'Empty: native default. Zero is preserved.':option.name==='CaseRefs'?'Comma-separated component-owned case references.':undefined}>
            {option.numeric ? <NumericInput id={fieldId} value={optionValue(args[index])} fill disabled={disabled} onValueChange={(_number,text)=>setArgs(setOption(args,option,text,index))}/> : <InputGroup id={fieldId} value={optionValue(args[index])} disabled={disabled} onChange={event=>setArgs(setOption(args,option,event.target.value,index))}/>}
          </FormGroup>;
        });
      })}
    </div>
    <FormGroup label="Case dimensions and additional native options" labelFor={`${id}-cases`} helperText="One native Name=value1,value2 option per line. ExcludeDefault stays with this definition; shared references are not expanded.">
      <TextArea id={`${id}-cases`} fill rows={4} className="studio-code-input" disabled={disabled} value={extraText} onChange={event=>{
        setExtraText(event.target.value);
        const lines=event.target.value.split('\n');
        let index=0;
        // Preserve untouched argument bytes; only changed/new lines are quoted.
        const replacement=lines.filter(line=>line!=='').map(line=>{const previous=extra[index++];return previous!==undefined&&unquote(previous)===line?previous:literal(line);});
        const next=[...args.slice(0,2)];let inserted=false;
        for(const arg of args.slice(2)) {
          if(isExtra(arg)){if(!inserted){next.push(...replacement);inserted=true;}}else next.push(arg);
        }
        if(!inserted)next.push(...replacement);
        setArgs(next);
      }}/>
    </FormGroup>
  </>;
}

export function TargetedWarmupEditor({structure,version,selectedView,onSelectView,canEdit,saving,onApply,effectiveWarmup,effectiveResolved,inspecting}) {
  const views=warmupViews(structure?.component?.rootView);
  const selected=views.some(item=>item.name===selectedView)?selectedView:views[0]?.name??'';
  const target=views.find(item=>item.name===selected);
  const plans=(structure?.targetedWarmups??[]).filter(plan=>plan.view===selected);
  const [edit,setEdit]=useState(null);
  const [error,setError]=useState('');
  const [removal,setRemoval]=useState(null);
  const pending=useRef(false);
  const nextId=useRef(0);
  const mounted=useRef(true);
  const removalRef=useRef(null);removalRef.current=removal;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;removalRef.current=null;};},[]);
  const open=plan=>{
    setError('');
    setEdit({plan,definitions:plan ? plan.contributors.map(call=>({id:nextId.current++,call,args:[...call.args]})) : [{id:nextId.current++,args:[selected,literal(''),literal('Priority=0')]}]});
  };
  const submit=async operation=>{
    if(pending.current||!mounted.current)return;
    pending.current=true;setError('');
    try{await onApply(operation,version);if(mounted.current){setEdit(null);setRemoval(null);}}
    catch(cause){if(mounted.current)setError(cause.message);}
    finally{pending.current=false;}
  };
  return <section className="studio-cache-section" aria-label="View inline warmup plans">
    <h3>View inline warmup plans</h3>
    <p>Targeted inline plans override the root component-level plan or the selected view’s host policy. Removing the targeted collection restores native fallback. Cache storage is configured independently.</p>
    <FormGroup label="Target view" labelFor="warmup-target"><HTMLSelect id="warmup-target" fill value={selected} disabled={saving||Boolean(edit)} onChange={event=>{onSelectView(event.target.value);setError('');}}>{views.map(item=><option key={item.name} value={item.name}>{item.label}</option>)}</HTMLSelect></FormGroup>
    {error&&<Callout intent="danger" role="alert">{error}</Callout>}
    {target&&<>
      <p>Authored host reference: {target.view.source?.bindings?.cacheWarmup||'Not supplied'}. Storage binding: {target.view.source?.bindings?.cacheName||'Not supplied'}.</p>
      {inspecting?<p role="status">Loading selected view’s effective plans…</p>:effectiveResolved?<div aria-label="Selected view effective plans"><strong>Effective plans for this view</strong>{effectiveWarmup.targets.filter(item=>item.view===target.effectiveView).map((item,index)=><p key={index}>{item.policyName||'Unnamed policy'} · {item.origin||'Not supplied'} · {item.policyRef||'Not supplied'}</p>)}{!effectiveWarmup.targets.some(item=>item.view===target.effectiveView)&&<p>No effective plans for this view.</p>}</div>:<p>Effective metadata unavailable. Authored definitions remain separate.</p>}
      {!plans.length&&<p>No targeted inline plans authored for this view.</p>}
      {plans.map((plan,index)=><div key={index} className="studio-cache-section" aria-label={`Inline plan ${index+1}`}>
        <h4>{plan.settings.name||`Inline plan ${index+1}`}</h4>
        <p>Index: {plan.settings.indexColumn||'Unindexed'} · MaxCases: {plan.settings.maxCases??'Native default'} · Limit: {plan.settings.limit===0?'Unlimited':plan.settings.limit??'Native default'} · {plan.settings.cases?.length??0} authored case groups · CaseRefs: {plan.settings.caseRefs?.join(', ')||'None'}</p>
        {plan.diagnostic&&<Callout intent="warning">{plan.diagnostic}</Callout>}
        <div className="studio-warmup-actions"><Button disabled={!canEdit||saving||Boolean(edit)||!plan.editable} onClick={()=>open(plan)}>Edit inline plan {index+1}</Button><Button intent="danger" disabled={!canEdit||saving||Boolean(edit)||!plan.editable} onClick={()=>setRemoval(plan)}>Remove inline plan {index+1}</Button></div>
      </div>)}
      {!edit&&<Button disabled={!canEdit||saving} onClick={()=>open(null)}>Add view inline plan</Button>}
      {edit&&<div aria-label="Targeted inline plan editor">
        <p>Edit the authored definitions below. Datly combines matching definitions into plans and validates all options. Changes apply only after saving; Run all effective plans uses the saved version.</p>
        {edit.definitions.map((definition,index)=><fieldset className="studio-targeted-warmup-definition" key={definition.id} disabled={!canEdit||saving}>
          <legend>Definition {index+1}</legend>
          <DefinitionFields definition={definition} id={`targeted-warmup-${definition.id}`} disabled={!canEdit||saving} onChange={next=>setEdit(current=>({...current,definitions:current.definitions.map(item=>item.id===next.id?next:item)}))}/>
          {edit.definitions.length>1&&<Button disabled={!canEdit||saving} intent="danger" onClick={()=>setEdit(current=>({...current,definitions:current.definitions.filter(item=>item.id!==definition.id)}))}>Remove definition {index+1}</Button>}
        </fieldset>)}
        <div className="studio-warmup-actions">
          <Button disabled={!canEdit||saving} onClick={()=>setEdit(current=>({...current,definitions:[...current.definitions,{id:nextId.current++,args:withInlineArity(current.definitions[0].args.filter((arg,index)=>index<2||options.some(option=>option.name!=='CaseRefs'&&matches(arg,option))))}]}))}>Add case group</Button>
          <Button intent="primary" loading={saving} disabled={!canEdit||saving||!targetedWarmupBatch(edit.plan,edit.definitions,selected).operations.length} onClick={()=>submit(targetedWarmupBatch(edit.plan,edit.definitions,selected))}>Save view inline plan</Button>
          <Button disabled={saving} onClick={()=>{setEdit(null);setError('');}}>Cancel view edit</Button>
        </div>
      </div>}
    </>}
    <WorkbenchAlert portalClassName="forge-reader-workbench-dialog" isOpen={Boolean(removal)} intent="warning" confirmButtonText="Remove targeted plan" cancelButtonText="Keep plan" loading={saving} onCancel={()=>setRemoval(null)} onConfirm={()=>{const plan=removalRef.current;if(plan&&plan===removal)submit(targetedWarmupBatch(plan,[],selected));}}>
      <p>Remove {removal?.settings.name||'this inline plan'} from {target?.label}, version {version.versionNo}, source revision {version.sourceRevision}?</p><p>All contributing definitions for this plan will be removed. Other plans, shared cases, host references and cache storage remain unchanged. Removing the last targeted plan restores native fallback.</p>
    </WorkbenchAlert>
  </section>;
}
