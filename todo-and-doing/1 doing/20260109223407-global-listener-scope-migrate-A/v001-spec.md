# 任务说明（A）- global-listener-scope 落地迁移（P1）

## 0. 任务目标
第5轮已把 “pdf-viewer 目录下 window/document.addEventListener” 做成门禁（`pdfviewer-global-listener-gates`）。本任务要把现有的直接注册点迁移到统一入口，降低门禁基线并减少面条化“全局监听散落”。

目标结果：
- `src/frontend/pdf-viewer/**` 内的全局监听注册尽量通过 `src/frontend/pdf-viewer/core/global-listener-scope.js`。
- 门禁 baseline 数量下降（或至少不新增）。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/**`
  - `src/frontend/pdf-viewer/core/global-listener-scope.js`（必要时扩展 API）
  - `scripts/ci/baselines/pdfviewer-global-listener-gates.json`（如果迁移后 baseline 需要更新）
- 不要修改 `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 至少迁移 1~2 个实际监听点（不要大扫荡，保持任务 20 分钟内可验收）。
- 必须补回归测试（二选一）：
  - 若迁移涉及某个 manager 的 destroy/cleanup：补“重复 init/destroy 不叠加监听”测试；
  - 或补 `pdfviewer-global-listener-gates` 的基线更新说明与验证（写入 working-log）。
- 门禁通过：`pnpm -s run lint`（必须包含 `pdfviewer-global-listener-gates`）。

## 3. 提交要求
- 1 个 commit（迁移+测试/说明）。
- 更新 `todo-and-doing/1 doing/20260109223407-global-listener-scope-migrate-A/working-log.md`。

