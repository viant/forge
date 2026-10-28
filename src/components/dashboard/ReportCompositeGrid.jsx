import React,{useEffect,useRef,useState} from 'react';
import {compositeWeightedTemplate} from '../../reporting/reportCompositeLayout.js';

// Measure each nested group rather than assuming every group has viewport width.
export default function ReportCompositeGrid({block,blocks,columns,viewportWidth,layout,children,className}){
  const ref=useRef(null),[width,setWidth]=useState(0);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    const update=()=>setWidth(element.getBoundingClientRect().width);
    update();
    if(typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
  },[]);
  if(layout==='documentMetrics')return <div ref={ref} className={className} data-report-runtime-composite-layout={layout}>{children}</div>;
  const template=compositeWeightedTemplate(block,blocks,width||viewportWidth)||`repeat(${columns}, minmax(0, 1fr))`;
  return <div ref={ref} data-report-runtime-composite-layout={layout} data-report-runtime-composite-columns={template==='minmax(0, 1fr)'?1:columns} style={{display:'grid',gridTemplateColumns:template,gap:'var(--forge-spacing-4, 16px)'}}>{children}</div>;
}
