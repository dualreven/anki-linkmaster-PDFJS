# 模块：manager（管理器）

简介：管理器负责将前端事件转换为后端消息并处理响应。

主要文件：
- roo/system-prompt-agent-master.yaml:1
- data/pdf_files.json:1

职责：
- 接收事件总线消息并构建请求（包含 request_id, metadata）
- 与后端/持久化层通信并广播结果

细节：
- 消息构建示例见 roo/system-prompt-agent-master.yaml:10
- 处理逻辑在 data/pdf_files.json 所示的元数据处理流程中引用（仅作索引说明）