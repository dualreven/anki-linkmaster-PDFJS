# 20260110040857-adapters-pdfid-provider-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 04:08:57
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 先写 fail-fast 的最小回归测试（缺 provider/pdfId 直接 throw）
2. 引入 pdfIdProvider（或显式参数）并在边界 wiring 注入
3. 删除 adapters 内直接读 URL 的逻辑
4. 自验：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 交付 commit hash

