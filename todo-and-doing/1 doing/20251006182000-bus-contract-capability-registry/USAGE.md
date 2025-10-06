# 使用指南：能力发现 + 统一搜索（前后端并行开发）

本指南说明如何在不互相“撞线”的前提下，让多个前端并行对接同一个后端插件：先通过“能力发现”确认可用事件与版本，再按统一事件与数据结构调用业务功能（示例：pdf-library 搜索）。

## 启动

建议使用 `ai_launcher.py` 统一启动（后台运行，UTF-8 日志）：

```bash
python ai_launcher.py start --module pdf-home
# 或
python ai_launcher.py start --module pdf-viewer --pdf-id sample
```

检查状态/日志：

```bash
python ai_launcher.py status
python ai_launcher.py logs
```

## 事件命名与消息结构

- 事件名三段式：`{module}:{action}:{status}`，例如 `capability:discover:requested`
- 消息字段：必须包含 `type`、`timestamp`、`request_id`、`data`（对象），响应包含 `status`、`code`、`message`
- 前后端应使用相同的事件名与字段，不得擅自改动

## 能力发现（必走一步）

前端在对接任何业务域前，先做一次“能力发现”，获得后端当前支持的域与版本：

```js
import WSClient from '../../src/frontend/common/ws/ws-client.js';
import eventBus from '../../src/frontend/common/event/event-bus.js';

const ws = new WSClient('ws://127.0.0.1:8765', eventBus);
await ws.connect();

// 询问后端能力（支持哪些域/事件/版本）
const discover = await ws.request('capability:discover:requested', {}, { timeout: 5000 });
// 结果示例：{ domains: [{ name: 'pdf-library', versions: ['1.0.0'], events: [...] }, ...] }

// 如需查看某个域的详细契约（事件+Schema路径）
const describe = await ws.request('capability:describe:requested', { domain: 'pdf-library' }, { timeout: 5000 });
// 结果示例：{ domain:'pdf-library', version:'1.0.0', events:[{ type, schema:{ path, schemaHash }}, ...] }
```

注意：本项目已在 WSClient 中实现“泛化请求-响应结算”，凡是 `*:completed|failed` 或带 `status` 的消息，只要 `request_id` 匹配，都会自动完成 Promise 结算。

## 统一搜索（pdf-library）

在完成能力发现后，前端即可使用统一搜索接口：

```js
// 请求
const result = await ws.request('pdf-library:search:requested', { query: 'tag:math', limit: 20 }, { timeout: 8000 });
// 返回结果结构：{ items: [{ pdf_id, title, page_count?, tags? }], total? }
```

后端返回值符合 `schemas/pdf-library/v1/messages/search.completed.schema.json` 契约。

## 上传 PDF（示例）

```js
const added = await ws.request('pdf-library:add:requested', { filepath: 'C:/path/to/doc.pdf' }, { timeout: 10000 });
// 返回：{ file: { id, filename, file_size }, original_type? }
```

注意：该接口会调用后端的 PDFLibraryAPI 进行入库，成功后通过 `pdf-library:add:completed` 进行回应；失败会返回 `pdf-library:add:failed`，并包含 `error` 字段。

## 读取持久化（KV 示例）

使用统一存储接口读取数据（最小实现：只提供 get）：

```js
const kv = await ws.request('storage-kv:get:requested', { namespace: 'pdf-home', key: 'last-query' }, { timeout: 3000 });
// 返回：{ value: any }
```

## 契约位置

- 契约样例（JSON Schema）：`schemas/**`
- 规格说明：`v001-spec.md`

建议流程：先在 `schemas/**` 提交或更新契约，再开始前后端并行开发；如需兼容旧事件名，使用总线层的 adapter（后端已保留旧事件映射）。

## 白名单机制与新增事件流程
- 全局事件与所有 WebSocket 消息类型均受白名单限制：
  - 未注册的“全局事件”（非 @ 开头）在前端 EventBus 上将被阻止订阅/发布，并输出错误。
  - 未注册的 WebSocket 请求（*:requested）在 WSClient.request() 将被拒绝并抛错。
  - 未注册的 WebSocket 响应在 WSClient 将被拦截，若携带 request_id 则按失败结算。
- 如何新增事件：
  1) 先在 `schemas/**` 提交/更新契约（JSON Schema），并在 `event-constants.js` 增加常量
  2) 提交 PR 评审；合入后方可在前后端使用
  3) 如需兼容旧名，使用后端的映射/adapter 做灰度迁移

## 存储服务（KV & FS）
- KV：get/set/delete
```js
await ws.request("storage-kv:set:requested", { namespace: "pdf-home", key: "last-query", value: { q: "math" } });
const kv = await ws.request("storage-kv:get:requested", { namespace: "pdf-home", key: "last-query" });
await ws.request("storage-kv:delete:requested", { namespace: "pdf-home", key: "last-query" });
```
- FS：read/write（路径均相对 data/fs/）
```js
// 写入
const contentB64 = btoa("hello world");
await ws.request("storage-fs:write:requested", { path: "u/test.txt", content: contentB64, overwrite: true });
// 读取
const r = await ws.request("storage-fs:read:requested", { path: "u/test.txt" });
```

## 能力域（当前覆盖）
- capability：discover/describe
- pdf-library：list/search/add/remove/info/config-read/config-write
- bookmark：list/save
- pdf-page：load/preload/cache-clear
- storage-kv：get/set/delete
- storage-fs：read/write
- system：heartbeat

## 列表/详情/配置/查看器（pdf-library）
```js
// 列表
await ws.request("pdf-library:list:requested", { pagination: { limit: 20, offset: 0 } });
// 详情
await ws.request("pdf-library:info:requested", { pdf_id: "id-1" });
// 配置读写
await ws.request("pdf-library:config-read:requested", {});
await ws.request("pdf-library:config-write:requested", { recent_search: [{ text: "math", ts: Date.now() }] });
// 打开查看器（回执）
await ws.request("pdf-library:viewer:requested", { pdf_id: "id-1" });
```

## 书签（bookmark）
```js
await ws.request("bookmark:list:requested", { pdf_uuid: "id-1" });
await ws.request("bookmark:save:requested", { pdf_uuid: "id-1", bookmarks: [], root_ids: [] });
```

## 页面（pdf-page）
```js
await ws.request("pdf-page:load:requested", { file_id: "id-1", page_number: 1 });
await ws.request("pdf-page:preload:requested", { file_id: "id-1", pages: [2,3,4] });
await ws.request("pdf-page:cache-clear:requested", { file_id: "id-1" });
```

## 心跳（system）
```js
await ws.request("system:heartbeat:requested", {});
```
