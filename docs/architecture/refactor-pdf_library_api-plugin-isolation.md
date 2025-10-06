# 迁移指引\n\n本需求文档已迁移至 todo-and-doing 目录：\n- todo-and-doing/2 todo/20251006140530-pdf-library-api-plugin-isolation/v001-spec.md\n\n以下为最初版本（仅保留以供比对）：\n\n# PDFLibraryAPI 插件隔离重构需求说明（v001）

- 功能ID: 20251006000000-pdf-library-api-plugin-isolation
- 优先级: 高
- 版本: v001
- 创建时间: 2025-10-06
- 状态: 设计中（先行编写需求文档，不立即重构代码）

## 1. 背景与现状
- 现有 `src/backend/api/pdf_library_api.py` 是前端使用的统一门面，内部直接持有多类数据库插件（PDFInfo、PDFAnnotation、PDFBookmark、SearchCondition）并实现了多种特性：
  - 列表与详情：`list_records`、`get_record`、`get_record_detail`
  - 搜索：`search_records`
  - 书签：`list_bookmarks`、`save_bookmarks`
  - 文件入库/同步：`register_file_info`、`add_pdf_from_file`、`delete_record`
- 问题：
  - 职责混杂，`pdf-home` 与 `pdf-viewer` 的后端逻辑耦合在同一个类中；
  - 扩展新能力（如新的筛选或排序规则）会进一步膨胀该门面；
  - 单测覆盖点集中在一个文件，影响定位与维护效率；
  - 代码复用点（时间戳、tags 归一化、record 映射）分散在门面内部，缺乏清晰的 util 边界。

## 2. 重构目标
- 建立“插件隔离”的目录与代码结构，按前端功能域拆分后端子模块：
  - pdf-home 搜索能力 → `src/backend/api/pdf-home/search`
  - pdf-home 添加/入库能力 → `src/backend/api/pdf-home/add`
  - pdf-viewer 书签能力 → `src/backend/api/pdf-viewer/bookmark`
  - 公共工具 → 上述目录同级的 `utils/`
- 保留 `PDFLibraryAPI` 作为兼容门面，对外 API 不变，内部委派到对应子模块；
- 提炼共用的归一化与转换工具，避免重复实现；
- 不修改数据库插件与表结构（非目标），不破坏 `StandardWebSocketServer` 的既有消息契约；
- 单测迁移并补齐子模块级测试，保持现有 `test_pdf_library_api.py` 可通过（门面转调）。

## 3. 目录与模块规划

目标目录结构（新增）：

```
src/backend/api/
  pdf-home/
    search/
      service.py          # 搜索服务（search_records）
      contracts.py        # 请求/响应协议（DTO 定义、类型约束）
      dto.py              # 数据传输对象（可选）
      utils/              # 搜索相关工具（排序、过滤等）
    add/
      service.py          # 入库相关（register_file_info, add_pdf_from_file）
      validators.py       # 参数校验器
      utils/              # 元数据提取、路径处理等
  pdf-viewer/
    bookmark/
      service.py          # 书签树构建与持久化（list_bookmarks, save_bookmarks）
      contracts.py        # 书签节点与响应结构
      dto.py              # 书签 DTO（可选）
      utils/              # 书签树/顺序/区域校验工具
  utils/
    datetime.py           # ms/iso/second 互转、解析工具
    mapping.py            # row ↔ frontend record 映射工具
    tags.py               # tag 标准化工具
```

兼容层：
- `src/backend/api/pdf_library_api.py` 保留类 `PDFLibraryAPI`，将现有实现拆出为各子模块后，方法改为委派（delegate）：
  - `search_records` → 调用 `pdf-home/search/service.py` 中的 `SearchService.search_records`
  - `register_file_info`、`add_pdf_from_file` → 调用 `pdf-home/add/service.py`
  - `list_bookmarks`、`save_bookmarks` → 调用 `pdf-viewer/bookmark/service.py`
  - 其余 `_map_to_frontend`、时间戳换算、tag 归一化等公共逻辑挪到 `api/utils` 下；
- 这样既不破坏既有对外导入路径（保持 `PDFLibraryAPI` 可用），又便于后续直接由 WebSocket 层注入子服务实现。

