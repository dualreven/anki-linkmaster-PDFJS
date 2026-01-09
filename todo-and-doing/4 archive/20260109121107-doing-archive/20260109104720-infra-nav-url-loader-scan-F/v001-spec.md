# PDFViewer infra-nav-core / pdf-url-loader 面条化扫描（F，仅扫描产出报告）

**功能ID**: 20260109104720-infra-nav-url-loader-scan-F  
**优先级**: 中（扫描/评估）  
**版本**: v001  
**创建时间**: 2026-01-09 10:47:20  
**状态**: 设计中

## 扫描范围（只读，不改业务代码）
- `src/frontend/pdf-viewer/features/infra-nav-core/**`
- `src/frontend/pdf-viewer/features/pdf-url-loader/**`

## 目标
- 找出“导航/URL 解析/互斥门闸”相关的面条化热点：多入口、状态分散、竞态（setTimeout/await gate）、订阅清理风险。
- 产出可执行的 P0/P1 列表（文件:行号 + 建议拆分方式 + 必要的回归测试点）。

## 输出物
- 报告写入并提交到 repo：`docs/reports/20260109-infra-nav-url-loader-scan-F.md`

## 约束条件
- 本任务禁止修改业务代码（只允许新增 1 份报告文件）。
- `pnpm -s run lint` 必须通过。

## 协作协议
- 提交到 `worker/refactor-F`，提供 commit hash。

