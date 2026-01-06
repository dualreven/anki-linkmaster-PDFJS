# 总线契约与能力注册中心 规格说明

**功能ID**: 20251006182000-bus-contract-capability-registry
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-06 18:20:28
**预计完成**: 2025-10-08
**状态**: 设计中

## 现状说明
- 当前为“前端插件 + 事件总线 + 后端插件”的并行开发模式，事件名三段式，JSON消息有统一字段（type/request_id/timestamp/metadata/data）。
- 新需求需要前端↔总线↔后端联动并访问持久化存储；多个前端同时对接同一后端插件，若“说法不统一”，容易互相踩线。

## 存在问题
- 事件和数据格式容易各自为政：不同前端可能各自定义字段，后端也在演进，导致不兼容。
- 缺少“后端能做什么”的统一入口：前端不知道哪些事件可用、用哪个版本。
- 持久化读写入口不统一：有时直连数据库，造成多条通道、写法不一致。

## 提出需求
- 统一说法（事件名和数据结构），大家按同一份“约定文档”来接入。
- 后端提供“能力清单”，前端启动时先确认对齐版本和可用事件。
- 持久化访问走统一接口（KV/FS），不让前端直接摸数据库。
- 允许旧→新平滑过渡，不打断并行开发。

## 解决方案
- 契约优先与版本化
  - 事件名固定三段式：{module}:{action}:{status}；JSON 	ype 等于事件名。
  - 元数据 metadata.version 使用语义化版本（MAJOR.MINOR.PATCH）。破坏性变更必须提升 MAJOR。
  - 在本任务目录 schemas/ 维护契约 JSON Schema（示例已包含）。
- 能力注册中心（能力清单）
  - “发现”事件：capability:discover:requested → capability:discover:completed 返回可用域/版本/事件列表。
  - “描述”事件：capability:describe:requested → capability:describe:completed 返回指定域的事件与 Schema URI/hash。
- 请求-响应规范
  - 请求：*:requested；成功：*:completed；失败：*:failed；响应 status=success/error 与事件状态一致。
  - 使用 equest_id 作为关联 ID；可选 eplyTo 指定回执事件名。
- 存储服务抽象
  - KV：storage-kv:get|set|delete:requested → *:completed|failed；字段：
amespace/key/ttl/idempotencyKey。
  - FS：storage-fs:read|write:requested → *:completed|failed；字段：path/content(base64)/mode/overwrite。
- 兼容策略
  - 总线层提供“适配器”，把旧事件名转为新事件名；保留一段时间再下线旧名。

## 约束条件
### 仅修改本模块代码
仅在本任务文档范围内整理与迁移文档与样例，不修改其他模块代码。

### 严格遵循代码规范和标准
必须优先阅读和理解 docs/SPEC/SPEC-HEAD-communication.json 与 docs/SPEC/JSON-MESSAGE-FORMAT-001.md 等规范；文件 I/O 使用 UTF-8；换行为 \n。

## 可行验收标准
### 单元测试（文档阶段）
- 使用 JSON Schema 校验示例消息（后续加入轻量脚本）。
- 事件名三段式与字段齐全检查（后续加入脚本）。

### 端到端测试（最小闭环）
- 前端发 pdf-library:search:requested，后端返回 ...:completed，equest_id 对齐；字段满足 Schema。

### 接口实现（示例域）
#### 接口1: 能力发现（discover）
函数/事件: capability:discover:requested
描述: 请求后端返回可用域/版本/事件
参数: {}（可带过滤条件）
返回值: { domains: [{ name, versions, events }] }

#### 接口2: 搜索（search）
函数/事件: pdf-library:search:requested
描述: 搜索 PDF 库
参数: { query, limit?, offset?, order_by? }
返回值: { items: [{ pdf_id, title, ... }], total? }

### 事件规范（示例）
- capability:discover:requested|completed
- pdf-library:search:requested|completed|failed
- storage-kv:get:requested|completed|failed

