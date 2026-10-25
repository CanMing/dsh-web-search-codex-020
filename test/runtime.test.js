import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { Context, resolveConfig } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import { composeEntries, evaluatePluginCompatibility, getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot';
import { load as loadYaml } from 'js-yaml';
import * as plugin from '../lib/index.js';

// These imports intentionally resolve through the project's actual node_modules.
// No Cordis, Loader, schema, or web registry implementation is mocked.
const require = createRequire(import.meta.url);
const projectURL = new URL('../', import.meta.url);
const fields = [
  'apiKeyEnv', 'baseURL', 'model', 'searchContextSize', 'stream',
  'maxOutputTokens', 'reasoningEffort', 'timeoutMs',
];
const initialConfig = {
  apiKeyEnv: 'DSH_CODEX_RUNTIME_TEST_KEY_A',
  baseURL: 'https://first.invalid/v1',
  model: 'runtime-test-model-a',
  searchContextSize: 'medium',
  stream: false,
  maxOutputTokens: 1024,
  reasoningEffort: 'low',
  timeoutMs: 5000,
};

function completedResponse(text = 'Runtime search answer') {
  return {
    id: 'resp_runtime_test',
    object: 'response',
    status: 'completed',
    output: [
      {
        id: 'ws_runtime_test',
        type: 'web_search_call',
        status: 'completed',
        action: {
          type: 'search',
          query: 'runtime test',
          sources: [{ url: 'https://example.invalid/runtime', title: 'Runtime source' }],
        },
      },
      {
        id: 'msg_runtime_test',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    ],
  };
}

function stubFetch(t, responses = [completedResponse()]) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    assert.match(url, /^https:\/\/(?:first|second)\.invalid\/v1\/responses$/,
      'All network access must use a fixture URL intercepted by this stub');
    const body = JSON.parse(init.body);
    const fixture = responses[Math.min(calls.length, responses.length - 1)];
    calls.push({ url, body, headers: new Headers(init.headers), signal: init.signal });
    if (!body.stream) {
      return new Response(JSON.stringify(fixture), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    const events = [
      { type: 'response.created', response: { id: fixture.id, status: 'in_progress', output: [] } },
      { type: 'response.output_item.done', output_index: 0, item: fixture.output[0] },
      { type: 'response.completed', response: fixture },
    ];
    return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {
      status: 200, headers: { 'content-type': 'text/event-stream' },
    });
  });
  return calls;
}

async function createRuntime(t, webConfig = { searchProvider: 'codex-local' }) {
  const ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); });
  const resolvedRefs = [];
  const keys = new Map([
    [initialConfig.apiKeyEnv, 'fixture-key-a'],
    ['DSH_CODEX_RUNTIME_TEST_KEY_B', 'fixture-key-b'],
  ]);
  // Root-owned seam stub: never instantiate credentials-local or consult env secrets.
  ctx.provide('credentials', {
    async resolve(ref) {
      resolvedRefs.push(ref);
      const value = keys.get(ref);
      return value === undefined ? undefined : { value, source: 'runtime-test' };
    },
  });
  await ctx.plugin(Loader, { baseUrl: projectURL.href });
  const loader = ctx.get('loader');
  await loader.create({ id: 'web', name: '@deepseek-ai/dsh-web', config: webConfig });
  await loader.await();
  await loader.resolve('web').fiber.await();
  const web = ctx.get('web');
  assert.ok(web, 'Real WebRuntime must have started');
  return { ctx, loader, web, resolvedRefs, keys };
}

async function loadProvider(runtime, config = initialConfig, id = 'web-search-codex') {
  await runtime.loader.create({ id, name: './lib/index.js', config: { ...config } });
  await runtime.loader.await();
  const entry = runtime.loader.resolve(id);
  assert.ok(entry.fiber, 'Loader must have imported the plugin entry');
  await entry.fiber.await();
  assert.equal(entry.fiber.state, 2, 'Provider plugin must be active, not pending or failed');
  return entry;
}

test('uses the actual DSH 0.2.1-rc.3 runtime package versions', async () => {
  const expected = {
    '@deepseek-ai/cordis': '4.0.5',
    '@deepseek-ai/schemastery': '3.18.5',
    '@deepseek-ai/dsh-web': '0.2.1-rc.3',
    '@deepseek-ai/cordis-plugin-loader': '1.0.6',
  };
  for (const [name, version] of Object.entries(expected)) {
    const actual = JSON.parse(await readFile(require.resolve(`${name}/package.json`), 'utf8'));
    assert.equal(actual.version, version, `${name} runtime version`);
  }
});

