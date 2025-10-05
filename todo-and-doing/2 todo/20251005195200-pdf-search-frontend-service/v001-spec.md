# PDF-Home 搜索服务层重构规格说明

**功能ID**: 20251005195200-pdf-search-frontend-service
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-05 19:52:00
**预计完成**: 2025-10-13
**状态**: 设计中

## 现状说明
- SearchFeature 仅负责 UI，真实搜索逻辑由 FilterManager 在本地执行。
- FilterManager/FilterConditionFactory 只支持按空格切词，且不会将条件发送给后端。
- WSClient 仅暴露通用发送能力，没有针对搜索的包装。

## 存在问题
- 无法与后端 LIKE 搜索 SQL 协同：缺少 tokens/filters/sort/pagination 的 payload 构建。
- 搜索响应无统一处理，SearchResultsFeature 直接操作数据数组。

## 提出需求
- 新建 SearchService，负责：
  1. 监听搜索框输入、防抖后合成 payload。
  2. 按“非文本符号”拆分关键字，生成 tokens。
  3. 与 FilterManager 协作，合并 filters/sort/pagination。
  4. 调用 WSClient 发送 pdf-home:search:pdf-files，并处理响应。
- SearchFeature/SearchResults/FilterFeature 仅专注 UI，数据流由 SearchService 主导。

## 解决方案
- 目录：src/frontend/pdf-home/features/search/services/search-service.js
- 功能点：
  - constructor({ globalEventBus, wsClient, filterManager, logger })
  - submitQuery(queryText, options)：整合 tokens、filters、sort、pagination。
  - handleResponse(message)：监听 pdf-home:response:search-results，分发至 UI。
  - parseTokens(query)：使用 /[^\p{L}\p{N}]+/u 拆词，过滤空字符串。
  - uildSortRules()：默认 [match_score desc, updated_at desc]，允许 UI 覆盖。
  - 发布事件：
    - search:request:started
    - search:request:failed
    - search:results:server-updated
  - 错误处理：将后端 error 转换成通知。
- SearchFeature 重构：
  - 注入 SearchService，转发 search:query:requested、search:clear:requested。
  - 清除本地 quickSearch 逻辑。
- SearchResults 联动 Pagination Task（独立规格）接收服务层事件。

## 约束条件
### 仅修改本模块代码
修改范围：eatures/search, eatures/search-results, eatures/filter 中与服务层对接部分；不得改动后端。

### 严格遵循代码规范和标准
遵守 SPEC-HEAD-PDFHome.json; 事件命名使用三段式；新增模块需在 eature.config.js 注册；文件写入采用 UTF-8。

## 可行验收标准
### 单元测试
- Jest 测试 SearchService：
  - parseTokens 针对多语言、符号、中英文混排；
  - payload 构建（包含 filters 与分页）。
- Mock WSClient，断言发送消息结构。

### 端到端测试
- 启动前后端，输入多关键字组合，校验事件流：请求开始 → 响应更新 → SearchResults 渲染。

### 接口实现
#### 接口1:
函数: SearchService.submitQuery(queryText: string, overrides?: SearchOptions)
描述: 用户输入发起搜索。
参数: queryText, overrides = { filters, sort, pagination }
返回值: Promise<void>

### 类实现
#### 类1
类: SearchService
描述: 统一搜索数据流。
属性: _wsClient, _eventBus, _filterManager, _logger, _currentRequestId, _pendingRequest
方法: submitQuery, clear, parseTokens, uildPayload, handleResponse, handleError

### 事件规范
#### 事件1
描述: search:results:server-updated（全局事件）携带 { records, total, page, meta }，供分页 UI 订阅。
参数: 同响应 data。
返回值: 无
