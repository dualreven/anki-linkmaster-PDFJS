# 标准协议模块拆分（standard_protocol.py）规格说明 v001

功能ID: 20251028111413-standard-protocol-split  
目标文件: `src/backend/msgCenter_server/standard_protocol.py`（≈599 行）  
优先级: 高（msgCenter 核心依赖）  
状态: 进行中（Phase-1 已完成）

## 背景与动机
- 当前文件集成：
  - `MessageType`（全域三段式类型枚举）
  - `StandardMessageHandler`（基础消息构造/错误封装/解析/结构校验）
  - `PDFMessageBuilder`（PDF 页/库相关便捷构造）
- 问题：职责混杂、难以单测、跨域耦合（通用与 PDF 专用杂糅），导致演进成本高。

## 拆分目标
- 按“类型枚举 / 通用构造 / PDF 专用构造 / 解析与结构校验”职责分离；
- 保持对外 API 不变（由 `standard_protocol` 作为门面 re-export）；
- 引入独立单测覆盖模块化职能；
- 行数目标：`standard_protocol.py` < 250 行；避免循环依赖。

## 模块结构（拟）
- `core/message_types.py`：仅包含 `MessageType`（分域注释/分段）
- `core/response.py`：
  - `build_base_message(request_type, data=None)`
  - `build_response(message_type, request_id, status, code, message, data=None, error=None)`
  - `build_error_response(request_id, error_type, error_message, *, message_type=..., error_details=None, code=500)`
- `core/pdf_messages.py`：PDF 领域构造（`build_pdf_page_response/error_response/preload_request/cache_clear_request`、PDF删除/列表等如需保留可迁此或保留在 pdf_library handler 内部）
- `core/parser.py`：
  - `parse_message(raw: str) -> (dict|None, str|None)`
  - `validate_message_structure(msg: dict) -> (bool, str|None)`（轻量结构校验；Schema 仍由 `core/schema_validation.py` 完成）
- `standard_protocol.py`（门面保留）：`from .core.message_types import MessageType` 等并 re-export，维持现有导入路径稳定。

## 分步实施（Phase）
1. Phase-0：基线验证（运行现有 pytest，全量通过）。【已完成】
2. Phase-1：迁移 `MessageType` → `core/message_types.py`；`standard_protocol` 引用并 re-export；增量测试。【已完成】
3. Phase-2：迁移通用构造 → `core/response.py`；`standard_protocol` 引用并 re-export；增量测试。【已完成】
4. Phase-3：迁移 `PDFMessageBuilder` → `core/pdf_messages.py`；`standard_protocol` 引用并 re-export；增量测试。
5. Phase-4：迁移解析与轻量结构校验 → `core/parser.py`；`standard_protocol` 调整为门面；增量测试。
6. Phase-5：清理与收敛 → 删除文件内遗留重复代码，确保行数目标；完善文档与单测。

## 兼容策略
- 对外 import 路径保持：`from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, PDFMessageBuilder, MessageType` 均可用；
- 新模块路径向内使用；对外仅在稳定后发布迁移指南（可选，非必须）。

## 单测计划
- 新增：`src/backend/msgCenter_server/core/__tests__/test_response_and_parser.py`
  - `build_response/build_error_response` 正/负路径；
  - `parse_message/validate_message_structure` 异常/非法格式；
- 回归：`__tests__` 全量通过；覆盖新增门面 re-export 行为。

## 验收标准
- 功能与现状一致；路由与处理器无感；
- `standard_protocol.py` < 250 行，且无循环引用告警；
- 全量 pytest 通过；CI 可加入该用例集。

## 风险与缓解
- 风险：循环依赖（处理器引用 MessageType/Builder）；
  - 缓解：模块内仅简单函数与 Enum；保持“下层无上层依赖”；
- 风险：第三方直接引用路径变化
  - 缓解：维持门面 re-export，后续再做外部迁移窗口。

## 时间预估
- Phase-1/2/3：每步 0.5 天 + 回归；
- Phase-4/5：1 天（含文档与测试）；
