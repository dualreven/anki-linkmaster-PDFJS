# PDF Outline Feature（pdf-viewer）面条治理说明

目标：把 `src/frontend/pdf-viewer/features/pdf-outline/index.js` 收敛为“装配/委托层”，将大块逻辑拆到同目录模块，保持对外行为不变并将主文件压到 ≤500 行。

## 入口与边界

- 入口：`src/frontend/pdf-viewer/features/pdf-outline/index.js`
- 对外导出：`export class OutlineManager` + `export default OutlineManager`（保持不变）
- 约束：
  - Fail‑Fast：非预期输入/状态必须显式失败（禁止静默兜底）。
  - 事件名必须使用常量（ESLint 强约束）。

## 拆分结果（同目录模块）

### 1) bulk-save 扁平化（纯函数，可测）
- `src/frontend/pdf-viewer/features/pdf-outline/outline-bulk-save-flattener.js`
  - `flattenOutlineTreeForBulkSave()`：将树结构转换为 `{outline_id,parent_id,order,...}` 扁平列表，并做 page/position 规范化
- 回归测试：`src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-bulk-save-flattener.test.js`

### 2) 原生 dest 解析
- `src/frontend/pdf-viewer/features/pdf-outline/outline-native-dest-parser.js`
  - `parseOutlineNormalizedDest()`：将原生 bookmark dest 解析为 `{pageAt, position}`，优先走 provider，失败则 fallback 到 `resolvePdfDest`

### 3) 初始加载流程（event-driven，无超时）
- `src/frontend/pdf-viewer/features/pdf-outline/outline-initial-load-flow.js`
  - `runOutlineInitialLoadFlowAfterFile()`：`OUTLINE_LIST → (null则导入+bulk-save) → OUTLINE_LIST → refreshList`

### 4) 按 ID 导航与 pending
- `src/frontend/pdf-viewer/features/pdf-outline/outline-navigate-by-id.js`
  - `handleOutlineNavigateById()`：打开 outline sidebar、发 `OUTLINE.SELECT.CHANGED`、再执行导航
  - `tryOutlinePendingNavigate()`：列表就绪后补处理挂起的导航请求

### 5) CRUD/重排 WS 操作
- `src/frontend/pdf-viewer/features/pdf-outline/outline-crud-handlers.js`
  - `handleOutlineCreate/update/delete/reorder()`：封装 WS request + list refresh 逻辑（主文件只负责委托）

