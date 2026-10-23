# Published artifact cohorts

## Revision selection

Artifacts are retained by logical URI and immutable version. Each cohort has
one root per logical URI; different cohorts can select different versions of
the same URI. `Publisher.Get` fetches exact retained bytes, and partition/cache
keys preserve both versions instead of collapsing them by URI.

`ReplaceCatalog` interprets `RootRef.Version > 0` as an exact pin (and checks a
supplied hash). Version zero means follow the latest published version. Returned
manifests contain resolved versions plus `Cohort.FollowPublished`, the URI list
that preserves follow behavior when replacing a snapshot. Remove a URI from
that list and supply an exact version to pin it. Publishing a newer version
advances only following assignments; it never changes an explicit pin. Loading
an older immutable version does not move the latest pointer backward.

For example, a stable cohort can select `{URI: "window://studio/connectors",
Kind: "window", Version: 3}` while a preview cohort selects version 4. No query
suffix is added to existing navigation URIs. Partition hashes include the
cohort-to-revision mapping, so swapping assignments updates the local index even
when all artifact bytes are already cached.

If one session is admitted to both cohorts and their revisions differ, configure
the trusted `Config.Cohort(ctx)` selector to choose its active bundle. Selection
must name an already-admitted cohort and grants no additional access. Without a
selector, ordinary same-version unions still work; conflicting versions return
`ErrConflict` from `Open`/`PermittedRoots` rather than picking an arbitrary one.
This remains a local lookup with no added MCP calls.

## Registration and synchronization

This package is an opt-in host/producer contract over an already authenticated MCP connection. A producer validates the complete top-level artifact at publication, including every declared private dependency, before `Publisher.Publish` activates the immutable version. A published window contains its selected datasource/dialog/CSS definitions in its schema 2 closure. Dependencies do not gain public versions or separate access grants. Window, skill, intent, agent, report, prompt, eval, navigation, toolfeed, and feed roots follow the same top-level rule. This production contract supersedes the exploratory signed PoC under Agently Core's performance output; it adds no new signature or event-sequence protocol.

Minimal trusted Go registration:

```go
replica, err := artifactcohort.NewReplica(artifactcohort.Config{
    Enabled:       true,
    Source:        "studio-management", // configured MCP provider identity
    Tenant:        tenant,
    Account:       account,
    Caller:        artifactcohort.MCPCaller{Client: trustedMCP},
    Facts:         verifiedFactsProvider,
    SessionKey:    existingAuthSessionKey,
    Store:         compressedArtifactCache, // optional scache + immutable backing
    ManifestStore: scopedManifestFile,       // optional, source/tenant/account scoped
})
if err != nil { return err }
if err := replica.Sync(ctx); err != nil { return err } // before serving users
```

`ManifestStore` is a persisted index hint only. A fresh process sends its saved content hash to the authenticated producer; it builds no policy store or admission until that hash is confirmed or a full current manifest is received. When `Store` is configured, Sync retains refs only and checks `Store.Has` without hydration. Open loads selected bytes lazily from the bounded scache/compressed backing, then rechecks local admission and active partition state before release. The in-memory-only configuration retains payload pointers and needs no cache adapter.

The producer exposes `artifact/discover` and `artifact/fetch`. `MCPCaller` consumes their **text** content, preserving exact published JSON bytes for content-hash verification. Decoded `structuredContent` maps are unsuitable because number precision, field order, and escaping may change. `Publisher.Publish` normalizes RawMessage JSON once before hashing; later opens do not revalidate the graph. On reconnect, `artifact/discover` accepts `knownHash`; an identical current content hash yields only `{"unchanged":true,"hash":"..."}`. The internal publication generation is excluded from content identity, so a repeated equivalent catalog publication does not force an index transfer.

Configure one `Replica` for each trusted MCP source, tenant, and account. The configured MCP client uses host service credentials; browser values never select it. `Replica.Sync` downloads the complete manifest and only missing/changed root bytes, with at most four concurrent fetches. A second sync with matching hashes transfers no artifact bytes. Changed namespace×kind partitions stage and activate independently, so an unavailable `sales|intent` does not block `sales|window` or `ops|intent`. Policy changes have namespace-scoped policy partitions and invalidate affected admissions without downloading unchanged content. Full snapshots remove omitted roots. `MarkUpdated` and `HandleNotification` consume standard MCP `resources/updated` and `resources/list_changed` hints; after disconnect, reconcile before serving cached roots.

The URI namespace is the **logical artifact** namespace. It is not a selected Datly data namespace or database namespace ID. The producer adapter binds its own trusted storage namespace/account. `Source`, `Tenant`, and `Account` are separate Replica scope keys, so identical artifact aliases from different providers or accounts never share admissions or cache entries.

`Replica.Admit` uses the host's verified `authz.Provider` facts and actual `authz.Service.AuthorizeWithRevision` once for a session/policy generation. `EnsureAdmitted` checks the local admission first and evaluates policy only for a new session or changed cohort policy. `Open` checks only current admission, cohort policy hash, and active partition pointer. It makes no MCP calls or policy evaluations. The surrounding application must preserve its existing authentication middleware. Execution of a datasource retains the existing backend authorization path. `ETag` identifies content only; any HTTP 304 decision must follow current admission and use private/no-cache headers.

For push freshness, construct `NewNotificationHandler(ctx, existingClientHandler)` before constructing the MCP client and pass it as that client's inbound protocol handler. After constructing the Replica with `MCPCaller{Client: client}`, call `AttachReplica(replica)`. The handler marks a notified root partition stale synchronously but performs MCP `Sync` only on a bounded/coalesced background worker, avoiding a transport-reader deadlock. Canceling its context or calling `Close` invalidates the local replica until reconnect reconciliation. A producer emits `resources/updated(uri)` for root-only publication and `resources/list_changed` for policy/cohort index replacement.

Notification delivery depends on MCP transport: the current viant/mcp latest-protocol HTTP path is stateless and cannot push resource notifications. Choose a stateful legacy-protocol session for push, or explicitly reconcile on the stateless path. The package does not silently treat an absent notification stream as freshness proof.
