# 20260110014111-pdf-search-dom-manager-extract-D 工作日志
**参考标准**: v001-spec.md

## 2026-01-10 01:41
### 工作内容
- 任务下发（待 D 开工）。
### 下一步计划
- D：先补 DOMManager 单测，再拆分代码并确保解绑对称。

## 2026-01-10 02:50
### 工作内容
- 复用现有 `SearchBoxDOMManager`，把 SearchBox 的 DOM 查询/事件绑定/解绑进一步集中到 DOMManager：
  - 新增 `SearchBoxDOMManager.getRequiredElements({ container, logger })`：从 container 内 Fail-Fast 查询必需 DOM。
  - DOMManager 增加 `destroy()`，并保留 `cleanup()` 作为别名（避免潜在调用方炸掉）。
  - 将 `#search-toggle-btn` 的 click 绑定迁移进 DOMManager（按钮缺失时 debug 跳过；若按钮存在但缺 onToggle 则抛错）。
- 更新/增强 JSDOM 单测：覆盖 init/destroy 对称 + toggle 解绑。

### 验收
- `pnpm exec jest --runTestsByPath "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js" -i` ✅
- `pnpm -s run lint` ✅

### 变更文件
- `src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-manager.js`
- `src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom.js`
- `src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-bindings.js`
- `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js`

### 交付信息
- main 合入：`ab6a0f3`
