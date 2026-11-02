import {buildGeoGeometry} from './geoGeometry.js';
import {buildGeoConfig, resolveGeoColor, findGeoColorRule} from '../components/dashboard/geoMapUtils.js';
import {formatDashboardValue} from '../components/dashboard/dashboardUtils.js';
import {resolveKey} from '../utils/selector.js';
import {GEO_MAX_MARKS, geoSeriesIdentity, geoSeriesRuleLabel, findGeoSeriesColorRule, resolveGeoSeriesField, compareGeoSeriesMarks} from './geoSeries.js';

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
  const seriesField = block.geo.seriesField;
  if (seriesField !== undefined && (typeof seriesField !== 'string' || !seriesField.trim() || !hasPoints)) throw new Error('geo.seriesField requires a nonempty field and Point geometry');
  const series = seriesField !== undefined;
  const marks = new Map();
  const groups = new Map(geometry.features.map(feature => [feature.key, []]));
  for (const [index, row] of rows.entries()) {
    const key = resolveKey(row, config.key);
    if (typeof key !== 'string' || !groups.has(key)) throw new Error(`geo row ${index}: unknown feature key "${String(key)}" in ${config.key}`);
    let markId;
    if (series) {
      if (!pointKeys.has(key)) throw new Error(`geo row ${index}: series data requires Point geometry; polygon "${key}" is a static backdrop`);
      const seriesValue = resolveGeoSeriesField(row, seriesField);
      markId = geoSeriesIdentity(key, seriesValue);
      if (!marks.has(markId)) {
        if (marks.size >= GEO_MAX_MARKS) throw new Error(`geo.seriesField supports at most ${GEO_MAX_MARKS} observed marks`);
        marks.set(markId, {key, markId, seriesValue, rows: []});
      }
      marks.get(markId).rows.push(row);
    }
    const value = resolveKey(row, config.metricKey);
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`geo row ${index}: ${config.metricKey} must be finite number or null`);
    const sizeValue = size && pointKeys.has(key) ? resolveKey(row, size.key) : null;
    if (sizeValue != null && (typeof sizeValue !== 'number' || !Number.isFinite(sizeValue) || sizeValue < 0)) throw new Error(`geo row ${index}: ${size.key} symbol size must be a nonnegative finite number or null`);
    groups.get(key).push(row);
  }
  const featureByKey = new Map(geometry.features.map(feature => [feature.key, feature]));
  const entries = series ? [...geometry.features.filter(feature => !feature.point).map(feature => ({feature, matched: []})),
    ...Array.from(marks.values()).sort(compareGeoSeriesMarks).map(mark => ({feature: featureByKey.get(mark.key), matched: mark.rows, mark}))]
    : geometry.features.map(feature => ({feature, matched: groups.get(feature.key)}));
  const regionRows = new Map();
  const regions = entries.map(({feature, matched, mark}) => {
    const values = matched.map(row => resolveKey(row, config.metricKey)).filter(value => value != null);
    const rawValue = aggregateValues(values, config.aggregate, feature.key);
    const sizeValue = feature.point ? aggregateValues(matched.map(row => resolveKey(row, size.key)).filter(value => value != null), sizeAggregate, feature.key) : null;
    const rule = series ? findGeoSeriesColorRule(matched[0], config.color) : findGeoColorRule(matched[0], config.color);
    if (series && matched.some(row => findGeoSeriesColorRule(row, config.color) !== rule)) throw new Error(`geo mark ${mark.markId}: conflicting color rules within a location/series group`);
    regionRows.set(mark?.markId ?? feature.key, {row: matched[0], rule});
    return {key: feature.key, label: feature.label, rawValue,
      ...(mark ? {markId: mark.markId, seriesValue: mark.seriesValue} : {}),
      ...(feature.point ? {symbol: {rawValue: sizeValue, displayValue: sizeValue == null ? (matched.length ? 'No value' : 'No row') : formatDashboardValue(sizeValue === 0 ? 0 : sizeValue, size.format || 'number', locale), label: size.label || size.key, radius: 0}} : {}),
      displayValue: rawValue == null ? (matched.length ? 'No value' : 'No row') : formatDashboardValue(rawValue, config.format, locale),
      color: config.color.empty, statusColor: String(rule?.color || ''), statusLabel: String(rule?.label || ''), rowCount: matched.length};
  });
  const sizeMax = regions.reduce((max, region) => Math.max(max, region.symbol?.rawValue ?? 0), 0);
  regions.forEach(region => {if (region.symbol && sizeMax > 0) region.symbol.radius = maxRadius * (Math.sqrt(region.symbol.rawValue ?? 0) / Math.sqrt(sizeMax));});
  const values = regions.map(region => region.rawValue).filter(value => value != null);
  const min = values.length ? values.reduce((a,b) => Math.min(a,b), Infinity) : 0;
  const max = values.length ? values.reduce((a,b) => Math.max(a,b), -Infinity) : 0;
  regions.forEach(region => { if (region.rawValue != null) {
    const entry = regionRows.get(region.markId ?? region.key);
    region.color = series && entry.rule?.color ? entry.rule.color : resolveGeoColor({row: entry.row, value: region.rawValue, minValue: min, maxValue: max, colorConfig: series ? {...config.color, field: undefined} : config.color});
  } });
  const ranking = regions.filter(region => region.rawValue != null).sort((a,b) => b.rawValue-a.rawValue || (series ? compareGeoSeriesMarks(a,b) : a.key.localeCompare(b.key)));
  const observedRules = new Set([...regionRows.values()].filter(entry => entry.row).map(entry => entry.rule));
  const rules = config.color.field && config.color.rules?.filter(rule => rule.color
    && (config.color.legendScope !== 'observed' || observedRules.has(rule)));
  return {shape: 'geojson', geometry, keyField: config.key, labelField: config.labelKey || '', metricKey: config.metricKey, metricLabel: config.metricLabel,
    ...(series ? {seriesField} : {}),
    format: config.format || 'number', aggregate: config.aggregate, regions, ranking, activeRegion: ranking[0] || regions[0] || null,
    summary: !config.summary ? null : {regionCount: regions.length, totalValue: formatDashboardValue(values.reduce((a,b) => a+b, 0), config.format, locale), topKey: ranking[0]?.key || ''},
    legend: !config.legend || (config.color.legendScope === 'observed' && config.color.field && !rules?.length) ? null : rules?.length ? {rules: rules.map(rule => ({color: rule.color, label: series ? geoSeriesRuleLabel(rule) : String(rule.label || rule.value || rule.equals || rule.when)}))} : {min: formatDashboardValue(min, config.format, locale), max: formatDashboardValue(max, config.format, locale), palette: config.color.palette},
  };
}
