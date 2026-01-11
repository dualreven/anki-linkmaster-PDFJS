# 20260111161611-backend-annotation-bulk-get-test-ids-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 16:16
### 工作内容:
- 为 `annotation:bulk-get` 增加可查询的测试伪标注 id：`ann_test_1`、`ann_test_2`，并补后端回归测试。
### 工作步骤:
1. 确认当前 DB/表结构与 annotation id 字段含义
2. 增加/seed 两条测试标注数据（不影响真实数据）
3. 补后端测试：bulk-get 返回包含这两条 id
4. 跑 `pnpm -s run lint` + 后端定向测试
5. 写 `report.md` 并 git 提交
### 工作结果:
- [待填写]
### 存在问题:
- [待填写]
### 下一步计划:
- [待填写]

