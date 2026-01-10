# Card Planner - MsgCenter 后端 annotation:bulk-get fail-fast（依赖不可用时明确失败）

**功能ID**: 20260110212636-card-planner-annotation-bulk-get-backend-failfast-I  
**优先级**: 中（P1：提升错误可读性，避免“看起来像超时/无响应”）  
**版本**: v001  
**创建时间**: 2026-01-10 21:26  
**状态**: 设计中  

## 现状说明
- `annotation:bulk-get` 已有后端 handler：`src/backend/msgCenter_server/handlers/pdf_viewer/annotation_bulk_get.py`，并有单测。
- 用户当前看到的是前端“超时”提示；该问题主因在前端 `to`/`failed` 处理，但后端仍需要在依赖不可用时给出 **清晰、稳定、可测试** 的失败响应，便于定位。

## 存在问题
- 当运行环境缺少 `pdf_library_api` 或 `_annotation_plugin` 不可用时，handler 可能抛异常或返回不够明确的错误信息，导致定位成本高。

## 提出需求
1) 当 annotation 插件不可用（例如 `ctx.pdf_library_api` 缺失、或 `_annotation_plugin` 缺失/为 None）时：
   - 必须返回 `type=annotation:bulk-get:failed`
   - `error.message` 必须包含“依赖缺失”的明确描述（Fail‑Fast）
2) 不允许 silent drop；错误必须可回到客户端（依赖 MsgCenter 标准错误格式）。

## 解决方案（建议）
- 在 `annotation_bulk_get.py` 开头做依赖检查：
  - 缺失则构造 `annotation:bulk-get:failed`（保持字段与现有错误格式一致）
- 补 pytest 覆盖：
  - 缺失 pdf_library_api
  - 缺失 _annotation_plugin
  - plugin 查询返回 None 的场景（现有 missing ann_id 已覆盖，可复用）

## 约束条件
- 仅修改：
  - `src/backend/msgCenter_server/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。
- 禁止新增“自动兜底加载插件”的逻辑（非预期必须报错）。

## 可行验收标准
### 单元测试
- `python -m pytest -q src/backend/msgCenter_server/handlers/__tests__/test_annotation_bulk_get_unit.py` 必须新增用例并通过。

### 人工验收（给用户）
- 当后端不具备注解插件时，planner 侧应收到明确的 `annotation:bulk-get:failed`（而不是无响应/只能超时）。

