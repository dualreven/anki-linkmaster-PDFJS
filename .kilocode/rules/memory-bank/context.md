# Memory Bank - Context（近7日）

最后更新：2026-01-09

## 当前主线：PDFViewer 面条代码整治（进行中）
- **目标**：把 `src/frontend/pdf-viewer/**` 中“事件驱动 + 状态驱动混杂、职责过载、订阅泄漏”等面条化热点拆分并加回归测试。
- **并行扫描（已完成）**：
  - 已给 A/B/C/D 下发 `pdfviewer-spaghetti-scan-*` doing；各自输出扫描报告到各 worktree 的 `AItemp/reports/*-pdfviewer-scan-*.md`（注意：`AItemp/` 被 gitignore）。
- **当前阻塞点**：扫描报告需要**复制到 repo 内可提交路径**（建议 `docs/reports/`）才能在 `main` 汇总、追踪与拆分重构任务。
- **下一步（main 侧）**：
  1) 收敛 A/B/C/D 扫描报告到 `docs/reports/`；
  2) 生成一份 P0/P1 汇总与“下一轮并行重构拆分清单”（按模块边界拆任务，互不干扰）；
  3) 归档旧 doing 并下发新 doing；
  4) `pnpm -s run lint` + 必要 Jest 门禁通过后，同步到 A/B/C/D。

## 近期关键事实（已完成/可复用）

### 2026-01-08：pdf-anchor 测试阻塞修复（已完成）
- **现象**：`src/frontend/pdf-viewer/features/pdf-anchor/index.js` 引用 `./services/anchor.manager.js`，但文件缺失导致 Jest 报 `Cannot find module`。
- **修复**：合入 `refactor(pdf-anchor): add anchor manager store`（新增 `src/frontend/pdf-viewer/features/pdf-anchor/services/anchor.manager.js` 并对齐 tracker/store 接口）。
- **验证**：`pnpm -s run lint` + 多个 `pdf-anchor` Jest 用例通过。

### 2026-01-07：Feature 内部 EventBus 增量门禁（已完成）
- **目的**：防止在 `src/frontend/pdf-viewer/features/**` 新增/扩大“Feature 内部 UI↔Manager 依赖 EventBus 事件闭环”的混合态。
- **实现**：`scripts/ci/feature-internal-eventbus-gates.js`（baseline 增量策略）并接入 `pnpm -s run lint`。
- **文档**：`docs/standards/feature-internal-eventbus-gates.md`。

### 2026-01-07：并行合入效率工具（已完成）
- **命令**：`pnpm -s run merge:sweep`
- **实现**：`scripts/sweep_and_merge.py` + `scripts/merge_fastlane.py`（自动发现 worktree 领先提交、批量 cherry-pick、跑 lint + 指定 Jest）。
- **文档**：`docs/reports/20260107-merge-optimization-plan.md`。

### 2026-01-05：标注侧边栏空白兼容修复（已完成）
- **根因**：历史 screenshot 数据仅含像素 `rect`，缺少 `rectPercent`；严格解析导致“一条坏数据拖垮整批”。
- **修复策略**：兼容 legacy 字段并逐条解析跳过坏条，避免 UI 全空白。

