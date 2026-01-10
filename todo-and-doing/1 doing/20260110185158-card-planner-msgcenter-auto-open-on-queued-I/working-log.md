# 20260110185158-card-planner-msgcenter-auto-open-on-queued-I 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 18:51
### 工作内容:
-（待执行）MsgCenter ingest queued 时自动发射 app-window open（带去重），增强自愈能力。
### 工作步骤:
1) queued 分支追加 app-window:open:requested（to=backend）
2) 加去重节流（按 client_id）
3) pytest 覆盖 queued + open + 去重
### 工作结果:
-（待执行）
### 存在问题:
-（待执行）
### 下一步计划:
-（待执行）提交 commit hash + 测试命令

