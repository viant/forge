import React,{useState,useId,useEffect} from 'react';
import Button from '../Button.jsx';
import {typographyProps} from '../Typography.jsx';
import {buildRoutingImpact} from './routingImpact.js';
import {buildStageAllocation} from './stageAllocation.js';
import {routingImpactSvg,stageAllocationSvg} from './scenarioSvg.js';
import {display} from './scenarioShared.js';
import './scenarios.css';
function Graphic({graphic,attribute,selected=null}) {
  const emphasize=(root,id)=>root.querySelectorAll(`[data-${attribute}]`).forEach(node=>node.classList.toggle('scenario-muted',!!id&&node.getAttribute(`data-${attribute}`)!==id));
  const inspect=event=>emphasize(event.currentTarget,event.target.closest?.(`[data-${attribute}]`)?.getAttribute(`data-${attribute}`)||selected);
  const reset=event=>emphasize(event.currentTarget,selected);
  // Emphasis changes classes, preserving the focused SVG node and its identity.
  return <div className="forge-scenario-graphic" onMouseOver={inspect} onMouseLeave={reset} onFocus={inspect} onBlur={reset} dangerouslySetInnerHTML={{__html:graphic.svg}}/>;
}
function Routing({model,onChange,controlProps,width}) {
  const [draft,setDraft]=useState(null);
  const shareDisabled=controlProps('share').disabled;
  useEffect(()=>{if(shareDisabled)setDraft(null);},[shareDisabled]);
  const share=shareDisabled?model.state.share:(draft??model.state.share);
  const preview=draft==null||shareDisabled?model:buildRoutingImpact(model.config,model.paths.map(p=>p.row),{...model.state,share});
  const commit=()=>{if(draft!=null&&!shareDisabled){onChange?.('share',draft);setDraft(null);}};
  return <section className="forge-scenario" {...typographyProps('small')} aria-label="Routing impact">
    <div className="forge-scenario-controls">
      <label>Eligible routed share <output>{display(share*100)}%</output><input aria-label="Eligible routed share" type="range" min="0" max="1" step="0.01" value={share} {...controlProps('share')} onChange={event=>setDraft(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit}/></label>
      <div aria-label="Routing presets">{model.config.presets.map(p=><Button key={p.id} variant="secondary" {...controlProps('share')} aria-pressed={share===p.share} onClick={()=>onChange?.('share',p.share)}>{p.label}</Button>)}</div>
      <div aria-label="Routing categories">{model.config.categories.map(c=><Button key={c.id} variant="secondary" {...controlProps('categories')} aria-pressed={model.state.categories.includes(c.id)} onClick={()=>onChange?.('categories',model.state.categories.includes(c.id)?model.state.categories.filter(id=>id!==c.id):[...model.state.categories,c.id])}>{c.label}</Button>)}</div>
    </div>
    <p role="status">{draft!=null?'Preview — release slider to commit and export.':'Current committed scenario.'} Projections use authored assumptions.</p>
    <Graphic graphic={routingImpactSvg(preview,width,{interactive:true})} attribute="path"/>
    <table><caption>Destinations — projected scenario</caption><thead><tr><th>Destination</th><th>Delivered ({model.config.unit})</th><th>Share</th><th>Direct share</th><th>{model.config.outcomeLabel} ({model.config.outcomeUnit})</th></tr></thead><tbody>{preview.destinations.map(d=><tr key={d.id}><th>{d.id}</th><td>{display(d.delivered)}</td><td>{d.share==null?'No data':display(d.share*100)+'%'}</td><td>{!d.eligible?'Ineligible':d.directShare==null?'No data':display(d.directShare*100)+'%'}</td><td>{display(d.outcome)}</td></tr>)}</tbody></table>
  </section>;
}
function Stages({model,onChange,controlProps,width}) {
  const [highlight,setHighlight]=useState(null);
  return <section className="forge-scenario" {...typographyProps('small')} aria-label="Stage allocation">
    <div className="forge-scenario-controls"><label>Size blocks by<select {...controlProps('metric')} value={model.state.metric} onChange={event=>onChange?.('metric',event.target.value)}>{model.config.metrics.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label><label>Period<select {...controlProps('period')} value={model.state.period} onChange={event=>onChange?.('period',event.target.value)}>{model.config.periods.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label></div>
    <div className="forge-scenario-controls" aria-label="Categories">{model.config.categories.map(c=><Button key={c.id} variant="secondary" aria-pressed={highlight===c.id} onClick={()=>setHighlight(highlight===c.id?null:c.id)}>{c.label}</Button>)}</div>
    <div className="forge-scenario-controls" aria-label="Simulated additions">{model.config.categories.filter(c=>c.inactive).map(c=><Button key={c.id} className={model.state.activeCategories.includes(c.id)?undefined:"forge-scenario-inactive"} variant="secondary" {...controlProps('activeCategories')} aria-pressed={model.state.activeCategories.includes(c.id)} onClick={()=>onChange?.('activeCategories',model.state.activeCategories.includes(c.id)?model.state.activeCategories.filter(id=>id!==c.id):[...model.state.activeCategories,c.id])}>{model.state.activeCategories.includes(c.id)?'Remove':'Simulate adding'} {c.label}</Button>)}</div>
    <Graphic graphic={stageAllocationSvg(model,width,{interactive:true,highlight})} selected={highlight} attribute="category"/>
    <table><caption>Stage evidence — {model.projected?'projected':'measured'}</caption><thead><tr><th>Stage</th><th>Category</th><th>{model.metric.label} ({model.metric.unit})</th><th>Baseline change</th></tr></thead><tbody>{model.stages.flatMap(s=>s.cells.map(c=><tr key={JSON.stringify([s.id,c.id])}><th>{s.label}</th><td>{c.label}{c.inactive?' (inactive)':''}</td><td>{display(c.value)}</td><td>{display(c.delta)}</td></tr>))}</tbody></table>
  </section>;
}
export default function ScenarioView({type,config,rows=[],state,filters={},onChange,width=900,readOnly=false}) {
  const controlId=useId();
  let model;try {model=type==='routing-impact'?buildRoutingImpact(config,rows,state,filters):buildStageAllocation(config,rows,state,filters);}catch(error){return <p role="alert">{error.message}</p>;}
  const labels=type==='routing-impact'?{share:'eligible routed share',categories:'routing categories'}:{metric:'metric selection',period:'period selection',...(model.config.categories.some(c=>c.inactive)?{activeCategories:'simulated additions'}:{})};
  const controlProps=key=>{
    const disabled=readOnly||typeof onChange!=='function'||(typeof onChange.canChange==='function'&&!onChange.canChange(key));
    return {disabled,...(disabled?{'aria-describedby':`${controlId}-${key}-unavailable`}:{})};
  };
  return <>{Object.entries(labels).filter(([key])=>controlProps(key).disabled).map(([key,label])=><p key={key} id={`${controlId}-${key}-unavailable`} {...typographyProps('small')}>Editing {label} is unavailable in this report.</p>)}
    {type==='routing-impact'?<Routing model={model} onChange={onChange} controlProps={controlProps} width={width}/>:<Stages model={model} onChange={onChange} controlProps={controlProps} width={width}/>}
  </>;
}
