import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

const require = createRequire(import.meta.url);
const PRIMITIVES = '@deepseek-ai/dsh-client-ui-primitives';
const packageManifest = JSON.parse(readFileSync(require.resolve(`${PRIMITIVES}/package.json`), 'utf8'));

// The npm browser package imports CSS and dev-only browser dependencies at its
// root. Prefer its actual exports; on Node, execute its published, independent
// settings regions verbatim instead. No form parsing/planning/saving is mocked.
// The small observable adapter and Host/RPC fixtures below are test boundaries;
// this suite does not claim DOM rendering, real ConfigForms or slot lifecycles.
function publishedRegion(source, path) {
  const marker = `//#region lib/types/${path}.js`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Published primitives region exists: ${path}`);
  const end = source.indexOf('//#endregion', start);
  assert.notEqual(end, -1, `Published primitives region terminates: ${path}`);
  return source.slice(start + marker.length, end);
}

function observableAdapter(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    set(value) { snapshot = value; for (const listener of listeners) listener(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

async function loadPrimitives() {
  try {
    return { module: await import(PRIMITIVES), mode: 'actual package exports' };
  } catch (error) {
    // Fail visibly on unexpected package/runtime errors instead of silently
    // replacing broken application code with a second implementation.
    assert.ok(['ERR_MODULE_NOT_FOUND', 'ERR_UNKNOWN_FILE_EXTENSION'].includes(error.code),
      `Expected browser-only root import failure, received ${error.code}: ${error.message}`);
    const source = readFileSync(require.resolve(PRIMITIVES), 'utf8');
    const regions = ['Button', 'Tag', 'settings-form/SettingsForm', 'settings-form/fields', 'settings-form/form-model'];
    const module = new vm.Script(`${regions.map((path) => publishedRegion(source, path)).join('\n')}
      ;({ Button, Tag, SettingsForm, SettingsSecretField, SettingsValueField,
          SettingsFormModel, settingsTextField, settingsNumberField });`, {
      filename: 'published-dsh-client-ui-primitives-settings-regions.js',
    }).runInNewContext({ ...React, ...jsxRuntime, createSnapshotStore: observableAdapter });
    return { module, mode: `published regions; browser root import unavailable (${error.code})` };
  }
}

const loaded = await loadPrimitives();
const primitives = loaded.module;
let registration;
new vm.Script(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
  filename: 'lib/client.js',
}).runInNewContext({ URL, window: { __ModuleLoader__: { load(value) { registration = value; } } } });
assert.equal(registration.id, 'dsh-web-search-codex-020');
const client = registration.factory((specifier) => {
  if (specifier === 'react') return React;
  if (specifier === PRIMITIVES) return primitives;
  throw new Error(`Unexpected client factory dependency: ${specifier}`);
});

const REF_A = 'CODEX_SEARCH_API_KEY';
const REF_B = 'CODEX_RUNTIME_KEY_B';
const plain = (value) => JSON.parse(JSON.stringify(value));

function createHostScope() {
  const base = {
    apiKeyEnv: REF_A, baseURL: 'https://fixture.invalid/v1', model: 'model-before',
    reasoningEffort: 'low', searchContextSize: 'medium', stream: true,
    maxOutputTokens: 4096, timeoutMs: 90000,
  };
  const store = observableAdapter({ status: 'ready', writable: true, revision: 23, base, user: {}, value: { ...base } });
  const mutations = [];
  const events = [];
  let rejectNext = false;
  const scope = {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    mutations, events,
    rejectNextMutation() { rejectNext = true; },
    externalUpdate(patch) {
      const current = store.getSnapshot();
      const user = { ...current.user, ...patch };
      store.set({ ...current, revision: current.revision + 1, user, value: { ...base, ...user } });
    },
    async mutate(ops, expectedRevision) {
      const current = store.getSnapshot();
      mutations.push({ ops: plain(ops), expectedRevision });
      events.push({ kind: 'mutate', expectedRevision });
      if (rejectNext || expectedRevision !== current.revision) { rejectNext = false; return false; }
      const user = { ...current.user };
      for (const operation of ops) {
        assert.equal(operation.path.length, 1);
        if (operation.op === 'set') user[operation.path[0]] = operation.value;
        else if (operation.op === 'unset') delete user[operation.path[0]];
        else assert.fail(`Unexpected operation ${operation.op}`);
      }
      store.set({ ...current, revision: current.revision + 1, user, value: { ...base, ...user } });
      return true;
    },
  };
  return scope;
}

async function setup(t) {
  const scope = createHostScope();
  const keys = new Map([[REF_A, 'fixture-original-key']]);
  const writes = [];
  let failNextKey = false;
  const ctx = { remote: { credentials: {
    async describe(refs) {
      return { ok: true, value: Object.fromEntries(refs.map((ref) => [ref, {
        configured: keys.has(ref), writable: true,
      }])) };
    },
    async set(ref, text) {
      writes.push({ ref, text, acceptedRef: scope.getSnapshot().value.apiKeyEnv });
      scope.events.push({ kind: 'key', ref });
      if (failNextKey) { failNextKey = false; return { ok: false }; }
      keys.set(ref, text);
      return { ok: true, value: undefined };
    },
  } } };
  const controller = new client.CodexSearchCardController(scope, ctx);
  t.after(() => controller.dispose());
  await controller.readCredential();
  return { controller, scope, keys, writes, failNextKeyWrite() { failNextKey = true; } };
}

test('rc.3 published SettingsFormModel runs inside the generated client factory with real React', async (t) => {
  t.diagnostic(`Primitives loading: ${loaded.mode}; scope/RPC are fixtures; slots/DOM are outside this test.`);
  assert.equal(packageManifest.version, '0.2.1-rc.3');
  for (const name of ['Button', 'Tag', 'SettingsForm', 'SettingsSecretField', 'SettingsValueField',
    'SettingsFormModel', 'settingsTextField', 'settingsNumberField']) assert.ok(primitives[name], name);
  const { controller } = await setup(t);
  assert.ok(controller.form instanceof primitives.SettingsFormModel);
  assert.equal(controller.form.shell().available, true);
  assert.equal(controller.store.getSnapshot().apiKeyConfigured, true);
  assert.equal(typeof React.createElement, 'function');
});

test('real form batches typed fields into one mutation fenced by the edit baseline revision', async (t) => {
  const { controller, scope, writes } = await setup(t);
  controller.edit('model', 'model-after');
  controller.edit('timeoutMs', '2500');
  controller.edit('stream', 'false');
  assert.equal(scope.mutations.length, 0, 'Editing is staged until Save');
  await controller.save();
  assert.deepEqual(scope.mutations, [{ expectedRevision: 23, ops: [
    { op: 'set', path: ['model'], value: 'model-after' },
    { op: 'set', path: ['timeoutMs'], value: 2500 },
    { op: 'set', path: ['stream'], value: false },
  ] }]);
  assert.equal(scope.getSnapshot().revision, 24);
  assert.equal(controller.store.getSnapshot().saved, true);
  assert.equal(controller.form.shell().dirty, false);
  assert.deepEqual(writes, []);
});

test('changing reference and key commits settings first and writes only the accepted reference', async (t) => {
  const { controller, scope, keys, writes } = await setup(t);
  controller.edit('apiKeyEnv', REF_B);
  await controller.readCredential();
  controller.edit('apiKey', '  fixture-replacement-key  ');
  await controller.save();
  assert.deepEqual(scope.mutations, [{ expectedRevision: 23, ops: [
    { op: 'set', path: ['apiKeyEnv'], value: REF_B },
  ] }]);
  assert.deepEqual(writes, [{ ref: REF_B, text: 'fixture-replacement-key', acceptedRef: REF_B }]);
  assert.deepEqual(scope.events.map(({ kind }) => kind), ['mutate', 'key']);
  assert.equal(keys.get(REF_A), 'fixture-original-key');
  assert.equal(keys.get(REF_B), 'fixture-replacement-key');
  assert.equal(controller.store.getSnapshot().apiKey.text, '');
  assert.equal(controller.store.getSnapshot().saved, true);
});

test('a concurrent Host revision rejects the original edit fence and prevents any key write', async (t) => {
  const { controller, scope, writes } = await setup(t);
  controller.edit('apiKeyEnv', REF_B);
  await controller.readCredential();
  controller.edit('apiKey', 'fixture-conflicting-key');
  scope.externalUpdate({ model: 'concurrent-model' });
  await controller.readCredential();
  await controller.save();
  assert.equal(scope.mutations[0].expectedRevision, 23, 'Form keeps first-edit revision after an external update');
  assert.equal(scope.getSnapshot().revision, 24);
  assert.equal(scope.getSnapshot().value.apiKeyEnv, REF_A);
  assert.deepEqual(writes, []);
  assert.equal(controller.form.shell().failed, true);
  assert.equal(controller.store.getSnapshot().apiKey.text, 'fixture-conflicting-key');
});

test('rejected settings save retains reference and key drafts and never calls credentials.set', async (t) => {
  const { controller, scope, writes } = await setup(t);
  controller.edit('apiKeyEnv', REF_B);
  await controller.readCredential();
  controller.edit('apiKey', 'fixture-retained-key');
  scope.rejectNextMutation();
  await controller.save();
  assert.equal(scope.getSnapshot().revision, 23);
  assert.equal(scope.getSnapshot().value.apiKeyEnv, REF_A);
  assert.deepEqual(writes, []);
  assert.equal(controller.form.shell().failed, true);
  assert.equal(controller.store.getSnapshot().apiKeyEnv.text, REF_B);
  assert.equal(controller.store.getSnapshot().apiKey.text, 'fixture-retained-key');
  await controller.save();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].ref, REF_B);
  assert.equal(controller.store.getSnapshot().saved, true);
});

test('key failure after accepted settings preserves the secret and retries without a second settings mutation', async (t) => {
  const { controller, scope, writes, keys, failNextKeyWrite } = await setup(t);
  controller.edit('apiKeyEnv', REF_B);
  await controller.readCredential();
  controller.edit('apiKey', 'fixture-retry-key');
  failNextKeyWrite();
  await controller.save();
  assert.equal(scope.getSnapshot().value.apiKeyEnv, REF_B);
  assert.equal(scope.getSnapshot().revision, 24);
  assert.equal(keys.has(REF_B), false);
  assert.equal(controller.form.shell().failed, true);
  assert.equal(controller.form.shell().dirty, true);
  assert.equal(controller.store.getSnapshot().apiKey.text, 'fixture-retry-key');
  await controller.save();
  assert.equal(scope.mutations.length, 1, 'Already accepted fields are not submitted with a stale revision');
  assert.equal(writes.length, 2);
  assert.equal(keys.get(REF_B), 'fixture-retry-key');
  assert.equal(controller.store.getSnapshot().apiKey.text, '');
  assert.equal(controller.form.shell().failed, false);
  assert.equal(controller.form.shell().dirty, false);
  assert.equal(controller.store.getSnapshot().saved, true);
});

test('blank key is excluded from the save plan and preserves the existing credential', async (t) => {
  const { controller, scope, writes, keys } = await setup(t);
  controller.edit('apiKey', '   ');
  assert.equal(controller.form.shell().dirty, false, 'Whitespace-only secret creates no write');
  await controller.save();
  assert.deepEqual(scope.mutations, []);
  controller.edit('model', 'model-with-original-key');
  await controller.save();
  assert.equal(scope.mutations.length, 1);
  assert.deepEqual(writes, []);
  assert.equal(keys.get(REF_A), 'fixture-original-key');
  assert.equal(controller.form.shell().dirty, false);
  assert.equal(controller.store.getSnapshot().apiKey.text, '');
});
