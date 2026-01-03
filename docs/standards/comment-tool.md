# CommentTool（批注工具）拆分说明

目标：把 `src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/index.js` 收敛为“装配/委托层”，单文件行数 ≤500，并让关键行为可测、可回收（destroy 可正确解绑订阅）。

## 入口与对外契约

- 入口：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/index.js`
  - 对外导出保持不变：`export class CommentTool ...` + `export default CommentTool`
  - 必须保留：`ensureOverlayFor(annotation)`（供 AnnotationFeature 在数据加载后补画/入队）

## 拆分模块（同目录）

- 页面渲染监听：`comment-tool-page-rendering.js`
  - 负责：pdf.js `pagerendered` / `scale:*` 监听，以及应用级 `RENDER.PAGE_COMPLETED` 桥接事件
  - 重点：安装时返回 `unsubs`，destroy 统一清理

- 标注事件订阅：`comment-tool-subscriptions.js`
  - 负责：`ANNOTATION.CREATED/DELETED` 的订阅与 cleanup（从 pending 队列移除、移除 marker）

- 标记恢复与渲染：`comment-tool-marker-restoration.js`
  - 负责：pending 队列、flush、restore、渲染 marker 到 page

- 交互流：`comment-tool-interactions.js`
  - 负责：激活/停用、PDF 点击弹出输入框、marker 点击选择与侧栏打开

- UI：按钮与卡片
  - 工具按钮：`comment-tool-button.js`
  - 批注卡片：`comment-tool-annotation-card.js`

- 确认弹窗（Fail-Closed）：`comment-tool-confirm-dialog.js`
  - 决策：任何异常都返回 `false`（不删除），避免“异常默认允许删除”的兜底行为

## 防回归测试

- destroy 清理订阅：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/__tests__/comment-tool-destroy-unsubscribe.test.js`
- confirm fail-closed：`src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/__tests__/comment-tool-fail-closed-confirm.test.js`

