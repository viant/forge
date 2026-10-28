import React, {useState,useId} from 'react';
import Button from '../Button.jsx';
import Typography from '../Typography.jsx';
import {kpiSparklineGeometry,kpiSparklineColorSegments} from '../../reporting/reportKpiSparklineModel.js';
import {valueColorAt} from '../valueColorScale.js';

export default function KpiSparkline({content,label='Trend over the selected period'}){
 const [active,setActive]=useState(null);const detailId=useId();
 const points=content?.details?.points||[];
 const selected=points.find(point=>point.series===active?.series&&point.index===active?.index);
 const choose=(series,index)=>setActive({series,index});
 const keyboard=(event,series)=>{
  const entries=points.filter(point=>point.series===series);if(!entries.length)return;
  if(event.key==='Escape'){setActive(null);event.preventDefault();return;}
  const current=entries.findIndex(point=>point.index===active?.index&&point.series===active?.series);
  let next;if(event.key==='Home')next=0;else if(event.key==='End')next=entries.length-1;else if(['ArrowRight','ArrowDown'].includes(event.key))next=Math.min(entries.length-1,Math.max(0,current)+1);else if(['ArrowLeft','ArrowUp'].includes(event.key))next=Math.max(0,current-1);else return;
  event.preventDefault();choose(series,entries[next].index);
 };
 const geometry=kpiSparklineGeometry(content);if(!geometry)return null;
 const pointer=event=>{
  const box=event.currentTarget.getBoundingClientRect();if(!box.width||!box.height)return;
  const x=(event.clientX-box.left)*geometry.width/box.width,y=(event.clientY-box.top)*geometry.height/box.height;
  let nearest=null;geometry.points.forEach((entries,series)=>entries.forEach(point=>{const distance=(point.x-x)**2+(point.y-y)**2;if(!nearest||distance<nearest.distance)nearest={series,index:point.index,distance};}));
  if(nearest)choose(nearest.series,nearest.index);
 };
 const colored=kpiSparklineColorSegments(content,geometry);
 const description=label+(content.comparisonValues?' (solid: selected period; dashed: prior period)':'');
 const graphic=<svg role={content.details?"group":"img"} aria-label={description} preserveAspectRatio={content.details?"none":undefined} viewBox={`0 0 ${geometry.width} ${geometry.height}`} width="100%" height={content.details?44:36} onPointerMove={content.details?pointer:undefined} onPointerDown={content.details?pointer:undefined} style={{display:'block',maxWidth:'100%',overflow:'hidden'}}>
  <title>{description}</title>
  {geometry.paths.map((path,i)=>path&&!(i===0&&colored)?<path key={i} d={path} fill="none" stroke={i?'var(--forge-report-text-muted, #6d7e8c)':'var(--forge-report-chart-primary, #2868a9)'} strokeWidth={i?1.25:1.75} strokeDasharray={i?'3 2':undefined}/>:null)}
  {colored?.map((s,i)=><path key={`color-${i}`} d={`M${s.x1},${s.y1}L${s.x2},${s.y2}`} fill="none" stroke={s.color} strokeOpacity={content.valueColor.opacity} strokeWidth="1.75"/>)}
  {geometry.points.flatMap((points,i)=>points.filter(p=>p.isolated).map((p,j)=><circle key={`${i}:${j}`} cx={p.x} cy={p.y} r="1.75" fillOpacity={i?1:content.valueColor?.opacity??1} fill={i?'var(--forge-report-text-muted, #6d7e8c)':content.valueColor?valueColorAt(content.valueColor,content.values[p.index]):'var(--forge-report-chart-primary, #2868a9)'}/>))}
  {selected?geometry.points[selected.series]?.filter(point=>point.index===selected.index).map(point=><circle key="active" cx={point.x} cy={point.y} r="3" fill="var(--forge-report-surface, #fff)" stroke="var(--forge-report-text, #182026)" strokeWidth="1.5" pointerEvents="none"/>):null}
  {content.details?geometry.points.map((seriesPoints,series)=>{
   const entries=points.filter(point=>point.series===series);if(!entries.length)return null;
   return <g key={`details-${series}`} role="group" tabIndex={0} aria-label={`${series?'Comparison':'Selected'} trend. Arrow keys move between observations; Home and End jump; Escape dismisses details.`} aria-describedby={selected?.series===series?detailId:undefined} onFocus={()=>choose(series,entries[0].index)} onKeyDown={event=>keyboard(event,series)}>
    {seriesPoints.map(point=><circle key={point.index} cx={point.x} cy={point.y} r="8" fill="transparent" stroke="none" onPointerEnter={()=>choose(series,point.index)} onPointerDown={()=>choose(series,point.index)} aria-label={entries.find(entry=>entry.index===point.index)?.text}/>)}
   </g>;
  }):null}
 </svg>;
 return content.details?<div onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setActive(null);}} onPointerLeave={event=>{if(event.pointerType!=='touch'&&!event.currentTarget.contains(event.currentTarget.ownerDocument.activeElement))setActive(null);}} onKeyDown={event=>{if(event.key==='Escape')setActive(null);}} style={{minWidth:0,maxWidth:'100%'}}>{graphic}{selected?<Typography as="p" typeRole="caption" id={detailId} role="status" style={{overflowWrap:'anywhere'}}>{selected.text}</Typography>:null}{selected?<Button variant="ghost" size="compact" aria-label="Dismiss trend details" onClick={()=>setActive(null)}>Dismiss</Button>:null}</div>:graphic;
}
