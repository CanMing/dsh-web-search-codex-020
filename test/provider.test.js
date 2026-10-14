import test from 'node:test';
import assert from 'node:assert/strict';
import { CodexLocalSearchProvider, responsesEndpoint, buildSearchRequest } from '../lib/provider.js';
import { extractResponsesSources } from '../lib/extract.js';
import { createResponsesSseParser } from '../lib/responses-sse.js';

const options = () => ({ baseURL: 'https://search.example/v1', model: 'search-model', apiKey: 'test-only-secret', stream: true, reasoningEffort: 'low', timeoutMs: 1000 });
const completed = () => ({ status: 'completed', output: [
  { type: 'web_search_call', status: 'completed', action: { type: 'search', sources: [{ type: 'url', url: 'https://example.org/source' }] } },
  { type: 'message', content: [{ type: 'output_text', text: '已核实的结果', annotations: [{ type: 'url_citation', url: 'https://example.org/source', title: 'Official source' }] }] },
] });
const sse = events => new Response(new ReadableStream({ start(controller) {
  const bytes = new TextEncoder().encode(events.map(x => `data: ${JSON.stringify(x)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n');
  // Exercise UTF-8 code points and SSE frames split at every byte.
  for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
  controller.close();
} }), { headers: { 'content-type': 'text/event-stream' } });

function mockFetch(t, fn) { const previous = globalThis.fetch; globalThis.fetch = fn; t.after(() => { globalThis.fetch = previous; }); }

test('normalizes base and complete operation URLs without duplication', () => {
  assert.equal(responsesEndpoint('https://example.org/v1/'), 'https://example.org/v1/responses');
  assert.equal(responsesEndpoint('https://example.org/v1/responses/'), 'https://example.org/v1/responses');
  assert.throws(() => responsesEndpoint('https://user:password@example.org/v1'));
  assert.throws(() => responsesEndpoint('https://example.org/v1?api_key=secret'));
});

test('forces native search with verified gateway-compatible request shape', () => {
  const body = buildSearchRequest('搜索问题', options());
  assert.equal(body.input[0].content[0].text, '搜索问题');
  assert.equal(body.tool_choice, 'required');
  assert.deepEqual(body.include, ['web_search_call.action.sources']);
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
  assert.deepEqual(body.reasoning, { effort: 'low' });
  assert.equal(buildSearchRequest('q', { ...options(), reasoningEffort: 'none' }).reasoning, undefined);
});

test('merges native sources and citations, deduplicates and rejects non-web URLs', () => {
  const response = completed();
  response.output[0].action.sources.push({ type: 'url', url: 'javascript:alert(1)' }, { type: 'url', url: 'https://example.org/second' });
  const sources = extractResponsesSources(response);
  assert.equal(sources.length, 2);
  assert.deepEqual(sources[0], { url: 'https://example.org/source', title: 'Official source' });
});

test('SSE parser supports comments, CRLF, multiline JSON and final frames without newline', () => {
  const events = [];
  const parser = createResponsesSseParser(event => events.push(event));
  const data = ': heartbeat\r\nevent: response.completed\r\ndata: {"type":\r\ndata: "response.completed"}\r\n\r\ndata: [DONE]';
  for (const char of data) parser.push(char);
  parser.end();
  assert.equal(events[0].event, 'response.completed');
  assert.equal(events[0].data.type, 'response.completed');
  assert.equal(events[1].data, '[DONE]');
});

test('streaming search parses real native completion shape and passes safe transport flags', async t => {
  mockFetch(t, async (url, init) => {
    assert.equal(url, 'https://search.example/v1/responses');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.authorization, 'Bearer test-only-secret');
    return sse([{ type: 'response.completed', response: completed() }]);
  });
  const result = await new CodexLocalSearchProvider(options).search({ query: 'q' });
  assert.equal(result.content, '已核实的结果');
  assert.equal(result.sources[0].title, 'Official source');
});

test('completed response returns and cancels the stream without waiting for network EOF', async t => {
  let cancelled = false;
  const keepAlive = setTimeout(() => {}, 5000);
  t.after(() => clearTimeout(keepAlive));
  mockFetch(t, async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'response.completed', response: completed() })}\n\n`)); },
    cancel() { cancelled = true; },
  })));
  const result = await new CodexLocalSearchProvider(() => ({ ...options(), timeoutMs: 100 })).search({ query: 'q' });
  assert.equal(result.content, '已核实的结果');
  assert.equal(cancelled, true);
});

test('JSON mode remains supported', async t => {
  mockFetch(t, async (_url, init) => {
    assert.equal(init.headers.accept, 'application/json');
    return Response.json(completed());
  });
  const result = await new CodexLocalSearchProvider(() => ({ ...options(), stream: false })).search({ query: 'q' });
  assert.equal(result.sources.length, 1);
});

test('ordinary text without native search cannot masquerade as search', async t => {
  mockFetch(t, async () => sse([{ type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'I searched' }] }] } }]));
  await assert.rejects(new CodexLocalSearchProvider(options).search({ query: 'q' }), error => error.code === 'WEB_PROVIDER_ERROR' && /native web search/.test(error.message));
});

test('an interrupted SSE stream is rejected even after text arrives', async t => {
  mockFetch(t, async () => sse([{ type: 'response.output_text.delta', delta: 'partial' }]));
  await assert.rejects(new CodexLocalSearchProvider(options).search({ query: 'q' }), /before response.completed/);
});

test('failed and incomplete responses are not accepted as results', async t => {
  mockFetch(t, async () => sse([{ type: 'response.incomplete', response: { status: 'incomplete' } }]));
  await assert.rejects(new CodexLocalSearchProvider(options).search({ query: 'q' }), /failure or incomplete/);
});

test('missing credentials fail before network dispatch', async t => {
  mockFetch(t, async () => assert.fail('Network must not be reached'));
  await assert.rejects(new CodexLocalSearchProvider(() => ({ ...options(), apiKey: undefined, resolveApiKey: async () => undefined })).search({ query: 'q' }), error => error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING');
});

test('HTTP errors do not echo provider bodies or bearer secrets', async t => {
  mockFetch(t, async () => new Response('test-only-secret private upstream message', { status: 401 }));
  await assert.rejects(new CodexLocalSearchProvider(options).search({ query: 'q' }), error => error.code === 'WEB_PROVIDER_ERROR' && /HTTP 401/.test(error.message) && !/test-only-secret|private/.test(error.message));
});

test('a caller cancellation interrupts pending credential resolution', async () => {
  const abort = new AbortController();
  const provider = new CodexLocalSearchProvider(() => ({ ...options(), apiKey: undefined, resolveApiKey: () => new Promise(() => {}) }));
  const pending = provider.search({ query: 'q' }, abort.signal);
  abort.abort();
  await assert.rejects(pending, error => error.code === 'WEB_ABORTED');
});

test('configured timeout interrupts pending transport', async t => {
  let keepAlive;
  t.after(() => clearTimeout(keepAlive));
  mockFetch(t, async (_url, { signal }) => new Promise((resolve, reject) => {
    keepAlive = setTimeout(resolve, 5000);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  await assert.rejects(new CodexLocalSearchProvider(() => ({ ...options(), timeoutMs: 20 })).search({ query: 'q' }), error => error.code === 'WEB_PROVIDER_TIMEOUT');
});
