# 步骤03：数据库搜索插件校验与用例

状态: 待执行
耗时预估: 45-60 分钟（含测试）
产出: 通过插件层单元测试的稳定搜索实现

## 目标
- 校验并补充 `PDFInfoTablePlugin.search_records(...)` 的多关键词/多字段模糊搜索行为。
- 覆盖关键词转义（`%`、`_`）、tags 数组匹配、JSON 字段（subject/keywords/notes）匹配等用例。

## 关键文件
- 插件实现：`src/backend/database/plugins/pdf_info_plugin.py:1`
- 现有单测样例：`src/backend/database/plugins/__tests__/test_pdf_info_plugin.py:1`

## 语义与实现要点（v001）
- 输入：`keywords: List[str]`（已按空格分词且去空）。
- 默认字段：`['title','author','filename','tags','notes','subject','keywords']`
- WHERE 子句：
  - 对每个关键词，构建字段 OR 条件块：`(title LIKE ? OR author LIKE ? OR ... )`
  - 多个关键词之间使用 AND 连接。
- LIKE 转义：对 `%` 与 `_` 转义，值使用参数绑定。
- tags：基于 JSON 文本包含判断（如：`json_data LIKE '%"keyword"%'`）。

## 示例 SQL 片段（简化）
```sql
SELECT * FROM pdf_info
WHERE (
  title LIKE ? OR author LIKE ? OR json_extract(json_data,'$.filename') LIKE ? OR json_data LIKE ? OR json_extract(json_data,'$.notes') LIKE ? OR json_extract(json_data,'$.subject') LIKE ? OR json_extract(json_data,'$.keywords') LIKE ?
) AND (
  title LIKE ? OR ...
)
ORDER BY updated_at DESC
LIMIT ? OFFSET ?
```

## 单元测试设计
- 用例1：单关键词命中 title/author/filename/notes/subject/keywords 之一。
- 用例2：多关键词 AND；分别命中不同字段。
- 用例3：tags 匹配（`tags: ['ai','ml']`，输入 `ai` 应命中；输入 `ml ai` 应 AND 组合）。
- 用例4：LIKE 特殊字符转义（输入 `50%_done` 不应被解释为通配符）。
- 用例5：空关键词（返回全部，支持 limit/offset）。

## 断言要点
- 返回数量、顺序（按 `updated_at DESC`）、字段完整性。
- 日志：`Search completed: {len(keywords)} keywords, {len(result)} results`（UTF-8）。

## 参考实现位置
- `src/backend/database/plugins/pdf_info_plugin.py:480` 起（search_records 实现）
