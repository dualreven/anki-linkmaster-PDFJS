# Anchor Sidebar UI 数据驱动化（B）规格说明

**功能ID**: 20260107100900-observable-anchor-sidebar-B
**优先级**: 高
**版本**: v001
**创建时间**: 2026-01-07 10:09:00
**预计完成**: 2026-01-08
**状态**: 设计中

## 现状说明
- `features/pdf-anchor/**` 仍以 EventBus 事件流与命令式 DOM 更新为主，缺少明确的 `Manager + store` 单向数据流。

## 存在问题
- 事件流分散：状态来源不唯一，UI 更新路径难追踪。
- 生命周期风险：订阅/监听分散，易出现 destroy/uninstall 不彻底。

## 提出需求
- 引入/补齐 `AnchorManager + store(ObservableState)`，形成“Command -> Store -> View”的单向流。
- `AnchorSidebarUI`（或对应 UI）订阅 store 做渲染，不再依赖 EventBus 原子事件更新 UI。

## 解决方案
1) 若已存在 manager：补 `store` 并将 UI 改为 `store.subscribe`。
2) 若不存在 manager：新增 `services/anchor.manager.js`（只承载纯逻辑 + store），UI 只做渲染与发起命令。
3) 保留 EventBus 作为跨 Feature 的桥接层（例如导航、WS 交互），但禁止在 Feature 内部做逻辑闭环。
4) 统一资源释放：订阅与 DOM 监听全部纳入 unsub bag / destroy 清理。

## 约束条件
### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer/features/pdf-anchor/**`（以及其同目录 tests），不可修改其他 Feature 内部实现。

### 严格遵循代码规范和标准
必须优先阅读和理解 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 下的规范与 refs。

## 可行验收标准
### 单元测试
- 新增至少 1 条回归测试：store 状态变化驱动 UI 更新（无需 EventBus 事件）。
- 新增至少 1 条回归测试：destroy/uninstall 后不再响应状态变化（无泄漏）。

### 质量门禁
- `pnpm -s run lint` 通过
- `pnpm exec jest --runTestsByPath <本任务新增/改动用例>` 通过

## 协作协议（并行开发提速版，必须遵守）
本项目的“并行”目标是：**各分支并行排雷，主干一次性集成验收**，避免在合并阶段才补交付物。

### 完成定义（DoD：没有 commit hash 就不算完成）
- 必须提交到对应 worktree 分支（工作区干净），并给出 **commit hash**。
- 必须通过最小验收：`pnpm -s run lint` + “本任务新增/改动的测试文件集”。
- 必须在 `working-log.md` 写明：改动范围（目录）、验收命令与结果、风险点（如跨模块边界）。

### 合入 main 的交付格式（复制这段到群里/issue）
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `<只改动的目录列表>`
- `tests`: `<lint命令>` + `<jest --runTestsByPath ...>`（贴出通过结论）
- `notes`: `<是否触碰跨模块契约/是否需要人工点检>`

### 集成方式（主干一次性验证）
- 默认不做 rebase；**main 仅 cherry-pick 功能提交**（避免把“同步 main 的提交”二次合并）。
- main 侧只跑一次门禁：`lint` + `jest --runTestsByPath <四个任务新增测试并集>`；通过即合入。

