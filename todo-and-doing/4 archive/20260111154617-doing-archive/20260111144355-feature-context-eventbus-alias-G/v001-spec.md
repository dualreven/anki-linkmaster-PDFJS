# FeatureRegistry - FeatureContext 增加 eventBus 兼容别名（globalEventBus -> eventBus）

**功能ID**: 20260111144355-feature-context-eventbus-alias-G  
**优先级**: P1（防止再次出现“eventBus 字段名误用”）  
**版本**: v001  
**创建时间**: 2026-01-11 14:43  
**状态**: doing  

## 需求
- 在 `FeatureRegistry` 创建的 FeatureContext 中：
  - 继续保留标准字段：`globalEventBus`
  - 新增只读别名：`eventBus`（值等于 `globalEventBus`）
- Fail-fast：若 `globalEventBus` 缺失，本任务不引入兜底；保持现状（context 中 eventBus 为空/不存在即可）。

## 约束（严格隔离 scope）
### 允许修改/新增（仅限）
- `src/frontend/common/micro-service/feature-registry-context.js`
- `src/frontend/common/micro-service/__tests__/**`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/planner/**`、`src/frontend/new-card-scheduler/features/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 交付物（必须提交到 git）
- ≥1 条 Jest 回归测试：验证 `createFeatureContext` 返回对象同时包含 `globalEventBus` 与 `eventBus` 且引用同一实例
- `report.md`（必须提交）：含 scope、lint/jest 结果、commit hash

## 验收标准（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务测试文件...> -i` ✅
- git 提交：提供 **commit hash**，工作区干净

