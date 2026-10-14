// Generated from client.js by scripts/build-client.mjs.
window.__ModuleLoader__.load({
  id: "dsh-web-search-codex-020",
  factory(require) {
const React = require("react");
const {
  Button,
  SettingsForm,
  SettingsFormModel,
  SettingsSecretField,
  SettingsValueField,
  Tag,
  settingsNumberField,
  settingsTextField,
} = require("@deepseek-ai/dsh-client-ui-primitives");

// This is the ESM source. Publish the official ModuleLoader factory build as
// exports["./client"], with the factory id equal to the package manifest name.
const name = 'web-search-codex';
const inject = ['slots', 'remote', 'remote.credentials', 'configForms'];

const CONFIG_NAMESPACE = 'web-search-codex';
const DEFAULT_API_KEY_REF = 'CODEX_SEARCH_API_KEY';
const API_KEY_FIELD = 'apiKey';
const h = React.createElement;

const labels = {
  unavailable: '插件当前未加载，暂时无法配置。',
  readOnly: '本部署的设置为只读。',
  saveFailed: '保存未完成，已保留输入。请检查参数或凭据状态后重试。',
  save: '保存',
  saving: '保存中…',
};

const fields = [
  {
    field: 'apiKeyEnv',
    label: 'API Key 凭据名称',
    hint: '默认 CODEX_SEARCH_API_KEY。这里只填写引用名称；API Key 会写入保存后使用的引用。',
    invalidLabel: '请填写以字母或下划线开头、仅含字母、数字和下划线的凭据名称。',
  },
  {
    field: 'baseURL',
    label: '接口地址',
    hint: '必填。填写 OpenAI 兼容接口的基础地址，例如 https://api.example.com/v1；地址不能带账号、密码、查询参数或片段。',
    invalidLabel: '请填写不带账号、密码、查询参数或片段的 HTTP 或 HTTPS 地址。',
  },
  {
    field: 'model',
    label: '模型',
    hint: '必填。填写接口支持网页搜索的模型名称。',
  },
  {
    field: 'reasoningEffort',
    label: '推理强度',
    hint: '默认 low；none 表示不发送 reasoning 字段，使用上游默认行为。可用强度取决于所选模型。',
    options: [['none', '上游默认（none）'], ['low', '低（low）'], ['medium', '中（medium）'], ['high', '高（high）']],
  },
  {
    field: 'searchContextSize',
    label: '搜索上下文大小',
    hint: '控制网页搜索返回的上下文规模。',
    options: [['low', '小（low）'], ['medium', '中（medium）'], ['high', '大（high）']],
  },
  {
    field: 'stream',
    label: '流式响应',
    hint: '选择是否以流式方式接收搜索响应。',
    options: [['true', '开启'], ['false', '关闭']],
  },
  {
    field: 'maxOutputTokens',
    label: '最大输出 Token 数',
    hint: '填写正整数；留空使用提供方默认值。',
    numeric: true,
    invalidLabel: '请填写正整数，或留空恢复默认。',
  },
  {
    field: 'timeoutMs',
    label: '请求超时（毫秒）',
    hint: '范围为 1000–600000 毫秒（1 秒至 10 分钟），填写整数；留空使用提供方默认值。',
    numeric: true,
    invalidLabel: '请填写 1000–600000 之间的整数，或留空恢复默认。',
  },
];

const layout = {
  field: { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0' },
  heading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' },
  badges: { display: 'flex', alignItems: 'center', gap: 8 },
  hint: { margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)' },
  select: {
    boxSizing: 'border-box', width: '100%', minHeight: 34, padding: '0 12px',
    borderRadius: 'var(--dsw-radius-md, 8px)', border: '0.5px solid var(--dsw-alias-border-l4)',
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 13,
  },
};

function validatedTextField(field, valid) {
  const spec = settingsTextField(field);
  return {
    ...spec,
    parse(text) {
      const parsed = spec.parse(text);
      return parsed.kind === 'clear' || valid(parsed.value) ? parsed : undefined;
    },
  };
}

function positiveIntegerField(field, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const spec = settingsNumberField(field);
  return {
    ...spec,
    parse(text) {
      const parsed = spec.parse(text);
      if (parsed?.kind === 'clear') return parsed;
      return parsed?.kind === 'set' && Number.isSafeInteger(parsed.value)
        && parsed.value >= min && parsed.value <= max ? parsed : undefined;
    },
  };
}

function enumField(field, values) {
  return validatedTextField(field, (value) => values.includes(value));
}

function booleanField(field) {
  return {
    field,
    format: (value) => typeof value === 'boolean' ? String(value) : '',
    parse(text) {
      const value = text.trim();
      if (!value) return { kind: 'clear' };
      if (value !== 'true' && value !== 'false') return undefined;
      return { kind: 'set', value: value === 'true' };
    },
  };
}

function fieldSpecs() {
  return [
    validatedTextField('apiKeyEnv', (value) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)),
    validatedTextField('baseURL', (value) => {
      try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:')
          && !url.username && !url.password && !url.search && !url.hash;
      } catch {
        return false;
      }
    }),
    settingsTextField('model'),
    enumField('reasoningEffort', ['none', 'low', 'medium', 'high']),
    enumField('searchContextSize', ['low', 'medium', 'high']),
    booleanField('stream'),
    positiveIntegerField('maxOutputTokens'),
    positiveIntegerField('timeoutMs', 1000, 600000),
  ];
}

function refOf(snapshot) {
  const value = snapshot.value?.apiKeyEnv;
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_API_KEY_REF;
}

function SelectField({ definition, value, disabled, onEdit, onReset }) {
  const id = `plugin-config-codex-search-${definition.field}`;
  return h('div', { style: layout.field },
    h('div', { style: layout.heading },
      h('label', { htmlFor: id }, definition.label),
      value.overridden ? h('span', { style: layout.badges },
        h(Tag, { tone: 'neutral' }, '已覆盖'),
        h(Button, { variant: 'ghost', size: 'sm', disabled, onClick: onReset }, '恢复默认'),
      ) : null,
    ),
    h('select', {
      id, value: value.text, disabled, style: layout.select,
      'aria-describedby': `${id}-hint`, 'aria-invalid': value.invalid || undefined,
      onChange: (event) => onEdit(event.target.value),
    },
    h('option', { value: '' }, '使用提供方默认值'),
    ...definition.options.map(([option, label]) => h('option', { key: option, value: option }, label))),
    h('p', { id: `${id}-hint`, style: layout.hint }, value.invalid ? '请选择有效选项。' : definition.hint),
  );
}

function CodexSearchCard(props) {
  const state = props.useCodexSearchCard((snapshot) => snapshot);
  if (props.view === 'summary') return '设置 Codex 网页搜索的 API Key、模型及搜索参数。';
  const disabled = !state.writable || state.saving;
  return h(SettingsForm, {
    labels, state, onSave: props.save, onDiscard: props.discard,
  },
  h(SettingsSecretField, {
    id: 'plugin-config-codex-search-key', label: 'API Key',
    hint: `通过 DSH 凭据存储保存，不写入设置文件。留空保留当前密钥。当前引用：${state.credentialRef}。`,
    disabled: !state.apiKeyWritable,
    text: state.apiKey.text, configured: state.apiKeyConfigured,
    stateLabel: state.credentialLoading ? '正在读取凭据状态…'
      : state.credentialFailed ? '凭据状态读取失败'
        : state.apiKeyConfigured ? '已配置密钥' : '尚未配置密钥',
    onEdit: (text) => props.edit(API_KEY_FIELD, text),
  }),
  state.credentialFailed ? h('div', { role: 'status', style: layout.field },
    h('p', { style: layout.hint }, '无法确认凭据状态，请重试读取后再填写 API Key。'),
    h(Button, { variant: 'ghost', size: 'sm', disabled: state.saving, onClick: props.retryCredential }, '重试读取密钥状态'),
  ) : !state.credentialLoading && !state.credentialWritable ? h('p', { role: 'status', style: layout.hint },
    '当前密钥由只读来源提供，无法从此处修改。',
  ) : null,
  ...fields.map((definition) => definition.options
    ? h(SelectField, {
      key: definition.field, definition, value: state[definition.field], disabled,
      onEdit: (text) => props.edit(definition.field, text),
      onReset: () => props.resetField(definition.field),
    })
    : h(SettingsValueField, {
      key: definition.field, id: `plugin-config-codex-search-${definition.field}`,
      label: definition.label, hint: definition.hint, numeric: definition.numeric,
      overriddenLabel: '已覆盖', resetLabel: '恢复默认',
      invalidLabel: definition.invalidLabel ?? '请填写有效值。',
      disabled, ...state[definition.field],
      onEdit: (text) => props.edit(definition.field, text),
      onReset: () => props.resetField(definition.field),
    })),
  state.saved ? h('p', { role: 'status', 'aria-live': 'polite', style: layout.hint }, '已保存。') : null,
  );
}

/** Owns the staged settings form; only the volatile writer receives key text. */
class CodexSearchCardController {
  constructor(scope, ctx) {
    this.scope = scope;
    this.ctx = ctx;
    this.disposed = false;
    this.readGeneration = 0;
    this.saved = false;
    this.credential = { ref: '', configured: false, writable: false, loading: true, failed: false };
    this.form = new SettingsFormModel(scope, fieldSpecs(), [{
      field: API_KEY_FIELD,
      write: (text) => this.writeKey(text),
    }]);
    this.store = this.form.bind(() => this.projection());
    this.actions = this.form.actions();
    this.unsubscribe = scope.subscribe(() => { void this.readCredential(); });
    void this.readCredential();
  }

  projection() {
    const shell = this.form.shell();
    return {
      ...shell,
      ...Object.fromEntries(fields.map(({ field }) => [field, this.form.field(field)])),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: shell.available && shell.writable && !shell.saving
        && this.credential.writable && !this.credential.loading && !this.credential.failed,
      credentialRef: this.credential.ref || DEFAULT_API_KEY_REF,
      credentialWritable: this.credential.writable,
      credentialLoading: this.credential.loading,
      credentialFailed: this.credential.failed,
      saved: this.saved,
    };
  }

  publish() {
    if (!this.disposed) this.store.set(this.projection());
  }

  draftRef() {
    const text = this.form.field('apiKeyEnv').text.trim();
    const inherited = this.scope.getSnapshot().base?.apiKeyEnv;
    return text || (typeof inherited === 'string' && inherited.trim() ? inherited.trim() : DEFAULT_API_KEY_REF);
  }

  async readCredential() {
    if (this.disposed) return false;
    const ref = this.draftRef();
    const generation = ++this.readGeneration;
    this.credential = {
      ref,
      configured: ref === this.credential.ref && this.credential.configured,
      writable: false,
      loading: true,
      failed: false,
    };
    this.publish();
    try {
      const response = await this.ctx.remote.credentials.describe([ref]);
      if (this.disposed || generation !== this.readGeneration || ref !== this.draftRef()) return false;
      const view = response.ok ? response.value?.[ref] : undefined;
      if (!view || typeof view.configured !== 'boolean' || typeof view.writable !== 'boolean') {
        this.credential = { ...this.credential, writable: false, loading: false, failed: true };
        this.publish();
        return false;
      }
      this.credential = { ref, configured: view.configured, writable: view.writable, loading: false, failed: false };
      this.publish();
      return true;
    } catch {
      if (!this.disposed && generation === this.readGeneration && ref === this.draftRef()) {
        this.credential = { ...this.credential, writable: false, loading: false, failed: true };
        this.publish();
      }
      return false;
    }
  }

  refreshCredential(ref) {
    if (ref === this.draftRef()) void this.readCredential();
  }

  async writeKey(value) {
    const text = value.trim();
    if (!text) return true;
    const snapshot = this.scope.getSnapshot();
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable) return false;
    // SettingsFormModel first commits the non-secret fields, then runs this
    // writer. Resolve the accepted apiKeyEnv, never a stale saved reference.
    const ref = refOf(snapshot);
    if (ref !== this.draftRef() || !await this.readCredential() || !this.credential.writable) return false;
    const response = await this.ctx.remote.credentials.set(ref, text);
    if (!response.ok) return false;
    const refreshed = await this.readCredential();
    return refreshed && this.credential.ref === ref && this.credential.configured;
  }

  edit(field, text) {
    const state = this.projection();
    if (this.disposed || !state.available || !state.writable || state.saving) return;
    if (field === API_KEY_FIELD && !state.apiKeyWritable) return;
    this.saved = false;
    this.actions.edit(field, text);
    if (field === 'apiKeyEnv') void this.readCredential();
  }

  resetField(field) {
    const state = this.form.shell();
    if (this.disposed || !state.available || !state.writable || state.saving) return;
    this.saved = false;
    this.actions.resetField(field);
    if (field === 'apiKeyEnv') void this.readCredential();
  }

  async save() {
    const before = this.form.shell();
    if (this.disposed || !before.available || !before.writable || !before.dirty || before.invalid || before.saving) return;
    this.saved = false;
    await this.form.save();
    if (this.disposed) return;
    const after = this.form.shell();
    this.saved = !after.failed && !after.dirty;
    this.publish();
  }

  discard() {
    if (this.disposed) return;
    this.saved = false;
    this.actions.discard();
    void this.readCredential();
  }

  inject() {
    return {
      hooks: { codexSearchCard: this.store },
      edit: (field, text) => this.edit(field, text),
      resetField: (field) => this.resetField(field),
      save: () => this.save(),
      discard: () => this.discard(),
      retryCredential: () => this.readCredential(),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.readGeneration += 1;
    this.actions.discard();
    this.unsubscribe();
    this.form.dispose();
  }
}

function apply(ctx) {
  const card = new CodexSearchCardController(ctx.configForms.get(CONFIG_NAMESPACE), ctx);
  ctx.effect(() => () => card.dispose(), 'web-search-codex: form subscription');
  ctx.effect(() => ctx.remote.$on('credentials/reference-updated', (ref) => card.refreshCredential(ref)),
    'web-search-codex: credential invalidations');
  ctx.effect(() => ctx.configForms.whileServed([CONFIG_NAMESPACE], () => ctx.slots.inject('plugins.item',
    () => ctx.slots.register({
      name: 'plugins.item', id: CONFIG_NAMESPACE, order: 41,
      label: () => 'Codex 网页搜索', inject: () => card.inject(),
    }, CodexSearchCard))), 'web-search-codex: configuration card');
}

    return { name, inject, CodexSearchCard, CodexSearchCardController, apply };
  }
});
