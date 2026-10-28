import React from 'react';
import {buildHeatmap,heatmapSelection,heatmapSvg} from './categoricalHeatmap.js';
import {typographyProps} from './Typography.jsx';
import './categoricalHeatmap.css';
export default function CategoricalHeatmap({config,rows,onSelect,onInspect,width=680,title='Categorical heatmap'}) {
  let model;
  try {model=buildHeatmap(config,rows);} catch(error) {return <p role="alert" {...typographyProps('body')}>{error.message}</p>;}
  const graphic=heatmapSvg(model,width,{interactive:true,selectable:typeof onSelect==='function',title});
  const inspect=target=>{const node=target?.closest?.('[data-cell]');if(node)onInspect?.(Number(node.dataset.cell));};
  const select=target=>{const cell=model.cells[Number(target?.closest?.('[data-cell]')?.dataset.cell)];if(cell){const selection=heatmapSelection(model.config,cell);if(selection)onSelect?.(selection);}};
  const focusCell=(root,node)=>{
    if(!node)return;
    root.querySelectorAll('[data-cell]').forEach(cell=>cell.setAttribute('tabindex',cell===node?'0':'-1'));
    node.focus();
  };
  const keyDown=event=>{
    const node=event.target.closest?.('[data-cell]');if(!node)return;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();select(node);return;}
    const columns=model.config.columnCategories.length,index=Number(node.dataset.cell);
    const row=Math.floor(index/columns),column=index%columns;
    const next={ArrowRight:column+1<columns?index+1:index,ArrowLeft:column>0?index-1:index,ArrowDown:row+1<model.config.rowCategories.length?index+columns:index,ArrowUp:row>0?index-columns:index,Home:0,End:model.cells.length-1}[event.key];
    if(next!==undefined){event.preventDefault();focusCell(event.currentTarget,event.currentTarget.querySelector(`[data-cell="${next}"]`));}
  };
  return <div className="forge-categorical-heatmap" {...typographyProps('small')}
    onMouseOver={event=>inspect(event.target)}
    onFocus={event=>{inspect(event.target);const node=event.target.closest?.('[data-cell]');if(node)event.currentTarget.querySelectorAll('[data-cell]').forEach(cell=>cell.setAttribute('tabindex',cell===node?'0':'-1'));}}
    onClick={event=>{focusCell(event.currentTarget,event.target.closest?.('[data-cell]'));select(event.target);}}
    onKeyDown={keyDown} dangerouslySetInnerHTML={{__html:graphic.svg}}/>;
}
