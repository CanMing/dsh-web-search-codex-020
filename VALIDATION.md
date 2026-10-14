# Validation record

## Tested runtime

- DeepSeek Harness desktop: 0.2.0-rc.2
- Node.js: 24.21.0 (bundled desktop runtime)
- @deepseek-ai/cordis: 4.0.4
- @deepseek-ai/schemastery: 3.18.4
- @deepseek-ai/cordis-plugin-loader: 1.0.5
- @deepseek-ai/dsh-web: 0.2.0-rc.2
- Host operating system: Windows

## Completed checks

- Classic ModuleLoader client build and JavaScript syntax/manifest checks passed.
- Automated suite: **33 passed, 0 failed, 0 skipped**.
- 13 client protocol tests use mocked browser services and form primitives.
- 14 transport/source/SSE/failure tests use fixture responses, including a completed response whose connection remains open.
- 6 runtime tests use the actual DSH/Cordis/Loader/Schema/Web packages, with only credentials and HTTP replaced by test fixtures.
- The client controller was additionally exercised with the actual DSH SettingsFormModel in five staged-save scenarios during development.
- The declared DSH 0.2.0-rc.2 package versions were confirmed available from public npm.
- A separate integration call executed this plugin's real Responses transport against a user-provided sub2api gateway: completed successfully in approximately **7.45 seconds**, produced an answer and **25 structured source URLs**, including the expected official source. No gateway address, credentials, or user account identifiers are included in this repository.
- Release packaging scans project source against the user's actual provided credentials and rejects accidental inclusion. Runtime dependencies and local integration scripts are excluded from release assets.

## Limits

The real Electron window has not been manually clicked through, and the plugin has not been installed into the user's active desktop profile as part of these checks. Client protocol tests and classic module validation establish the expected integration format, but are not a browser rendering acceptance test.

Only DSH 0.2.0-rc.2 is declared supported. Gateway success proves the tested model/account route, not every model or proxy configuration. Provider tokens and search requests may be billed by the configured upstream.

GitHub Actions is supplied for future Windows/Linux verification; a local passing suite does not imply that a remote Actions run has already passed.
