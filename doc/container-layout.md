# Web container sizing and scrolling

The host bounds the viewport. WindowManager owns its direct panel geometry;
WindowLayout chooses the window scroll viewport. Metadata can declare
`sizingMode: fill` or `sizingMode: content` on a container. Workspace CSS themes
appearance and must not change this allocation.

| Boundary | Sizing | Scroll responsibility |
| --- | --- | --- |
| WindowManager direct panel | Remaining space below window tabs | Hidden; delegates to WindowLayout |
| WindowLayout with root scrolling | Bounded viewport | Auto; passes content allocation and parent scrolling to root |
| WindowLayout with fill content | Remaining host space | Hidden; delegates to the bounded content |
| FormPanel active panel | Remaining space below its tab rail | Auto; retained inactive panels have no layout box |
| Section tabs | Content by default; `tabs.fill: true` opts into allocation | Content sections use parent scrolling; fill panels scroll |
| Container with `scrollMode: self` | Allocated mode or explicit authored dimensions | Outermost container boundary only |
| Card/section bodies | Follow container allocation | Visible; never duplicate outer self-scrolling |

Parent allocation is used when `sizingMode` is absent. The compatibility default
at standalone Container entry points remains fill. Content-sized section tabs
pass content allocation explicitly. In a vertical fill stack, the last child
receives remaining space; preceding children fit content. In a horizontal fill
stack, children share space. Explicit child sizing overrides allocation.

`style.height`, `minHeight`, and `maxHeight` remain deliberate metadata sizing
constraints. They apply once at the outer container boundary, not to every
nested card/section body. Splitter cells retain their bounded sizing contract.
Fill requires an ancestor that actually allocates space; it does not mean
100% height plus the size of sibling headers and toolbars.

Supported layout diagnostics include `data-forge-sizing` and
`data-forge-scroll` on the container body, and the owned
`forge-window-manager-tabs__panel` / `forge-form-panel-tabs__panel` classes.
Themes may use the classes for appearance; geometry belongs to Forge.

Regression commands:

```sh
node --no-warnings src/components/containerSizing.test.js
node scripts/test-tab-layout.mjs
go test ./backend/types
```

The browser regression checks nested real Blueprint panels, short/long content,
inactive mounted panels, and content/fill container geometry at desktop and
mobile widths. It explicitly checks the nested panel's computed overflow so a
residual outer Blueprint descendant rule cannot silently pass again.

Still to validate: the user's exact mismatching advertiser tab pair. Existing
workspace CSS and per-tab metadata minimum heights can independently alter the
screen and are not removed by this framework change. Window control hit areas
and focus treatment are a separate follow-up.

Table width: `table.fullWidth: false` (or omitted) now sizes the entire table
surface to the declared visible-column sum, including selection columns and the
surface border, capped at available parent width. Explicit `table.width` wins;
`fullWidth: true` fills. The calculation does not feed the current observed
width back into the preferred width. Wide columns scroll within that surface.
Non-paged loaded tables show an accurate record-count footer without page buttons.

Latest table layout policy supersedes the footer/strict-default descriptions
above: omit `table.fullWidth` for adaptive sizing. When declared visible columns
occupy less than 50% of the independently measured parent, keep intrinsic width;
at 50% or more, fill the parent. Explicit false remains strict intrinsic, true
forces fill, and explicit table.width wins. Oversized columns scroll locally.

The shared toolbar is Actions LEFT, pagination/status CENTER, controls RIGHT.
Legacy footer pagination is normalized into that one center slot; nonpaged tables
show accurate record status. There is no separate pagination footer or column
arrow cluster. The focusable data viewport uses native horizontal scrolling.
Headers stay one line with ellipsis, full title text and accessible sortable
buttons; authored column widths still determine allocation.


Exploratory trailing-space width: `table.fillRemainingWidth: true` makes the
surface fill available width while keeping real columns at declared sizes.
An empty aria-hidden trailing header/cell absorbs spare width, without joining
metadata columns, exports, sort/filter options, selection, or record counts.
Wide tables have zero filler and retain local scrolling. Preview Table width
allows this trial independently of row slots; Adaptive restores authored defaults.

Latest quiet navigation policy: no visible standalone record count and no
parenthesized count in page status. Pagination appears in the toolbar center only
when previous or next navigation is actually possible. A first/only page leaves
the center empty. Data counts remain unchanged internally.
