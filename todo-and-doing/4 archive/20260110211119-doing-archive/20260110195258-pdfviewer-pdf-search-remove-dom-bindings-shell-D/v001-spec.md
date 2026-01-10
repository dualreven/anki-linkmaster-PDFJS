# PDFViewer pdf-search：移除旧 DOM bindings 壳（收敛到 SearchBoxDOMManager）

**功能ID**: 20260110195258-pdfviewer-pdf-search-remove-dom-bindings-shell-D
**优先级**: 中（P1-D 收尾：降低维护者误判）
**版本**: v001
**创建时间**: 2026-01-10 19:52:58
**状态**: 设计中

## 现状说明
- 已引入 `SearchBoxDOMManager` 并有 cleanup 契约测试：
  - `src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-manager.js`
  - `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js`
- 仍保留 `search-box-dom-bindings.js` 作为薄壳，容易误导后续维护者继续在壳里加绑定逻辑。

## 存在问题
- “旧壳存在”会导致职责边界再次模糊，DOM 绑定逻辑回潮，重回面条。

## 提出需求
- 移除 `search-box-dom-bindings.js`（或并入 `search-box-dom.js`），确保 DOM 绑定只存在于 `SearchBoxDOMManager`。
- 更新所有引用点，保证功能不退化。

## 解决方案
- 查清引用链（例如 `search-box.js`/`search-box-dom.js`）：
  - 直接在装配层 new `SearchBoxDOMManager(...)` 并调用 `init/cleanup`；
  - 删除旧壳文件或将其改为纯 re-export（不允许 addEventListener 等绑定逻辑）。

## 约束条件
### 允许修改的目录（scope）
- `src/frontend/pdf-viewer/features/pdf-search/**`

### 严格遵循代码规范和标准
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准
### 单元测试（必需）
- `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js` 必须继续通过。
- 新增/调整测试（如需要）：断言项目内不存在对 `search-box-dom-bindings.js` 的引用（避免回潮）。

### 门禁（必需）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增/改动测试路径> -i` ✅

## 协作协议（必须遵守）
- 必须提交到 `anki-linkmaster-D` worktree，并给出 **commit hash**。
- `working-log.md` 必须记录：删除/替换的引用点位与测试命令。
