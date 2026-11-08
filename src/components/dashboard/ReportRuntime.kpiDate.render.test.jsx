import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import ReportRuntime from './ReportRuntime.jsx';

// Date-only values keep calendar-day semantics in either browser appearance.
for (const appearance of ['dashboard','document']) {
  for (const [value,expected] of [['2040-02-29T00:00:00Z','Feb 29, 2040'],['2040-03-01','Mar 1, 2040'],[null,'Date unavailable'],['not-a-date','not-a-date']]) {
    const block={id:'period',kind:'kpiBlock',title:'Observation date',datasetRef:'primary',valueField:'observed',valueLabel:'Observed',valueFormat:'date',emptyLabel:'Date unavailable',content:{title:'Observation date',valueField:'observed',valueLabel:'Observed',valueFormat:'date',value,rowCount:1,emptyLabel:'Date unavailable'}};
    const before=JSON.stringify(block);
    const html=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:{title:'Calendar specimen',viewer:appearance==='document'?{appearance}:undefined,blocks:[block]},reportFill:{blocks:[block],datasets:[],diagnostics:[]}}));
    const document=new JSDOM(html).window.document;
    assert.ok(document.body.textContent.includes(expected),`${appearance}: ${expected}`);
    assert.equal(JSON.stringify(block),before);
  }
}
console.log('Browser KPI dates preserve calendar display, nulls, invalid source values and raw input.');
