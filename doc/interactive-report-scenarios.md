# Interactive report scenarios

Forge exposes two independent chart types: `routing-impact` and
`stage-allocation`. Both work through ordinary Chart, report documents, report
fill and canonical print. The independently invented fixtures are
[routing-impact.json](examples/routing-impact.json) (logistics) and
[stage-allocation.json](examples/stage-allocation.json) (energy). They contain no
customer data or external dependencies.

Run `npm run dev -- --host 127.0.0.1 --port <free-port> --strictPort` and open
`/interactive-scenarios-preview.html`. The page hosts two ordinary
`DashboardReportRuntime` instances with simulated standard datasources, each
with its own scope and frozen print preview. Run `npm run test:interactive-scenarios`
for model, schema, authored-report pipeline and real React controls. The Endly
workflow `e2e/interactive-scenarios/run.yaml` accepts `previewURL` and an owned
Chrome `debuggerAddress`; it checks the real report controls and print snapshot. The separate `narrow.yaml` uses the preview's `?narrow` route to give the real report a 390-pixel iframe browsing context, checks that width explicitly, and verifies local scrolling and slider touch size.

## Routing impact

Use `chartSpec.type: "routing-impact"` and `chartSpec.routingImpact` (or
`chart.routingImpact` on a direct Chart). Required field mappings:

| Property | Source data |
| --- | --- |
| `idField` | Unique stable path ID |
| `sourceField`, `routeField`, `destinationField` | Nonempty source, indirect-route and destination identities/labels |
| `categoryField` | One declared category ID |
| `amountField` | Nonnegative finite input amount, or null/missing |
| `eligibleField` | Boolean direct-route eligibility |
| `baselineShareField` | Measured baseline routing share, 0–1; zero for ineligible paths |
| `directLossField`, `indirectLossField` | Explicit loss coefficients, 0–1, or null/missing |

Author `categories: [{id,label}]`, `presets: [{id,label,share}]`, `unit`,
`outcomeLabel`, `outcomeUnit`, `outcomeExpression`, and
`state: {share: 0.25, categories: ["ambient","chilled"]}`. Optional
`directLabel` and `lossLabel` rename the two structural nodes. Indirect route
names cannot equal the direct label, and destination ID `__loss` is reserved.
`expressionFields` lists additional producer fields used by the expression so
report projection requests them.

For each eligible row, the scenario share allocates the input between direct
and indirect paths. Ineligible rows remain entirely indirect. Each branch's
loss is its allocated amount multiplied by its declared coefficient; delivered
amount is input minus both losses. Thus direct plus indirect equals input and
delivered plus loss equals input, without negative allocations. A zero branch
has zero loss even if its unused coefficient is missing. Unknown nonzero branch
loss stays unknown; unknown totals and shares are never presented as zero.

The existing report calculated-field evaluator executes `outcomeExpression`.
It receives producer fields plus `scenarioAmount`, `scenarioShare`,
`scenarioDirect`, `scenarioIndirect`, `scenarioLoss`, `scenarioDelivered`.
For example, `scenarioDelivered * valuePerCrate` uses a producer-owned value
coefficient. These scenario names are reserved computed inputs. Outcome must be
nonnegative and finite or null. The same expression is evaluated at each row's
baseline share. Labels distinguish measured input from modeled baseline delivery
and modeled outcome; the scenario delta is a projection, not observed uplift.

The slider previews continuously; pointer release, keyboard key-up or blur
commits once through the host callback. Drafts explicitly say they are not yet
exported. Presets and category buttons commit directly. An empty category
selection is an empty scenario, with zero totals and undefined shares.
Hover/focus emphasizes the full source-to-route-to-destination path, including
loss. The destination table reports delivered amount, share, direct share and
outcome. Stable IDs identify traces independently of filtering.

## Stage allocation

Use `chartSpec.type: "stage-allocation"` and `chartSpec.stageAllocation` (or
`chart.stageAllocation`). Required properties:

| Property | Meaning |
| --- | --- |
| `periodField`, `stageField`, `categoryField` | Source coordinate fields |
| `periods`, `stages`, `categories` | Ordered arrays of `{id,label}`; category may have `inactive:true` |
| `metrics` | Additive `{id,label,field,unit,additionField?}` or explicit ratio definitions |
| `baselinePeriod` | Declared baseline period ID |
| `state` | `{period,metric,activeCategories:[]}` |

