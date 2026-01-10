# 20260110212636-card-planner-gui-launcher-annotation-bulk-get-selftest-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 21:26
### 工作内容:
- 给 `gui_launcher` 增加 annotation bulk-get 自检入口，便于人工验收与排障。
### 工作步骤:
1. 增加 UI：按钮 + ann_ids 输入框/默认值。
2. 实现：发送 `annotation:bulk-get:requested`（携带 `to:"backend"`），打印耗时与回执字段。
3. 回归：补 pytest 覆盖请求构造与回执解析。
### 工作结果:
- （待实现）
### 存在问题:
- （待记录）
### 下一步计划:
- 提交功能 commit + 贴出 pytest 通过结论。

