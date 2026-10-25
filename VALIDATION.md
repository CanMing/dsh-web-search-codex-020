# Validation record — 0.2.1-rc.3

## Tested runtime

- DeepSeek Harness desktop: **0.2.1-rc.3**, build commit `be72761ee1a6736ebcdf4f3739363b083ae53c98`.
- Host operating system: Windows.
- Node.js: **24.21.0**, from the installed desktop's primary runtime. Build/check also ran on local Node 24.16.0.
- @deepseek-ai/cordis: 4.0.5.
- @deepseek-ai/schemastery: 3.18.5.
- @deepseek-ai/cordis-plugin-loader: 1.0.6.
- @deepseek-ai/dsh-web, dsh-app-boot and UI primitives: 0.2.1-rc.3.

## Completed checks

- Client classic ModuleLoader build and syntax/manifest checks passed.
- Automated suite: **43 passed, 0 failed, 0 skipped** on the bundled Node runtime.
- 1 build regression runs the real build script with both LF and Windows CRLF source and compares the generated factories byte for byte.
- 13 client protocol tests use browser-service/form doubles.
- 7 additional generated-client tests execute the **actual rc.3 SettingsFormModel published implementation** with real React. These cover typed batched mutations, baseline revision conflicts, accepted-reference credential writes, failed settings writes, failed credential writes with retry, and preservation of existing keys when the secret is blank.
- In Node, the primitives root import requires browser CSS/development dependencies. The form tests therefore extract its independent published settings regions verbatim. They use a small observable-store adapter plus Host-scope and credential-RPC fixtures; they do not substitute a second form algorithm. The test diagnostic explicitly reports this loading mode.
- 14 transport/source/SSE/failure tests use fixture responses, including a completed response whose connection remains open.
- 8 runtime tests use real DSH/Cordis/Loader/Schema/Web/AppBoot packages with fixture credentials and HTTP. They verify rc.3 compatibility admission without an exemption, precise peer requirements, volatile updates, provider disposal, composed bundle selection, structured source limits and caller cancellation.
- Installed desktop archive inspection confirmed that rc.3 still supplies UI primitives and slots as browser shell static modules. The plugin's required primitive exports, `plugins.item` slot, configForms and reference-credential APIs remain available.

- The `.tgz` installed successfully with scripts disabled into an isolated npm directory. Its public host entry registered the provider, its classic client factory loaded, its bundle composed with rc.3 AppBoot, and its manifest passed the actual compatibility evaluator. The isolated dependency tree contained rc.3 DSH packages and did not install UI primitives as a host peer. This is a package-install smoke check, not an end-to-end DSH plugin-manager install.

## Dependency audit

The isolated install's npm audit reports the DSH-owned `zod@4.4.3` dependency under advisory `GHSA-mrhx-c7xc-m3w5` (oversized constrained-collection validation can exhaust memory). It propagates through DSH's `dsh-llm` / `dsh-web` dependency chain. This release retains the versions supplied by the target DSH runtime; it does not override the host's dependency graph. No fix is available through this plugin's pinned DSH peers.

## Limits

The real Electron window has not been manually clicked through. The user's active desktop profile is not modified by this validation. Form implementation tests and static shell inspection do not constitute browser rendering or real slot mount/unmount acceptance tests.

Only DSH **0.2.1-rc.3** is declared supported by this release. Other versions require separate validation. The package's `engines.dsh` intentionally admits only the tested runtime.

This release's tests do not use real API keys or send paid upstream search requests. The preceding 0.2.0-rc.2 release recorded a successful real sub2api Responses search (approximately 7.45 seconds and 25 structured sources); that historical result is not claimed as a new rc.3 integration run.

GitHub Actions runs Windows/Linux compatibility checks on pushes. Local results alone do not imply a remote Actions run has passed.
