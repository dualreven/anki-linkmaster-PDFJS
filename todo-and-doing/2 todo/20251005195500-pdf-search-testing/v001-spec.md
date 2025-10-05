# PDF-Home 搜索功能测试与质量保障规格说明

**功能ID**: 20251005195500-pdf-search-testing
**优先级**: 中
**版本**: v001
**创建时间**: 2025-10-05 19:55:00
**预计完成**: 2025-10-16
**状态**: 设计中

## 现状说明
- 现有测试覆盖旧版本地搜索逻辑，缺乏数据库/消息/前端联动的验证。
- 没有端到端脚本确保分页、筛选、排序交互正确。

## 存在问题
- 新增搜索链路跨多个模块，缺乏系统级回归测试风险较高。
- 缺乏自动化数据准备与清理手段。

## 提出需求
- 制定完整测试策略：单元（后端/前端）、集成（WebSocket）、端到端（浏览器自动化或脚本）。
- 提供测试数据与脚本，方便其他 AI/开发者执行。

## 解决方案
- 单元测试：
  - 扩展 pytest 覆盖 PDFLibraryAPI.search_records（依赖 Search SQL 任务）。
  - Jest 覆盖 SearchService、PaginationPanel、FilterManager。
- 集成测试：
  - Python 测试 StandardWebSocketServer，通过内存 WS 客户端模拟请求，验证响应结构。
  - 可复用 pytest-qt 或自行模拟。
- 端到端：
  - 新建 i-scripts/tests/search_e2e.py：
    1. 启动 i_launcher.py 服务；
    2. 调用 WebSocket 发送搜索请求；
    3. 校验分页跳转、筛选组合结果。
  - 或在前端使用 Playwright 脚本。
- 数据准备：
  - 在测试夹具中加载样例 PDF 数据（仿真 pdf_info 表）。
  - 提供 	ests/fixtures/search_samples.json。
- 报告：输出覆盖率、关键断言列表。

## 约束条件
### 仅修改本模块代码
涉及 src/backend/api/__tests__, src/backend/msgCenter_server/__tests__, src/frontend/pdf-home/features/__tests__, i-scripts/tests。

### 严格遵循代码规范和标准
测试文件命名遵循现有约定；脚本日志 UTF-8；不得提交临时数据文件。

## 可行验收标准
### 单元测试
- pytest 与 
pm test 均无失败，新增用例覆盖新逻辑所有分支。

### 端到端测试
- python ai_launcher.py start --module pdf-home 后执行 i-scripts/tests/search_e2e.py，返回 SUCCESS。

### 接口实现
#### 接口1:
函数: un_search_e2e()（Python 脚本入口）
描述: 自动化执行端到端验证。
参数: CLI 参数（可选 limit/keyword）。
返回值: 0 表示通过。

### 类实现
#### 类1
类: SearchE2ETestCase
描述: 封装端到端测试逻辑（可基于 unittest）。
属性: ws_client, ixtures
方法: setUp, 	earDown, 	est_multi_keyword, 	est_pagination, 	est_filter_combo

### 事件规范
#### 事件1
描述: 测试脚本需验证 search:results:server-updated 事件在前端触发（可通过前端日志或模拟环境）。
参数: { records, total, page }
返回值: 无
