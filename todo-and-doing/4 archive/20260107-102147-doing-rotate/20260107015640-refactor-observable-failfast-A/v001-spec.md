# Observable Fail-Fast 收敛规格说明

**功能ID**: 20260107015640-observable-failfast-A  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-07 01:56:40  
**状态**: 设计中

## 现状说明
- `src/frontend/common/utils/observable.js` 作为前端“Manager + Store”模式的基础设施，当前在部分非预期输入下会 `warn` 并返回（非 fail-fast）。

## 存在问题
- `ObservableState.set()` 遇到非 object 的 `partial` 会吞掉（仅 warn），可能掩盖上层 bug。
- `ObservableState` 对 `initialState`、`replace()` 的输入约束不清晰。

## 提出需求
- 将 Observable 的“契约违规”改为 **直接抛错**（Fail-Fast），避免隐藏 bug。
- 保持现有正常用法不变；若发现现网存在违规调用，必须在本任务内修正调用点（仍限制在 scope 内）。

## 解决方案
- 在 `ObservableState` 内新增/强化参数校验：
  - `constructor(initialState)`：非 object/array 直接 throw；
  - `set(partialOrUpdater)`：updater 返回非 object/array 直接 throw；
  - `replace(nextState)`：非 object/array 直接 throw；
  - `subscribe(...)`：listener 非函数直接 throw（selector+listener 形态同理）。
- 补齐/调整单测覆盖 fail-fast 行为（新增用例必须红→绿）。

## 约束条件
### 仅修改本模块代码
仅修改 `src/frontend/common/utils/observable.js` 与其测试（`src/frontend/common/utils/__tests__/observable.test.js`）。

## 可行验收标准
- `pnpm -s run lint` 通过
- `pnpm exec jest --runTestsByPath src/frontend/common/utils/__tests__/observable.test.js -i` 通过

## 协作协议（并行开发提速版，必须遵守）
（见 `todo-and-doing/3 template/v001-spec-template.md` 的同名章节；本任务必须完整遵守）

