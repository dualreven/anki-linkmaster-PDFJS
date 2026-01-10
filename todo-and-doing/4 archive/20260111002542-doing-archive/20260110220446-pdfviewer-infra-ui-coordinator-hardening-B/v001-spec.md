# PDFViewer infra-ui：Coordinator 迁移收尾 + 严格隔离订阅

**功能ID**: 20260110220446-pdfviewer-infra-ui-coordinator-hardening-B
**优先级**: 高（P1-B：持续瘦身 & 订阅上移）
**版本**: v001
**创建时间**: 2026-01-10 22:04:46
**状态**: 设计中

## 现状说明
- `infra-ui` 已有 `InfraUICoordinator` 与 `subscriptions/*` 拆分，但仍存在“订阅/初始化分散、组件职责过载”的回潮风险。

## 提出需求
- 进一步把订阅与一次性初始化逻辑集中到 `subscriptions/*`：
  - `components/*` 只保留“纯方法/纯状态”，禁止直接订阅 app eventBus。
  - 初始化流程必须基于明确事件（禁止 `setTimeout` 时间窗依赖）。

## 解决方案（建议）
- 对现有 `subscriptions/*` 做“领域划分 + 单一职责”：
  - Zoom / Page / Loading / Header 等分域订阅拆分（按既有结构扩展）
  - `destroy()` 必须清理所有订阅（可通过 spy/计数断言）

## 约束条件（代码隔离：必须遵守）
### 允许修改的 scope（不允许越界）
- `src/frontend/pdf-viewer/features/infra-ui/**`
- **禁止修改**：`src/frontend/pdf-viewer/core/**`（避免与 A 冲突）
- **禁止修改**：`scripts/ci/**`（避免与 E 冲突）
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`（由规划者统一维护）

### 规范
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD）
- 必须 `git commit` 并提供 **commit hash**
- 回归测试（至少 2 条）：
  1) coordinator destroy 后订阅全部清理（不再响应事件）
  2) 初始化不依赖 `setTimeout`（用 RENDER.READY 等明确事件驱动）
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅

## 交付格式
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `src/frontend/pdf-viewer/features/infra-ui/**`
- `tests`: `pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
