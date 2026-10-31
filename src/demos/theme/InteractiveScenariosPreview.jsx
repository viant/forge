import React from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {useSignals} from '@preact/signals-react/runtime';
import {DashboardReportRuntime} from '../../components/dashboard/DashboardBlocks.jsx';
import {ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import {normalizeReportBuilderChartSpec,buildExplicitReportBuilderChartContainer} from '../../components/dashboard/reportBuilderUtils.js';
import {resolveBoundReportRuntime} from '../../components/dashboard/reportRuntimeBindings.js';
import {buildReportPrintChartSvg} from '../../reporting/reportPrintChartSvg.js';
import routing from '../../../doc/examples/routing-impact.json';
import staging from '../../../doc/examples/stage-allocation.json';
import '@blueprintjs/core/lib/css/blueprint.css';
// Both fixtures are independently invented; this simulates only the standard
// datasource lifecycle. No external data, network producer or private renderer.
function specimen(fixture) {
 const chartSpec=normalizeReportBuilderChartSpec(JSON.parse(JSON.stringify(fixture.chartSpec)));
 const config=chartSpec.routingImpact||chartSpec.stageAllocation;
 if(new URLSearchParams(window.location.search).has('partial')) {
  const optionalKey=chartSpec.type==='routing-impact'?'categories':'activeCategories';
  delete config.state[optionalKey];delete config.stateBindings[optionalKey];
 }
 const chartModel=buildExplicitReportBuilderChartContainer({}, {}, {},chartSpec).chart;
 const input=signal({page:1,parameters:{query:{filters:config.state}}}),control=signal({loaded:true}),collection=signal(fixture.rows);
 const source={signals:{control,collection},handlers:{dataSource:{peekInput:()=>input.value,setLoading:loading=>{control.value={...control.value,loading};},setError:error=>{control.value={...control.value,error};},setInputParameters:parameters=>{input.value={...input.value,parameters};},setPage:page=>{input.value={...input.value,page};},fetchCollection:()=>{collection.value=[...fixture.rows];control.value={loaded:true,loading:false};}}}};
 const options=key=>({categories:config.categories,activeCategories:config.categories?.filter(c=>c.inactive),period:config.periods,metric:config.metrics}[key]||[]).map(v=>({value:v.id,label:v.label}));
 const params=Object.entries(config.state).map(([id,value])=>({id,label:id,kind:typeof value==='number'?'number':'select',value,required:!Array.isArray(value),multiple:Array.isArray(value),...(typeof value==='number'?{}:{options:options(id)}),filterBindings:[{datasetRef:'primary',path:id}]}));
 const reportSpec={title:fixture.title,viewer:{appearance:'document'},scope:{dataSourceRef:'reader',params},datasets:[{id:'primary',request:input.value.parameters.query}],layoutIntent:{blockOrder:['scenario']},blocks:[{id:'scenario',kind:'chartBlock',title:fixture.title,datasetRef:'primary',chartSpec,chartModel}]};
 return {fixture,input,container:{reportRuntime:{reportSpec,datasetBindings:{primary:{dataSourceRef:'reader',queryPath:'query'}},presentationMode:'report'}},context:{Context:()=>source}};
}
const examples=[specimen(routing),specimen(staging)];
function Example({example}) {
 useSignals();const {container,context,input,fixture}=example;
 const bound=resolveBoundReportRuntime(container.reportRuntime,context),block=bound.reportFill?.blocks?.find(b=>b.id==='scenario');
 const print=block?.content?.resolvedChart?buildReportPrintChartSvg({chartModel:block.content.chartModel,resolvedChart:block.content.resolvedChart,width:900}):null;
 return <article id={fixture.chartSpec.type} style={{marginBlock:32,padding:16}}>
   <DashboardReportRuntime container={container} context={context}/>
   <details><summary>Frozen canonical print of current committed scenario</summary><output className="scenario-state">{JSON.stringify(input.value.parameters.query.filters)}</output>{print&&<div className="forge-scenario-graphic" dangerouslySetInnerHTML={{__html:print.svg}}/>}</details>
 </article>;
}
function App(){return <ForgeThemeBoundary presentation="document"><main style={{maxWidth:1200,margin:'auto',padding:16}}><h1>Interactive report scenarios</h1><p>Two independent report primitives using invented logistics and energy data.</p>{examples.map(example=><Example key={example.fixture.chartSpec.type} example={example}/>)}</main></ForgeThemeBoundary>;}
const narrow=new URLSearchParams(window.location.search).has('narrow');
createRoot(document.getElementById('root')).render(narrow?<iframe id="scenario-frame" name="scenario-frame" title="390 pixel report viewport" src="/interactive-scenarios-preview.html" style={{width:390,height:844,border:0}}/>:<App/>);
