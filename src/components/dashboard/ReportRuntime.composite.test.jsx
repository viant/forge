import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import ReportRuntime, {resolveReportRuntimeCompositeColumns} from './ReportRuntime.jsx';
import {normalizeReportBuilderDocumentBlocks} from '../../reporting/reportDocumentModel.js';

const [columns] = normalizeReportBuilderDocumentBlocks([{id:'columns',kind:'compositeBlock',layout:'responsiveGrid',
  childBlockIds:['left','right'],runtime:{desktopColumns:6,tabletColumns:3,mobileColumns:2,minColumnWidth:180,requireCompleteDataset:true}}]);
assert.equal(resolveReportRuntimeCompositeColumns(columns,1440),6);
assert.equal(resolveReportRuntimeCompositeColumns(columns,800),3);
assert.equal(resolveReportRuntimeCompositeColumns(columns,500),2);
const [lenientColumns] = normalizeReportBuilderDocumentBlocks([{...columns,
  runtime:{desktopColumns:99,tabletColumns:'invalid',mobileColumns:-3,minColumnWidth:'invalid',requireCompleteDataset:true}}]);
assert.equal(resolveReportRuntimeCompositeColumns(lenientColumns,1440),6);
assert.equal(resolveReportRuntimeCompositeColumns(lenientColumns,800),2);
assert.equal(resolveReportRuntimeCompositeColumns(lenientColumns,500),1);

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
