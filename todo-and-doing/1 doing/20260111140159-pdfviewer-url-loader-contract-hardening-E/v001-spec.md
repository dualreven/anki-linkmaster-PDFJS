# PDFViewer pdf-url-loader 契约收敛与 Fail-Fast 强化（E）规格说明

**功能ID**: 20260111140159-pdfviewer-url-loader-contract-hardening-E  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-11 14:01  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/features/pdf-url-loader/**` 负责 URL/导航相关请求的组装与 gate 行为；该模块处于“协议边界”，是面条化回潮的高风险点。

## 存在问题
- 输入参数/事件 payload 若缺少严格校验，后续会产生“隐式兜底/多处修补”导致分叉与面条化回潮。
- gate/contract 若缺少回归覆盖，很容易在并行迭代中被误改。

## 提出需求（目标）
1) 强化契约校验（Fail-Fast）：明确允许的输入形态与拒绝策略（不要兜底）。  
2) 收敛内部可变状态：让 gate 的重置/清理路径可证明、可测试。  
3) 补 1 条防回归测试：覆盖“非法输入/循环 payload/缺字段 → 明确失败”或“uninstall 后 gate 状态清理”。

## 非目标（本任务不做）
- 不改 bootstrap/adapters/infra-ui/pdf-annotation（避免与 A/B/C/D 冲突）。
- 不新增或修改全局事件白名单（除非在 scope 内且能用测试证明必要）。

## 约束条件（硬规则）
### 仅修改本模块代码（严格隔离）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/adapters/**`
  - `src/frontend/pdf-viewer/bootstrap/**`
  - `src/frontend/pdf-viewer/features/infra-ui/**`
  - `src/frontend/pdf-viewer/features/pdf-annotation/**`

### 必须遵循模块规范
先阅读并遵守：
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-EVENT-BUS-001.md`
- `docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) **必须 git 提交**并提供 commit hash。  
2) **必须自验通过**：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新：
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-url-loader-contract-hardening-E/working-log.md`
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-url-loader-contract-hardening-E/report.md`

