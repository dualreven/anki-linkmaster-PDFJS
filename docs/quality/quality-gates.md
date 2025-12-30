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

行数门禁（P0：止血）
- 目标：阻止前端单文件继续面条化（历史大文件允许逐步拆分，不要求一次性清零）。
- 规则（基线 + 增量）：
  - `src/frontend/**` 源码：禁止新增 `>500` 行文件；
  - 对基线中已 `>500` 行的历史文件：禁止行数继续增长（允许减少）。
- 排除：
  - 构建产物：`src/frontend/dist/**`
  - 测试目录：`**/__tests__/**`、`**/__smoke__/**`
- 基线文件：`scripts/ci/baselines/frontend-line-limit.json`
- 运行：
  - 检查：`pnpm run ci:frontend-line-limit`
  - 重建基线（仅在“接受现状”或大规模移动文件时使用）：`pnpm run ci:frontend-line-limit:write-baseline`

测试
- 单元/集成：Jest（前端）、pytest（后端/handlers/DB 插件）
- 端到端：采用“多段集成 + 流程编排”（无浏览器）覆盖 pdf-home 添加、pdf-viewer 导航与 outline CRUD
  - 运行：`pnpm -s e2e:flow:<module>:<feature>`（如 `pnpm -s e2e:flow:pdf-home:add-pdf`）
  - 目标：安装顺序无失败、导航/CRUD 链路可用；产物与报告完整可溯源

契约差异建议（CI）
- 比对前端 `WEBSOCKET_MESSAGE_TYPES` 与后端 `MessageType` 的集合差异
- 差异即失败，阻断契约漂移

示例脚本与用法
- 脚本：`scripts/ci/ws-contract-diff.mjs`（Node ESM）
- 运行：`pnpm run ci:ws-types-diff`
- 原理：读取 `src/frontend/common/event/event-constants.js` 与 `src/backend/msgCenter_server/core/message_types.py`，提取三段式消息类型集合并比较差集。

迁移任务与历史说明
- 见 `todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md`
