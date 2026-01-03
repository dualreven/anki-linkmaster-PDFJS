# PDF Sorter（WeightedSortEditor）拆分说明

目标：将 `weighted-sort-editor.js` 从大体积 UI+逻辑混杂文件拆成若干职责单一模块，并把主文件行数压到 ≤500，同时保持对外导出与交互行为不变。

## 文件结构与职责

- `src/frontend/pdf-home/features/pdf-sorter/components/weighted-sort-editor.js`
  - 对外类：`export class WeightedSortEditor`
  - 负责状态管理（tokens / pendingFunction / numberBuffer / currentFormula）与事件绑定
  - 装配/委托：模板、公式解析/格式化、视图渲染与校验交给子模块

- `src/frontend/pdf-home/features/pdf-sorter/components/weighted-sort-editor-constants.js`
  - 运营符、数字面板与函数定义常量（用于模板渲染与公式解析）

- `src/frontend/pdf-home/features/pdf-sorter/components/weighted-sort-editor-template.js`
  - 生成组件模板（保留原 data-test 结构，保证既有 Jest 交互测试不变）

- `src/frontend/pdf-home/features/pdf-sorter/components/weighted-sort-editor-formula.js`
  - 纯逻辑：token → formula 格式化、formula → token 解析、safe reference 检查

- `src/frontend/pdf-home/features/pdf-sorter/components/weighted-sort-editor-view.js`
  - 只负责 DOM 渲染与校验状态渲染（tokens/pending/preview/validation）

## 回归测试

- 既有交互测试继续覆盖 UI 行为：`src/frontend/pdf-home/features/pdf-sorter/__tests__/weighted-sort-editor.builder.test.js`
- 新增纯逻辑测试：`src/frontend/pdf-home/features/pdf-sorter/__tests__/weighted-sort-editor.formula.test.js`

