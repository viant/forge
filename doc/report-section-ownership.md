# One section model for screen and print

An exclusive report tab group (`includeUnlistedSections: false`) uses each
section's explicit `blockIds` as membership. The report layout controls order
within that membership; placing a KPI before its section heading in the flat
layout does not remove the KPI from its section.

`src/reporting/reportSections.js` is the shared pure model used by ReportRuntime
and ReportPrint. The previous dashboard import remains as a compatibility
re-export. Legacy sections without explicit membership keep position-based
inference. Unlisted blocks remain excluded, and hidden/composite child blocks
are not emitted twice.

A regression fixture deliberately places a KPI before its section heading.
It verifies the KPI belongs to the screen section, prints after the heading,
retains its sparkline, and excludes an unlisted narrative. Captured staged Geo
and Creatives results also demonstrate the repaired ownership without changing
their data or scope. Browser visual acceptance remains separate.
