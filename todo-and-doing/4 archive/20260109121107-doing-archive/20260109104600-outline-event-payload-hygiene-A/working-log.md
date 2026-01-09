# 20260109104600-outline-event-payload-hygiene-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-09 10:46:00
### 工作内容:
- 任务创建（A 负责）
### 工作步骤:
1. 找到所有 `OUTLINE.SELECT.CHANGED` / `OUTLINE.NAVIGATE.REQUESTED` emit 点
2. 将 payload 收敛为最小字段
3. 补测试：断言 emit 的 payload 不含大对象字段
### 工作结果:
- N/A
### 下一步计划:
- A 提交 commit hash