test('published manifest passes the rc.3 compatibility gate without an exemption', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(getDshRuntimeVersion(), '0.2.1-rc.3');
  assert.equal(manifest.engines.dsh, '0.2.1-rc.3');
  assert.equal(evaluatePluginCompatibility(manifest), undefined);
  const { dsh, ...otherEngines } = manifest.engines;
  assert.equal(evaluatePluginCompatibility({ ...manifest, engines: otherEngines }), undefined,
    'Host peers must also satisfy rc.3; engines.dsh must not hide old dependencies');
  assert.equal(manifest.peerDependencies['@deepseek-ai/dsh-client-ui-primitives'], undefined,
    'UI primitives are supplied by shell seeds, not the host package resolver');
  assert.equal(manifest.devDependencies['@deepseek-ai/dsh-client-ui-primitives'], '0.2.1-rc.3');
  for (const runtimeVersion of ['0.2.0-rc.2', '0.2.1-rc.2', '0.2.1', '0.3.0']) {
    const issue = evaluatePluginCompatibility(manifest, {}, runtimeVersion);
    assert.deepEqual(issue.requirements, { 'engines.dsh': '0.2.1-rc.3' });
    assert.equal(issue.exempted, false, 'Untested runtimes must not be silently accepted');
  }
});

test('real Schemastery Config supplies volatile get() references and defaults', () => {
  assert.equal(plugin.name, 'web-search-codex');
  assert.deepEqual(plugin.inject, ['web']);
  const config = resolveConfig(plugin, { ...initialConfig });
  for (const field of fields) {
    assert.equal(typeof config[field]?.get, 'function', `${field} must be a volatile reference`);
    assert.equal(config[field].get(), initialConfig[field]);
  }
  const defaults = resolveConfig(plugin, {});
  assert.equal(defaults.apiKeyEnv.get(), 'CODEX_SEARCH_API_KEY');
  assert.equal(defaults.stream.get(), true);
  assert.equal(defaults.searchContextSize.get(), 'medium');
  assert.equal(defaults.maxOutputTokens.get(), 4096);
  assert.equal(defaults.reasoningEffort.get(), 'low');
  assert.equal(defaults.timeoutMs.get(), 90000);
});

test('real Loader registers once, resolves credentials per search, and dispose unregisters', async t => {
  const calls = stubFetch(t);
  const runtime = await createRuntime(t);
  const registrations = t.mock.method(runtime.web, 'registerSearchProvider');
  const entry = await loadProvider(runtime);
  assert.equal(registrations.mock.callCount(), 1);
  assert.equal(runtime.web.searchProviders.size, 1);
  assert.equal(runtime.web.searchProviders.get('codex-local').id, 'codex-local');

  const result = await runtime.web.search({ query: 'runtime test', maxResults: 3 });
  assert.equal(runtime.web.searchProviders.get('codex-local').id, 'codex-local');
  assert.equal(result.content, 'Runtime search answer');
  assert.deepEqual(result.sources, [{ url: 'https://example.invalid/runtime', title: 'Runtime source' }]);
  assert.equal(calls[0].url, 'https://first.invalid/v1/responses');
  assert.equal(calls[0].body.model, initialConfig.model);
  assert.equal(calls[0].headers.get('authorization'), 'Bearer fixture-key-a');
  assert.ok(runtime.resolvedRefs.includes(initialConfig.apiKeyEnv));

  runtime.keys.set(initialConfig.apiKeyEnv, 'fixture-key-rotated');
  const previousResolutions = runtime.resolvedRefs.length;
  await runtime.web.search({ query: 'rotated credential' });
  assert.ok(runtime.resolvedRefs.length > previousResolutions);
  assert.equal(calls[1].headers.get('authorization'), 'Bearer fixture-key-rotated');
  assert.equal(registrations.mock.callCount(), 1, 'Credential rotation must not reload the provider');

  await entry.fiber.dispose();
  assert.equal(runtime.web.searchProviders.has('codex-local'), false);
  await assert.rejects(runtime.web.search({ query: 'after disposal' }), {
    code: 'WEB_PROVIDER_CONFIGURED_MISSING',
  });
  assert.equal(calls.length, 2, 'Disposed provider cannot issue another request');
});

