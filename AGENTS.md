# Public framework repository

- Keep implementation and fixtures domain-neutral and reusable without private applications.
- Never commit internal application captures, production/customer data, private hosts, credentials, personal workstation paths, or private-repository source dependencies.
- Author minimal synthetic fixtures independently. Document their provenance and preserve generic regression coverage when replacing an integration capture.
- Store any authorized private backup outside this repository. Do not rewrite already-public history as part of cleanup.
- Keep generated captures, build outputs, and test executables untracked.
