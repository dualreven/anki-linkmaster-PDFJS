# 任务说明（D）- Outline + Search 组合场景爆栈修复（P0）

## 0. 任务目标
修复手工点检中仍存在的报错：**搜索栏打开时点击大纲跳转**，出现 Toast/日志：
- `[前端异常] Maximum call stack size exceeded`
- `事件回调执行出错: Maximum call stack size exceeded`（疑似事件：`pdf-viewer:navigation:goto`，subscriberId：`InfraUICoordinator.NavGoto`）

要求：功能保持正常，且不再出现上述报错。

> 注意：该报错已确认**不是** tracing 的 JSON stringify 爆栈（第二轮已修复），更像是 **同步事件环/递归调用** 导致 RangeError。

## 1. 范围限制（必须遵守）
- 只修复与该 bug 相关的代码路径；避免顺手重构。
- 尽量限制改动范围在：
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
  - `src/frontend/pdf-viewer/features/pdf-search/**`（如存在）
  - `src/frontend/pdf-viewer/features/infra-ui/**`
  - `src/frontend/pdf-viewer/features/infra-nav-core/**`
- **不要修改** `.kilocode/rules/memory-bank/**`（由 main 验收时统一更新，避免冲突）。

## 2. 复现步骤（必须能复现）
1. 启动 `gui_launcher`
2. 打开任意 PDF
3. 打开搜索栏（Search UI 处于打开状态）
4. 点击大纲任意条目触发跳转

## 3. 交付标准（DoD）
- 不再出现 `Maximum call stack size exceeded` toast/日志。
- 保持跳转/搜索/大纲功能正常。
- 必须补一条**防回归测试**（能在 Jest 下稳定复现“修复前会炸、修复后不炸”的核心条件）。
- 通过门禁：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath <你新增/修改的测试> -i`

## 4. 排查建议（给你节省时间）
- 重点看 `NavigationService.navigateTo()`（会 `emit NAVIGATION.GOTO`）与 `InfraUICoordinator.NavGoto -> uiControls.goToPage()`（会设置 `currentPageNumber`）之间是否形成同步闭环。
- Search 打开时，可能存在额外订阅者在 `NAVIGATION.GOTO` / `PAGE.CHANGING` 上再次触发导航，导致 **emit → handler → emit → ...**。
- 你需要明确“哪个 handler 在同步链路里再次 emit 了相同事件”，然后断开闭环（例如：去重/actorId guard/重入锁/改为异步 microtask 等），但不要吞掉异常。

## 5. 提交要求
- 提交 1~2 个 commit（一个修复 + 一个测试也可以）。
- 更新 `todo-and-doing/1 doing/20260109175600-outline-search-goto-stackoverflow-D/working-log.md`，写清：
  - 根因
  - 修复点（文件+函数）
  - 测试路径与运行命令

