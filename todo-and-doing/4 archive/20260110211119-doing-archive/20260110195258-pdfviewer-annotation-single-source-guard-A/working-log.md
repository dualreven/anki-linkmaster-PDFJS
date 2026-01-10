# 20260110195258-pdfviewer-annotation-single-source-guard-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 19:52:58
### 工作内容:
- 任务下发：为 Annotation 单真源加 lint 门禁，防止 feature 侧再次复制实现导致分叉。
### 下一步计划:
1. 读取 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 与现有 lint gates 实现位置
2. 选择最小侵入的 gate 接入点并实现扫描规则
3. 本地验证：正例通过/反例失败
4. 提交 commit + 记录验收命令

## 工作记录2
**时间**: 2026-01-10 20:20
### 工作内容:
- 新增 lint gate：强制 `pdf-annotation` feature 侧 `models/annotation.js` 只能作为 common 的复出口（禁止第二份实现）。

### 工作步骤:
1. 新增 gate 脚本：`scripts/ci/pdfviewer-annotation-single-source-guard.js`
2. 接入 `pnpm -s run lint`：挂到 `scripts/ci/frontend-line-limit.js`（与其他 pdfviewer gates 同一入口）
3. 新增回归测试：`scripts/ci/__tests__/pdfviewer-annotation-single-source-guard.test.js`（覆盖正例通过/反例失败）
4. 本地验收：跑 lint + jest（按路径）

### 工作结果:
- 功能提交：待提交
- 门禁：
  - `pnpm -s run lint` ✅（输出包含 `[pdfviewer-annotation-single-source-guard] OK`）
  - `pnpm exec jest --runTestsByPath scripts/ci/__tests__/pdfviewer-annotation-single-source-guard.test.js -i` ✅

### 备注:
- Jest 提示 `baseline-browser-mapping` 数据过旧（非本任务范围，不影响测试通过）。
