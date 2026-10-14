import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// The DSH primitives are provided by the browser shell. This test double
// isolates our controller/field protocol; it does not emulate Host persistence
// or claim to test the official SettingsFormModel's save implementation.
class FormDouble {
  constructor(scope, specs, secrets) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    this.secrets = new Map(secrets.map((spec) => [spec.field, spec]));
    this.drafts = new Map();
    this.state = { dirty: false, invalid: false, saving: false, failed: false };
    this.disposed = false;
  }
  shell() {
    const snapshot = this.scope.getSnapshot();
    return { available: snapshot.status === 'ready', writable: snapshot.writable, ...this.state };
  }
  field(field) {
    return {
      text: this.drafts.get(field) ?? this.specs.get(field)?.format(this.scope.getSnapshot().value?.[field]) ?? '',
      overridden: false, invalid: false,
    };
  }
  bind(project) {
    let snapshot = project();
    this.project = project;
    this.store = { getSnapshot: () => snapshot, set: (next) => { snapshot = next; } };
    return this.store;
  }
  actions() {
    return {
      edit: (field, text) => {
        this.drafts.set(field, text);
        this.state.dirty = true;
        this.store.set(this.project());
      },
      resetField: (field) => {
        this.drafts.set(field, this.specs.get(field).format(this.scope.getSnapshot().base?.[field]));
        this.state.dirty = true;
        this.store.set(this.project());
      },
      discard: () => {
        this.drafts.clear();
        this.state.dirty = false;
        this.state.failed = false;
        this.store.set(this.project());
      },
    };
  }
  async save() { await this.saveResult?.(); }
  dispose() { this.disposed = true; }
}

function textSpec(field) {
  return {
    field, format: (value) => typeof value === 'string' ? value : '',
    parse: (text) => text.trim() ? { kind: 'set', value: text.trim() } : { kind: 'clear' },
  };
}
function numberSpec(field) {
  return {
    field, format: (value) => typeof value === 'number' ? String(value) : '',
    parse(text) {
      if (!text.trim()) return { kind: 'clear' };
      const value = Number(text.trim());
      return Number.isFinite(value) ? { kind: 'set', value } : undefined;
    },
  };
}

function component() {}
const primitives = {
  Button: component, Tag: component,
  SettingsForm: function SettingsForm() {},
  SettingsSecretField: function SettingsSecretField() {},
  SettingsValueField: function SettingsValueField() {},
  SettingsFormModel: FormDouble,
  settingsTextField: textSpec,
  settingsNumberField: numberSpec,
};
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const original = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const source = original
  .replace("import React from 'react';", '')
  .replace(/import\s*\{[\s\S]*?\}\s*from '@deepseek-ai\/dsh-client-ui-primitives';/, '')
  .replace(/^export (?=(?:const|function|class) )/gm, '');
const client = new vm.Script(`${source}\n;({ name, inject, apply, CodexSearchCardController, CodexSearchCard });`, {
  filename: 'client.js',
}).runInNewContext({ React, ...primitives, URL });

function scopeOf(value = {}, writable = true) {
  let snapshot = { status: 'ready', writable, value, base: {}, user: {}, revision: 1 };
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(patch) { snapshot = { ...snapshot, ...patch }; for (const listener of listeners) listener(); },
    listeners,
  };
}
function setup({ scope = scopeOf(), describe, set } = {}) {
  const calls = { describe: [], set: [] };
  const ctx = { remote: { credentials: {
    async describe(refs) {
      calls.describe.push([...refs]);
      return describe ? describe(refs) : { ok: true, value: { [refs[0]]: { configured: true, writable: true } } };
    },
    async set(ref, text) {
      calls.set.push([ref, text]);
      return set ? set(ref, text) : { ok: true, value: undefined };
    },
  } } };
  const controller = new client.CodexSearchCardController(scope, ctx);
  return { controller, scope, ctx, calls };
}
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function json(value) { return JSON.parse(JSON.stringify(value)); }
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

