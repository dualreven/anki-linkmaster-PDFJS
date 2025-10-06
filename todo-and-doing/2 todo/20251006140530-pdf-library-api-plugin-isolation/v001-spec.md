# PDFLibraryAPI 插件隔离重构 规格说明

**功能ID**: 20251006140530-pdf-library-api-plugin-isolation
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-06 14:05:30
**预计完成**: 2025-10-07
**状态**: 设计中

## 现状说明
- `src/backend/api/pdf_library_api.py` 作为门面，直接包含搜索、书签、入库等多职责逻辑；
- WebSocket 服务 `standard_server.py` 已经接入该门面，对外消息契约稳定；
- 数据库表插件（pdf_info/pdf_annotation/pdf_bookmark/search_condition）已实现。

## 存在问题
- 职责过重：pdf-home 与 pdf-viewer 的后端逻辑混杂在 `PDFLibraryAPI`；
- 扩展困难：新增筛选/排序/领域能力会继续膨胀门面；
- 测试边界不清：测试集中在单文件，定位与维护成本高；
- 工具分散：时间戳、tags 归一化、映射等通用逻辑没有独立 util 边界。

## 提出需求
- 以“插件隔离”为原则，按前端域拆分后端子模块：
  - pdf-home 搜索能力 → `src/backend/api/pdf-home/search`
  - pdf-home 添加/入库能力 → `src/backend/api/pdf-home/add`
  - pdf-viewer 书签能力 → `src/backend/api/pdf-viewer/bookmark`
  - 通用工具 → `src/backend/api/utils`
- 保持对外契约与消息协议不变；`PDFLibraryAPI` 作为兼容门面改为委派；
- 新增子模块具备独立测试，门面旧测试继续通过。

## 解决方案
- 目录结构：
```
src/backend/api/
  pdf-home/
    search/{service.py, contracts.py, dto.py, utils/}
    add/{service.py, validators.py, utils/}
  pdf-viewer/
    bookmark/{service.py, contracts.py, dto.py, utils/}
  utils/{datetime.py, mapping.py, tags.py}
```
- 委派策略：
  - `search_records` → pdf-home/search/service.SearchService
  - `register_file_info`、`add_pdf_from_file` → pdf-home/add/service.AddService
  - `list_bookmarks`、`save_bookmarks` → pdf-viewer/bookmark/service.BookmarkService
  - `api/utils` 提供时间戳互转、record 映射、tags 归一化；门面与子模块复用
- 分阶段：
  1) 架构落地（不改行为）：建目录/抽工具/门面委派；
  2) 提取实现：搜索/书签/入库迁移至子模块；
  3) 可选依赖倒置：WS 层注入子服务，降低耦合。

## 约束条件
### 仅修改本模块代码
仅修改 `src/backend/api/*` 相关目录与 `src/backend/msgCenter_server/standard_server.py` 的注入/调用细节（若需要注入）；不得修改前端协议与数据库表结构。

### 严格遵循代码规范和标准
- 阅读并遵循 `docs/SPEC/SPEC-HEAD-coding.json:1`、`docs/SPEC/SPEC-HEAD-communication.json:1`、`docs/SPEC/SPEC-HEAD-TEST.json:1`；
- 所有文件读写必须显式 UTF-8，且严格校验换行 `\n`；
- 目录命名使用 kebab-case（如 `pdf-home`、`pdf-viewer`）。

## 可行验收标准
### 单元测试
- 搜索：多 token、空 token、标签匹配、评分、分页、排序、负例；
- 书签：树结构构建/顺序、region 校验、级联保存/加载；
- 入库：路径与文件类型校验、失败回滚、DB 同步；
- 门面：保留 `src/backend/api/__tests__/test_pdf_library_api.py` 全量通过。

### 端到端测试
- WebSocket 路由保持不变；pdf-home 搜索、pdf-viewer 书签交互冒烟通过；
- ai_launcher 脚本下本地冒烟（不在此文档展开）。

### 接口实现（保持不变）
- 函数: `search_records(payload)`
  - 入参：`tokens[]`、`filters`、`sort[]`、`pagination{limit,offset,need_total}`、`query`
  - 返回：`{"records": [...], "total": int, "page": {limit,offset}, "meta": {...}}`
- 函数: `register_file_info(file_info)` → `str(uuid)`
- 函数: `add_pdf_from_file(filepath)` → `{success,uuid,filename,file_size,error}`
- 函数: `list_bookmarks(pdf_uuid)` → `{bookmarks, root_ids}`
- 函数: `save_bookmarks(pdf_uuid, bookmarks, *, root_ids)` → `int`

### 事件规范
- 不新增前端事件与消息类型；保持 `standard_server` 既有路由。

## 原子任务清单
1. 新建目录与 `__init__.py`（search/add/bookmark/utils）
2. 抽取工具到 `api/utils`：ms/iso/second、tags、row↔record 映射
3. 搜索逻辑迁移至 `search/service.py`，门面委派
4. 书签逻辑迁移至 `bookmark/service.py`，门面委派
5. 入库逻辑迁移至 `add/service.py`，门面委派
6. 新增子模块单测；保留门面单测
7. 更新 memory-bank、迁移文档，冒烟验证 WS 路径