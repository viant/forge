import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import GeoGeometryMap from './GeoGeometryMap.jsx';
import {buildReportFillGeoPayload} from '../../reporting/reportFillGeoPayload.js';
import fixture from '../../../doc/examples/campus-zone-geometry.json';
import ReportRuntime from './ReportRuntime.jsx';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_GEO_PALETTE} from './geoMapUtils.js';
import points from '../../../doc/examples/sensor-point-geometry.json';
import {buildReportPrintGeoSvg} from '../../reporting/reportPrintGeoSvg.js';
it('paints larger colocated bubbles first in screen and print, retaining small hit targets and all controls',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const example=structuredClone(points);
 example.block.geo.geometry.features.find(f=>f.id==='B').geometry.coordinates=[2,6];
 example.rows.find(row=>row.sensorId==='F').observations=25;
 // An authored background appearing last must still paint beneath every point.
 example.block.geo.geometry.features.push(example.block.geo.geometry.features.shift());
 const geo=buildReportFillGeoPayload(example.block,example.rows);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onSelect=vi.fn();
 try {
  await act(async()=>root.render(<GeoGeometryMap resolvedGeo={geo} onSelect={onSelect}/>));
  const marks=[...host.querySelectorAll('[data-region-key]')];
  expect(marks.map(mark=>mark.getAttribute('data-region-key'))).toEqual(['plan','B','A','F','C','D','E']);
  const small=host.querySelector('[data-region-key="A"]'),large=host.querySelector('[data-region-key="B"]');
  expect(small.getAttribute('cx')).toBe(large.getAttribute('cx'));
  expect(small.getAttribute('cy')).toBe(large.getAttribute('cy'));
  expect(small.getAttribute('r')).toBe('16');expect(large.getAttribute('r')).toBe('32');
  const smallHit=small.parentElement.querySelector('circle[fill="transparent"]');
  await act(async()=>smallHit.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  expect(onSelect.mock.calls.at(-1)[0].key).toBe('A');
  expect(host.querySelector('[role=status]').textContent).toContain('Sensor A:');
  const buttons=[...host.querySelectorAll('button')];expect(buttons).toHaveLength(7);
  for (const [index,button] of buttons.entries()) {
   button.focus();expect(document.activeElement).toBe(button);
   await act(async()=>button.click());
   expect(onSelect.mock.calls.at(-1)[0].key).toBe(geo.regions[index].key);
   expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  }
  const printed=document.createElement('div');printed.innerHTML=buildReportPrintGeoSvg({resolvedGeo:geo}).svg;
  expect([...printed.querySelector('svg').children].slice(0,7).map(mark=>mark.tagName)).toEqual(['path','circle','circle','circle','path','path','path']);
  expect([...printed.querySelectorAll('circle')].map(mark=>mark.getAttribute('r'))).toEqual(['32','16','16']);
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('renders supplied point positions, truthful areas and exact inspection with one selection',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onSelect=vi.fn();
 const geo=buildReportFillGeoPayload(points.block,points.rows);
 try {
  await act(async()=>root.render(<GeoGeometryMap resolvedGeo={geo} onSelect={onSelect}/>));
  expect(host.querySelector('[data-region-key="A"]').getAttribute('r')).toBe('16');
  expect(host.querySelector('[data-region-key="B"]').getAttribute('r')).toBe('32');
  expect(host.querySelector('[data-region-key="A"]').parentElement.querySelector('title').textContent).toBe('Sensor A: -3; Observations: 25');
  expect(host.querySelector('[data-region-key="C"]').tagName).toBe('path');
  const buttons=[...host.querySelectorAll('button')];
  buttons[5].focus();expect(document.activeElement).toBe(buttons[5]);
  await act(async()=>buttons[5].click());
  expect(onSelect.mock.calls[0][0].symbol).toMatchObject({rawValue:null,radius:0,displayValue:'No row'});
  expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  expect(host.querySelector('[role=status]').textContent).toBe('Sensor E: No row; Observations: No row');
  expect(host.querySelector('[data-selection-outline]').tagName).toBe('circle');
  expect(host.querySelector('[data-selection-outline]').getAttribute('cx')).toBe('480');
  expect(host.querySelector('svg').getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('keeps finite extreme signed values on valid browser palette endpoints',()=>{
 const resolvedGeo=buildReportFillGeoPayload(fixture.block,[{zoneId:'North',utilization:-1e308},{zoneId:'East',utilization:1e308}]);
 const host=document.createElement('div');
 host.innerHTML=renderToStaticMarkup(<GeoGeometryMap resolvedGeo={resolvedGeo}/>);
 expect(host.querySelector('[data-region-key="North"]').getAttribute('fill')).toBe(DEFAULT_GEO_PALETTE[0]);
 expect(host.querySelector('[data-region-key="East"]').getAttribute('fill')).toBe(DEFAULT_GEO_PALETTE[4]);
 expect(host.innerHTML).not.toContain('undefined');expect(host.innerHTML).not.toContain('NaN');
});
it('uses generic geometry in actual report runtime in both appearances, including no rows',()=>{
 for (const example of [fixture, points]) {
 for (const appearance of [undefined, 'document']) {
  const resolvedGeo=buildReportFillGeoPayload(example.block,[]);
  const reportSpec={title:example.block.title,viewer:{appearance},blocks:[example.block],datasets:[{id:'primary',request:{}}]};
  const reportFill={diagnostics:[],datasets:[{id:'primary',rows:[],provenance:{rowCount:0,diagnostics:[]}}],blocks:[{...example.block,content:{geo:example.block.geo,rowCount:0,resolvedGeo}}]};
  const html=renderToStaticMarkup(<ReportRuntime reportSpec={reportSpec} reportFill={reportFill}/>);
  expect(html).toContain(`data-region-key="${resolvedGeo.geometry.features[0].key}"`);expect(html).toContain('No row');expect(html).not.toContain('No geo data.');
  if (example===points) expect(html).toContain('Sensor E: No row; Observations: No row');
 }
 }
});
it('renders shared paths and accessible region controls including null and absent rows',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onSelect=vi.fn();
 const geo=buildReportFillGeoPayload(fixture.block,fixture.rows);
 try {
  await act(async()=>root.render(<GeoGeometryMap resolvedGeo={geo} title={fixture.block.title} onSelect={onSelect}/>));
  expect(host.querySelector('desc').textContent).toBe('Planar regions. Use the region buttons below the map to select any region, including small regions.');
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
