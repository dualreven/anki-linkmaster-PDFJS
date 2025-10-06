# 步骤06：日志与诊断（search v001）

状态: 待执行
耗时预估: 15-30 分钟
产出: 快速定位问题的日志与诊断手册

## 目标
- 明确前后端日志位置、关键日志点与快速定位方法。

## 日志要求
- 编码：UTF-8；换行：`\n`。
- 前端：
  - 全局日志：`logs/pdf-home-js.log`
  - 关键点：
    - SearchManager：发送请求、收到响应、超时、失败
    - WSClient：连接、错误、未知消息类型警告
    - SearchResultsFeature：结果数量、首条记录摘要
- 后端：
  - WS 服务器：收到 `pdf/search`、查询耗时、结果数量；异常栈。
  - API/插件：`search_records` 关键词数量与结果数量。

## 建议的附加诊断
- 前端调试页：`src/frontend/pdf-home/debug-websocket-edit.html:1` 可用于观察 WS 事件流。
- 事件追踪：临时在容器层打印 `websocket:message:received` 的 `type`，确保 `pdf/search` 到达。
- 路由核对：`standard_server.py:341` 附近的 message_type 分支是否命中。

## 常见问题速查
- 未命中路由：确认消息 `type` 是否为 `pdf/search`（大小写一致）。
- 前端不识别：`WSClient.VALID_MESSAGE_TYPES` 未包含 `pdf/search` → 添加并重启。
- 结果为空：检查数据库是否有数据；或关键词过于严格（AND 组合）。
- 特殊字符误匹配：确认 LIKE 转义逻辑是否生效。
