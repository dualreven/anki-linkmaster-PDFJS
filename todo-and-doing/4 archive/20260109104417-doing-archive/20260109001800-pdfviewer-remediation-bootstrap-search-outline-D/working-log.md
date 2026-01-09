# 20260109001800-pdfviewer-remediation-bootstrap-search-outline-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-09 00:18:00
### 工作内容:
- 任务创建（等待 D worktree 开工）
### 工作步骤:
1. 阅读 `v001-spec.md`
2. 阅读 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
3. 先做 P0（全局监听器卸载）并补测试
4. 再做 search/outline 解耦并补测试
### 工作结果:
- N/A
### 存在问题:
- N/A
### 下一步计划:
- D worktree 开工并按 DoD 交付 commit hash

## 工作记录2
**时间**: 2026-01-09 08:30:00
### 工作内容:
- 按 v001-spec 完成 bootstrap/search/outline P0 清理与解耦，并补最小回归测试。
### 改动范围（严格）
- `src/frontend/pdf-viewer/bootstrap/**`
- `src/frontend/pdf-viewer/features/pdf-search/**`
- `src/frontend/pdf-viewer/features/pdf-outline/**`
### 工作结果:
- P0：把 Ctrl/Cmd+Wheel/Key 的 page zoom guard 收敛为可卸载 Feature，并补回归测试验证 `removeEventListener` 发生。
- search：DOM manager 只管 DOM，改为 fail-fast + 可注入 logger；SearchFeature 统一收集 `eventBus.on(...)` 的 unsubscribe 并在 uninstall 清理。
- outline：UI 选中节点不再走 URL 参数导航事件，改为发领域事件 `OUTLINE.NAVIGATE.REQUESTED`；同时补齐 OutlineSidebarUI 的 destroy 链路（uninstall 时销毁）。
### 验收（最小集合）:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath "src/frontend/pdf-viewer/bootstrap/__tests__/page-zoom-guard-feature.cleanup.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js" "src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-feature.install.test.js" --runInBand` ✅
### 存在问题:
- N/A
### 下一步计划:
- DoD 交付：`commit(s)`：`f095619`
