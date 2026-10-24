import React, {useState} from 'react';
import Button from '../Button.jsx';
import Typography from '../Typography.jsx';
import {WORLD_COUNTRY_PATHS, countryRegionsByKey} from './worldCountryModel.js';

export default function WorldCountryMap({regions = [], title = 'Country map', onSelect}) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([480,250]);
  const [drag, setDrag] = useState(null);
  const byKey = countryRegionsByKey(regions);
  const mapped = new Set(WORLD_COUNTRY_PATHS.map(country => country.key));
  const unmatched = [...byKey.keys()].filter(key => !mapped.has(key));
  return <div className="forge-report-world-map">
    <div role="group" aria-label="Map controls" className="forge-report-world-map-controls">
      <Button variant="ghost" size="compact" hideLabel icon="lucide:zoom-in" aria-label="Zoom in map" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + .5))}/>
      <Button variant="ghost" size="compact" hideLabel icon="lucide:zoom-out" aria-label="Zoom out map" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}/>
      <Button variant="ghost" size="compact" onClick={() => {setZoom(1);setCenter([480,250]);}}>Reset map</Button>
    </div>
    <svg role="list" aria-label={title} tabIndex={0} viewBox={`${center[0]-480/zoom} ${center[1]-250/zoom} ${960/zoom} ${500/zoom}`}
      onPointerDown={event => {if(zoom > 1){event.currentTarget.setPointerCapture(event.pointerId);setDrag({x:event.clientX,y:event.clientY,center});}}}
      onPointerMove={event => {if(drag){const scale=960/zoom/event.currentTarget.getBoundingClientRect().width;setCenter([drag.center[0]-(event.clientX-drag.x)*scale,drag.center[1]-(event.clientY-drag.y)*scale]);}}}
      onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}
      onKeyDown={event => {const delta={ArrowLeft:[-25,0],ArrowRight:[25,0],ArrowUp:[0,-25],ArrowDown:[0,25]}[event.key];if(delta && zoom>1){event.preventDefault();setCenter(value=>[value[0]+delta[0],value[1]+delta[1]]);}}}>
      {WORLD_COUNTRY_PATHS.map(country => {
        const region = byKey.get(country.key);
        const label = `${country.label}: ${region?.displayValue || 'No data'}`;
        const props = {role:'listitem', 'aria-label':label, tabIndex:region ? 0 : undefined};
        const select = () => region && onSelect?.({...region, label:country.label});
        return <g key={country.key}><path d={country.path} {...props}
          fill={region?.color || 'var(--forge-report-surface-subtle, #e6edf2)'} stroke="var(--forge-report-border, #bccbd6)" strokeWidth={.65}
          style={{cursor:region ? 'pointer' : 'default'}} onClick={select}
          onKeyDown={event => {if(region && ['Enter',' '].includes(event.key)){event.preventDefault();onSelect?.({...region,label:country.label});}}}>
          <title>{label}</title>
        </path>{region && country.small ? <circle cx={country.center[0]} cy={country.center[1]} r={2.5} fill={region.color} stroke="var(--forge-text-inverse, #fff)" strokeWidth={.6} onClick={select} style={{cursor:'pointer'}}><title>{label}</title></circle> : null}</g>;
      })}
    </svg>
    <Typography as="small" typeRole="caption" className="forge-report-world-map-credit">Natural Earth country boundaries</Typography>
    {unmatched.length ? <Typography as="p" typeRole="body" role="status">No boundary for {unmatched.join(', ')}. Values remain in the report.</Typography> : null}
  </div>;
}
