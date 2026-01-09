# 任务说明（A）- 全局监听统一入口 + lint 门禁（P1）

## 0. 任务目标
把 “window/document 全局事件监听” 变成可管控的硬规则：
- 在 `src/frontend/pdf-viewer/**` 范围内，禁止散落使用 `window.addEventListener`/`document.addEventListener`；
- 必须通过一个统一入口（例如 `core/global-listener-scope.js`）注册，并返回取消函数；
- 用 ESLint 自定义规则或现有门禁脚本把这条规则 **lint 化**（接入 `pnpm -s run lint`）。

## 1. 范围限制
- 允许改：
  - ESLint 自定义规则（若已有相同模式，优先复用）
  - `src/frontend/pdf-viewer/core/**`（新增统一入口模块）
  - 对应测试（如果仓库对 ESLint rule 有测试模式；若无，则至少补一个 “lint 门禁脚本单测/快照” 或最小可运行验证方式写进 working-log）
- 不要改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 规则生效：在 pdf-viewer 目录内新增 `window.addEventListener` 代码会被 lint 拦截（明确错误信息）。
- 不破坏现有功能：允许的注册点（比如 `LifecycleManager`）要能通过（可用白名单/路径豁免，但要最小化）。
- 门禁通过：`pnpm -s run lint`。

## 3. 提交要求
- 1 个 commit（规则 + 最小验证/测试）。
- 更新 `todo-and-doing/1 doing/20260109211007-global-listener-lint-A/working-log.md`。

