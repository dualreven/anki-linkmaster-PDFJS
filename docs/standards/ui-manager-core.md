# UIManagerCore（infra-ui）拆分说明

目标：把 `src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core.js` 收敛为“装配/委托层”，避免单文件过大（≤500 行门禁），并降低面条耦合风险。

## 文件边界（现状）

- 入口类：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core.js`
  - 职责：初始化子模块、装配事件订阅与 UI 控件、对外暴露少量公共 API（如 `initialize()/destroy()`）。
  - 约束：对外 API 保持不变；事件名只允许使用常量（禁止字面量/变量事件名）。

## 已抽离模块

- 事件订阅：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-event-listeners.js`
  - 负责：EventBus 订阅/卸载集合（FILE.LOAD、URL_PARAMS.PARSED、WS 回执等）。
  - 依赖：通过 `ctx` 注入 getter/setter 与回调，避免跨模块直接访问私有字段。

- UI 控件装配：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-ui-controls.js`
  - 负责：`UIZoomControls/UILayoutControls` 初始化 + 事件 wiring（ZOOM/NAVIGATION/PAGE 同步）。

- DOM 交互监听：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-interactions.js`
  - 负责：ResizeObserver/window.resize 与 Ctrl/Cmd+wheel 缩放监听（返回 cleanup）。
  - 防回归点：避免 `addEventListener(..., fn.bind(this))` 导致 destroy 时无法 remove。

- 复制 PDF ID：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-copy-pdf-id.js`
  - 负责：复制按钮初始化、显隐控制、点击复制（execCommand 分支）+ cleanup。

- Header 标题更新：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-header-title.js`
  - 负责：更新 `#pdf-title` 的显示文本与 tooltip（去掉 `.pdf` 后缀）。

## 相关测试

- 复制按钮：`src/frontend/pdf-viewer/features/infra-ui/__tests__/copy-pdf-id-button.test.js`
- 销毁解绑：`src/frontend/pdf-viewer/features/infra-ui/__tests__/ui-manager-core-destroy-detaches-dom-listeners.test.js`