## 4. 对外契约（保持不变）
以下方法签名与返回结构保持不变（由门面或子模块提供）：
- `search_records(payload: Dict[str, Any]) -> Dict[str, Any]`
  - 请求 payload 字段：`tokens[]`、`filters`、`sort[]`、`pagination{limit, offset, need_total}`、`query`
  - 响应：`{"records": [...], "total": int, "page": {limit, offset}, "meta": {...}}`
- `register_file_info(file_info: Dict[str, Any]) -> str`
- `add_pdf_from_file(filepath: str) -> Dict[str, Any]`（`success/uuid/filename/file_size/error`）
- `list_bookmarks(pdf_uuid: str) -> Dict[str, Any]`（`{"bookmarks": [...], "root_ids": [...]}`）
- `save_bookmarks(pdf_uuid: str, bookmarks: List[Dict], *, root_ids: Optional[List[str]]) -> int`

## 5. 迁移与分阶段实施
第一阶段（架构落盘 + 无功能变更）：
- 创建目标目录与空模块文件（含 `__init__.py`）；
- 将 `pdf_library_api.py` 中的工具方法抽到 `api/utils`；
- 保留门面方法签名，内部调用子模块实现；
- 单测层面：保留现有 `src/backend/api/__tests__/test_pdf_library_api.py`，新增子模块测试用例；
- 文档与 memory-bank：补充本重构条目与契约说明。

第二阶段（按域提取）：
- 提取搜索逻辑（排序、过滤、打分）到 `pdf-home/search/service.py`；
- 提取书签树构建与持久化到 `pdf-viewer/bookmark/service.py`；
- 提取添加/入库（含 `PDFMetadataExtractor` 与 `StandardPDFManager` 协作）到 `pdf-home/add/service.py`；
- 在门面中移除重复逻辑，仅保留参数校验与委派。

第三阶段（可选，按依赖倒置）：
- 为 `StandardWebSocketServer` 注入具体子服务（或通过构造函数传入门面的子服务实例），降低运行时硬依赖；
- 将 WebSocket 侧调用位置从 `pdf_library_api` 过渡到特定子服务（逐步替换）。

## 6. 测试与验收标准
- 测试维度：
  - 单元测试：
    - 搜索（多 token、空 token、标签匹配、评分、分页、排序、负例校验）；
    - 书签（树构建、排序、区域校验、级联保存/加载）；
    - 入库/注册（路径合法性、PDF 校验、失败回滚、DB 同步）。
  - 兼容性测试：
    - 既有 `test_pdf_library_api.py` 全量通过；
    - `src/backend/msgCenter_server/standard_server.py` 的相关调用路径不变（运行冒烟）。
- 验收标准：
  - 目录结构与文件名落地；
  - 门面对外接口不变；
  - 子模块具备独立测试覆盖；
  - 新增/变更的所有文件 I/O 显式 UTF-8，换行 `\n` 正确；
  - memory-bank 与架构文档更新完成。

## 7. 兼容与风险
- 风险：
  - 导入路径迁移导致 `ImportError`；
  - 子模块之间的工具函数循环依赖；
  - WebSocket 层若直接访问门面内部实现会受影响（需通过门面委派保护）。
- 降风险策略：
  - 第一阶段仅做“挪代码 + 委派”，不改变签名；
  - 工具函数集中到 `api/utils`，严格避免深层交叉引用；
  - 在 PR 阶段开启临时日志，确认新路径加载正常。

## 8. 开发清单（原子任务）
1) 新建目录与空文件（search/add/bookmark/utils）
2) 提炼工具函数到 `api/utils`（时间戳、tags、record 映射）
3) 搜索逻辑迁移至 `search/service.py`，门面委派
4) 书签逻辑迁移至 `bookmark/service.py`，门面委派
5) 入库逻辑迁移至 `add/service.py`，门面委派
6) 子模块单测补齐（保留门面单测）
7) 文档与 memory-bank 更新

## 9. 不在本次范围
- 不调整数据库表结构与迁移；
- 不修改前端协议与消息路由；
- 不重写 `StandardWebSocketServer` 逻辑（仅在后续阶段考虑注入）。


