import React from 'react';
import {kpiSparklineGeometry} from '../../reporting/reportKpiSparklineModel.js';

export default function KpiSparkline({content,label='Trend over the selected period'}){
 const geometry=kpiSparklineGeometry(content);if(!geometry)return null;
 const description=label+(content.comparisonValues?' (solid: selected period; dashed: prior period)':'');
 return <svg role="img" aria-label={description} viewBox={`0 0 ${geometry.width} ${geometry.height}`} width="100%" height="36" style={{display:'block',maxWidth:'100%',overflow:'hidden'}}>
  <title>{description}</title>
  {geometry.paths.map((path,i)=>path?<path key={i} d={path} fill="none" stroke={i?'var(--forge-report-text-muted, #6d7e8c)':'var(--forge-report-chart-primary, #2868a9)'} strokeWidth={i?1.25:1.75} strokeDasharray={i?'3 2':undefined}/>:null)}
  {geometry.points.flatMap((points,i)=>points.filter(p=>p.isolated).map((p,j)=><circle key={`${i}:${j}`} cx={p.x} cy={p.y} r="1.75" fill={i?'var(--forge-report-text-muted, #6d7e8c)':'var(--forge-report-chart-primary, #2868a9)'}/>))}
 </svg>;
}
