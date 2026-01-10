# CI Gate：禁止 pdf-viewer feature components 直接订阅 EventBus（严格失败）

**功能ID**: 20260110220446-ci-pdfviewer-no-eventbus-on-in-components-E
**优先级**: 高（结构性：防回潮）
**版本**: v001
**创建时间**: 2026-01-10 22:04:46
**状态**: 设计中

## 现状说明
- 当前治理方向：EventBus 订阅应上移到 `subscriptions/*`（装配层），`components/*` 尽量为“纯方法/纯状态”。
- 但缺少强门禁时，后续很容易在 `components/*` 里继续写 `eventBus.on(...)`，导致回潮。

## 提出需求
- 新增 CI gate：**严格失败**（无 allowlist 过渡）：
  - 只要在 `src/frontend/pdf-viewer/features/**/components/**` 发现 `eventBus.on(` 或 `.on(` 形式的 app eventBus 订阅（按规则定义），即失败。
  - 允许的订阅位置：`src/frontend/pdf-viewer/features/**/subscriptions/**`（以及必要的装配层/manager，按 spec 固化）。

## 解决方案（建议）
- 在 `scripts/ci/` 新增 gate 脚本（参考现有 `pdfviewer-annotation-single-source-guard.js`、`pdfviewer-global-listener-gates.js`）。
- 同时新增脚本自测（Jest）：
  - 用 fixture 文件验证“components 命中 → fail”
  - 用 fixture 文件验证“subscriptions 命中 → pass”

## 约束条件（代码隔离：必须遵守）
### 允许修改的 scope（不允许越界）
- `scripts/ci/**`
- `scripts/ci/__tests__/**`
- `.kilocode/rules/memory-bank/memory-bank-limit.js` 等如需接入（以 lint 现有结构为准）
- **禁止修改**：`src/frontend/pdf-viewer/**`（避免与 A/B/C/D 冲突）
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`（由规划者统一维护）

### 规范
- 先读：`docs/SPEC/SPEC-HEAD-TEST.json`（或同等测试规范）

## 可行验收标准（DoD）
- 必须 `git commit` 并提供 **commit hash**
- `pnpm -s run lint` ✅（gate 已接入 lint 或 CI 流水线）
- `pnpm exec jest --runTestsByPath <本 gate 自测路径> -i` ✅
- 必须做到：**严格失败**（不允许 allowlist，除非用户后续改需求）

## 交付格式
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `scripts/ci/**`
- `tests`: `pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
