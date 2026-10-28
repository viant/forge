import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import ReportRuntime from './ReportRuntime.jsx';

const children=['left','right'].map(id=>({id,kind:'kpiBlock',title:id,content:{value:42,valueLabel:id}}));
const group={id:'group',kind:'compositeBlock',title:'Invisible layout title',layout:'responsiveGrid',childBlockIds:['left','right'],runtime:{chrome:'none',childWeights:{left:1,right:3}}};
const input={reportSpec:{title:'Synthetic weighted layout',layoutIntent:{blockOrder:['group','left','right']},blocks:[],datasets:[]},reportFill:{blocks:[group,...children],datasets:[]}};
let html=renderToStaticMarkup(<ReportRuntime {...input}/>);
assert.match(html,/minmax\(0, 0.25fr\) minmax\(0, 0.75fr\)/);
assert.doesNotMatch(html,/Invisible layout title/);
assert.match(html,/left/);assert.match(html,/right/);
children[0].runtime={visibleWhen:{source:'filters',field:'show',equals:true}};
html=renderToStaticMarkup(<ReportRuntime {...input}/>);
assert.match(html,/grid-template-columns:minmax\(0, 1fr\)/);
assert.doesNotMatch(html,/data-report-runtime-block-id="left"/);
console.log('native weighted composites render proportional tracks and normalize hidden children');
