# 质量门禁（Lint/测试/E2E/契约差异）

Lint
- 规则核心
  - `custom/event-name-format=error`：三段式 + 禁字面量/变量/模板字符串（事件名必须来自命名空间常量）
  - `custom/no-cross-feature-internals=error`：禁止跨特性内部 import，避免耦合
  - 其余通用质量规则：eqeqeq、semi、quotes、indent、no-trailing-spaces、eol-last、no-multiple-empty-lines、curly 等
- 例外与覆写
  - EventBus 内核文件关闭事件名规则（保持灵活性）
  - 测试目录、fixtures、__smoke__ 可放宽限制（不影响生产代码）
- 命令分组
  - 全量：`pnpm run lint`
  - 核心域：`pnpm run lint:strict:pdf-core`、`lint:strict:common-core`
  - 功能域：`pnpm run lint:features`、或 CI 精简 `lint:features:ci`

测试
- 单元/集成：Jest（前端）、pytest（后端/handlers/DB 插件）
- 端到端：Playwright 覆盖 pdf-home 添加、pdf-viewer 导航与 outline CRUD
  - 运行：`pnpm run e2e:browser`
  - 目标：安装顺序无失败、导航/CRUD 链路可用

契约差异建议（CI）
- 比对前端 `WEBSOCKET_MESSAGE_TYPES` 与后端 `MessageType` 的集合差异
- 差异即失败，阻断契约漂移

示例脚本与用法
- 脚本：`scripts/ci/ws-contract-diff.mjs`（Node ESM）
- 运行：`pnpm run ci:ws-types-diff`
- 原理：读取 `src/frontend/common/event/event-constants.js` 与 `src/backend/msgCenter_server/core/message_types.py`，提取三段式消息类型集合并比较差集。

迁移任务与历史说明
- 见 `todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md`
