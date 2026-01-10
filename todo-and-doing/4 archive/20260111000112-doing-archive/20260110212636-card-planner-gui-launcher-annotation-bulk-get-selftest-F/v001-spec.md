# Card Planner - gui_launcher 增加 annotation:bulk-get 自检按钮（人工验收工具）

**功能ID**: 20260110212636-card-planner-gui-launcher-annotation-bulk-get-selftest-F  
**优先级**: 中（P1：提升人工验收与排障效率）  
**版本**: v001  
**创建时间**: 2026-01-10 21:26  
**状态**: 设计中  

## 现状说明
- 目前 `gui_launcher` 已有“Card Planner 注入测试”按钮，用于触发 ingest。
- annotation meta 拉取失败时，需要看后端日志/前端 toast，缺少“可控的单点自检入口”。

## 提出需求
1) 在 `gui_launcher` 增加一个“Annotation Bulk-Get 自检”按钮（或同等入口）：
   - 发送 `annotation:bulk-get:requested`
   - 必须携带 `to:"backend"`
   - 支持用户输入 `ann_ids`（默认给一个示例，如 `ann_1,ann_2`）
2) 输出可读日志：
   - request_id、耗时（ms）、ACK 的 `code/status/message/error`
3) 增加 pytest 防回归（至少覆盖：请求包含 to 字段、以及失败回执能被正确打印/解析）。

## 约束条件
- 仅修改：
  - `gui_launcher.py`
  - `src/gui_launcher/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。

## 可行验收标准
### 单元测试
- `python -m pytest -q src/gui_launcher/__tests__/test_gui_launcher_card_planner_manual_inject.py`（可新增新的 test 文件或复用现有）必须覆盖本按钮的消息构造与回执解析。

### 人工验收（给用户）
- 启动 MsgCenter 后，点击“Annotation Bulk-Get 自检”：
  - 成功：打印 `annotation:bulk-get:completed` 且包含 annotations 数组（或至少打印成功状态）
  - 失败：打印 `annotation:bulk-get:failed` 且 error message 清晰（例如缺少依赖/找不到 ann_id）

