# PDF-Viewer 事件常量（说明文档）

> 说明：`PDF_VIEWER_EVENTS` 的**权威事件名列表**永远以代码为准：  
> `src/frontend/common/event/pdf-viewer-constants.js`

## 为什么要把注释外移
- `pdf-viewer-constants.js` 是全局事件常量表，历史上包含大量逐条 JSDoc，导致单文件行数过大（影响面条治理门禁与可读性）。
- 本文档承载“事件语义解释/使用提示/事件流链接”，代码文件只保留常量本体与最小必要说明。

## AI/开发者应该从哪里获取“详细信息”
- 事件名与分组（权威）：`src/frontend/common/event/pdf-viewer-constants.js`
- 事件总线的使用规范：`docs/SPEC/FRONTEND-EVENT-BUS-001.md`
- 事件命名与常量规范：`docs/SPEC/FRONTEND-EVENT-NAMING-001.md`、`docs/SPEC/FRONTEND-EVENT-CONSTANTS-001.md`
- PDF-Viewer 关键事件先后关系（流程级解释）：`docs/standards/pdf-viewer-event-flow.md`

## 使用建议（避免踩坑）
1) 订阅/发布事件必须使用常量：`eventBus.on(PDF_VIEWER_EVENTS...., handler)` / `eventBus.emit(PDF_VIEWER_EVENTS...., payload)`。
2) 不要在业务代码里拼接字符串事件名（ESLint 会拦截：`custom/event-name-format`）。
3) 订阅要能卸载，避免重复订阅/内存泄漏；优先保存 `unsubscribe()` 或使用集中 subscriptions 模块。

## 常见定位方法（更快找到你要的事件）
- 先在 `src/frontend/common/event/pdf-viewer-constants.js` 搜索关键字（如 `ANNOTATION` / `OUTLINE` / `PDFJS_EVENTS` / `RESUME`）。
- 若你想知道事件“什么时候发/先后顺序”，去看 `docs/standards/pdf-viewer-event-flow.md`。

