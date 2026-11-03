import React from 'react';
import {buildTwoSetOverlap,twoSetOverlapSvg} from './twoSetOverlap.js';
import {typographyProps} from './Typography.jsx';
import './twoSetOverlap.css';
export default function TwoSetOverlap({config,rows,width=680,onInspect,colors,textSize,lineHeight}){
 let model;try{model=buildTwoSetOverlap(config,rows);}catch(error){return <p role="alert" {...typographyProps('body')}>{error.message}</p>;}
 const graphic=twoSetOverlapSvg(model,width,{colors,textSize,lineHeight});
 const inspect=event=>{const node=event.target.closest?.('[data-overlap-region]');if(node)onInspect?.(node.dataset.overlapRegion);};
 return <div className="forge-two-set-overlap" {...typographyProps('small')} onFocus={inspect} onMouseOver={inspect}><div dangerouslySetInnerHTML={{__html:graphic.svg}}/>{!model.empty&&<table className="forge-overlap-accessible-table"><caption>Two-set overlap values</caption><thead><tr><th scope="col">Region</th><th scope="col">Value</th><th scope="col">Secondary value</th></tr></thead><tbody>{model.regions.map(region=><tr key={region.key}><th scope="row">{region.label}</th><td>{region.primary.displayValue}</td><td>{region.secondary?.displayValue||'Not declared'}</td></tr>)}</tbody></table>}</div>;
}
