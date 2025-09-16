# 模块：persistence（持久化 / 后端交互）

简介：负责文件存储与与后端服务的交互。

主要文件：
- data/pdf_files.json:1

职责：
- 保存/加载 PDF 元数据
- 提供添加/删除接口给管理器使用

细节：
- 示例数据见 data/pdf_files.json:1
- 与管理器的交互在 kilocode/system-prompt-agent-master.yaml 中有规划