# Public framework repository

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
