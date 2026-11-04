import React from 'react';
import {createRoot} from 'react-dom/client';
import Chart from '../components/Chart.jsx';
import Typography from '../components/Typography.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../components/ThemeBoundary.jsx';
import fixture from '../../doc/examples/chart-tooltips.json';
const chart={type:'bar',appearance:'document',xAxis:{dataKey:'day'},series:{values:[{value:'passed',label:'Passed'}]},tooltip:fixture.chartSpec.tooltip};
const grouped=new URLSearchParams(window.location.search).has('grouped');
const overlapping=new URLSearchParams(window.location.search).has('overlapping');
const displayedChart=overlapping?{...chart,type:'line',series:{values:[{value:'passed',label:'Passed'},{value:'failed',label:'Failed'}]}}:grouped?{...chart,type:'line',layout:'small-multiples',series:{nameKey:'equipment',valueKey:'passed',values:[{value:'passed',label:'Passed'}]}}:chart;
// Independently invented close series exercise pointer ownership, without a report-specific fixture.
const displayedRows=overlapping?Array.from({length:48},(_,index)=>({day:new Date(Date.UTC(2026,0,5+index)).toISOString().slice(0,10),passed:index===47?0:50,failed:index===47?100:index===2?50:52})):grouped?fixture.rows.flatMap(row=>['A','B'].map((equipment,index)=>({...row,equipment,passed:row.passed+index,note:`Synthetic equipment ${equipment} on ${row.day}`}))):fixture.rows;
const context={signals:{collection:{value:displayedRows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
function InteractiveFixture(){
 const [selections,setSelections]=React.useState([]);
 return <><section data-pointer-fixture="primary"><Chart container={{id:'equipment-checks',chart:displayedChart}} context={context} onDatumSelect={selection=>setSelections(previous=>[...previous,selection])}/><output data-point-selections>{JSON.stringify(selections)}</output></section><section data-pointer-fixture="neighbor"><Chart container={{id:'neighbor-checks',chart:displayedChart}} context={context}/></section></>;
}
createRoot(document.getElementById('root')).render(<ForgeThemeProvider><ForgeThemeBoundary windowKey="tooltip-preview" presentation="document"><main>
 <Typography as="h1" typeRole="title">Equipment checks by day</Typography>
 <Typography as="p" typeRole="body">{fixture.provenance}</Typography>
 {overlapping?<InteractiveFixture/>:<Chart container={{id:'equipment-checks',chart:displayedChart}} context={context}/>}
</main></ForgeThemeBoundary></ForgeThemeProvider>);
