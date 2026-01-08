# PDFViewer 面条化扫描（C - pdf-annotation）

**功能ID**: 20260108212150-pdfviewer-spaghetti-scan-C  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-08 21:21:50  
**状态**: 进行中

## 扫描范围（仅此范围）
- `src/frontend/pdf-viewer/features/pdf-annotation/**`

## 目标
- 找全“混合态面条”：UI 既依赖 EventBus 又依赖 store 的双重驱动，以及清理不彻底的订阅/监听。

## 交付物（只交报告，不改业务代码）
- 报告路径：`AItemp/reports/[YYYYMMDDhhmmss]-pdfviewer-scan-C.md`
- 参考说明：`docs/pdfviewer-spaghetti-audit.md`

## 必跑命令（可复跑）
- `pnpm -s run lint`
- `rg -n "eventBus\\.(on|onGlobal|once)\\(" src/frontend/pdf-viewer/features/pdf-annotation -S`
- `rg -n "addEventListener\\(|removeEventListener\\(" src/frontend/pdf-viewer/features/pdf-annotation -S`
- `rg -n "setTimeout\\(|setInterval\\(" src/frontend/pdf-viewer/features/pdf-annotation -S`
- （可选）`rg -n "new ObservableState\\(|\\.store\\.subscribe\\(" src/frontend/pdf-viewer/features/pdf-annotation -S`

## 可行验收标准
- 报告必须包含：命令清单 + P0/P1/P2（每条带 `文件:行号`）+ 建议拆分点 + 至少 1 条回归测试建议。