Exactly one source row may occupy each period/stage/category coordinate.
Duplicates or undeclared coordinates fail. Category identity and order come
from metadata and remain stable across periods, including missing coordinates.
Additive metrics retain the existing `{id,label,field,unit,additionField?}` contract;
optional `type: "additive"` makes it explicit. Inputs are nonnegative finite
quantities or null/missing. A ratio metric instead declares:

```json
{"id":"efficiency","label":"Efficiency","type":"ratio",
 "numeratorField":"value","denominatorField":"energy",
 "additionNumeratorField":"addedValue","additionDenominatorField":"addedEnergy",
 "unit":"credits/MWh"}
```

The existing calculated-field evaluator divides each category's numerator by its
denominator. Stage and grand totals divide the **sum of numerators by the sum of
denominators**, never sum or take an unweighted average of category ratios. A zero
or missing denominator yields null, including for an inactive category with zero
inputs; it is not coerced to zero efficiency. Unknown constituents propagate to
pooled totals. Baseline ratios use baseline inputs only. Projected ratios add the
explicit numerator and denominator additions before division; missing additions
remain unknown. Ratio change is the projected ratio minus the measured/baseline
ratio, not a sum of per-category ratio changes.

When sizing blocks by a ratio, finite category ratios are normalized to their own
sum for visual comparison. The graphic explicitly calls this relative ratio size;
it is not a contribution share of the weighted total. Undefined ratios have no
width, with their label/value retained in the stage legend. Metric selection
changes these widths; period selection changes observations. The neutral example
includes additive energy/value and ratio efficiency with unequal input weights.

An inactive category has measured zero allocation. Its additive `additionField`, or ratio `additionNumeratorField` and `additionDenominatorField`, values
are authored hypothetical inputs, not inferred growth rates. Activating it
adds those quantities to the selected period's measurements for every metric;
removing it restores measurements. Additions are optional per metric: activating
a category whose addition is unknown leaves that metric unknown. Baseline values
never receive hypothetical additions. Projected totals, incremental quantities,
and baseline changes are labeled separately. Unknown coordinates stay unknown;
zero allocations have zero width. Inactive categories have dashed simulation
controls and explicit zero-width labels, without invented visual area. An ordered label/value legend is part of every stage graphic, including print; narrow positive blocks use matching ordinal markers instead of dropping labels. Category
buttons and hover/focus emphasize the same category across stages.

There is no automatic replay or animation; reduced-motion users receive the same
static transitions. The two primitives share formatting, binding and print helpers,
not a combined dashboard contract or another calculation engine.

## Scope binding and frozen output

For either configuration, `stateBindings` maps state keys to
`{paramId,path}`. `paramId` names an ordinary report `scope.params` entry;
`path` is its completed dataset request-filter path. Use number for `share`,
single-select for `period`/`metric`, and multiple-select for categories/additions.
Declare ordinary `filterBindings` on each scope parameter. Values in completed
request filters override the authored state defaults.

The renderer calls the existing scope handlers, retaining their validation,
required-value rules, datasource lifecycle, loading/error visibility and request
ownership. Array controls toggle one declared option per action. Underlying
producer facts can remain unchanged: the local model recomputes from them and
the completed scenario inputs. Slider pointer ticks do not issue producer requests.
A direct Chart accepts `onScenarioStateChange(key,value)`; its host must update
`container.requestFilters` and use the same filters when creating print payloads.
Each control is editable only when its own scope binding and mutation handler are available, including controls whose state was omitted and defaulted. Unbound controls are disabled with a visible, linked accessible explanation; bound controls remain usable. A direct Chart callback may expose `canChange(key)` for the same per-control availability contract. Without a mutation handler, scenario controls are read-only.

Canonical fill stores original rows and a detached `scenarioState` snapshot in
`resolvedChart`, whose `kind` equals its independent chart type. Canonical print
rebuilds from that snapshot, never from live DOM or hidden local state. It uses
the same SVG marks and current scenario labels, without controls, focus targets
or animation. Print paginates complete destination-flow groups or stages, with explicit subset labels and unchanged global headline totals and share denominators. Evidence pages retain all category/destination metrics, including zero-width blocks. A page too short for one complete unit reports a layout diagnostic rather than clipping marks. Raw CSV/table views
retain producer evidence; projected values are represented in the scenario view
and frozen print rather than silently overwriting source rows.

Bounds: at most 10,000 rows, 100 entries in each metadata list, and 4,000 characters
in an authored outcome expression. Invalid numeric types, infinities, negatives,
invalid share bounds, duplicate IDs/coordinates and overflowing totals fail
explicitly. Native export deployments need the reviewed shared materializer build;
this source change does not regenerate bundles from a dirty checkout.
