import React from 'react';
import {createRoot} from 'react-dom/client';
import ReportRuntime from '../../src/components/dashboard/ReportRuntime.jsx';

// Invented standalone source rows; record navigation intent without visiting it.
const rows = [
  {category:'Safe',amount:4,detailUrl:'https://example.invalid/records/17'},
  {category:'Unsafe',amount:3,detailUrl:'javascript:alert(1)'},
  {category:'Missing',amount:2},
  {category:'Ambiguous',amount:1,detailUrl:'https://example.invalid/records/18'},
  {category:'Ambiguous',amount:1,detailUrl:'https://example.invalid/records/19'},
];
const block = {id:'records',kind:'chartBlock',title:'Synthetic records',datasetRef:'records',runtime:{actions:[{kind:'external',urlField:'detailUrl'}]},chartSpec:{type:'horizontal_bar',xField:'category',yFields:['amount']}};
const chartModel = {type:'horizontal_bar',appearance:'document',animation:false,xAxis:{dataKey:'category'},series:{values:[{value:'amount',label:'Amount'}]}};
const spec = {title:'Synthetic links',blocks:[block],datasets:[{id:'records',request:{}}]};
const fill = {blocks:[{...block,content:{chartSpec:block.chartSpec,chartModel}}],datasets:[{id:'records',rows}]};
window.chartNavigationIntents = [];
window.open = (...args) => {window.chartNavigationIntents.push(args); document.getElementById('intents').textContent=JSON.stringify(window.chartNavigationIntents);return null;};
createRoot(document.getElementById('root')).render(<><ReportRuntime reportSpec={spec} reportFill={fill} presentationMode="report"/><output id="intents" role="status">[]</output></>);
