import React from 'react';
import {createRoot} from 'react-dom/client';
import Chart from '../components/Chart.jsx';
import Typography from '../components/Typography.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../components/ThemeBoundary.jsx';
import fixture from '../../doc/examples/chart-tooltips.json';
const chart={type:'bar',appearance:'document',xAxis:{dataKey:'day'},series:{values:[{value:'passed',label:'Passed'}]},tooltip:fixture.chartSpec.tooltip};
const grouped=new URLSearchParams(window.location.search).has('grouped');
const displayedChart=grouped?{...chart,type:'line',layout:'small-multiples',series:{nameKey:'equipment',valueKey:'passed',values:[{value:'passed',label:'Passed'}]}}:chart;
const displayedRows=grouped?fixture.rows.flatMap(row=>['A','B'].map((equipment,index)=>({...row,equipment,passed:row.passed+index,note:`Synthetic equipment ${equipment} on ${row.day}`}))):fixture.rows;
const context={signals:{collection:{value:displayedRows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
createRoot(document.getElementById('root')).render(<ForgeThemeProvider><ForgeThemeBoundary windowKey="tooltip-preview" presentation="document"><main>
 <Typography as="h1" typeRole="title">Equipment checks by day</Typography>
 <Typography as="p" typeRole="body">{fixture.provenance}</Typography>
 <Chart container={{id:'equipment-checks',chart:displayedChart}} context={context}/>
</main></ForgeThemeBoundary></ForgeThemeProvider>);
