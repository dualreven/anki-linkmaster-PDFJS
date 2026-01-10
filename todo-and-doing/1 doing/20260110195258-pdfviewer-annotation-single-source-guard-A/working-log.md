# 20260110195258-pdfviewer-annotation-single-source-guard-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 19:52:58
### 工作内容:
- 任务下发：为 Annotation 单真源加 lint 门禁，防止 feature 侧再次复制实现导致分叉。
### 下一步计划:
1. 读取 `docs/SPEC/SPEC-HEAD-pdf-viewer.json` 与现有 lint gates 实现位置
2. 选择最小侵入的 gate 接入点并实现扫描规则
3. 本地验证：正例通过/反例失败
4. 提交 commit + 记录验收命令
