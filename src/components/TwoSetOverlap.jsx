import React from 'react';
import {buildTwoSetOverlap,twoSetOverlapSvg} from './twoSetOverlap.js';
import {typographyProps} from './Typography.jsx';
import './twoSetOverlap.css';
export default function TwoSetOverlap({config,rows,width=680,onInspect,colors,textSize,lineHeight}){
 let model;try{model=buildTwoSetOverlap(config,rows);}catch(error){return <p role="alert" {...typographyProps('body')}>{error.message}</p>;}
 const graphic=twoSetOverlapSvg(model,width,{colors,textSize,lineHeight});
 const inspect=event=>{const node=event.target.closest?.('[data-overlap-region]');if(node)onInspect?.(node.dataset.overlapRegion,event.target.closest?.('[data-overlap-row]')?.dataset.overlapRow);};
 const list=config.mode==='region-list',hasFrequency=model.regions.some(region=>config[region.key].frequencyField);
 return <div className="forge-two-set-overlap" {...typographyProps('small')} onFocus={inspect} onMouseOver={inspect}><div dangerouslySetInnerHTML={{__html:graphic.svg}}/>{!model.empty&&<table className="forge-overlap-accessible-table"><caption>Two-set overlap values</caption><thead><tr><th scope="col">Region</th>{list&&<th scope="col">Row</th>}<th scope="col">Value</th><th scope="col">Secondary value</th>{hasFrequency&&<th scope="col">Frequency</th>}</tr></thead><tbody>{model.regions.flatMap(region=>(region.rows||[region]).map((entry,index)=><tr key={`${region.key}-${index}`}><th scope="row">{region.label}</th>{list&&<td>{entry.label}</td>}<td>{entry.primary.displayValue}</td><td>{entry.secondary?.displayValue||'Not declared'}</td>{hasFrequency&&<td>{entry.frequency?.displayValue||'Not declared'}</td>}</tr>))}</tbody></table>}</div>;
}
