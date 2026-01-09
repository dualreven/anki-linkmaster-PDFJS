# PDFViewer core/ui 面条化扫描（E，仅扫描产出报告）

**功能ID**: 20260109104700-pdfviewer-core-ui-spaghetti-scan-E  
**优先级**: 中（扫描/评估）  
**版本**: v001  
**创建时间**: 2026-01-09 10:47:00  
**状态**: 设计中

## 扫描范围（只读，不改业务代码）
- `src/frontend/pdf-viewer/core/**`
- `src/frontend/pdf-viewer/ui/**`

## 目标
- 识别下一批“面条热点”：订阅泄漏、DOM 监听/计时器未清理、职责过载文件、跨层耦合。
- 产出可执行的 P0/P1 列表（每条给出文件:行号 + 建议拆分边界）。

## 输出物
- 报告写入并提交到 repo：`docs/reports/20260109-pdfviewer-core-ui-scan-E.md`

## 约束条件
- 本任务禁止修改 `src/frontend/pdf-viewer/**` 业务代码（只允许新增 1 份报告文件）。
- `pnpm -s run lint` 必须通过。

## 协作协议
- 提交到 `worker/refactor-E`，提供 commit hash。

