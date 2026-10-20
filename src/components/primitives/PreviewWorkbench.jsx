import React from 'react';
import {Button,Checkbox,FormGroup,HTMLSelect,Tag} from '@blueprintjs/core';
import './PreviewWorkbench.css';

// A reusable local preview harness. Metadata supplies controls, fixed query
// fields, widths and review notes; the iframe destination stays same-origin.
export function PreviewWorkbench({spec={}}) {
 const [values,setValues]=React.useState(()=>({...spec.defaults,...(typeof window!=='undefined'&&window.innerWidth<(spec.narrowAt||650)&&spec.narrowValue?{[spec.viewportField||'viewport']:spec.narrowValue}:{})}));
 const [iteration,setIteration]=React.useState(0);
 const base=spec.baseURL||'./';
 const url=new URL(base,globalThis.location?.href||'http://localhost/');
 if(globalThis.location?.origin&&url.origin!==globalThis.location.origin)throw new Error('Preview workbench requires a same-origin frame.');
 const query=new URLSearchParams(spec.fixedParameters||{});
 for(const key of spec.queryFields||[])if(values[key]!==undefined)query.set(key,String(values[key]));
 query.set(spec.iterationField||'iteration',String(iteration));
 const src=base+(base.includes('?')?'&':'?')+query;
 const width=spec.widths?.[values[spec.viewportField||'viewport']]||'100%';
 return <main className="forge-preview-workbench" data-forge-primitive="previewWorkbench">
  <header className="forge-preview-workbench__heading"><div><h1>{spec.title}</h1><p>{spec.description}</p></div>{spec.badge&&<Tag minimal intent="primary">{spec.badge}</Tag>}</header>
  <section className="forge-preview-workbench__controls" aria-label="Preview controls">{(spec.controls||[]).map(control=><FormGroup key={control.id} label={control.label} labelFor={'preview-'+control.id}><HTMLSelect id={'preview-'+control.id} value={values[control.id]||''} onChange={event=>setValues(current=>({...current,[control.id]:event.target.value}))}>{(control.options||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</HTMLSelect></FormGroup>)}<Button icon="refresh" onClick={()=>setIteration(value=>value+1)}>{spec.resetLabel||'Reset preview'}</Button></section>
  <div className="forge-preview-workbench__layout"><section className="forge-preview-workbench__stage" aria-label="Preview viewport"><iframe key={src} src={src} title={spec.iframeTitle||'Component preview'} style={{width}}/></section><aside className="forge-preview-workbench__notes"><h2>{spec.checklistTitle||'Review checklist'}</h2>{spec.checklistDescription&&<p>{spec.checklistDescription}</p>}{(spec.checklist||[]).map(item=><Checkbox key={item} label={item}/>)}{spec.note&&<p>{spec.note}</p>}</aside></div>
 </main>;
}
export default function PreviewWorkbenchPanel({container}) {return <PreviewWorkbench spec={container.previewWorkbench}/>;}
