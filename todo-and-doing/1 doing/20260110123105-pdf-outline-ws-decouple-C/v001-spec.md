# [pdf-viewer][C][P1] pdf-outline：UI 去 WS 直连耦合（WS 只进 Manager/Adapter）

**功能ID**: 20260110123105-pdf-outline-ws-decouple-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 12:31:05  
**预计完成**: 2026-01-12  
**状态**: 开发中  
**负责分支**: `worker/refactor-C`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-C`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260108-pdfviewer-scan-D.md`
- 发现：`outline-sidebar-ui.js` 直接订阅 `WEBSOCKET_EVENTS`，导致 UI 与 WS 层强耦合，难测试、难复用、易引入跨层副作用。

## 目标
1) WS 消息只进入 `OutlineManager`（或 adapter/bridge），转成领域事件/状态（如 `OUTLINE.LOAD.SUCCESS`）。
2) UI 组件只订阅领域事件/store，不直接引用 `WEBSOCKET_EVENTS`。

## 约束
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
  - 必要时可改相邻 adapter/bridge（最小化）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：关键依赖缺失直接 throw。

## 必须新增回归测试（至少 1 条）
- 建议覆盖至少一项：
  1) UI 组件初始化时不再注册 `WEBSOCKET_EVENTS` 监听（可用 spy/rg 断言或运行时 spy）；
  2) Manager 收到 WS 消息后发出领域事件，UI 能正常渲染 outline（JSDOM）。

## 验收（DoD）
- 必须提交到 `worker/refactor-C`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

