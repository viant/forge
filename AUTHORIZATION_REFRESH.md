# Canonical window delivery and display hints

A server-issued `window.selectionBinding` identifies the canonical delivery
protocol. It contains the original actor, instance ID, parameters digest and
signed token; it is provenance, never a UI data grant. The managing MCP verifies
the complete selection and authorizes every read and write.

The host checks OPEN when admitting a window and emits the binding only after
successful admission. Forge uses the accompanying authorization snapshot for
widget display. Snapshot expiry does not stop data operations or close a bound
window. Forge does not periodically call `applyPermission`, extend snapshot
expiry, mutate proofs, or retry mutations. Artifact expiry requires a distinct
server delivery before a subsequent sequence.

Unsigned windows retain their existing OPEN preflight and snapshot lifetime
behavior. Actor, selection, namespace, source and revision fences still reject
stale completions. Typed managing-MCP dataset denials clear affected data;
identity, window and artifact denials invalidate the window.

Canonical mutation validation removes only known capability, role and feature
ACL paths (`resource.capabilities`, `globalCapabilities`, `principal.roles`,
`principal.features`, and account capability/role/feature paths). Resource ID,
parent, actor, selection, authorization-version and local form checks remain.
For mixed `any` conditions, removing an ACL branch leaves the remaining local
or fidelity alternatives mandatory: a stale hint cannot bypass local validation.
`all` and `not` retain the remaining authored conditions and their polarity.
Visibility and disabled-control hints still affect widget display. Unsigned
command validation retains its existing behavior; authored YAML is unchanged.
