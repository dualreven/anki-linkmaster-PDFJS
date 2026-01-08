# PDFViewer 面条化扫描（D - outline/search/bootstrap）

**功能ID**: 20260108212200-pdfviewer-spaghetti-scan-D  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-08 21:22:00  
**状态**: 进行中

## 扫描范围（仅此范围）
- `src/frontend/pdf-viewer/features/pdf-outline/**`
- `src/frontend/pdf-viewer/features/pdf-search/**`
- `src/frontend/pdf-viewer/bootstrap/**`

## 目标
- 找出装配层大文件中的职责混杂（WS 消费 / 状态 / UI / 事件桥接），并提出可拆分边界与回归测试建议。

## 交付物（只交报告，不改业务代码）
- 报告路径：`AItemp/reports/[YYYYMMDDhhmmss]-pdfviewer-scan-D.md`
- 参考说明：`docs/pdfviewer-spaghetti-audit.md`

## 必跑命令（可复跑）
- `pnpm -s run lint`
- `rg -n "eventBus\\.(on|onGlobal|once)\\(" src/frontend/pdf-viewer/features/pdf-outline src/frontend/pdf-viewer/features/pdf-search src/frontend/pdf-viewer/bootstrap -S`
- `rg -n "addEventListener\\(|removeEventListener\\(" src/frontend/pdf-viewer/features/pdf-outline src/frontend/pdf-viewer/features/pdf-search src/frontend/pdf-viewer/bootstrap -S`
- `rg -n "setTimeout\\(|setInterval\\(" src/frontend/pdf-viewer/features/pdf-outline src/frontend/pdf-viewer/features/pdf-search src/frontend/pdf-viewer/bootstrap -S`

## 可行验收标准
- 报告必须包含：命令清单 + P0/P1/P2（每条带 `文件:行号`）+ 建议拆分点 + 至少 1 条回归测试建议。

