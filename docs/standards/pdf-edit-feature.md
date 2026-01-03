# PDFEditFeature（pdf-home/pdf-edit）面条治理说明

目标：把 `src/frontend/pdf-home/features/pdf-edit/index.js` 收敛为“Feature 装配/流程编排层”，把大块的表单模板、组件初始化、重置按钮逻辑、提交流程等拆到小模块中，保证单文件行数门禁（≤500）且保持对外导出与行为不变。

> 权威入口：`src/frontend/pdf-home/features/pdf-edit/index.js`

## 模块拆分图

- `src/frontend/pdf-home/features/pdf-edit/index.js`
  - Feature 生命周期：install/uninstall/enable/disable
  - 事件订阅：监听 `PDF_MANAGEMENT_EVENTS.EDIT.*`
  - UI 编排：Modal 打开/关闭、确认弹窗
  - 委托：
    - 表单 HTML：`src/frontend/pdf-home/features/pdf-edit/pdf-edit-form-template.js`
    - 表单组件：`src/frontend/pdf-home/features/pdf-edit/pdf-edit-form-components.js`
    - 全局错误/警告提示：`src/frontend/pdf-home/features/pdf-edit/pdf-edit-global-notifications.js`
    - 重置按钮：`src/frontend/pdf-home/features/pdf-edit/pdf-edit-reset-actions.js`
    - 提交流程：`src/frontend/pdf-home/features/pdf-edit/pdf-edit-submit-flow.js`

## 回归测试（新增）

- 表单模板/转义：`src/frontend/pdf-home/features/pdf-edit/__tests__/pdf-edit-form-template.test.js`

