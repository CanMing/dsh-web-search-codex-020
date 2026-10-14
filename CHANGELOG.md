# Release 0.2.0-rc.2

Initial independent adaptation for DeepSeek Harness desktop 0.2.0-rc.2.

- Pin DSH peer packages to the tested 0.2.0-rc.2 runtime.
- Use volatile Config fields and per-operation DSH credential resolution.
- Add an installable DSH bundle selecting `codex-local`.
- Add a Chinese desktop settings card with staged configuration and credential-only API Key storage.
- Build the client into the classic ModuleLoader format required by this DSH version.
- Send the gateway-tested Responses request form: array input, forced native search, complete source inclusion, no storage, and SSE by default.
- Merge native search sources and answer URL citations.
- Reject incomplete streams, ordinary answers without native search, and failed responses.
- Add timeouts and cancellation; stop after response.completed without waiting for the upstream connection to close.
- Include 33 passing automated tests and a successful real Responses gateway search.

See VALIDATION.md for evidence and limits. No npm registry publication is implied by this GitHub release.
