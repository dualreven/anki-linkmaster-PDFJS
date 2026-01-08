# PDFViewer 面条代码整治：并行扫描作业说明（ABCD）

范围：只扫 `src/frontend/pdf-viewer/**`（先把最大耦合点收敛）。

## 你要做什么（先找全，再动刀）
1) **全量机械扫描**：把“订阅 / DOM listener / timer / 跨层耦合”的命中点都列出来（文件:行号）。
2) **热点精读**：对你范围内 Top 大文件与命中密集文件，判断是否存在“职责混杂 / 生命周期清理不全 / 重复触发”。
3) **只交报告，不改代码**：扫描阶段避免并行冲突；后续再按 P0/P1 拆重构任务。

## 分工
- A：`src/frontend/pdf-viewer/adapters/**`
- B：`src/frontend/pdf-viewer/features/infra-ui/**` + `src/frontend/pdf-viewer/features/infra-sidebar/**`
- C：`src/frontend/pdf-viewer/features/pdf-annotation/**`
- D：`src/frontend/pdf-viewer/features/pdf-outline/**` + `src/frontend/pdf-viewer/features/pdf-search/**` + `src/frontend/pdf-viewer/bootstrap/**`

## 报告交付格式（必须可复跑）
写到各自 worktree 的：`AItemp/reports/[YYYYMMDDhhmmss]-pdfviewer-scan-[A|B|C|D].md`

报告必须包含：
- 一键复跑命令清单
- P0/P1/P2 问题列表（每条都要 `文件:行号` + 风险 + 推荐修复方向）
- “面条化结构图”（用人话描述这个范围里职责怎么缠在一起）
- 至少 1 条回归测试建议

## 统一扫描命令（复制执行）
- `pnpm -s run lint`
- `rg -n "eventBus\\.(on|onGlobal|once)\\(" <scope> -S`
- `rg -n "addEventListener\\(|removeEventListener\\(" <scope> -S`
- `rg -n "setTimeout\\(|setInterval\\(" <scope> -S`
- （可选）`rg -n "new ObservableState\\(|\\.store\\.subscribe\\(" <scope> -S`

## main 基线参考
- 扫描基线：`AItemp/reports/20260108143040-pdfviewer-scan-baseline.md`

