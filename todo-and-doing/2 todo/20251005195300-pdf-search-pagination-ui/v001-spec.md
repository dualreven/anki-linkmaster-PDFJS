# PDF-Home 搜索结果分页 UI 规格说明

**功能ID**: 20251005195300-pdf-search-pagination-ui
**优先级**: 中
**版本**: v001
**创建时间**: 2025-10-05 19:53:00
**预计完成**: 2025-10-14
**状态**: 设计中

## 现状说明
- SearchResultsFeature 当前仅展示列表，无分页控件。
- 后端计划返回 	otal、page.limit、page.offset，需要前端消费。

## 存在问题
- 当结果集大于本地缓存时会渲染过多节点，用户无法按页浏览。
- 需要与 SearchService 联动，触发新的搜索请求。

## 提出需求
- 增加分页控件（页码、上一页/下一页、每页条数选择）并与 SearchService 协作。
- 显示当前范围信息，例如“第 21-40 条 / 共 123 条”。

## 解决方案
- 在 eatures/search-results 下新增组件 pagination-panel.js 与样式。
- 功能点：
  - 支持配置 pageSize（默认 20，可选 20/50/100）。
  - 点击页码或导航按钮时调用 SearchService.submitQuery 覆盖 pagination。
  - 监听 search:results:server-updated，更新分页状态。
  - 处理 disable 状态（无上一页/下一页）。
- 与 SearchService 约定：
  - pagination = { limit, offset, need_total }。
  - UI 维护 currentPage = offset / limit + 1。
  - 变更 pageSize 时 reset offset。
- 无需依赖 Tabulator，保持 DOM 可复用。

## 约束条件
### 仅修改本模块代码
仅修改 src/frontend/pdf-home/features/search-results 与新增组件文件。

### 严格遵循代码规范和标准
遵循 SPEC-HEAD-PDFHome.json；CSS 置于 styles/，命名使用 BEM；事件通过 GlobalEventBus 触发。

## 可行验收标准
### 单元测试
- Jest/DOM 测试：
  - 渲染分页按钮数量正确；
  - 点击事件触发 SearchService.submitQuery（通过 mock）；
  - 在 total < limit 时隐藏页码。

### 端到端测试
- 启动系统，搜索命中 60 条记录，验证分页跳转/每页条数切换。

### 接口实现
#### 接口1:
函数: PaginationPanel.update({ total, limit, offset })
描述: 根据最新响应刷新 UI。
参数: 同上。
返回值: void

### 类实现
#### 类1
类: PaginationPanel
描述: 管理分页 UI 与交互。
属性: _container, _limitSelector, _pageButtons, _total, _limit, _offset
方法: ender, update, _goToPage, _changeLimit, _renderButtons

### 事件规范
#### 事件1
描述: search:pagination:changed（由分页组件触发）；SearchService 监听并重新发起搜索。
参数: { limit, offset }
返回值: 无
