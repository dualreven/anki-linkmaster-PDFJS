# WebSocket 契约：Outline 域（索引版）

类型命名
- `outline:{list|create|update|delete|reorder}:{requested|completed|failed}`

负载约定
- list.completed：
  - `data.outline_items: Array<{ id, name, pageAt, position, children[] }>`
- 其他 completed：
  - 至少返回 `outline_id`；前端随后自动触发 `outline:list:requested` 进行二次拉取，保证一致性。

导入后持久化
- 首次导入原生大纲后，前端必须：
  1) `bookmark:save:requested` 持久化整棵树
  2) `outline:list:requested` 刷新 UI

参考代码
- 前端常量：`src/frontend/common/event/event-constants.js`（WEBSOCKET_MESSAGE_TYPES）
- 后端类型：`src/backend/msgCenter_server/core/message_types.py`（MessageType）
- 路由处理：`src/backend/msgCenter_server/core/msg_router.py`、`src/backend/msgCenter_server/handlers/pdf_viewer/outline.py`
- 能力注册：`src/backend/msgCenter_server/handlers/capability.py`
- 前端逻辑：`src/frontend/pdf-viewer/features/pdf-outline/index.js`

迁移任务与历史说明
- 见 `todo-and-doing/1 doing/20251107-tech-md-minify-migration/plan.md`

示例（请求/响应）
```json
// 请求：创建大纲
{
  "type": "outline:create:requested",
  "request_id": "req-123",
  "metadata": { "version": "1.0.0" },
  "data": {
    "pdf_uuid": "c83c60c58ad2",
    "parent_id": null,
    "name": "绪论",
    "pageAt": 1,
    "position": 0
  }
}
```

```json
// 响应：创建完成
{
  "type": "outline:create:completed",
  "request_id": "req-123",
  "data": {
    "outline_id": "outlineItem-AB12cdEF"
  }
}
```

```json
// 失败示例：更新找不到
{
  "type": "outline:update:failed",
  "request_id": "req-456",
  "error": {
    "code": "OUTLINE_NOT_FOUND",
    "message": "outline_id not found"
  }
}
```
