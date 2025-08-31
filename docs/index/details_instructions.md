# 细节层指引

细节层应放在每个模块文档内部或模块下的 details 子目录，包含：

- 函数/接口列表与签名（带 file_path:line 引用）
- 数据结构与示例（例如 request_id, metadata 格式）
- 关键实现片段（需引用真实文件路径与行号）
- 测试/运行建议（如何在本地观察行为，涉及 npm run dev, python app.py 等）

例：
- src/frontend/pdf-home/index.js:45 - 初始化表格并订阅 pdf:list:updated
- src/frontend/pdf-home/table-wrapper.js:120 - 表格渲染主函数