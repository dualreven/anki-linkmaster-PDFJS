# Card Planner - gui_launcher 注入流程可观测性增强（配合 v003）

**功能ID**: 20260110172214-card-planner-gui-launcher-inject-observability-F  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 17:22  
**状态**: 设计中  

## 现状说明
- 当前 `gui_launcher` 有“注入样例草稿卡”按钮，会发送 `card-planner:ingest:requested` 到 `to=[{client_id:\"new-card-scheduler\"}]`，并在日志中打印 ACK。
- 用户反馈 Step4 失败时，能看到 `NO_TARGET_FOUND(404)`，但“窗口是否已注册 / 是否 queued / 什么时候会自动注入”不够直观。

## 提出需求
- 增强注入按钮的日志输出（不改业务协议）：
  - 打印 ACK 的 `code/status/message/error_code`（如存在）；
  - 当 ACK 为 `202`（queued/accepted）时，额外提示：
    - “已排队等待 new-card-scheduler 注册，稍后会自动注入”
    - 建议用户切换窗口观察 toast/渲染。
- 仍保持 Fail-Fast：若 ACK 为 4xx/5xx（且非 queued 语义），应明确提示失败。

## 解决方案（建议）
- 修改 `gui_launcher.py` 中与 Card Planner 注入按钮相关的方法：
  - `_card_planner_manual_test_inject_sample_draft_cards`
  - 以及必要的 `_send_ws_text_qt` 返回值解析/日志打印（若当前返回的是字符串 JSON）。
- **不要**修改 `.kilocode/rules/memory-bank/**`（由 main 侧统一维护）。

## 约束条件
- 仅修改 GUI Launcher 模块相关代码：
  - `src/gui_launcher/**`
  - `gui_launcher.py`（如该文件仍是入口）

## 可行验收标准
### 单元测试（必须新增/补齐）
- pytest：模拟 `_send_ws_text_qt` 返回一个 `card-planner:ingest:completed` 的 JSON 文本：
  - `code=202` 时，`_log` 中必须包含“已排队/等待注册/自动注入”关键信息；
  - `code=404` 且 `error_code=NO_TARGET_FOUND` 时，`_log` 中必须包含“目标客户端未注册/不可路由”的关键信息。

### 人工验收
- 点击注入按钮后，日志应能明确区分：
  - 已成功转发（200）
  - 已排队等待注册（202）
  - 失败（4xx/5xx）

