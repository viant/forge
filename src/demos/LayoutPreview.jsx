import '../packs/blueprint/theme.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../../../agently-core/protocol/ui/theme/testdata/baseline.css';
import React from 'react';
import {createRoot} from 'react-dom/client';
import ReportRuntime from '../components/dashboard/ReportRuntime.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../components/ThemeBoundary.jsx';
import {buildReportFillFromReportSpec} from '../reporting/reportFillModel.js';

// Independently authored synthetic converter evidence; no live data producer.
const requestedCase=new URLSearchParams(location.search).get('case');
const fixture=['comparator','donut','legend','legend-styled','donut-emphasis'].includes(requestedCase)?requestedCase:'layout';
const {reportSpec,datasets}=await fetch(`/doc/examples/${fixture}-conversion-preview.json`).then(response=>response.json());
const selectedDatasets=new URLSearchParams(location.search).has('single')?Object.fromEntries(Object.entries(datasets).map(([id,payload])=>[id,{...payload,rows:payload.rows.slice(0,1)}])):datasets;
const visibleFill=buildReportFillFromReportSpec(reportSpec,selectedDatasets);
createRoot(document.getElementById('root')).render(<ForgeThemeProvider themeId="baseline"><ForgeThemeBoundary windowKey="weighted-layout" presentation="document"><ReportRuntime reportSpec={reportSpec} reportFill={visibleFill}/></ForgeThemeBoundary></ForgeThemeProvider>);
