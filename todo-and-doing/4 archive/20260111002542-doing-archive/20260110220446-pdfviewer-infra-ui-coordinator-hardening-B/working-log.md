# 20260110220446-pdfviewer-infra-ui-coordinator-hardening-B 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 22:04:46
### 工作内容:
- 任务下发：infra-ui 订阅进一步上移到 subscriptions，组件更“纯”，destroy 清理可证明。
### 下一步计划:
1. 读 `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 盘点 infra-ui 仍存在的分散订阅/初始化点
3. 先写回归测试（至少 2 条）再改实现
4. 提交 commit，记录验收命令与结果
