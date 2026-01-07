# Annotation Sidebar UI 数据驱动化（A）规格说明

**功能ID**: 20260107100900-observable-annotation-sidebar-A
**优先级**: 高
**版本**: v001
**创建时间**: 2026-01-07 10:09:00
**预计完成**: 2026-01-08
**状态**: 设计中

## 现状说明
- `AnnotationManager (v2)` 已具备 `store`（ObservableState），并已按“Manager 不订阅 EventBus”方向收敛。
- `AnnotationSidebarUI` 当前仍主要通过 EventBus 的 `ANNOTATION.CREATED/UPDATED/DELETED/...` 事件来做 DOM 原子更新，属于“混合态”。

## 存在问题
- Feature 内部数据流不一致：Store 更新与 UI 更新依赖事件是否完整发射，链路难追踪、易漏。
- 代码冗余：业务逻辑需同时维护 store 与 emit 事件；UI 需要维护多组回调。
- 维护成本高：难以通过“状态快照”做整体渲染与回归验证。

## 提出需求
- 将 `AnnotationSidebarUI` 改为**订阅 `AnnotationManager.store`** 的数据驱动 UI（render by state）。
- Feature 内部（UI ↔ Manager）不再依赖 EventBus 的 CRUD 事件来做 UI 更新；EventBus 仅保留跨 Feature/跨窗口桥接需要的事件。

## 解决方案
1) UI 注入 Manager：让 `AnnotationSidebarUI` 构造函数接收 `annotationManager`（或在 initialize 传入）。
2) UI 订阅 store：订阅 selector（`state.annotations` / 以及影响 UI 的派生字段），触发 `render(annotations)` 或 diff-render。
3) 移除 UI 对 `ANNOTATION.CREATED/UPDATED/DELETED` 的直接监听与对应“原子 DOM 更新”路径。
4) UI 命令仍调用 manager：例如删除/编辑/跳转继续走 `annotationManager.delete/update/...`，保持单向流（Command -> Store -> View）。
5) 必须保证卸载：`uninstall/destroy` 时 unsubscribe，避免泄漏。

## 约束条件
### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer/features/pdf-annotation/**`（以及其同目录 tests），不可修改其他 Feature 内部实现。

### 严格遵循代码规范和标准
必须优先阅读和理解 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 下的规范与 refs。

## 可行验收标准
### 单元测试
- 新增至少 1 条防回归测试：验证当 `annotationManager.store` 的 `annotations` 变化时，Sidebar UI 的渲染结果更新（无需 EventBus CRUD 事件）。
- 新增至少 1 条防回归测试：验证 `uninstall/destroy` 后 store 更新不再触发 UI 更新（或不再触发副作用）。

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

