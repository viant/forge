# Categorical Point marks

An inline planar `geojson` map can declare `geo.seriesField` to render each
observed `(geo.key, seriesField)` group as an independent Point mark. Geometry
feature IDs identify locations. Categories come from admitted rows and require
no geometry duplication or fixed category dictionary. The independently invented
[sensor example](examples/sensor-category-point-geometry.json) supplies one North
location at `[10,10]`, two status categories with count 4 each, and a polygon
backdrop. Adding a status C row at North adds a mark at the same coordinates.

The existing metric, `aggregate`, `symbolSize` and color rules apply separately
within each location/category group. Bubble area uses the group's size relative
to the largest observed size across the map. The renderer does not recompute
producer measures such as distinct counts; their input grain must already support
the declared aggregate. Equal-sized marks can coincide completely. Every mark
retains a separate labeled native button for keyboard and touch inspection.

Series values must be present JSON scalars: null, string, finite number or
boolean. Null, `""`, `0`, `"0"` and `false` have distinct identities and exact
typed color-rule matches; numeric negative zero shares the identity of zero.
Dotted series and color paths read own properties and require an actual leaf;
an explicit null leaf remains a value. The existing `value`, `equals`, then `when` rule
precedence is based on property presence, so a rule can match null. If rows in
one group select different color rules, materialization fails. An unmatched rule
uses the existing numeric palette. Color-rule labels should be declared for
readable legends. Without `seriesField`, existing rule behavior is unchanged.

Resolved Point regions retain `key` as the geometry location ID and add
`seriesValue` and `markId`. The mark ID is a JSON tuple of location and typed
series value, stable across row ordering. Selection callbacks retain the location
key and include this additional mark metadata. Screen selection uses mark
identity; equal-value ranking and equal-size paint ties use that same stable
identity. Descriptions include the plain series value (null displays “No value”). Native SVG, PDF and XLSX
use the same resolved marks and geometry.

Polygon and MultiPolygon features can remain static backdrops with the existing
empty-region presentation. They carry no series metadata. Data rows targeting a
polygon in a series map fail; categorical polygon aggregation is unsupported.
Locations without observed series rows produce no Point marks. An empty result
retains static polygon backdrops, if supplied, and has no ranked marks.

Limits remain 2,000 inline geometry features and 100,000 positions, with at most
10,000 observed Point marks. Unknown location keys, missing/non-scalar series
values and invalid sizes fail closed. The framework never invents coordinates,
discovers geometry, geocodes labels or changes producer requests. Maps without
`seriesField`, including mixed Point/polygon maps, retain their existing output.

Run `npm run test:geo-geometry` for synthetic model, schema, SVG and mounted UI
checks. Native Go materializer, fill, PDF and XLSX regressions use the same
neutral example.
