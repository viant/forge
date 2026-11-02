import {buildGeoGeometry} from './geoGeometry.js';
import {buildGeoConfig, resolveGeoColor, findGeoColorRule} from '../components/dashboard/geoMapUtils.js';
import {formatDashboardValue} from '../components/dashboard/dashboardUtils.js';
import {resolveKey} from '../utils/selector.js';

const aggregates = ['sum', 'avg', 'min', 'max', 'first'];
function aggregateValues(values, aggregate, key) {
  if (!values.length) return null;
  const value = aggregate === 'min' ? values.reduce((a,b) => Math.min(a,b), Infinity) : aggregate === 'max' ? values.reduce((a,b) => Math.max(a,b), -Infinity) : aggregate === 'first' ? values[0] : values.reduce((a,b) => a+b, 0) / (aggregate === 'avg' ? values.length : 1);
  if (!Number.isFinite(value)) throw new Error(`geo feature "${key}": aggregate is not finite`);
  return value;
}

export function buildReportFillGeoGeometry(block, rows, locale) {
  const geometry = buildGeoGeometry(block.geo);
  const config = buildGeoConfig({geo: block.geo});
  if (!block.geo.key || !block.geo.metric?.key) throw new Error('geojson requires explicit geo.key and geo.metric.key');
  if (!aggregates.includes(config.aggregate)) throw new Error('geo.aggregate is unsupported');
  const size = block.geo.symbolSize;
  const hasPoints = geometry.features.some(feature => feature.point);
  if (hasPoints && (!size || typeof size.key !== 'string' || !size.key.trim())) throw new Error('geo Point requires explicit geo.symbolSize.key');
  if (size && !hasPoints) throw new Error('geo.symbolSize requires Point geometry');
  const sizeAggregate = size?.aggregate ?? 'sum';
  const maxRadius = size?.maxRadius ?? 24;
  if (size && (!aggregates.includes(sizeAggregate) || typeof maxRadius !== 'number' || !Number.isFinite(maxRadius) || maxRadius < 1 || maxRadius > 64)) throw new Error('geo.symbolSize requires a supported aggregate and maxRadius within [1,64]');
  const pointKeys = new Set(geometry.features.filter(feature => feature.point).map(feature => feature.key));
  const groups = new Map(geometry.features.map(feature => [feature.key, []]));
  for (const [index, row] of rows.entries()) {
    const key = resolveKey(row, config.key);
    if (typeof key !== 'string' || !groups.has(key)) throw new Error(`geo row ${index}: unknown feature key "${String(key)}" in ${config.key}`);
    const value = resolveKey(row, config.metricKey);
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`geo row ${index}: ${config.metricKey} must be finite number or null`);
    const sizeValue = size && pointKeys.has(key) ? resolveKey(row, size.key) : null;
    if (sizeValue != null && (typeof sizeValue !== 'number' || !Number.isFinite(sizeValue) || sizeValue < 0)) throw new Error(`geo row ${index}: ${size.key} symbol size must be a nonnegative finite number or null`);
    groups.get(key).push(row);
  }
  const regions = geometry.features.map(feature => {
    const matched = groups.get(feature.key);
    const values = matched.map(row => resolveKey(row, config.metricKey)).filter(value => value != null);
    const rawValue = aggregateValues(values, config.aggregate, feature.key);
    const sizeValue = feature.point ? aggregateValues(matched.map(row => resolveKey(row, size.key)).filter(value => value != null), sizeAggregate, feature.key) : null;
    const rule = findGeoColorRule(matched[0], config.color);
    return {key: feature.key, label: feature.label, rawValue,
      ...(feature.point ? {symbol: {rawValue: sizeValue, displayValue: sizeValue == null ? (matched.length ? 'No value' : 'No row') : formatDashboardValue(sizeValue === 0 ? 0 : sizeValue, size.format || 'number', locale), label: size.label || size.key, radius: 0}} : {}),
      displayValue: rawValue == null ? (matched.length ? 'No value' : 'No row') : formatDashboardValue(rawValue, config.format, locale),
      color: config.color.empty, statusColor: String(rule?.color || ''), statusLabel: String(rule?.label || ''), rowCount: matched.length};
  });
  const sizeMax = regions.reduce((max, region) => Math.max(max, region.symbol?.rawValue ?? 0), 0);
  regions.forEach(region => {if (region.symbol && sizeMax > 0) region.symbol.radius = maxRadius * (Math.sqrt(region.symbol.rawValue ?? 0) / Math.sqrt(sizeMax));});
  const values = regions.map(region => region.rawValue).filter(value => value != null);
  const min = values.length ? values.reduce((a,b) => Math.min(a,b), Infinity) : 0;
  const max = values.length ? values.reduce((a,b) => Math.max(a,b), -Infinity) : 0;
  regions.forEach(region => { if (region.rawValue != null) region.color = resolveGeoColor({row: groups.get(region.key)[0], value: region.rawValue, minValue: min, maxValue: max, colorConfig: config.color}); });
  const ranking = regions.filter(region => region.rawValue != null).sort((a,b) => b.rawValue-a.rawValue || a.key.localeCompare(b.key));
  const rules = config.color.field && config.color.rules?.filter(rule => rule.color);
  return {shape: 'geojson', geometry, keyField: config.key, labelField: config.labelKey || '', metricKey: config.metricKey, metricLabel: config.metricLabel,
    format: config.format || 'number', aggregate: config.aggregate, regions, ranking, activeRegion: ranking[0] || regions[0],
    summary: {regionCount: regions.length, totalValue: formatDashboardValue(values.reduce((a,b) => a+b, 0), config.format, locale), topKey: ranking[0]?.key || ''},
    legend: !config.legend ? null : rules?.length ? {rules: rules.map(rule => ({color: rule.color, label: String(rule.label || rule.value || rule.equals || rule.when)}))} : {min: formatDashboardValue(min, config.format, locale), max: formatDashboardValue(max, config.format, locale), palette: config.color.palette},
  };
}
