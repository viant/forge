export const GEO_MAX_MARKS = 10000;
// Only an explicitly present leaf is a category. In particular, a falsy parent
// is not the value of a missing dotted child. Legacy selectors are unchanged.
export function resolveGeoSeriesField(row, path) {
  if (typeof path !== 'string') return undefined;
  let value = row;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
    value = value[part];
  }
  return value;
}
export const compareGeoSeriesMarks = (a, b) => a.markId < b.markId ? -1 : a.markId > b.markId ? 1 : 0;
export function geoSeriesIdentity(key, value) {
  if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)
      || typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('geo.seriesField must resolve to a present scalar (null, string, finite number or boolean)');
  }
  return JSON.stringify([key, value]);
}
export const geoMarkIdentity = region => JSON.stringify(region.markId === undefined ? ['location', region.key] : ['mark', region.markId]);
export const geoSeriesLabel = value => value === null ? 'No value' : String(value);
const ruleField = rule => ['value', 'equals', 'when'].find(key => Object.hasOwn(rule, key));
export const geoSeriesRuleLabel = rule => String(rule.label ?? (ruleField(rule) === undefined ? 'Rule' : geoSeriesLabel(rule[ruleField(rule)])));

// Typed matching is opt-in with categorical marks. Legacy maps keep their
// existing string rule semantics. Own-property precedence also preserves null.
export function findGeoSeriesColorRule(row, config) {
  const value = resolveGeoSeriesField(row, config.field);
  return config.field ? config.rules?.find(rule => {
    const field = ruleField(rule);
    return field !== undefined && rule[field] === value;
  }) : undefined;
}

// Geometry remains keyed by location. Only the display marks fan out; callbacks
// retain the location key and carry their independent mark identity and series.
export function geoRenderEntries(geo) {
  if (!geo.seriesField) {
    const regions = new Map(geo.regions.map(region => [region.key, region]));
    return geo.geometry.features.map(feature => ({feature, region: regions.get(feature.key)}));
  }
  const features = new Map(geo.geometry.features.map(feature => [feature.key, feature]));
  return geo.regions.map(region => ({feature: features.get(region.key), region}));
}
