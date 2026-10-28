import React from 'react';import{createRoot}from'react-dom/client';
import KpiSparkline from '../../components/dashboard/KpiSparkline.jsx';
import {ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import Typography from '../../components/Typography.jsx';
import {materializeKpiSparkline} from '../../reporting/reportKpiSparklineModel.js';
import {sparklineDetailDeclaration,sparklineDetailDatasets} from '../../reporting/kpiSparklineDetailsFixture.js';
import '@blueprintjs/core/lib/css/blueprint.css';
const content=materializeKpiSparkline(sparklineDetailDeclaration,id=>sparklineDetailDatasets[id]);
createRoot(document.getElementById('root')).render(<ForgeThemeBoundary><main style={{maxWidth:360,margin:'24px auto',padding:16}}><Typography as="h1" typeRole="heading">Temperature readings</Typography><Typography as="p" typeRole="body">Hover or tap the trend. Focus a series and use arrow keys to inspect observations.</Typography><KpiSparkline content={content} label="Temperature over selected periods"/></main></ForgeThemeBoundary>);
