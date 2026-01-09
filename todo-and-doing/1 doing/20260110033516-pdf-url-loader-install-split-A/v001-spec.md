# [pdf-viewer][A] pdf-url-loader：install 拆分与纯函数化（P1）规格说明

**功能ID**: 20260110033516-pdf-url-loader-install-split-A  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 03:35:16  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/refactor-A`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-A`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260109-infra-nav-url-loader-scan-F.md`
- 现状：`src/frontend/pdf-viewer/features/pdf-url-loader/index.js` 入口过重（依赖解析/参数解析/网络/事件/日志混杂），属于典型“装配层变上帝函数”。

## 目标
在不改变对外行为的前提下，把 `PDFUrlLoaderFeature.install()` 拆为：
1) **依赖解析**（EventBus / navigationService / wsClient 等）集中一处；
2) **URL 参数解析与校验** 变为纯函数（无 DOM/无 eventBus/无 wsClient）；
3) `install()` 仅做 wiring + 调度（必要时调用 coordinator），destroy/uninstall 必须对称清理。

## 约束
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`
  - 如确需：`src/frontend/pdf-viewer/features/infra-nav-core/**`（仅用于依赖注入/类型对齐）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：参数缺失/非法必须 throw；禁止“静默兜底继续跑”。

## 建议拆分（命名可调整）
- `deps/resolve-url-loader-deps.js`：集中解析依赖（缺失直接 throw）
- `url-params/parse-url-load-request.js`：纯函数：`(search) -> { pdfId, pageAt, position, ... }`（非法 throw）
- `coordinator/url-load-coordinator.js`：决定是否触发 ws 请求/emit FILE.LOAD.REQUESTED（可测试）

## 必须新增回归测试（至少 1 条）
- 新增/更新一个 Jest 用例，覆盖：
  1) wsClient 不可用时，install 只 wiring，不应触发网络副作用；
  2) URL 参数非法时直接 throw（Fail-Fast）；
  3) uninstall/destroy 后不再响应事件（至少断言不会再 emit/不会再调用 wsClient）。

## 验收（DoD）
- 必须提交到 `worker/refactor-A`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

