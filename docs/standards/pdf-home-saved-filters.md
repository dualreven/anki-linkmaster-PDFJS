# SavedFilters（pdf-home）面条治理说明

目标：把 `src/frontend/pdf-home/features/sidebar/saved-filters/index.js` 收敛为“装配/委托层”，将对话框/UI/纯逻辑拆到同目录模块，降低单文件复杂度并保持对外行为不变。

## 入口与边界

- 入口：`src/frontend/pdf-home/features/sidebar/saved-filters/index.js`
- 对外导出：`export class SavedFiltersFeature`（保持不变）
- 约束：
  - Fail‑Fast：非预期输入/状态必须显式失败，禁止静默兜底。
  - 事件名必须使用常量（ESLint 强约束）。

## 拆分结果

### 1) 去重/插入逻辑（纯函数，可测）
- `src/frontend/pdf-home/features/sidebar/saved-filters/saved-filters-collection.js`
  - `buildSavedFilterSignature()`：按 `{searchText,filters,sort}` 生成去重签名
  - `upsertSavedFilter()`：相同内容则更新 ts 并置顶；否则插入；并按 maxItems 截断
- 回归测试：`src/frontend/pdf-home/features/sidebar/saved-filters/__tests__/saved-filters-collection.test.js`

### 2) 文本与时间格式化（小工具）
- `src/frontend/pdf-home/features/sidebar/saved-filters/saved-filters-text-utils.js`
  - `escapeHtml()`、`formatTimeHHMM()`

### 3) Python 表达式与排序摘要（用于“保存确认”摘要展示）
- `src/frontend/pdf-home/features/sidebar/saved-filters/saved-filters-python-expression.js`
  - `toPythonExpression()`：把 filter cfg 转为 Python 表达式
  - `buildSortSummary()`：把 sort rules 转为可读摘要

### 4) 对话框控制器（UI 大块下沉）
- 保存对话框：`src/frontend/pdf-home/features/sidebar/saved-filters/saved-filters-save-dialog.js`
  - `createSavedFiltersSaveDialog()`：负责 DOM 创建/显示/关闭与事件绑定
- 管理对话框：`src/frontend/pdf-home/features/sidebar/saved-filters/saved-filters-manage-dialog.js`
  - `createSavedFiltersManageDialog()`：负责重命名/复制/删除/拖动排序，并通过回调回写列表

