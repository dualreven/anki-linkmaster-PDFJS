# 事件与常量命名规范（索引版）

目标：统一事件名称与常量引用，消除字面量与变量事件名带来的不一致与回归风险。

必须遵守
- 三段式：`{module}:{action}:{status}`（小写+连字符）。
- 只能通过命名空间常量引用：`*_EVENTS`、`*_MESSAGE_TYPES`、`PDF_VIEWER_EVENTS`、`WEBSOCKET_EVENTS`（禁止字符串字面量与变量/模板字符串）。
- 全局事件需在常量文件登记后，才会被 `global-event-registry.js` 放行。
- 作用域一致：跨模块通信使用 `onGlobal/emitGlobal`；同一链路不得混用 scoped/global。
- Lint：`custom/event-name-format=error`（三段式 + 禁字面量与变量/模板字符串）。

参考代码
- 常量：`src/frontend/common/event/event-constants.js`、`src/frontend/common/event/pdf-viewer-constants.js`
- 白名单：`src/frontend/common/event/global-event-registry.js`
- 校验器：`src/frontend/common/event/event-bus.js`（EventNameValidator）

命名空间示例（节选）
```js
// src/frontend/common/event/event-constants.js
export const WEBSOCKET_MESSAGE_TYPES = {
  OUTLINE_LIST: "outline:list:requested",
  OUTLINE_LIST_COMPLETED: "outline:list:completed",
  OUTLINE_LIST_FAILED: "outline:list:failed",
  // ...
};

// src/frontend/common/event/pdf-viewer-constants.js
export const PDF_VIEWER_EVENTS = {
  FILE: {
    LOAD: {
      REQUESTED: "pdf-viewer:file:load-requested",
      SUCCESS: "pdf-viewer:file:load-success",
      FAILED: "pdf-viewer:file:load-failed",
    },
  },
  // ...
};
```

用法示例（合规）
```js
eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, payload);
eventBus.on(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED, handler);
eventBus.emitGlobal(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, data);
```

用法示例（禁止）
```js
eventBus.emit("pdf-viewer:file:load-success", payload);    // ❌ 字面量
eventBus.on(eventNameVar, handler);                         // ❌ 变量/模板字符串
```

迁移任务与历史说明
- 见 `todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md`
