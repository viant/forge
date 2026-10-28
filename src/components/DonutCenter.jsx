import React,{useEffect} from 'react';
import {donutCenterDescription,layoutDonutCenter} from './donutCenter.js';
import Typography from './Typography.jsx';
export function DonutCenterLabel({center,viewBox={},typography={},measure,onLayout}) {
 const {cx=120,cy=120,innerRadius=55}=viewBox;
 const layout=layoutDonutCenter(center,Number(innerRadius),{valueSize:typography.smallSize||14,labelSize:typography.captionSize||12,lineHeight:typography.captionLineHeight||16,measure});
 useEffect(()=>{onLayout?.(layout.needsDetails);},[layout.needsDetails,onLayout]);
 const y=cy-layout.height/2+layout.valueSize*.8;
 return <g role="img" aria-label={donutCenterDescription(center)} data-forge-donut-center="true" data-center-cx={cx} data-center-cy={cy} data-center-radius={innerRadius}>
  <title>{donutCenterDescription(center)}</title>
  <text x={cx} y={y} textAnchor="middle" fill="var(--forge-chart-text, #344054)" style={{fontFamily:typography.smallFamily,fontSize:layout.valueSize,fontWeight:typography.smallWeight,letterSpacing:typography.smallLetterSpacing}}>{layout.value}</text>
  {layout.labelLines.map((line,i)=><text key={i} x={cx} y={y+layout.valueSize+4+i*layout.lineHeight} textAnchor="middle" fill="var(--forge-chart-text-muted, #5f6b7c)" style={{fontFamily:typography.captionFamily,fontSize:layout.labelSize,fontWeight:typography.captionWeight,letterSpacing:typography.captionLetterSpacing}}>{line}</text>)}
 </g>;
}
export function DonutCenterDetails({center}) {return <Typography as="p" typeRole="small" data-forge-donut-center-details="true" style={{overflowWrap:'anywhere'}}>{center.formattedValue} — {center.label}. Dataset value; slice selection does not change it.</Typography>;}
export function EmptyDonutCenter({center,message,typography}) {
 const [details,setDetails]=React.useState(false);
 return <div><svg width="100%" height="240" viewBox="0 0 240 240" aria-label={message}><circle cx="120" cy="120" r="75" fill="none" stroke="var(--forge-chart-border, #d8e1e8)" strokeWidth="20"/><DonutCenterLabel center={center} typography={typography} onLayout={setDetails}/></svg>{details&&<DonutCenterDetails center={center}/>}<Typography as="p" typeRole="small">{message}</Typography></div>;
}
