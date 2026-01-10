# 20260110125102-card-planner-gui-launcher-inject-fix-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 12:51:02
### 工作内容:
- 初始化任务（修复注入 to 字段与多窗口问题入口）
### 工作步骤:
1) 注入消息 `to` 改为 `[{client_id:\"new-card-scheduler\"}]`
2) pytest 覆盖 `to` 列表结构
3) 验收：lint + pytest by path
### 工作结果:
- 待执行

