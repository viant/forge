import React from 'react';
import '@blueprintjs/core/lib/css/blueprint.css';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../../src/components/ThemeBoundary.jsx';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import Chart from '../../src/components/Chart.jsx';
import Typography from '../../src/components/Typography.jsx';
import {buildExplicitReportBuilderChartContainer} from '../../src/components/dashboard/reportBuilderUtils.js';
import fixture from '../../doc/examples/two-set-overlap.json';
import '../../src/components/typography.css';
import '../../src/components/foundations.css';

// Independent public synthetic counts; no application fixture or query.
const variant=new URLSearchParams(location.search).get('case');
const config=structuredClone(variant==='list'?fixture.regionListChartSpec:fixture.chartSpec),rows=structuredClone(variant==='list'?fixture.regionListRows:fixture.rows);
if(variant==='long')for(const region of Object.values(config.twoSetOverlap)){region.label+=' — laboratory instruments undergoing scheduled verification in the northern equipment room';region.format={grouping:true,decimals:2,suffix:' independently measured devices'};}
if(variant==='extreme')Object.assign(rows[0],{monitoringAOnly:Number.MAX_SAFE_INTEGER,both:0,monitoringBOnly:-987654321012.25,bothPercent:null});
const context=data=>({signals:{collection:signal(data),control:signal({}),metrics:signal({}),windowForm:signal({})}});
const chart=buildExplicitReportBuilderChartContainer({}, {}, {},config).chart;
const frequency=buildExplicitReportBuilderChartContainer({}, {}, {},fixture.frequencyChartSpec).chart;
createRoot(document.getElementById('root')).render(<ForgeThemeProvider><ForgeThemeBoundary><main style={{padding:16}}><section aria-label="Device monitoring proof"><Typography as="h1" typeRole="section">Device monitoring</Typography><Chart container={{id:'counts',chart:{...chart,appearance:'document',showControls:false}}} context={context(rows)}/></section><section aria-label="Checks per device proof"><Typography as="h2" typeRole="section">Checks per device</Typography><Chart container={{id:'frequency',chart:{...frequency,appearance:'document',showControls:false}}} context={context(fixture.frequencyRows)}/></section></main></ForgeThemeBoundary></ForgeThemeProvider>);
