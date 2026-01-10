# 20260110220446-ci-pdfviewer-no-eventbus-on-in-components-E 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 22:04:46
### 工作内容:
- 任务下发：新增 CI gate（严格失败）：禁止 pdf-viewer feature 的 `components/**` 直接 `eventBus.on(...)` 订阅。
### 下一步计划:
1. 盘点现有 `scripts/ci/*` gate 接入点
2. 实现 gate（扫描规则 + 错误输出）
3. 先写 gate 自测（fixture：应 fail/应 pass）
4. 提交 commit，记录验收命令与结果
