# PDFViewerManager：PDF.js EventBus bridge 可卸载（防监听泄漏）

**功能ID**: 20260110195258-pdfviewer-manager-pdfjs-bridge-uninstall-E
**优先级**: 中（P1-B 补洞：监听器生命周期清晰）
**版本**: v001
**创建时间**: 2026-01-10 19:52:58
**状态**: 设计中

## 现状说明
- `PDFViewerManager` 建立 PDF.js EventBus → app EventBus 的桥接：
  - `src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js`
- 目前 `pdfjsEventBus.on(...)` 未见对应 `off/remove`，install/uninstall 或重复 load 场景可能导致监听累积。

## 存在问题
- 监听器泄漏/重复触发：重复创建/销毁 viewer 或重复 load 时，page/scale/render 事件可能被桥接多次，导致 UI/状态重复更新。

## 提出需求
- 让 `PDFViewerManager` 的桥接具备明确卸载能力：
  - 安装时收集 unsubscribe/off；
  - 卸载/销毁时确保解绑（Fail-Fast：若 pdfjsEventBus 不支持 off，需要明确策略而不是静默忽略）。

## 解决方案
- 在 `#setupEventBridge` 内部：
  - 若 `pdfjsEventBus.on(...)` 能返回 off：收集并在 destroy/uninstall 调用；
  - 若不返回：使用 pdfjsEventBus 的 `off` API（如存在）并保持 handler 引用；
  - 若两者都不支持：明确抛错（禁止“无法卸载也继续跑”的兜底）。

## 约束条件
### 允许修改的目录（scope）
- `src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js`
- 相关测试路径（同一 feature 范围内）

### 严格遵循代码规范和标准
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准
### 单元测试（必需）
- 新增至少 1 条防回归测试：
  - install → uninstall → install 后，同一 pdfjsEventBus 事件只桥接一次（不重复 emit）。

### 门禁（必需）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增/改动测试路径> -i` ✅

## 协作协议（必须遵守）
- 必须提交到 `anki-linkmaster-E` worktree，并给出 **commit hash**。
- `working-log.md` 必须记录：off 策略、失败策略、回归测试路径与命令。