test('Loader volatile update keeps references and provider identity while next search uses new config and SSE', async t => {
  const calls = stubFetch(t, [completedResponse('JSON answer'), completedResponse('SSE answer')]);
  const runtime = await createRuntime(t);
  const registrations = t.mock.method(runtime.web, 'registerSearchProvider');
  const entry = await loadProvider(runtime);
  const fiber = entry.fiber;
  const config = fiber.config;
  const refs = Object.fromEntries(fields.map(field => [field, config[field]]));
  const provider = runtime.web.searchProviders.get('codex-local');
  await runtime.web.search({ query: 'before dynamic update' });

  const next = {
    apiKeyEnv: 'DSH_CODEX_RUNTIME_TEST_KEY_B',
    baseURL: 'https://second.invalid/v1',
    model: 'runtime-test-model-b',
    searchContextSize: 'high',
    stream: true,
    maxOutputTokens: 2048,
    reasoningEffort: 'high',
    timeoutMs: 7000,
  };
  const volatileEvents = [];
  fiber.ctx.on('loader/volatile-update', paths => volatileEvents.push(paths));
  await runtime.loader.update(entry.id, { config: next });
  await runtime.loader.await();
  await fiber.await();
  assert.equal(entry.fiber, fiber);
  assert.equal(fiber.config, config);
  assert.equal(runtime.web.searchProviders.get('codex-local'), provider);
  assert.equal(registrations.mock.callCount(), 1, 'Volatile update must not register again');
  for (const field of fields) {
    assert.equal(fiber.config[field], refs[field], `${field} reference must retain identity`);
    assert.equal(refs[field].get(), next[field], `${field} must expose the updated value`);
  }
  assert.equal(volatileEvents.length, 1);
  assert.deepEqual(volatileEvents[0].map(path => path.join('.')).sort(), [...fields].sort());

  const result = await runtime.web.search({ query: 'after dynamic update' });
  assert.equal(result.content, 'SSE answer');
  assert.equal(runtime.web.searchProviders.get('codex-local').id, 'codex-local');
  assert.equal(calls[1].url, 'https://second.invalid/v1/responses');
  assert.equal(calls[1].headers.get('authorization'), 'Bearer fixture-key-b');
  assert.equal(runtime.resolvedRefs.at(-1), next.apiKeyEnv);
  assert.equal(calls[1].body.model, next.model);
  assert.equal(calls[1].body.stream, true);
  assert.equal(calls[1].body.max_output_tokens, next.maxOutputTokens);
  assert.equal(calls[1].body.reasoning.effort, next.reasoningEffort);
  assert.equal(calls[1].body.tools[0].search_context_size, next.searchContextSize);
  assert.equal(registrations.mock.callCount(), 1);
});

test('invalid volatile candidate keeps the running values and provider usable', async t => {
  const calls = stubFetch(t);
  const runtime = await createRuntime(t);
  const entry = await loadProvider(runtime);
  const provider = runtime.web.searchProviders.get('codex-local');
  const timeoutRef = entry.fiber.config.timeoutMs;
  await runtime.loader.update(entry.id, { config: { ...initialConfig, timeoutMs: 0 } });
  await runtime.loader.await();
  await entry.fiber.await();
  assert.equal(timeoutRef.get(), initialConfig.timeoutMs);
  assert.equal(runtime.web.searchProviders.get('codex-local'), provider);
  const result = await runtime.web.search({ query: 'invalid candidate was rejected' });
  assert.equal(runtime.web.searchProviders.get('codex-local').id, 'codex-local');
  assert.equal(calls.length, 1);
});

test('rc.3 WebRuntime caps structured sources and forwards caller cancellation', async t => {
  const response = completedResponse();
  response.output[0].action.sources.push({ url: 'https://example.invalid/second', title: 'Second source' });
  const calls = stubFetch(t, [response]);
  const runtime = await createRuntime(t);
  await loadProvider(runtime);
  const result = await runtime.web.search({ query: 'limited sources', maxResults: 1 });
  assert.equal(result.sources.length, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.content, 'Runtime search answer');
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(runtime.web.search({ query: 'cancelled' }, abort.signal), { code: 'WEB_ABORTED' });
  assert.equal(calls.length, 1, 'Cancelled requests must not dispatch HTTP');
});

test('bundle patch composes with real DSH semantics and explicitly selects codex-local', async t => {
  const calls = stubFetch(t);
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const patch = loadYaml(await readFile(new URL(manifest.dsh.bundle.patch, projectURL), 'utf8'));
  const warnings = [];
  const base = [{ insert: [{
    id: 'web', name: '@deepseek-ai/dsh-web',
    config: { searchProvider: 'other-provider', fetchProvider: 'fixture-fetch' },
  }] }];
  const rows = composeEntries([base, patch], warning => warnings.push(warning));
  assert.deepEqual(warnings, []);
  assert.deepEqual(rows.find(row => row.id === 'web').config, { searchProvider: 'codex-local' },
    'DSH patch config replaces the whole object');
  const inserted = rows.find(row => row.id === 'web-search-codex');
  assert.ok(inserted, 'Bundle must insert the provider entry');
  assert.equal(inserted.name, manifest.name);
  assert.equal(inserted.disabled, undefined);

  const runtime = await createRuntime(t, rows.find(row => row.id === 'web').config);
  const otherSearch = t.mock.fn(async () => { throw new Error('Bundle selected the wrong provider'); });
  runtime.web.registerSearchProvider({ id: 'other-provider', available: () => true, search: otherSearch });
  // The isolated Loader has no host package-install projection; resolve the
  // bundle's self package to its public entry, preserving id and composed config.
  await loadProvider(runtime, { ...inserted.config, ...initialConfig }, inserted.id);
  assert.equal(runtime.web.config.searchProvider.get(), 'codex-local');
  assert.equal(runtime.web.searchProviders.size, 2);
  const result = await runtime.web.search({ query: 'bundle selection' });
  assert.equal(runtime.web.searchProviders.get('codex-local').id, 'codex-local');
  assert.equal(otherSearch.mock.callCount(), 0);
  assert.equal(calls.length, 1);
});
