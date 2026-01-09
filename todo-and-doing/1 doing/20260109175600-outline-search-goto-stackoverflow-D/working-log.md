# Working Log（D）- 20260109175600-outline-search-goto-stackoverflow-D

## 1. 结论摘要
- 根因：
- 修复：
- 回归测试：

## 2. 变更清单
- [ ] （填写你改动的文件/函数）

## 3. 验证记录
- [ ] `pnpm -s run lint`
- [ ] `pnpm exec jest --runTestsByPath ... -i`

## 4. 交付信息
- PR/commit：

## 5. 实施记录（2026-01-09）
### 根因
- `NAVIGATION.GOTO` 在某些组合场景下会形成同步闭环：`NAVIGATION.GOTO` → `InfraUICoordinator.NavGoto` → `UIControls.goToPage()` → `set pdfViewerManager.currentPageNumber` →（环境/实现差异导致）再次同步触发 `NAVIGATION.GOTO` → ……
- 该闭环会导致 `RangeError: Maximum call stack size exceeded`，并被 EventBus 记录为 “事件回调执行出错”。

### 修复
- 在 `UIControls.goToPage()` 中加入幂等短路：当 `currentPageNumber === targetPage` 时直接 return，避免重复 set 触发同步闭环。
  - 文件：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-ui-controls.js`

### 回归测试
- 用例构造一个“setter 会同步 re-emit NAVIGATION.GOTO”的 stub，以稳定复现“修复前会炸、修复后不炸”的核心条件：
  - `src/frontend/pdf-viewer/features/infra-ui/__tests__/infra-ui-nav-goto.stackoverflow.regression.test.js`

### 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath "src/frontend/pdf-viewer/features/infra-ui/__tests__/infra-ui-nav-goto.stackoverflow.regression.test.js" -i`

### 交付信息
- commit：`75936a2`
