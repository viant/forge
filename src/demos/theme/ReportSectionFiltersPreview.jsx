import React from 'react';
import {createRoot} from 'react-dom/client';
import ReportBuilder from '../../components/dashboard/ReportBuilder.jsx';
import ReportRuntime from '../../components/dashboard/ReportRuntime.jsx';
import {ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';
import {sectionFilterParams, sectionFilterBlocks, createSectionFilterBuilderFixture} from './reportSectionFiltersFixture.js';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../../packs/blueprint/index.jsx';
import '../../components/dashboard/Dashboard.css';

const {container,context}=createSectionFilterBuilderFixture();
window.localStorage.setItem('reportBuilder.workspaceMode.desktop.sectionFilters',JSON.stringify('report'));
window.localStorage.setItem('reportBuilder.workspaceMode.mobile.sectionFilters',JSON.stringify('report'));
function App(){
 const [params,setParams]=React.useState(sectionFilterParams);
 const spec={title:'Operations observations',viewer:{appearance:'document'},scope:{params},blocks:sectionFilterBlocks};
 return <ForgeThemeBoundary presentation="document"><main style={{maxWidth:1200,margin:'auto',padding:16}}>
  <h1>Section filter controls</h1><p>Independently invented local data. No external transport.</p>
  <section aria-label="Standalone report"><h2>Report controls</h2><ReportRuntime reportSpec={spec} reportFill={buildReportFillFromReportSpec(spec,{})} presentationMode="report" runtimeHandlers={{canEditScopeParam:()=>true,toggleScopeParamOption:(param,value)=>setParams(current=>current.map(entry=>entry.id===param.id?{...entry,value}:entry))}}/></section>
  <section aria-label="Builder report"><h2>Builder sidebar and mobile controls</h2><ReportBuilder container={container} context={context}/></section>
 </main></ForgeThemeBoundary>;
}
createRoot(document.getElementById('root')).render(<App/>);
