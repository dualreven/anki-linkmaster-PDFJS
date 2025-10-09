# MsgCenter 通信规范 - PDF Viewer 导航（v1）

本文定义 MsgCenter 与 pdf-viewer 之间的“实例注册 + 精确导航”消息契约，支持：
- 指定 viewer 实例跳转到某个标注（annotation/anchor）
- 指定页码 + 精确位置（百分比/坐标）

## 概览
- 传输载体：WebSocket（JSON）
- 字段命名：snake_case
- 事件命名：三段式（domain:action:status）
- 幂等性：以 `request_id` + `viewer_id` 去重

## 实例注册
- type: `pdf-viewer:register:requested`
- direction: 前端 → MsgCenter
- purpose: 声明本浏览器窗口中的 viewer 实例身份，便于 MsgCenter 精确路由

请求：
```
{
  "type": "pdf-viewer:register:requested",
  "request_id": "<uuid>",
  "data": {
    "viewer_id": "vwr_xxxxxxxx",        // 必填，前端生成（session范围稳定）
    "pdf_uuid": "<pdf-id>",             // 可选，若已知当前PDF
    "url": "https://host/pdf-viewer?pdf-id=...", // 可选
    "title": "<document-title>"          // 可选
  },
  "timestamp": 1730000000000
}
```

响应：
- 可复用通用 `response`，或自定义 `pdf-viewer:register:completed/failed`

## 导航请求
- type: `pdf-viewer:navigate:requested`
- direction: MsgCenter → 前端
- purpose: 让特定 viewer 导航到标注或页内精确位置

请求（示例一：按标注跳转）：
```
{
  "type": "pdf-viewer:navigate:requested",
  "request_id": "<uuid>",
  "to": {
    "viewer_id": "vwr_xxxxxxxx",     // 与 pdf_uuid 二选一或同时提供
    "pdf_uuid": "<pdf-id>"
  },
  "data": {
    "target": {
      "type": "annotation",          // annotation | anchor | page | xy
      "annotation_id": "ann_abc123"   // 或 anchor_id
    },
    "options": {
      "highlight": true               // 跳转后是否闪烁高亮
    }
  }
}
```

请求（示例二：指定页码 + 垂直百分比）：
```
{
  "type": "pdf-viewer:navigate:requested",
  "request_id": "<uuid>",
  "to": { "pdf_uuid": "<pdf-id>" },
  "data": {
    "target": {
      "type": "page",
      "page_number": 12,
      "position": { "y_percent": 0.35 }   // 0~1，页内相对位置
    },
    "options": {
      "zoom": { "scale": 1.25 },
      "behavior": "smooth",               // smooth | instant（预留）
      "align": "center"                    // center | top | bottom（预留）
    }
  }
}
```

请求（示例三：页内坐标）：
```
{
  "type": "pdf-viewer:navigate:requested",
  "request_id": "<uuid>",
  "to": { "viewer_id": "vwr_xxxxxxxx" },
  "data": {
    "target": {
      "type": "xy",
      "page_number": 2,
      "position": { "x_percent": 0.40, "y_percent": 0.18 }
    }
  }
}
```

回执：
- 完成：`pdf-viewer:navigate:completed`
- 失败：`pdf-viewer:navigate:failed`
```
{
  "type": "pdf-viewer:navigate:completed",
  "request_id": "<same-as-request>",
  "data": { "viewer_id": "vwr_xxxxxxxx" },
  "timestamp": 1730000000100
}
```

失败：
```
{
  "type": "pdf-viewer:navigate:failed",
  "request_id": "<same-as-request>",
  "error": { "message": "annotation_id required" },
  "data": { "viewer_id": "vwr_xxxxxxxx" }
}
```

## 路由规则（前端）
- 若 `to.viewer_id` 存在且与本实例不一致：忽略消息
- 若 `to.pdf_uuid` 存在且与当前 PDF 不一致：忽略消息
- 否则按 `data.target.type` 执行：
  - `annotation/anchor` → 触发 `annotation-navigation:jump:requested`
  - `page/xy` → 触发 `pdf-viewer:navigation:goto`（附带 position/zoom 可选字段）

## 兼容性与扩展
- request_id 建议使用 UUIDv4
- options.behavior/align 为预留参数，前端可选择性实现
- viewer_id 生命周期建议为 session 级；多 tab 区分不同实例

