# Cached report metadata and new actions

The shared stored-report runtime requests fresh metadata before a new Run,
Print or Export when its cached `validUntil` has sixty seconds or less remaining.
This is a cache freshness budget. It does not evaluate permissions, compensate
for clock skew, extend a deadline locally, or retry an already dispatched tool.
Notification-bound metadata with an omitted or zero expiry keeps its existing
behavior.

The existing `reporting:get_report` request supports `refreshMetadata: true`:

```json
{
  "resource": {"uri": "report://example/sample", "revision": "working"},
  "resolvedResource": {
    "providerIdentity": "sample-owner",
    "uri": "report://example/sample",
    "kind": "working",
    "contentFingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "authorityBinding": "sample-binding",
    "validUntil": "2026-01-01T00:00:00Z"
  },
  "refreshMetadata": true
}
```

The example is synthetic. The trusted reader uses the bookmark's original provider
and selector to request a new managing-producer selection under the current
actor. The old deadline does not authorize this request. The response replaces
the definition-cache entry and matching selector aliases for future reads. The
owner's namespace metadata is refreshed too, so a new action does not inherit
an older cached namespace deadline. Declared resource-backed datasource metadata
is refreshed through the existing dependency resolver, with one namespace refresh
per contributing owner. The new report metadata deadline is capped by those new
child grants. Existing executions retain their detached original pins and deadlines. The
fresh-selection path refuses use inside a resource sequence already holding an
admitted report or data dispatch; ordinary pinned readers keep their existing
lease caps.

The browser compares provider, URI, lifecycle, revision, content fingerprint and
authority binding before starting exactly one action with the new pin. Changed
metadata asks the user to refresh or reopen the report. A response still within
the freshness budget also asks for a refresh; it causes no second metadata read
or tool replay. The UI displays “Refreshing report details” while waiting.
Parameters, selected table and chart choices belong to the captured action and
remain intact. Print validates its response against the new action pin.

`reportResourceFreshness.test.js` and the stored-runtime component tests cover
fresh, expired and near-expiry metadata, identity drift, pending StrictMode
sharing, cancellation and no replay. Client-pool/resource-host tests cover cache
replacement, alias reuse, invalidation fences, current actor checks and preserved
original deadlines. Core reporting tests cover the optional request field and
fresh-reader dispatch.
