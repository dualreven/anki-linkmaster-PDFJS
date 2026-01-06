# PDF-Home LIKE 搜索 SQL 实现规格说明

**功能ID**: 20251005195000-pdf-search-like-sql
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-05 19:50:00
**预计完成**: 2025-10-12
**状态**: 设计中

## 现状说明
- 数据库存有 pdf_info 表，扩展字段存放在 json_data；现有 search() 方法仅支持单关键字、手工拼接条件。
- 前端搜索仍在浏览器端通过 FilterManager 对缓存列表做模糊匹配，无法满足多字段排序与分页需求。

## 存在问题
- 后端没有一次性在 SQL 层完成“分词→筛选→排序→分页”的能力，前端需要分页控件也无法落地。
- 现有实现没有按字段设置权重，搜索结果相关性低；缺少统一接口给 WebSocket 层调用。

## 提出需求
- 采用 LIKE 方案构建多 token 搜索 SQL，在一条查询内完成匹配、筛选、排序、分页，输出匹配分数。
- 保留升级 FTS5 的拓展点：代码结构需可切换实现，增加必要索引以保证 LIKE 性能。

## 解决方案
- 在 PDFLibraryAPI 内提供 search_records(payload)：
  - 接收 	okens、ilters、sort、pagination；无 token 时返回默认排序。
  - 使用 WITH tokens AS (...) CTE 展开关键字，遍历 target 字段（title/author/notes/tags/subject/keywords）。
  - 每个字段生成 LOWER(field) LIKE LOWER('%token%') 条件；标签使用 json_each 折平；所有 token 以 AND 组合。
  - 利用 CASE 统计命中得分，例如标题 5 分、作者 3 分、标签 2 分、备注 1 分。
  - 统一注入 Filter 条件（见 Filter 序列化任务），支持 AND/OR/NOT、布尔、区间、集合匹配。
  - 支持分页参数 limit/offset，并可选输出 	otal（通过 COUNT 子查询）。
  - 返回字段与 list_records 一致，额外暴露 match_score、matched_fields。
- 新建/复用索引：确保 	itle、uthor、json_extract(json_data,'$.keywords')、json_extract(json_data,'$.notes') 有覆盖索引，必要时增加虚拟列（例如 
otes_text）。

## 约束条件
### 仅修改本模块代码
仅修改 src/backend/api/pdf_library_api.py、必要的数据库插件/迁移脚本；不得直接改动前端代码。

### 严格遵循代码规范和标准
必须优先阅读 docs/SPEC/SPEC-HEAD-communication.json 与数据库插件相关规范，所有 SQL 通过参数绑定，禁止字符串拼接；保证 Set-Content -Encoding utf8 输出文件。

## 可行验收标准
### 单元测试
- 扩展 src/backend/api/__tests__/test_pdf_library_api.py：覆盖多 token、无 token、标签匹配、评分区间、分页、排序、负例。

### 端到端测试
- 启动 WebSocket 服务器，通过新 API 搜索“title+tag”组合，验证排序得分、分页正确；日志无 SQL 错误。

### 接口实现
#### 接口1:
函数: PDFLibraryAPI.search_records(payload: Dict[str, Any]) -> Dict[str, Any]
描述: 根据搜索 payload 返回记录列表及统计信息。
参数: payload = { tokens: List[str], filters: Dict, sort: List, pagination: Dict }
返回值: { records: List[Record], total: int, meta: { match_score: bool, query: str } }

### 类实现
#### 类1
类: SearchQueryBuilder
描述: 可选的内部辅助类，负责将 payload 拼装为 SQL、参数；方便未来切换 FTS5。
属性: 	okens, ilter_tree, sort_rules, limit, offset, 
eed_total
方法: uild_sql(), uild_params(), uild_count_sql()

### 事件规范
#### 事件1
描述: 搜索成功返回时，通过 WebSocket 广播 pdf-home:response:search-results（由其他任务实现），要求数据结构匹配本接口输出。
参数: { records, total, page }
返回值: 无
