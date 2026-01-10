# 20260110212636-card-planner-annotation-bulk-get-to-field-and-failed-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 21:26
### 工作内容:
- 接到用户验收反馈：注入成功但 `annotation:bulk-get` 超时 toast 仍出现。
### 工作步骤:
1. 复现：在新卡片规划器注入草稿卡，观察 toast 与 WS 往返消息。
2. 修复：为 `annotation:bulk-get` 与所有后端消息补齐 `to:"backend"`，并处理 `*:failed`。
3. 防回归：补 Jest，覆盖 `to`、`failed` 快速失败、toast 去重。
### 工作结果:
- （待实现）
### 存在问题:
- （待记录）
### 下一步计划:
- 提交功能 commit + 贴出测试命令与结果。

