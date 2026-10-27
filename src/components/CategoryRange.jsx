import React from 'react';
import {buildCategoryRange,categoryRangeSelection,categoryRangeSvg} from './categoryRange.js';
import {typographyProps} from './Typography.jsx';
import './categoryRange.css';
export default function CategoryRange({config,rows,onSelect,width=680}) {
  let model;
  try {model=buildCategoryRange(config,rows);} catch(error) {return <p role="alert" {...typographyProps('body')}>{error.message}</p>;}
  const graphic=categoryRangeSvg(model,width,{interactive:true,selectable:typeof onSelect==='function'});
  const select=target=>{const node=target.closest?.('[data-category]');if(!node)return;const selection=categoryRangeSelection(model,Number(node.dataset.category),Number(node.dataset.series));if(selection)onSelect?.(selection);};
  const keyDown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(event.target);}};
  return <div className="forge-category-range" {...typographyProps('small')} onClick={event=>select(event.target)} onKeyDown={keyDown} dangerouslySetInnerHTML={{__html:graphic.svg}}/>;
}
