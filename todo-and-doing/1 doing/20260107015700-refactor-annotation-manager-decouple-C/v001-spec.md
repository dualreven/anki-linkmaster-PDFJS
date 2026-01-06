# AnnotationManager V2 去 EventBus 依赖规格说明

**功能ID**: 20260107015700-annotation-manager-decouple-C  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-07 01:57:00  
**状态**: 设计中

## 现状说明
- 当前 `AnnotationManager V2` 仍持有 `eventBus` 并在 `create/update/delete/load` 内部直接 `emit` 领域事件。
- 目标架构是：**Manager 纯逻辑 + Observable store**；EventBus 桥接由 Feature 负责（便于测试与解耦）。

## 存在问题
- Manager 依赖 EventBus，会把“业务逻辑 + 跨模块通信”揉在一起，易面条化。

## 提出需求
- `AnnotationManager V2` 不再直接 `emit` 事件；改为返回结果/抛错，由 `AnnotationFeature` 统一对外发射事件。
- 行为保持一致（外界仍能收到同名事件）。

## 解决方案
- 调整 `annotation.manager.v2.js`：
  - 移除 `eventBus` 成员依赖；
  - `create/update/delete/load` 返回结构化结果（例如 `{ ok:true, annotation }` / `{ ok:false, error }`），或在失败时 throw。
- 调整 `AnnotationFeature`：
  - 在调用 manager 后统一 `eventBus.emitGlobal(...)`（保持原事件名与 payload）。
- 补回归测试：覆盖“Feature 发射事件仍正确、uninstall 后不再响应”。

## 约束条件
### 仅修改本模块代码
仅修改 `src/frontend/pdf-viewer/features/pdf-annotation/**`。

## 可行验收标准
- `pnpm -s run lint` 通过
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-annotation/__tests__/annotation-feature.nav.urlparams.smoke.test.js -i` 通过（必要时补充本任务新增测试并一并执行）

## 协作协议（并行开发提速版，必须遵守）
（见 `todo-and-doing/3 template/v001-spec-template.md` 的同名章节；本任务必须完整遵守）

