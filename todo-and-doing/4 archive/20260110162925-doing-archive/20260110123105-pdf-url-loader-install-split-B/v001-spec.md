# [pdf-viewer][B][P1] pdf-url-loader：install 拆分 + 导航 Gate 状态机收敛

**功能ID**: 20260110123105-pdf-url-loader-install-split-B  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 12:31:05  
**预计完成**: 2026-01-12  
**状态**: 开发中  
**负责分支**: `worker/refactor-B`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-B`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260109-infra-nav-url-loader-scan-F.md`
- 发现：
  - `PDFUrlLoaderFeature.install` 职责过载（依赖解析/参数解析/网络/事件/日志混杂）
  - `#handleNavigationRequested` 兼做大状态机（pending/去重/重载/导航/成功失败清理），容易遗留 `pendingManualNav` 等状态

## 目标
1) 拆分 `install()`：只保留 wiring；把依赖解析与 URL 参数解析抽成可测试的纯逻辑模块。
2) 抽出 `NavigationRequestGate`（或等价对象），把 `pendingManualNav` / `navInProgress` / `inflightNavKey` 的状态与 reset 规则收敛到单处：
   - 成功/失败/卸载时都必须显式 reset；
   - 禁止 `JSON.stringify` 去重导致循环结构未捕获异常。

## 约束
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`
  - 必要时可改 `src/frontend/pdf-viewer/features/infra-nav-core/**` 的注入点（最小化）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：参数非法必须 throw；禁止静默兜底。

## 必须新增回归测试（至少 1 条）
- 建议覆盖至少两项：
  1) 连续触发两次 URL 导航请求：第二次在 gate 未释放前被去重/拒绝（行为明确）；
  2) `FILE.LOAD.FAILED` 或 uninstall 后，gate/pending 状态被清空，不会重放旧请求；
  3) 循环结构 payload 不会导致未捕获异常（明确 throw 并被测试捕获）。

## 验收（DoD）
- 必须提交到 `worker/refactor-B`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

