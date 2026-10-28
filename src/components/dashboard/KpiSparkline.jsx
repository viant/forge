import React from 'react';
import {kpiSparklineGeometry,kpiSparklineColorSegments} from '../../reporting/reportKpiSparklineModel.js';
import {valueColorAt} from '../valueColorScale.js';

export default function KpiSparkline({content,label='Trend over the selected period'}){
 const geometry=kpiSparklineGeometry(content);if(!geometry)return null;
 const colored=kpiSparklineColorSegments(content,geometry);
 const description=label+(content.comparisonValues?' (solid: selected period; dashed: prior period)':'');
 return <svg role="img" aria-label={description} viewBox={`0 0 ${geometry.width} ${geometry.height}`} width="100%" height="36" style={{display:'block',maxWidth:'100%',overflow:'hidden'}}>
  <title>{description}</title>
  {geometry.paths.map((path,i)=>path&&!(i===0&&colored)?<path key={i} d={path} fill="none" stroke={i?'var(--forge-report-text-muted, #6d7e8c)':'var(--forge-report-chart-primary, #2868a9)'} strokeWidth={i?1.25:1.75} strokeDasharray={i?'3 2':undefined}/>:null)}
  {colored?.map((s,i)=><path key={`color-${i}`} d={`M${s.x1},${s.y1}L${s.x2},${s.y2}`} fill="none" stroke={s.color} strokeOpacity={content.valueColor.opacity} strokeWidth="1.75"/>)}
  {geometry.points.flatMap((points,i)=>points.filter(p=>p.isolated).map((p,j)=><circle key={`${i}:${j}`} cx={p.x} cy={p.y} r="1.75" fillOpacity={i?1:content.valueColor?.opacity??1} fill={i?'var(--forge-report-text-muted, #6d7e8c)':content.valueColor?valueColorAt(content.valueColor,content.values[p.index]):'var(--forge-report-chart-primary, #2868a9)'}/>))}
 </svg>;
}
