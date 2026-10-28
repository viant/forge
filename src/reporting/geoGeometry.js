// Explicit, inline planar geometry. No fetch, registry discovery or geographical inference.
export const GEO_VIEWBOX = [0, 0, 960, 500];
const fail = message => { throw new Error(`geo.geometry: ${message}`); };
// Translation leaves signed area unchanged and avoids cancellation of large
// absolute-coordinate products for small rings near the coordinate limits.
const area = ring => {
  const [originX, originY] = ring[0];
  return ring.slice(1).reduce((sum, point, i) => sum
    + (ring[i][0] - originX) * (point[1] - originY)
    - (point[0] - originX) * (ring[i][1] - originY), 0);
};

export function buildGeoGeometry(geo = {}) {
  if (geo.projection !== 'planar') fail('projection must be "planar" (x right, y up)');
  const collection = geo.geometry;
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features) || !collection.features.length) fail('provide a nonempty inline FeatureCollection; URLs and resource discovery are unsupported');
  if (collection.features.length > 2000) fail('at most 2000 features are supported');
  const keys = new Set();
  let count = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const features = collection.features.map((feature, index) => {
    const key = feature?.id;
    if (feature?.type !== 'Feature' || typeof key !== 'string' || !key.trim() || key !== key.trim()) fail(`feature ${index} requires a nonempty, unpadded string id`);
    if (keys.has(key)) fail(`duplicate feature id "${key}"`);
    keys.add(key);
    const geometry = feature.geometry;
    if (!['Polygon', 'MultiPolygon'].includes(geometry?.type)) fail(`feature "${key}" must be Polygon or MultiPolygon`);
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (!Array.isArray(polygons) || !polygons.length) fail(`feature "${key}" has no polygons`);
    const rings = polygons.flatMap(polygon => {
      if (!Array.isArray(polygon) || !polygon.length) fail(`feature "${key}" has no rings`);
      return polygon.map((ring, ringIndex) => {
        if (!Array.isArray(ring) || ring.length < 4) fail(`feature "${key}" rings need at least four positions`);
        ring.forEach(point => {
          if (++count > 100000) fail('at most 100000 positions are supported');
          if (!Array.isArray(point) || point.length !== 2 || !point.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e9)) fail(`feature "${key}" positions must be finite [x,y] numbers within ±1e9`);
          minX = Math.min(minX, point[0]); maxX = Math.max(maxX, point[0]);
          minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
        });
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) fail(`feature "${key}" rings must be closed`);
        const signedArea = area(ring);
        if (!Number.isFinite(signedArea) || signedArea === 0) fail(`feature "${key}" has a degenerate ring`);
        // Opposite winding also preserves holes in PDF renderers using nonzero fill.
        return (signedArea > 0) === (ringIndex === 0) ? ring : [...ring].reverse();
      });
    });
    const label = feature.properties?.label ?? key;
    if (typeof label !== 'string' || !label.trim()) fail(`feature "${key}" label must be a nonempty string`);
    return {key, label, rings};
  });
  const scale = Math.min(928 / (maxX - minX), 468 / (maxY - minY));
  if (!Number.isFinite(scale) || scale <= 0) fail('bounds must have positive width and height');
  const xOffset = (960 - (maxX - minX) * scale) / 2;
  const yOffset = (500 - (maxY - minY) * scale) / 2;
  const number = value => String(Number(value.toFixed(8)));
  return {viewBox: [...GEO_VIEWBOX], features: features.map(({key, label, rings}) => ({key, label,
    path: rings.map(ring => ring.map(([x,y], i) => `${i ? 'L' : 'M'}${number(xOffset + (x-minX)*scale)},${number(yOffset + (maxY-y)*scale)}`).join(' ') + ' Z').join(' '),
  }))};
}