test('field protocol uses all eight settings and typed, constrained values', () => {
  const { controller } = setup();
  const specs = controller.form.specs;
  assert.deepEqual([...specs.keys()], ['apiKeyEnv', 'baseURL', 'model', 'reasoningEffort', 'searchContextSize', 'stream', 'maxOutputTokens', 'timeoutMs']);
  assert.equal(controller.form.secrets.size, 1);
  assert.equal(controller.form.secrets.has('apiKey'), true);
  assert.equal(specs.has('apiKey'), false);
  assert.deepEqual(json(specs.get('stream').parse('false')), { kind: 'set', value: false });
  assert.equal(specs.get('stream').parse('yes'), undefined);
  assert.equal(specs.get('reasoningEffort').parse('none').value, 'none');
  assert.equal(specs.get('reasoningEffort').parse('minimal'), undefined);
  assert.equal(specs.get('searchContextSize').parse('large'), undefined);
  for (const field of ['timeoutMs', 'maxOutputTokens']) {
    for (const text of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992']) assert.equal(specs.get(field).parse(text), undefined);
    assert.equal(specs.get(field).parse('1000').value, 1000);
    assert.equal(specs.get(field).parse(' ').kind, 'clear');
  }
  assert.equal(specs.get('timeoutMs').parse('999'), undefined);
  assert.equal(specs.get('timeoutMs').parse('600001'), undefined);
  assert.equal(specs.get('timeoutMs').parse('600000').value, 600000);
  assert.equal(specs.get('apiKeyEnv').parse('CODEX_SEARCH_API_KEY').value, 'CODEX_SEARCH_API_KEY');
  assert.equal(specs.get('apiKeyEnv').parse('not-a-ref'), undefined);
  assert.equal(specs.get('baseURL').parse('https://api.example.com/v1').value, 'https://api.example.com/v1');
  for (const url of ['file:///config', 'https://user:pass@example.com/v1', 'https://user@example.com/v1', 'https://api.example.com/v1?key=test', 'https://api.example.com/v1#fragment']) {
    assert.equal(specs.get('baseURL').parse(url), undefined);
  }
  controller.dispose();
});

test('default reference is described without resolving or retrieving key text', async () => {
  const { controller, calls } = setup();
  await settle();
  assert.deepEqual(calls.describe, [['CODEX_SEARCH_API_KEY']]);
  const state = controller.store.getSnapshot();
  assert.equal(state.apiKeyConfigured, true);
  assert.equal(state.apiKeyWritable, true);
  assert.equal(state.apiKey.text, '');
  controller.edit('apiKey', 'test-only-secret');
  assert.deepEqual(calls.set, []);
  assert.equal(controller.form.drafts.get('apiKey'), 'test-only-secret');
  controller.dispose();
  assert.equal(controller.form.drafts.size, 0);
});

test('blank API Key is a no-op and preserves the stored key', async () => {
  const { controller, calls } = setup();
  await settle();
  assert.equal(await controller.writeKey('   '), true);
  assert.deepEqual(calls.set, []);
  controller.dispose();
});

test('API Key goes only through credentials.set and confirmed metadata', async () => {
  const { controller, calls } = setup();
  await settle();
  assert.equal(await controller.form.secrets.get('apiKey').write(' test-only-secret '), true);
  assert.deepEqual(calls.set, [['CODEX_SEARCH_API_KEY', 'test-only-secret']]);
  assert.equal(controller.form.drafts.size, 0);
  controller.dispose();
});

test('rejected key replacement cannot report success from an existing key', async () => {
  const { controller, calls } = setup({ set: () => ({ ok: false, error: { message: 'rejected' } }) });
  await settle();
  assert.equal(controller.store.getSnapshot().apiKeyConfigured, true);
  assert.equal(await controller.writeKey('test-only-new-secret'), false);
  assert.equal(calls.set.length, 1);
  controller.dispose();
});

test('failed metadata read and read-only credential both block key writes', async () => {
  for (const describe of [
    () => ({ ok: false, error: { message: 'offline' } }),
    () => { throw new Error('offline'); },
    ([ref]) => ({ ok: true, value: { [ref]: { configured: true, writable: false } } }),
  ]) {
    const { controller, calls } = setup({ describe });
    await settle();
    assert.equal(controller.store.getSnapshot().apiKeyWritable, false);
    assert.equal(await controller.writeKey('test-only-secret'), false);
    assert.deepEqual(calls.set, []);
    controller.dispose();
  }
});

test('read-only config rejects edit and credentials mutation', async () => {
  const { controller, calls } = setup({ scope: scopeOf({}, false) });
  await settle();
  controller.edit('model', 'another-model');
  controller.edit('apiKey', 'test-only-secret');
  assert.equal(controller.form.drafts.size, 0);
  assert.equal(await controller.writeKey('test-only-secret'), false);
  assert.deepEqual(calls.set, []);
  controller.dispose();
});

test('draft apiKeyEnv describes the new reference; key writer uses accepted reference', async () => {
  const { controller, scope, calls } = setup();
  await settle();
  controller.edit('apiKeyEnv', 'NEW_CODEX_KEY');
  await settle();
  assert.equal(controller.store.getSnapshot().credentialRef, 'NEW_CODEX_KEY');
  assert.equal(await controller.writeKey('test-only-secret'), false); // settings have not been accepted yet
  assert.equal(calls.set.length, 0);
  scope.update({ value: { apiKeyEnv: 'NEW_CODEX_KEY' } });
  await settle();
  assert.equal(await controller.writeKey('test-only-secret'), true);
  assert.deepEqual(calls.set, [['NEW_CODEX_KEY', 'test-only-secret']]);
  controller.dispose();
});

test('out-of-order credential reads for the same reference keep the newer result', async () => {
  const first = deferred();
  const second = deferred();
  let count = 0;
  const { controller } = setup({ describe: () => (++count === 1 ? first.promise : second.promise) });
  const refreshed = controller.readCredential();
  second.resolve({ ok: true, value: { CODEX_SEARCH_API_KEY: { configured: true, writable: false } } });
  await refreshed;
  first.resolve({ ok: true, value: { CODEX_SEARCH_API_KEY: { configured: false, writable: true } } });
  await settle();
  assert.equal(controller.store.getSnapshot().apiKeyConfigured, true);
  assert.equal(controller.store.getSnapshot().apiKeyWritable, false);
  controller.dispose();
});

test('credential refresh only reacts to the watched ref and disposal ignores pending reads', async () => {
  const pending = deferred();
  const { controller, scope, calls } = setup({ describe: () => pending.promise });
  const before = controller.store.getSnapshot();
  controller.refreshCredential('UNRELATED_KEY');
  assert.equal(calls.describe.length, 1);
  controller.dispose();
  pending.resolve({ ok: true, value: { CODEX_SEARCH_API_KEY: { configured: true, writable: true } } });
  await settle();
  assert.equal(scope.listeners.size, 0);
  assert.equal(controller.store.getSnapshot().apiKeyConfigured, before.apiKeyConfigured);
  assert.equal(controller.form.disposed, true);
});

test('save feedback follows the model outcome and clears on another edit', async () => {
  const { controller } = setup();
  await settle();
  controller.edit('model', 'test-model');
  controller.form.saveResult = async () => { controller.form.state.dirty = false; };
  await controller.save();
  assert.equal(controller.store.getSnapshot().saved, true);
  controller.edit('model', 'other-model');
  assert.equal(controller.store.getSnapshot().saved, false);
  controller.form.saveResult = async () => { controller.form.state.failed = true; };
  await controller.save();
  assert.equal(controller.store.getSnapshot().saved, false);
  controller.dispose();
});

test('Chinese card has secret field, all values, and save-success live feedback', async () => {
  const { controller } = setup();
  await settle();
  const props = { ...controller.inject(), view: 'detail', useCodexSearchCard: (selector) => selector(controller.projection()) };
  assert.match(client.CodexSearchCard({ ...props, view: 'summary' }), /Codex 网页搜索/);
  controller.saved = true;
  const tree = client.CodexSearchCard(props);
  assert.equal(tree.type, primitives.SettingsForm);
  const secret = tree.children.find((node) => node?.type === primitives.SettingsSecretField);
  assert.equal(secret.props.text, '');
  assert.match(secret.props.hint, /留空保留/);
  assert.equal(tree.children.filter((node) => node?.props?.key && controller.form.specs.has(node.props.key)).length, 8);
  for (const field of ['baseURL', 'model']) {
    const control = tree.children.find((node) => node?.props?.key === field);
    assert.match(control.props.hint, /必填/);
    assert.doesNotMatch(control.props.hint, /默认/);
  }
  const reasoning = tree.children.find((node) => node?.props?.key === 'reasoningEffort');
  assert.match(reasoning.props.definition.options[0][1], /上游默认/);
  assert.equal(tree.children.some((node) => node?.props?.['aria-live'] === 'polite' && node.children.includes('已保存。')), true);
  controller.dispose();
});

test('plugin uses official slots, configForms lifecycle and credential update event', async () => {
  const { controller, scope, ctx } = setup();
  controller.dispose();
  const calls = [];
  const cleanup = [];
  let registered;
  ctx.effect = (effect) => { const result = effect(); if (typeof result === 'function') cleanup.push(result); };
  ctx.remote.$on = (event, listener) => { calls.push(['event', event]); return () => calls.push(['off', event]); };
  ctx.configForms = {
    get: (ns) => { calls.push(['get', ns]); return scope; },
    whileServed: (namespaces, mount) => { calls.push(['whileServed', ...namespaces]); return mount(); },
  };
  ctx.slots = {
    inject: (slot, mount) => { calls.push(['inject', slot]); return mount(); },
    register: (options, render) => { registered = { options, render }; return () => calls.push(['unregister', options.id]); },
  };
  client.apply(ctx);
  await settle();
  assert.equal(client.name, 'web-search-codex');
  assert.deepEqual(json(client.inject), ['slots', 'remote', 'remote.credentials', 'configForms']);
  assert.equal(calls.some((call) => call.join(':') === 'get:web-search-codex'), true);
  assert.equal(calls.some((call) => call.join(':') === 'whileServed:web-search-codex'), true);
  assert.equal(calls.some((call) => call.join(':') === 'event:credentials/reference-updated'), true);
  assert.equal(registered.options.name, 'plugins.item');
  assert.equal(registered.options.id, 'web-search-codex');
  assert.equal(registered.render, client.CodexSearchCard);
  assert.equal(typeof registered.options.inject().hooks.codexSearchCard.getSnapshot, 'function');
  for (const dispose of cleanup.reverse()) dispose();
  assert.equal(scope.listeners.size, 0);
});
