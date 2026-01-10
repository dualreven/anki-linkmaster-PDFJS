# 20260110040857-annotation-model-single-source-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 04:08:57
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写“单真源/re-export”的最小回归测试
2. 收敛 models 入口（common 为真源；feature 侧仅薄出口）
3. 统一引用路径并移除重复实现逻辑
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 交付 commit hash

## 工作记录2
**时间**: 2026-01-10 10:30
### 工作内容:
- 消除 `Annotation` 模型重复真源：以 `src/frontend/common/models/annotation.js` 为唯一实现真源，feature 侧仅保留复出口。
- 新增最小回归测试：保证“两个入口导出的对象同一引用（toBe）”，防止后续再次分叉。

### 工作步骤:
1. 新增回归测试：`src/frontend/pdf-viewer/features/pdf-annotation/models/__tests__/annotation.single-source.regression.test.js`
2. 将 `src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js` 改为纯 re-export（不保留业务逻辑）
3. 统一入口：测试/冒烟用例从 `src/frontend/pdf-viewer/features/pdf-annotation/models/index.js` 导入
4. 自验门禁：跑 lint 与 jest（按路径）

### 工作结果:
- 提交：`2a0abab` `refactor(pdf-annotation): single-source annotation model`
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-annotation/models/__tests__/annotation.single-source.regression.test.js src/frontend/pdf-viewer/features/pdf-annotation/models/__tests__/annotation-id.test.js src/frontend/pdf-viewer/__smoke__/annotation-card-jump.smoke.test.js -i` ✅

### 存在问题:
- Jest 提示 `baseline-browser-mapping` 数据过旧（非本任务范围，不影响测试通过）。

### 下一步计划:
- main 侧 cherry-pick `2a0abab` 并做手工点检（标注创建/跳转/删除链路）。
