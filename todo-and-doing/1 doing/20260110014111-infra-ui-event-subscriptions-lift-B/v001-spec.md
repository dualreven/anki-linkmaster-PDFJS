# [pdf-viewer][B] infra-ui：订阅上移与子模块“哑化”规格说明

**功能ID**: 20260110014111-infra-ui-event-subscriptions-lift-B  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 01:41:11  
**状态**: 开发中

## 现状说明
- `infra-ui` 的 `ui-manager-core-*` 订阅大量领域事件，形成“上帝对象”，难测试、难维护。

## 存在问题
- UI 子模块内部直接订阅 EventBus，导致数据流混乱且拆分困难。

## 提出需求
- 选定一个明确子域（建议：导航/缩放）先做“小步上移”：
  - 子模块改为“哑模块”（不再 `eventBus.on`），仅暴露公开方法；
  - EventBus 订阅集中到 feature 装配层。
- 必须补 1 条回归测试防回归。

## 解决方案（建议）
- 以 `ui-manager-core-ui-controls.js` 为切入点，只处理一组事件订阅迁移（避免大爆改）。
- 装配层负责订阅 → 调用子模块方法（可 spy）。

## 约束条件
### 仅修改本模块代码
- 仅允许修改：`src/frontend/pdf-viewer/features/infra-ui/**`

### 严格遵循代码规范和标准
- 必须阅读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 禁止兜底：遇到缺失 DOM/依赖必须显式报错。

## 可行验收标准
### 单元测试（必须新增）
- 新增 1 条装配层测试：模拟关键事件 → 断言子模块公开方法被调用（而不是子模块自己订阅）。

### 门禁
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径>` ✅

