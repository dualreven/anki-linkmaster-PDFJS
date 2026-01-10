# 20260110195258-pdfviewer-annotation-commenttool-store-reactive-C 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 19:52:58
### 工作内容:
- 任务下发：CommentTool overlay 改为 store-reactive，去除对 `DATA.LOADED` 的硬依赖。
### 下一步计划:
1. 梳理 CommentTool 当前 overlay 恢复链路（DATA.LOADED/page rendered 等）
2. 接入 AnnotationManager.store 订阅并实现 overlay diff/恢复
3. 补回归测试：store 更新即可恢复 overlays
4. 提交 commit + 记录验收命令
