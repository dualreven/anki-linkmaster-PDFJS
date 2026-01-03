# FilterBuilder v2（pdf-home/filter）面条治理说明

目标：把 `src/frontend/pdf-home/features/filter/components/filter-builder-v2.js` 收敛为“装配/状态/业务编排层”，把大块模板/渲染/DOM 事件/序列化逻辑拆到小模块中，保证单文件行数门禁（≤500）且保持对外导出与行为不变。

> 权威入口：`src/frontend/pdf-home/features/filter/components/filter-builder-v2.js`

## 模块拆分图

- `src/frontend/pdf-home/features/filter/components/filter-builder-v2.js`
  - 组件状态：`#filterTree/#selectedNode/#availableTags`
  - 业务动作：add/delete/switch/apply/reset/show/hide
  - 委托：
    - 模板：`src/frontend/pdf-home/features/filter/components/filter-builder-v2-template.js`
    - 常量（展示标签/操作符映射）：`src/frontend/pdf-home/features/filter/components/filter-builder-v2-constants.js`
    - 树节点渲染：`src/frontend/pdf-home/features/filter/components/filter-builder-v2-renderer.js`
    - DOM 事件绑定：`src/frontend/pdf-home/features/filter/components/filter-builder-v2-dom-events.js`
    - tree→SearchCondition 序列化：`src/frontend/pdf-home/features/filter/components/filter-builder-v2-serialization.js`

## 关键不变语义（必须保持）

1) **对外导出不变**  
`export class FilterBuilder` 保持不变，调用方入口仍为 `src/frontend/pdf-home/features/filter/index.js`。

2) **条件配置结构不变**  
`getConditionConfig()` 仍返回后端可识别的结构（`{type:'composite'|'field', ...}`）；当树上无有效条件时返回空的 `AND` composite。

## 回归测试（新增）

- 序列化最小用例：`src/frontend/pdf-home/features/filter/__tests__/filter-builder-v2-serialization.test.js`

