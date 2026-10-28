import React, {useState} from 'react';
import Typography from '../Typography.jsx';
import Button from '../Button.jsx';
import './geoGeometryMap.css';

export default function GeoGeometryMap({resolvedGeo, title = 'Region map', onSelect}) {
  const [selectedKey, setSelectedKey] = useState(null);
  const regions = resolvedGeo.regions || [];
  const byKey = new Map(regions.map(region => [region.key, region]));
  const selected = byKey.get(selectedKey) || resolvedGeo.activeRegion;
  const selectedFeature = resolvedGeo.geometry.features.find(feature => feature.key === selected?.key);
  const select = region => {setSelectedKey(region.key); onSelect?.(region);};
  return <div className="forge-geometry-map">
    <svg role="img" aria-label={title} viewBox={resolvedGeo.geometry.viewBox.join(' ')} preserveAspectRatio="xMidYMid meet">
      <title>{title}</title><desc>Planar regions. Use the region buttons below the map to select any region, including small regions.</desc>
      {resolvedGeo.geometry.features.map(feature => {
        const region = byKey.get(feature.key);
        return <path key={feature.key} data-region-key={feature.key} d={feature.path} fill={region.color} fillRule="evenodd"
          onClick={() => select(region)}>
          <title>{`${region.label}: ${region.displayValue}`}</title>
        </path>;
      })}
      {selectedFeature ? <path className="is-selected" data-selection-outline="true" d={selectedFeature.path} fill="none" pointerEvents="none" aria-hidden="true"/> : null}
    </svg>
    {resolvedGeo.legend ? <div className="forge-geometry-map-legend" aria-label="Map legend">
      {resolvedGeo.legend.rules ? resolvedGeo.legend.rules.map((rule, i) => <Typography as="span" typeRole="caption" key={i}><i style={{background: rule.color}}/>{rule.label}</Typography>) : <>
        <Typography as="span" typeRole="caption">{resolvedGeo.legend.min}</Typography>
        {resolvedGeo.legend.palette.map((color, i) => <i key={i} style={{background: color}}/>)}
        <Typography as="span" typeRole="caption">{resolvedGeo.legend.max}</Typography>
      </>}
      <Typography as="span" typeRole="caption">No value: matched row without a value. No row: unmatched region.</Typography>
    </div> : null}
    <div className="forge-geometry-map-regions" role="group" aria-label="Select region">
      {regions.map(region => <Button variant="secondary" key={region.key} aria-pressed={selected?.key === region.key}
        onClick={() => select(region)}>{region.label}: {region.displayValue}</Button>)}
    </div>
    <Typography as="p" typeRole="body" role="status">{selected ? `${selected.label}: ${selected.displayValue}` : 'No region selected'}</Typography>
  </div>;
}
