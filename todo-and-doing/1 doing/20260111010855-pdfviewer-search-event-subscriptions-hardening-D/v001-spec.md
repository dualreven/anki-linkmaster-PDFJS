# PDFViewer pdf-search：订阅/清理契约强化（D）规格说明

**功能ID**: 20260111010855-pdfviewer-search-event-subscriptions-hardening-D  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-11 01:08（本地）  
**状态**: doing  

## 现状说明
- pdf-search 已拆出 `SearchBoxDOMManager`，并有 cleanup 回归测试，但仍存在“订阅层/DOM 层边界不够硬”的风险：
  - `components/search-box-event-subscriptions.js` 与 `components/search-box-dom-manager.js` 的职责可能继续互相侵入。

## 存在问题
- 订阅与 DOM 绑定混杂会造成后续“事件驱动 + 状态驱动混用”回潮，变回面条。
- destroy/uninstall 路径若不强制契约，很容易出现“挂着旧监听器”的幽灵 bug。

## 提出需求（目标）
1) 明确并强化契约：
   - 订阅层只负责 eventBus 订阅与转发，不直接触 DOM
   - DOM manager 只负责 DOM 绑定/解绑，不直接订阅 eventBus
2) 补齐至少 2 条回归测试：
   - init/cleanup 对称（已有可扩充为更严格断言）
   - 订阅层在 cleanup 后不再触发 UI 行为（可用 spy/mock 验证）

## 解决方案（建议方向）
- 以“最小可交付”为先：必要时仅做轻量拆分或重命名/提取函数，避免大范围重构引发冲突。

## 约束条件（严格代码隔离）
### 允许修改（scope）
- `src/frontend/pdf-viewer/features/pdf-search/**`

### 禁止修改
- 禁止修改 `src/frontend/pdf-viewer/features/infra-ui/**`（避免与 B 冲突）
- 禁止修改 `src/frontend/pdf-viewer/features/pdf-annotation/**`（避免与 C 冲突）
- 禁止修改 `src/frontend/pdf-viewer/ui/**`（避免与 A 冲突）

### 规范必读
- `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
- 必须提交 git 并提供 **commit hash**（工作区干净）。
- 必须新增/更新 ≥2 个测试用例，并提供定向命令（文件路径）：
  - `pnpm exec jest --runTestsByPath <测试文件1> <测试文件2> -i`
- `pnpm -s run lint` 通过。
- `working-log.md` 记录：职责边界、对外 API 变化（如有）与风险点。

