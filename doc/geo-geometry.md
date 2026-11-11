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
paths, keys, fills and legend. There is no tile service, pan/zoom,
automatic DMA/ZIP dataset, spherical projection or antimeridian handling.

Each Feature has a unique, unpadded string `id`. `geo.key` declares the row field
joining that id exactly and case-sensitively. `properties.label` optionally
provides the complete display name. Point, Polygon and MultiPolygon are supported;
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
For a valueless GeoJSON map, the ranking is empty and `summary.topKey` is empty;
native validation accepts this for polygon and point collections alike.

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

The existing region-button group scrolls vertically above 15rem so large
collections do not stretch neighboring report content. All regions remain in
the group, including absent rows; native keyboard focus reveals each button,
and the selected region's live description remains below it. The geometry
preview includes 51 independently invented areas. Run
`node scripts/test-geo-region-list-browser.mjs` to check bounded geometry,
complete labels, Tab traversal and selection at desktop and phone widths.
Canonical print retains its complete, paginated region descriptions.

## Explicit points and bubble area

A Point supplies exactly one `[x,y]` position; positions are never inferred from
labels, addresses or polygon centroids. Mixed collections draw polygons first
as context and points above them. Positive bubbles draw largest first, followed
by zero/missing crosses; ties retain feature order. This keeps smaller colocated
marks visible. All features retain the same explicit row join.
Collections containing points use 66 viewport units of padding, sufficient for
the maximum radius and selection outline. Single, coincident and collinear points
remain valid; a single location is centered. Polygon-only fitting is unchanged.

Points require `geo.symbolSize: {key, label?, aggregate?, format?, maxRadius?}`.
`key` explicitly selects the dataset field; aggregate defaults to `sum` and
accepts the same five operations as color, independently. Format is `number`
(default) or `compact`. `maxRadius` defaults to 24 and accepts 1–64 viewport units.
For positive sizes, radius is `maxRadius * sqrt(size / largestSize)`: area is
proportional, with no minimum radius or positive baseline. The scale is local to
this map's observed aggregated values, not comparable across independently filled
maps. The visible legend states this. There is no additional query or data reader.

Negative source sizes, numeric strings and nonfinite values reject the fill;
negatives are not made positive or hidden by aggregation. Nulls are ignored by
aggregation. Size zero has zero bubble area; null/missing sizes also have no
bubble area. A small cross locates these features, and inspection distinguishes
`0`, `No value` (matched rows) and `No row`. Negative zero also displays as `0`,
without changing the source measurement. The cross is a location indicator,
not a size encoding. Color retains its independent signed metric and empty-color
semantics, including positive size with a missing color metric. Point buttons,
hover titles and the live selected description expose both quantities. Exactly
one selection outline is drawn, with every point reachable through native buttons
even when points overlap. No automatic collision displacement is performed.

Canonical print uses the same positions, circles, cross paths and descriptions;
native PDF draws circles directly and dashboard XLSX embeds the canonical SVG.
The point example at `examples/sensor-point-geometry.json` is also shown in the
geometry preview. Its invented readings cover negative color values, a 4:1 bubble
area ratio, zero, null, absent rows and positive size with missing color.

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
