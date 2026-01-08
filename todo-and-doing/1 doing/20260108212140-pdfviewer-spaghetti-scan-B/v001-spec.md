# PDFViewer 面条化扫描（B - infra-ui/infra-sidebar）

**功能ID**: 20260108212140-pdfviewer-spaghetti-scan-B  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-08 21:21:40  
**状态**: 进行中

## 扫描范围（仅此范围）
- `src/frontend/pdf-viewer/features/infra-ui/**`
- `src/frontend/pdf-viewer/features/infra-sidebar/**`

## 目标
- 找出装配层“职责混杂”与生命周期清理风险（DOM listener / timer / EventBus 订阅）。

## 交付物（只交报告，不改业务代码）
- 报告路径：`AItemp/reports/[YYYYMMDDhhmmss]-pdfviewer-scan-B.md`
- 参考说明：`docs/pdfviewer-spaghetti-audit.md`

## 必跑命令（可复跑）
- `pnpm -s run lint`
- `rg -n "eventBus\\.(on|onGlobal|once)\\(" src/frontend/pdf-viewer/features/infra-ui src/frontend/pdf-viewer/features/infra-sidebar -S`
- `rg -n "addEventListener\\(|removeEventListener\\(" src/frontend/pdf-viewer/features/infra-ui src/frontend/pdf-viewer/features/infra-sidebar -S`
- `rg -n "setTimeout\\(|setInterval\\(" src/frontend/pdf-viewer/features/infra-ui src/frontend/pdf-viewer/features/infra-sidebar -S`

## 可行验收标准
- 报告必须包含：命令清单 + P0/P1/P2（每条带 `文件:行号`）+ 建议拆分点 + 至少 1 条回归测试建议。

