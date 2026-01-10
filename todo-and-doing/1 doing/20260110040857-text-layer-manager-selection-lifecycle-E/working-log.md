# 20260110040857-text-layer-manager-selection-lifecycle-E 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 04:08:57
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写“destroy 后无残留监听”的最小回归测试
2. 梳理 TextLayerManager 的 bind/unbind 边界，确保对称清理
3. 确保 create/destroy 循环与页面切换下 selection 可用
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 交付 commit hash

## 工作记录2
**时间**: 2026-01-10 12:06
### 工作内容:
- 采取 Fail-Fast：禁止 `TextLayerManager` 多实例并存，避免重复 `document.selectionchange` 监听叠加。
- 新增回归测试：第二次构造必须 throw；destroy 后允许再次创建；并断言 `selectionchange` add/remove 对称。
### 改动范围:
- `src/frontend/pdf-viewer/ui/text-layer-manager.js`
- `src/frontend/pdf-viewer/ui/__tests__/text-layer-manager.test.js`
### 自验:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/ui/__tests__/text-layer-manager.test.js -i` ✅
### 工作结果:
- 已完成：`ba83122fd511b6e11639a52032ecb7e1c07b26a8`
