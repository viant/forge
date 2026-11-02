import React from 'react';
import {createRoot} from 'react-dom/client';
import ReportRuntime from '../components/dashboard/ReportRuntime.jsx';
import Typography from '../components/Typography.jsx';
import {buildReportFillGeoPayload} from '../reporting/reportFillGeoPayload.js';
import fixture from '../../doc/examples/campus-zone-geometry.json';
import pointFixture from '../../doc/examples/sensor-point-geometry.json';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../components/ThemeBoundary.jsx';
const resolvedGeo = buildReportFillGeoPayload(fixture.block, fixture.rows);
const reportSpec = {title:fixture.block.title,viewer:{appearance:'document'},blocks:[fixture.block],datasets:[{id:'primary',request:{}}]};
const reportFill = {diagnostics:[],datasets:[{id:'primary',rows:fixture.rows,provenance:{rowCount:fixture.rows.length,diagnostics:[]}}],blocks:[{...fixture.block,content:{geo:fixture.block.geo,rowCount:fixture.rows.length,resolvedGeo}}]};
const pointGeo = buildReportFillGeoPayload(pointFixture.block, pointFixture.rows);
const pointSpec = {...reportSpec,title:pointFixture.block.title,blocks:[pointFixture.block]};
const pointFill = {diagnostics:[],datasets:[{id:'primary',rows:pointFixture.rows,provenance:{rowCount:pointFixture.rows.length,diagnostics:[]}}],blocks:[{...pointFixture.block,content:{geo:pointFixture.block.geo,rowCount:pointFixture.rows.length,resolvedGeo:pointGeo}}]};
createRoot(document.getElementById('root')).render(<ForgeThemeProvider><ForgeThemeBoundary windowKey="geometry-preview" presentation="document"><main>
  <Typography as="p" typeRole="body">{fixture.provenance}</Typography>
  <ReportRuntime reportSpec={reportSpec} reportFill={reportFill}/>
  <Typography as="h2" typeRole="section">Raw rows</Typography>
  <pre>{JSON.stringify(fixture.rows, null, 2)}</pre>
  <Typography as="h2" typeRole="section">Explicit point observations</Typography>
  <Typography as="p" typeRole="body">{pointFixture.provenance}</Typography>
  <ReportRuntime reportSpec={pointSpec} reportFill={pointFill}/>
  <pre>{JSON.stringify(pointFixture.rows, null, 2)}</pre>
</main></ForgeThemeBoundary></ForgeThemeProvider>);
