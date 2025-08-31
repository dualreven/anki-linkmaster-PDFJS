# persistence 模块 — 细节层

接口：
- saveItems(items)
  - 参考：data/pdf_files.json:1
  - 作用：将 items 写入持久化存储并返回 summary。
- deleteItems(ids)
  - 参考：data/pdf_files.json:1
  - 作用：删除指定 id 的条目并返回失败列表（如果有）。

数据存储格式：
- 使用 JSON 文件（data/pdf_files.json）保存 PDF 元数据；生产环境可替换为数据库或服务。

实现注意：
- 对文件读写需加锁或使用原子写入以避免并发破坏。
- 写入前生成备份以便失败时回滚。

测试：
- 使用临时文件或 mock filesystem 运行 saveItems/deleteItems 的单元测试。