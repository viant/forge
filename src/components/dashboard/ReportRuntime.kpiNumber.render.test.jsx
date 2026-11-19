import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import ReportRuntime from './ReportRuntime.jsx';

for (const appearance of ['dashboard','document']) {
  for (const [value,whole,decimal] of [[1234.26,'1,234','1,234.3'],[-1234.26,'-1,234','-1,234.3'],[12,'12','12.0'],[0,'0','0.0'],[null,'Unavailable','—']]) {
    const block={id:'measurement',kind:'kpiBlock',title:'Measurement',datasetRef:'primary',valueField:'value',valueLabel:'Whole',valueFormat:'number0',secondaryField:'secondary',secondaryLabel:'Decimal',secondaryFormat:'number1',emptyLabel:'Unavailable',content:{title:'Measurement',valueField:'value',valueLabel:'Whole',valueFormat:'number0',value,rowCount:1,secondaryField:'secondary',secondaryLabel:'Decimal',secondaryFormat:'number1',secondaryValue:value,emptyLabel:'Unavailable'}};
    const before=JSON.stringify(block);
    const html=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:{title:'Precision specimen',viewer:appearance==='document'?{appearance}:undefined,blocks:[block]},reportFill:{blocks:[block],datasets:[],diagnostics:[]}}));
    const document=new JSDOM(html).window.document;
    assert.ok(document.body.textContent.includes(whole),`${appearance}: ${whole}`);
    if(value!==null) assert.ok(document.body.textContent.includes(decimal),`${appearance}: ${decimal}`);
    assert.equal(JSON.stringify(block),before);
  }
}
console.log('Browser KPI fixed precision preserves raw input, zero and null states.');
