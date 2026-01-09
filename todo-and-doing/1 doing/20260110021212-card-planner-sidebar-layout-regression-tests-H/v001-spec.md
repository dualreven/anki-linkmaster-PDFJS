# Card Planner - Sidebar Layout Regression Tests（H）规格说明

**功能ID**: 20260110021212-card-planner-sidebar-layout-regression-tests-H  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 02:12:12  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-H`

## 目标
为 new-card-scheduler 的“侧边栏折叠/展开 + push 主区域”补一条防回归测试，防止再次出现遮挡。

## 测试范围
- 新增 Jest 测试（建议路径）：
  - `src/frontend/new-card-scheduler/__tests__/planner-sidebar-layout.push.contract.test.js`
- 测试目标行为：
  1) 初次安装：默认展开，`.main-content` 被推开（`marginLeft=280px` + `width=calc(100% - 280px)`）
  2) 点击按钮一次：sidebar 收起，主区域恢复（上述 style 清空）
  3) 再次点击：恢复展开并再次推开
  4) `dispose()` 后不应残留事件监听（至少不再响应点击；可通过 spy/assert）

## 依赖与约束
- 依赖 F 提供的 `installPlannerSidebarLayoutOrThrow` 导出（H 可以在本分支临时 mock，但最终应以真实实现为准）。
- 禁止修改：`.kilocode/rules/memory-bank/**`
- 仅修改：`src/frontend/new-card-scheduler/**/__tests__/**`（必要时可增加最小测试 helper 文件）

## 验收（DoD）
- 必须提交到 `worker/feature-H`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/planner-sidebar-layout.push.contract.test.js -i`

*** Add File: todo-and-doing/1 doing/20260110021212-card-planner-sidebar-layout-regression-tests-H/working-log.md
# 20260110021212-card-planner-sidebar-layout-regression-tests-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 02:12:12
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 参考 `src/frontend/pdf-home/features/sidebar/__tests__/sidebar-layout-push.test.js` 的断言方式
2. 在 new-card-scheduler 下新增回归测试文件并构造最小 DOM
3. 覆盖：默认推开 / 折叠恢复 / 再展开 / dispose 不残留
4. 自检：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成测试并交付 commit hash

