import React, {useState} from 'react';
import Typography from '../Typography.jsx';
import Button from '../Button.jsx';
import {geoPointMark, geoRegionDescription, geoPaintOrder} from '../../reporting/geoPointMark.js';
import './geoGeometryMap.css';

export default function GeoGeometryMap({resolvedGeo, title = 'Region map', onSelect}) {
  const [selectedKey, setSelectedKey] = useState(null);
  const regions = resolvedGeo.regions || [];
  const byKey = new Map(regions.map(region => [region.key, region]));
  const selected = byKey.get(selectedKey) || resolvedGeo.activeRegion;
  const selectedFeature = resolvedGeo.geometry.features.find(feature => feature.key === selected?.key);
  const hasPoints = resolvedGeo.geometry.features.some(feature => feature.point);
  const select = region => {setSelectedKey(region.key); onSelect?.(region);};
  return <div className="forge-geometry-map">
    <svg role="img" aria-label={title} viewBox={resolvedGeo.geometry.viewBox.join(' ')} preserveAspectRatio="xMidYMid meet">
      <title>{title}</title><desc>{hasPoints
        ? 'Planar features. Use the region buttons below the map to inspect every feature, including small or overlapping points. Bubble area shows size; crosses indicate zero or missing size.'
        : 'Planar regions. Use the region buttons below the map to select any region, including small regions.'}</desc>
      {geoPaintOrder(resolvedGeo.geometry.features, byKey).map(feature => {
        const region = byKey.get(feature.key);
        if (feature.point) {
          const {tag: Mark, attributes} = geoPointMark(feature, region);
          return <g key={feature.key} onClick={() => select(region)}>
            <title>{geoRegionDescription(region)}</title>
            <Mark data-region-key={feature.key} {...attributes} style={attributes.stroke ? {stroke: attributes.stroke} : undefined}/>
            <circle cx={feature.point[0]} cy={feature.point[1]} r={Math.max(12, region.symbol.radius)} fill="transparent" stroke="none"/>
          </g>;
        }
        return <path key={feature.key} data-region-key={feature.key} d={feature.path} fill={region.color} fillRule="evenodd"
          onClick={() => select(region)}>
          <title>{geoRegionDescription(region)}</title>
        </path>;
      })}
      {selectedFeature ? selectedFeature.point
        ? <circle className="is-selected" data-selection-outline="true" cx={selectedFeature.point[0]} cy={selectedFeature.point[1]} r={Math.max(6, selected.symbol.radius + 1)} fill="none" pointerEvents="none" aria-hidden="true"/>
        : <path className="is-selected" data-selection-outline="true" d={selectedFeature.path} fill="none" pointerEvents="none" aria-hidden="true"/> : null}
    </svg>
    {resolvedGeo.legend ? <div className="forge-geometry-map-legend" aria-label="Map legend">
      {resolvedGeo.legend.rules ? resolvedGeo.legend.rules.map((rule, i) => <Typography as="span" typeRole="caption" key={i}><i style={{background: rule.color}}/>{rule.label}</Typography>) : <>
        <Typography as="span" typeRole="caption">{resolvedGeo.legend.min}</Typography>
        {resolvedGeo.legend.palette.map((color, i) => <i key={i} style={{background: color}}/>)}
        <Typography as="span" typeRole="caption">{resolvedGeo.legend.max}</Typography>
      </>}
      <Typography as="span" typeRole="caption">No value: matched row without a value. No row: unmatched region.</Typography>
    </div> : null}
    {regions.some(region => region.symbol) ? <Typography as="p" typeRole="caption">Bubble area: {regions.find(region => region.symbol).symbol.label}. Relative to the largest observed size in this map. Cross: zero or missing size; inspect the feature for its exact state.</Typography> : null}
    <div className="forge-geometry-map-regions" role="group" aria-label="Select region">
      {regions.map(region => <Button variant="secondary" key={region.key} aria-pressed={selected?.key === region.key}
        onClick={() => select(region)}>{geoRegionDescription(region)}</Button>)}
    </div>
    <Typography as="p" typeRole="body" role="status">{selected ? geoRegionDescription(selected) : 'No region selected'}</Typography>
  </div>;
}
