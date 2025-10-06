# 总线契约与能力注册中心（Contract-First 指南）

## 背景与目标
- 多前端 Feature 需要并行接入同一后端插件并访问持久存储；若无统一契约/版本，会造成事件线路分叉与回归成本。
- 目标：通过“契约优先 + 能力注册中心 + 版本化”规范化前端↔总线↔后端联动，确保可并行开发、可演进、可回滚。

## 事件命名与消息映射
- 事件名采用三段式：`{module}:{action}:{status}`，示例：`pdf-library:search:requested`。
- JSON 消息 `type` 字段等于事件名；响应额外包含 `status`（success/error）以兼容既有规范。
- 公共字段：`timestamp`(number) / `request_id`(uuid) / `metadata.version`(semver) / `data`(object)。

## 请求-响应约定
- 请求：`*:requested`，必须携带 `request_id`。
- 成功响应：`*:completed` + `status=success`；失败响应：`*:failed` + `status=error`。
- 关联标识：`correlationId = request_id`；可选 `replyTo` 指定回执事件名（缺省为规范约定响应名）。

## 能力注册中心（Capability Registry）
- 发现：`capability:discover:requested` → `capability:discover:completed` 返回后端可用域列表与版本范围。
- 描述：`capability:describe:requested` → `capability:describe:completed` 返回指定域的事件清单与 JSON Schema URI/哈希。
- 签名：可选 `schemaHash`（sha256）用于前端缓存与一致性校验。

## 存储服务抽象（最小接口）
- KV：`storage-kv:get|set|delete:requested` → `*:completed|failed`；支持 `namespace/key`、`ttl`、`idempotencyKey`。
- FS：`storage-fs:read|write:requested` → `*:completed|failed`；支持 `path`、`content(base64)`、`mode`、`overwrite`。
- 错误模型：`code`（字符串）、`message`、`details`；尽量避免泄漏底层实现细节。

## 版本策略
- 语义化版本：MAJOR 破坏性变更；MINOR 向后兼容新增；PATCH 向后兼容修复。
- CI Gate：禁止在未提升 MAJOR 的前提下更改 Schema 必填字段或字段语义。

## 并行开发流程（强制）
1) 先提交“契约 PR”（docs/contracts/* + 本文档必要更新），评审通过后合并。
2) 前后端分别基于相同版本的 Schema 开发，实现端内验证；必要时用 adapter 兼容旧事件名。
3) 提交实现 PR 前，跑契约一致性校验与路由冒烟测试。

## 迁移与兼容
- 旧→新事件名：提供 adapter 在总线层转发，逐步下线旧名。
- 实验特性：通过 `metadata.flags` 与命名空间隔离，避免影响稳定通道。

## 参考规范
- docs/SPEC/FRONTEND-EVENT-NAMING-001.md
- docs/SPEC/JSON-MESSAGE-FORMAT-001.md
- .kilocode/rules/memory-bank/context.md（三段式命名与总线说明）
