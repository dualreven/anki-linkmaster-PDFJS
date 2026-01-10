# 20260110175029-pdf-annotation-sidebar-zombie-cleanup-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 17:50:29
### 工作内容:
- 清理 sidebar Zombie Code，并补回归测试保证“仅 store 驱动”。
### 工作步骤:
1. 定位 sidebar 当前真实使用的订阅入口（store subscribe）
2. 移除 subscriptions.js 中无效 CRUD handlers 或彻底删除文件并修正引用
3. 新增 Jest：更新 store → 断言 sidebar render 更新
### 工作结果:
- 待开始
### 存在问题:
- 待开始
### 下一步计划:
- 实现并提交（附测试路径）

## 工作记录2
**时间**: 2026-01-10 18:14:30
### 工作内容:
- 确认 `AnnotationSidebarUI` 已为 store 驱动渲染，且 `subscriptions.js` 不包含 CRUD 订阅（仅保留交互/协作事件）。
- 强化回归测试：确保无论 `eventBus.on` 还是 `eventBus.onGlobal`，都不会订阅 CRUD 事件；列表更新仅由 store 驱动。
### 工作步骤:
1. 复核 `src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/subscriptions.js`：仅保留非数据类订阅（tool/sidebar/selected）。
2. 复核 `src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui.js`：`annotationManager.store.subscribe(..., fireImmediately:true)` 驱动渲染。
3. 回归测试增强：`annotation-sidebar-ui.store-driven.test.js` 合并统计 `on`/`onGlobal` 的订阅事件，断言不包含 CRUD 常量。
4. 自验：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-annotation/components/__tests__/annotation-sidebar-ui.store-driven.test.js -i`
5. 提交：`test(pdf-annotation): harden sidebar store-driven contract`
### 工作结果:
- ✅ Lint：通过（`pnpm -s run lint`）
- ✅ Jest：通过（2 tests）
- ✅ Commit：`b115188`（`worker/refactor-C`）
