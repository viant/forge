# Declared map geometry

`geoMapBlock` supports `geo.shape: "geojson"` in addition to the existing world
and US tile shapes. Its explicit `geometry` is an inline GeoJSON-shaped
FeatureCollection stored in the authored report, saved and serialized through
the existing report resource boundary. It is never treated as a URL. Missing
geometry and unsupported resource references fail with an actionable error;
there is no server-side fetching or discovery of producers or geometry assets.

The initial coordinate contract requires `projection: "planar"`: two finite
numbers per position, x increasing right and y increasing up. This is Cartesian
geometry, **not** WGS84 longitude/latitude or a geographic projection. The model
fits all coordinates into a 960 × 500 viewport with 16 units of padding and
preserves aspect ratio. Browser sizing is responsive and print uses the same
paths, keys, fills and legend. There is no tile service, pan/zoom, point layer,
automatic DMA/ZIP dataset, spherical projection or antimeridian handling.

Each Feature has a unique, unpadded string `id`. `geo.key` declares the row field
joining that id exactly and case-sensitively. `properties.label` optionally
provides the complete display name. Only Polygon and MultiPolygon are supported;
rings must be closed, nondegenerate, and contain at least four [x,y] positions.
The first ring is the exterior, later rings are holes. Disconnected polygons
are supported. Producers are responsible for valid non-self-intersecting topology
and properly contained holes; this renderer does not repair polygon topology.
Limits are 2000 features, 100000 positions and coordinate magnitude ≤ 1e9.

Unknown row keys, duplicate feature ids, missing geometry, nonfinite coordinates
and unsupported geometry types fail. Duplicate rows use declared sum, avg, min,
max or first aggregation, ignoring null values. Values must be finite numbers
or null; numeric strings are rejected. Zero remains numeric. A matched region
with only null values says **No value**; a region without a row says **No row**.
Both use `geo.color.empty`, distinct from the default numeric palette. Original
dataset rows are retained in ReportFill and exports.

Color uses the existing geo palette and rules contract. Signed values are
supported by the observed min/max range; this is not a centered diverging scale.
Use an explicit palette or categorical rules when appropriate. Every region has
a native keyboard button below the map, including tiny islands and missing-data
regions. Selection updates its outline, pressed state and live description.
Long names wrap in the browser controls and print descriptions. Print keeps the
map and color swatches at a fixed height, then wraps and paginates the complete
legend text and region descriptions through the canonical report text layout.
Selection is
local inspection; it does not infer report filter bindings.

## Runnable synthetic example

Run `npx vite --host 127.0.0.1` in the repository and open
`/geo-geometry-preview.html`. The example is
[`examples/campus-zone-geometry.json`](examples/campus-zone-geometry.json).
Its campus labels, coordinates and values were independently invented for this
change, with no copied map assets or real campus data. North is 70%, East is 0%,
South has a null row, and West has no row. North has a hole; East is a disconnected
MultiPolygon. The example invokes the same fill model and component used by
authored report runtime. `campus-zone-signed-values.json` supplies a separate
negative-value fixture, exercised by `geoGeometry.test.js`.

Checks: `node --no-warnings src/reporting/geoGeometry.test.js`,
`npx vitest run --config vitest.runtime.config.mjs src/components/dashboard/GeoGeometryMap.render.test.jsx`,
and `go test ./backend/reporting/materializer -run TestGeoGeometry`. The latter
also exports 48 regions with long labels through HTML and PDF, checks printable
bounds, and reconstructs every description from the actual PDF text fragments.
