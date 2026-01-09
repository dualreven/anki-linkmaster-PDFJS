# [pdf-viewer][D] pdf-search：debounce/throttle 可取消（P2）规格说明

**功能ID**: 20260110033519-pdf-search-debounce-cancel-D  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 03:35:19  
**预计完成**: 2026-01-11  
**状态**: 开发中  
**负责分支**: `worker/refactor-D`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-D`）

## 背景（来自扫描报告）
- 报告：`docs/reports/20260108-pdfviewer-scan-D.md`（P2）
- 现状：`src/frontend/pdf-viewer/features/pdf-search/utils/debounce.js` 生成的函数不可取消；组件销毁后可能仍触发延迟回调。

## 目标
让 debounce/throttle 支持取消，并确保调用方在 destroy/uninstall 时对称清理：
- `debounce()` 返回值提供 `cancel()`（或返回 `{ fn, cancel }`，命名不限但必须清晰）；
- `throttle()` 同理（至少对内部 timeout 可取消）；
- 在 `pdf-search` 的销毁路径调用 cancel，避免 destroy 后回调写 DOM/发事件。

## 约束
- 仅允许修改：
  - `src/frontend/pdf-viewer/features/pdf-search/utils/debounce.js`
  - `src/frontend/pdf-viewer/features/pdf-search/**`（仅为接线 cancel）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：入参 func 非函数必须 throw。

## 必须新增回归测试（至少 1 条）
- 新增 Jest + fake timers 测试覆盖：
  1) debounce 后调用 `cancel()` 再推进时间，不应执行回调；
  2) 组件 destroy 调用 cancel 后，推进 timers 不应触发任何副作用。

## 验收（DoD）
- 必须提交到 `worker/refactor-D`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径集合> -i`

