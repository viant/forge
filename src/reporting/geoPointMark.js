import {geoRenderEntries, geoSeriesLabel, compareGeoSeriesMarks} from './geoSeries.js';
// Shared geometry and inspection text for screen and canonical native print.
export function geoPaintEntries(geo) {
  return geoRenderEntries(geo).map((entry, index) => ({...entry, index})).sort((a, b) =>
    Number(!!a.feature.point) - Number(!!b.feature.point)
      || (a.feature.point ? b.region.symbol.radius - a.region.symbol.radius : 0)
      || (geo.seriesField && a.feature.point ? compareGeoSeriesMarks(a.region, b.region) : 0)
      || a.index - b.index);
}
export function geoPaintOrder(features, regionsByKey) {
  return features.map((feature, index) => ({feature, index})).sort((a, b) => {
    const layer = Number(!!a.feature.point) - Number(!!b.feature.point);
    if (layer) return layer;
    if (a.feature.point) {
      const size = regionsByKey.get(b.feature.key).symbol.radius - regionsByKey.get(a.feature.key).symbol.radius;
      if (size) return size;
    }
    return a.index - b.index;
  }).map(entry => entry.feature);
}

export function geoRegionDescription(region) {
  return `${region.label}${region.markId !== undefined ? `; series ${geoSeriesLabel(region.seriesValue)}` : ''}: ${region.displayValue}${region.symbol ? `; ${region.symbol.label}: ${region.symbol.displayValue}` : ''}`;
}

export function geoPointMark(feature, region) {
  const [cx, cy] = feature.point;
  const radius = region.symbol.radius;
  return radius > 0
    ? {tag: 'circle', attributes: {cx, cy, r: radius, fill: region.color}}
    : {tag: 'path', attributes: {d: `M${cx-3},${cy} L${cx+3},${cy} M${cx},${cy-3} L${cx},${cy+3}`, fill: 'none', stroke: region.rawValue == null ? '#bccbd6' : region.color}};
}
