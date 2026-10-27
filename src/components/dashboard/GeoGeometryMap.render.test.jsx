import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import GeoGeometryMap from './GeoGeometryMap.jsx';
import {buildReportFillGeoPayload} from '../../reporting/reportFillGeoPayload.js';
import fixture from '../../../doc/examples/campus-zone-geometry.json';
import ReportRuntime from './ReportRuntime.jsx';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_GEO_PALETTE} from './geoMapUtils.js';
it('keeps finite extreme signed values on valid browser palette endpoints',()=>{
 const resolvedGeo=buildReportFillGeoPayload(fixture.block,[{zoneId:'North',utilization:-1e308},{zoneId:'East',utilization:1e308}]);
 const host=document.createElement('div');
 host.innerHTML=renderToStaticMarkup(<GeoGeometryMap resolvedGeo={resolvedGeo}/>);
 expect(host.querySelector('[data-region-key="North"]').getAttribute('fill')).toBe(DEFAULT_GEO_PALETTE[0]);
 expect(host.querySelector('[data-region-key="East"]').getAttribute('fill')).toBe(DEFAULT_GEO_PALETTE[4]);
 expect(host.innerHTML).not.toContain('undefined');expect(host.innerHTML).not.toContain('NaN');
});
it('uses generic geometry in actual report runtime in both appearances, including no rows',()=>{
 for (const appearance of [undefined, 'document']) {
  const resolvedGeo=buildReportFillGeoPayload(fixture.block,[]);
  const reportSpec={title:fixture.block.title,viewer:{appearance},blocks:[fixture.block],datasets:[{id:'primary',request:{}}]};
  const reportFill={diagnostics:[],datasets:[{id:'primary',rows:[],provenance:{rowCount:0,diagnostics:[]}}],blocks:[{...fixture.block,content:{geo:fixture.block.geo,rowCount:0,resolvedGeo}}]};
  const html=renderToStaticMarkup(<ReportRuntime reportSpec={reportSpec} reportFill={reportFill}/>);
  expect(html).toContain('data-region-key="North"');expect(html).toContain('West: No row');expect(html).not.toContain('No geo data.');
 }
});
it('renders shared paths and accessible region controls including null and absent rows',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onSelect=vi.fn();
 const geo=buildReportFillGeoPayload(fixture.block,fixture.rows);
 try {
  await act(async()=>root.render(<GeoGeometryMap resolvedGeo={geo} title={fixture.block.title} onSelect={onSelect}/>));
  expect([...host.querySelectorAll('path[data-region-key]')].map(p=>p.getAttribute('d'))).toEqual(geo.geometry.features.map(f=>f.path));
  const buttons=[...host.querySelectorAll('button')];expect(buttons).toHaveLength(4);
  expect(buttons[1].textContent).toBe('East: 0.0%');expect(buttons[2].textContent).toBe('South: No value');
  await act(async()=>buttons[3].click());expect(onSelect.mock.calls[0][0]).toMatchObject({key:'West',rawValue:null,rowCount:0});
  expect(buttons[3].getAttribute('aria-pressed')).toBe('true');expect(host.querySelector('[role=status]').textContent).toBe('West: No row');
  const outline=host.querySelector('svg').lastElementChild;
  expect(outline.getAttribute('data-selection-outline')).toBe('true');
  expect(outline.getAttribute('d')).toBe(geo.geometry.features[3].path);
  expect(outline.getAttribute('fill')).toBe('none');
 } finally {await act(async()=>root.unmount());host.remove();}
});
