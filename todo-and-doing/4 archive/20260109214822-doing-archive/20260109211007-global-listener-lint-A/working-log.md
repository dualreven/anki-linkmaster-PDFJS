# Working Log（A）- 20260109211007-global-listener-lint-A

## 1. 结论摘要
- 规则描述：新增增量门禁 `pdfviewer-global-listener-gates`，扫描 `src/frontend/pdf-viewer/**` 中 `window/document.addEventListener` 的散落使用；按 baseline 策略禁止新增/增长。
- 允许入口/豁免点：统一入口文件 `src/frontend/pdf-viewer/core/global-listener-scope.js` 允许直接使用 `window/document.addEventListener`（用于提供可复用注册入口）。
- 验证方式：
  - `pnpm -s run lint` 会输出 `[pdfviewer-global-listener-gates] ... OK/FAILED`
  - 新增测试：`pnpm exec jest --runTestsByPath scripts/ci/__tests__/pdfviewer-global-listener-gates.test.js -i`

## 2. 验证记录
- [x] `pnpm -s run lint`

## 3. 交付信息
- commit：本提交（包含 gates + baseline + 单测 + 统一入口模块）
