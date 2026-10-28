# Report tab timing

Open a host with `?diagnostics=timing` to enable the shared Timing diagnostics
collector, then click report section tabs. The panel's `reportTabSwitches` shows
`clickToContentDOMMs`, `clickToContentFrameMs`, and `outcome` for each switch.
The frame measurement uses two animation-frame callbacks after the selected
section commits its content. It is a display scheduling proxy, not GPU paint.

Pending sections remain pending until their content commits. An error or a
superseding click cannot produce a successful frame measurement for that switch.
The collector retains numeric operation IDs, durations, and outcomes. It does
not retain section captions, input values, or report rows. Normal URLs install
no timing collector. Existing host route and Server-Timing configuration remains
in the host adapter.

The shared runtime exposes DOM section markers for this observer. Regression
checks cover ready, pending, errored, and superseded sections, two-frame timing,
and omission of report content from collected events.
