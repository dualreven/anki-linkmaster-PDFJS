# 模块：event-bus（本地事件总线）

简介：负责在前端各个组件间传递异步事件。

主要文件：
- kilocode/system-prompt-agent-fact-review.yaml:1

职责：
- 发布/订阅事件（如 pdf:list:updated）
- 保证幂等性与消息可追溯性（包含 metadata）

细节：
- 事件格式示例见 kilocode/system-prompt-agent-fact-review.yaml:5