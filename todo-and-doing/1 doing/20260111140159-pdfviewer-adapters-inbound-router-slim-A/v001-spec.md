# PDFViewer adapters 入站路由收敛与瘦身（A）规格说明

**功能ID**: 20260111140159-pdfviewer-adapters-inbound-router-slim-A  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-11 14:01  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/adapters/**` 的“入站消息分发/路由”存在碎片化与重复判断，后续很容易继续长回面条。
- 规划目标是把 adapters 侧收敛为“单入口 + 可测试 + 可卸载”的装配/路由层。

## 存在问题
- 入站处理分散在多处：行为追踪困难、回归测试难写、销毁时容易漏清理（订阅/监听）。
- 部分入站路径与上层状态（如 pdfId/url 上下文）耦合，后续改动容易波及其他 feature。

## 提出需求（目标）
1) 收敛入站路由到单入口（router/dispatcher），并明确 handler 列表与职责边界。  
2) 使 install/uninstall 对称：路由相关订阅/监听必须可卸载（Fail-Fast，不要兜底）。  
3) 补 1 条防回归测试：覆盖“销毁/卸载后不再处理入站消息/不再残留订阅”。

## 非目标（本任务不做）
- 不改 WebSocket 协议/消息类型定义（除非在本 scope 内已有明显错误且能用测试证明）。
- 不修改 `src/frontend/pdf-viewer/features/**` 其他 feature 的实现细节。

## 约束条件（硬规则）
### 仅修改本模块代码（严格隔离）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/adapters/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - 其他 worktree 任务目录
  - `src/frontend/pdf-viewer/features/**`（除非该文件实际位于 adapters 目录内）

### 必须遵循模块规范
先阅读并遵守：
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-STRUCTURE-001.md`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-EVENT-BUS-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) **必须 git 提交**（工作区干净）并提供 commit hash。  
2) **必须自验通过**：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新：
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-adapters-inbound-router-slim-A/working-log.md`
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-adapters-inbound-router-slim-A/report.md`（按模板填满）

