# dsh-web-search-codex-020

为 **DeepSeek Harness 桌面版 0.2.0-rc.2** 制作的 OpenAI Responses 原生联网搜索插件。基于 `@lyd123qw2008/dsh-web-search-codex@0.1.3`，保留来源声明，增加当前 DSH 配置接口、桌面设置卡与可安装组合包。

## 能力

- 自定义 OpenAI-compatible Responses 基址和模型；适用于提供原生 `web_search` 的 OpenAI 或 sub2api 网关。
- 使用 `POST /responses`、数组 `input`、`store:false`、`tool_choice:required` 和完整搜索来源请求。
- 默认 SSE 流式传输，支持 JSON 模式、超时和取消。
- 合并 `web_search_call.action.sources` 与 `url_citation`，不从普通回答中猜测来源。
- 检查原生搜索调用确实完成；断流或失败会报错。
- 通过 DSH 凭据服务保存 API Key；保存的端点和模型在下一次搜索立即生效。
- 保持官方 `web_search` 工具，所有使用 `ctx.web` 的会话共享所选提供方。

## 安装

只声明并验证 **DSH 0.2.0-rc.2**，不承诺兼容其他 DSH 版本。建议使用该桌面版附带的 Node.js 24 运行开发测试。

在 DSH 的「插件」页选择安装，输入本仓库的 GitHub 地址，或下载 Release 中的 `.tgz` 并使用其绝对路径安装。DSH 插件管理器支持 npm 组合包、本地路径和压缩包；本项目已包含 `dsh.bundle` 和预构建客户端，无需在桌面安装时手动编译。

CLI 方式（将路径替换为你的安装位置）：

```text
dsh plugin --profile desktop add /absolute/path/dsh-web-search-codex-020-0.2.0-rc.2.tgz
```

安装后组合包会选中 `codex-local` 作为搜索提供方。端点和模型没有默认值，填写并保存后才可搜索。

## 配置

在插件配置中打开「Codex / OpenAI 联网搜索」，填写：

| 字段 | 示例/默认值 |
| --- | --- |
| API 基址 | `https://your-gateway.example/v1`；也接受完整 `/v1/responses` |
| 模型 | 上游实际可用且支持原生搜索的模型 |
| API Key | 在界面中输入，留空保存会保留现有密钥 |
| 凭据引用 | 默认 `CODEX_SEARCH_API_KEY`，与聊天模型密钥独立 |
| 搜索上下文 | `medium`，可选 `low` / `high` |
| 流式传输 | 默认开启 |
| 推理强度 | 默认 `low`；`none` 表示不发送 reasoning 字段 |
| 输出上限 | 默认 4096 token |
| 超时 | 默认 90000 毫秒 |

凭据由 DSH 的凭据域管理；本插件不把密钥写入 Profile patch，不读取 Codex `auth.json`。聊天模型使用的 endpoint 与本插件搜索 endpoint 互不替代。

例如在 sub2api 中，要确认所选模型、账户路由和上游支持 **Responses 原生 `web_search`**。模型列表存在 GPT 或兼容 Chat Completions，不能单独证明搜索可用。所有搜索会向你配置的上游发送查询，并使用相应模型/搜索额度。

## Profile 行为

组合包注册 `web-search-codex` 条目，覆盖 `web` 行的配置为 `searchProvider: codex-local`。DSH patch 对 `config` 使用整对象替换；如果部署固定了自定义 `fetchProvider`，请在用户 Profile patch 的 `web.config` 中同时写回需要的 `fetchProvider`。已有用户层 `web.searchProvider` 覆盖优先级更高，需要按实际部署调整。

如果只有一个提供方可用，DSH 可自动选择；多个提供方可用时必须明确选择。本组合包已经指定 `codex-local`，不会依靠注册顺序。

## 开发与检查

```text
npm install
npm run build
npm run check
npm test
npm pack
```

构建脚本无额外构建依赖，把 `client.js` 的限定静态 ESM 源格式转换成 DSH 所需 `window.__ModuleLoader__.load` classic 模块。产物 `lib/client.js` 提交到仓库，支持直接通过 GitHub 安装。

测试使用真实 DSH 0.2.0-rc.2 包，覆盖 Loader 动态配置、凭据引用、提供方释放、组合包配置、请求格式、SSE 分块、结构化来源、失败、取消和超时。联网验证是单独执行的集成检查，测试本身不使用真实密钥或消耗额度。

## 验证范围

- 33 项自动化测试全部通过，包含 DSH 0.2.0-rc.2 的真实服务、Loader 和动态配置接口。
- 新插件的传输代码已对 sub2api Responses 网关完成一次真实搜索验证，约 7.45 秒返回回答和 25 条结构化来源。
- 自动化配置卡测试与 classic 模块检查不等同于完整 Electron 人工点击验收；详细环境、证据与限制见 `VALIDATION.md`。

## 来源与许可证

原项目：[lyd123qw2008/pi-websearch](https://github.com/lyd123qw2008/pi-websearch/tree/main/dsh-web-search-codex)，原发布包版本 `0.1.3`。本项目采用 MIT，详细来源与修改范围见 `NOTICE`。它是独立适配项目，并非 DeepSeek、OpenAI 或 Sub2API 官方插件。
