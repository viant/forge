# Public framework repository

## Capability reuse and explicit user approval

- Before adding any feature or mechanism, inspect the owning framework's existing APIs, configuration, documentation, implementation, tests, and callers at the exact version used by the application. Prove the relevant native behavior with an executable example before proposing an alternative.
- Trace the existing path across layers and identify its owner. Reuse that path; remove demonstrated duplication instead of adding parallel wrappers, adapters, fallback paths, caches, validation, permission checks, or configuration switches.
- Before implementing a new feature or framework extension, consult the user with the existing options, evidence of the remaining gap, the smallest proposed change and owning layer, and compatibility implications. Obtain explicit approval of that approach first. A request to fix a regression is not approval to invent a new mechanism. Agent or reviewer recommendations do not substitute for user approval.
- Keep validation, strict/lenient argument handling, authorization and contract enforcement in the framework or producer that already owns them. Do not silently replace native lenient behavior with stricter application, host, proxy or UI rejection.
- Passing tests does not justify a redundant feature. Preserve existing contracts and add regressions through the real native path. Do not introduce a new API, flag, gate, compatibility layer or workaround solely to make a test pass.
- Carry these requirements into delegated work. When the user has already approved the exact approach, continue within that authorization; ask again only if the proposed approach or scope changes.

- Keep implementation and fixtures domain-neutral and reusable without private applications.
- Never commit internal application captures, production/customer data, private hosts, credentials, personal workstation paths, or private-repository source dependencies.
- Author minimal synthetic fixtures independently. Document their provenance and preserve generic regression coverage when replacing an integration capture.
- Store authorized private backups outside this repository. Coordinate scoped repair of already-public sensitive history with maintainers; never push backup refs, rewrite unrelated refs, or change the bytes of existing published module versions.
- Audit sensitive history using local Git objects. Do not request removed revisions from third-party mirrors or archive services: those requests can replicate the content.
- Keep generated captures, build outputs, and test executables untracked.

# Design-system contributor entry point

Before changing UI or its theme contract, read [the canonical usage guide](doc/typography.md).
Reuse the documented shared components and semantic roles. Extend the owning
shared component with its usage example, states and existing checks when a
reusable capability is missing. Record remaining legacy scope in the change.

- Render declared producer metadata without application-specific tool names, business-field fallbacks, or domain-driven filtering/formatting rules. Business schemas and validation remain with data producers.
