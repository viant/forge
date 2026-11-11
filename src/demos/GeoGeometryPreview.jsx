import React from 'react';
import {createRoot} from 'react-dom/client';
import ReportRuntime from '../components/dashboard/ReportRuntime.jsx';
import Typography from '../components/Typography.jsx';
import {buildReportFillGeoPayload} from '../reporting/reportFillGeoPayload.js';
import fixture from '../../doc/examples/campus-zone-geometry.json';
import pointFixture from '../../doc/examples/sensor-point-geometry.json';
import categoryFixture from '../../doc/examples/sensor-category-point-geometry.json';
import {manyRegionGeometry, manyRegionRows} from '../../doc/examples/many-region-geometry.js';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../components/ThemeBoundary.jsx';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../components/dashboard/Dashboard.css';
const resolvedGeo = buildReportFillGeoPayload(fixture.block, fixture.rows);
const reportSpec = {title:fixture.block.title,viewer:{appearance:'document'},blocks:[fixture.block],datasets:[{id:'primary',request:{}}]};
const reportFill = {diagnostics:[],datasets:[{id:'primary',rows:fixture.rows,provenance:{rowCount:fixture.rows.length,diagnostics:[]}}],blocks:[{...fixture.block,content:{geo:fixture.block.geo,rowCount:fixture.rows.length,resolvedGeo}}]};
const pointGeo = buildReportFillGeoPayload(pointFixture.block, pointFixture.rows);
const pointSpec = {...reportSpec,title:pointFixture.block.title,blocks:[pointFixture.block]};
const pointFill = {diagnostics:[],datasets:[{id:'primary',rows:pointFixture.rows,provenance:{rowCount:pointFixture.rows.length,diagnostics:[]}}],blocks:[{...pointFixture.block,content:{geo:pointFixture.block.geo,rowCount:pointFixture.rows.length,resolvedGeo:pointGeo}}]};
const categoryGeo = buildReportFillGeoPayload(categoryFixture.block, categoryFixture.rows);
const categorySpec = {...reportSpec,title:categoryFixture.block.title,blocks:[categoryFixture.block]};
const categoryFill = {diagnostics:[],datasets:[{id:'primary',rows:categoryFixture.rows,provenance:{rowCount:categoryFixture.rows.length,diagnostics:[]}}],blocks:[{...categoryFixture.block,content:{geo:categoryFixture.block.geo,rowCount:categoryFixture.rows.length,resolvedGeo:categoryGeo}}]};
const manyGeo = buildReportFillGeoPayload(manyRegionGeometry, manyRegionRows);
const manySpec = {...reportSpec, title:manyRegionGeometry.title, blocks:[manyRegionGeometry]};
const manyFill = {diagnostics:[],datasets:[{id:'primary',rows:manyRegionRows}],blocks:[{...manyRegionGeometry,content:{geo:manyRegionGeometry.geo,resolvedGeo:manyGeo}}]};
createRoot(document.getElementById('root')).render(<ForgeThemeProvider><ForgeThemeBoundary windowKey="geometry-preview" presentation="document"><main>
  <Typography as="p" typeRole="body">{fixture.provenance}</Typography>
  <ReportRuntime reportSpec={reportSpec} reportFill={reportFill}/>
  <Typography as="h2" typeRole="section">Raw rows</Typography>
  <pre>{JSON.stringify(fixture.rows, null, 2)}</pre>
  <Typography as="h2" typeRole="section">Explicit point observations</Typography>
  <Typography as="p" typeRole="body">{pointFixture.provenance}</Typography>
  <ReportRuntime reportSpec={pointSpec} reportFill={pointFill}/>
  <pre>{JSON.stringify(pointFixture.rows, null, 2)}</pre>
  <Typography as="h2" typeRole="section">Categorical observations at shared locations</Typography>
  <Typography as="p" typeRole="body">{categoryFixture.provenance}</Typography>
  <ReportRuntime reportSpec={categorySpec} reportFill={categoryFill}/>
  <pre>{JSON.stringify(categoryFixture.rows, null, 2)}</pre>
  <section aria-label="Many region controls" style={{width: '100%', maxWidth: 531}}>
    <Typography as="h2" typeRole="section">Many region controls</Typography>
    <Typography as="p" typeRole="body">Independently invented areas with values, zero, missing values and absent rows.</Typography>
    <ReportRuntime reportSpec={manySpec} reportFill={manyFill}/>
  </section>
</main></ForgeThemeBoundary></ForgeThemeProvider>);
