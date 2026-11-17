# List page composition

Use `ListPagePattern` from `forge/patterns` to compose a title, optional period control, existing toolbar, native table and summary. The composition owns geometry only. Datasource access, row identity, filtering, sorting, permissions and actions retain their existing owners.

Native Basic and ResponsiveDataGrid tables adopt it through `table.presentation: list-page` when Design System 2.0 is selected. Other themes keep their prior table layout. Existing toolbar metadata can mark date controls with `placement: header`, quick search with `appearance: field`, and an existing two-choice select with `appearance: starred-toggle`. The existing select value and handler remain authoritative.

Customize and Filter use the existing native right-hand Drawer at 360px. Header and footer remain fixed while the body scrolls. Cancel discards pending choices; Apply uses the existing table callbacks. Date preset panels match their trigger width and keep civil date values unchanged. The workspace supplies colors, typography and spacing through its existing semantic style resource.

Pointer activation has no outer focus ring or glow. Keyboard focus uses the shared semantic indicator inside the existing border, including owned portals and nested menus. Open ghost dropdowns retain selection through native expanded state until dismissed. Menus have a subtle semantic border, no shadow, and committed selection colors without decorative checkmarks. These rules apply to future DS2 compositions; other profiles retain their appearance.

The mounted native table regression verifies opt-in theme gating, header period, existing select bindings and drawer reuse using independently authored synthetic data.
