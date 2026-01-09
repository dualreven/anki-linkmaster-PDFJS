# Card Planner - Annotation Meta Bulk Get（F）规格说明

**功能ID**: 20260109215122-card-planner-annotation-bulk-get-F  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-09 21:51:22  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/refactor-F`（worktree: `C:\Users\napretep\PycharmProjects\anki-linkmaster-F`）

## 真源
- 权威契约：`docs/contracts/card-planner.md`（第 7.4 节：`annotation:bulk-get:*`）

## 需求
实现 MsgCenter 后端消息：`annotation:bulk-get:requested`，按 `ann_ids` 返回标注元信息列表（title/type/pageNumber/pdfId）。

### 请求
- **type**: `annotation:bulk-get:requested`
- **data**:
  ```json
  { "ann_ids": ["ann_1", "ann_2"] }
  ```

### 响应（成功）
- **type**: `annotation:bulk-get:completed`
- **data**:
  ```json
  {
    "annotations": [
      { "id": "ann_1", "title": "t", "type": "note", "pageNumber": 1, "pdfId": "p1" }
    ]
  }
  ```

### Fail-Fast 规则（必须）
- `ann_ids` 必须为非空数组；元素必须为非空字符串。
- 必须保持输入顺序：`annotations[i].id === ann_ids[i]`。
- 任意 id 查询不到：直接返回 failed（400），错误信息必须包含缺失的 id（禁止静默跳过/过滤）。

## 实现建议（只改 MsgCenter）
- handler：新增 `src/backend/msgCenter_server/handlers/pdf_viewer/annotation_bulk_get.py`
- router：`src/backend/msgCenter_server/core/msg_router.py` 增加路由
- message types：`src/backend/msgCenter_server/core/message_types.py` 增加三段式常量
- 测试（必须新增）：`src/backend/msgCenter_server/handlers/__tests__/test_annotation_bulk_get_unit.py`

## 约束条件
- 仅修改 `src/backend/msgCenter_server/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`
- 禁止兜底：任何非预期输入必须报错（Fail‑Fast）

## 验收（DoD）
- 必须提交到 `worker/refactor-F`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `python -m pytest -q src/backend/msgCenter_server/handlers/__tests__/test_annotation_bulk_get_unit.py`

## 交付格式（复制给调度者）
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `src/backend/msgCenter_server/**`
- `tests`: `pnpm -s run lint` + `python -m pytest -q ...`
- `notes`: `<是否新增消息类型/是否影响现有协议>`
