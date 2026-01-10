# 20260110195258-pdfviewer-pdf-search-remove-dom-bindings-shell-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 19:52:58
### 工作内容:
- 任务下发：移除旧 DOM bindings 壳，绑定逻辑收敛到 SearchBoxDOMManager。
### 下一步计划:
1. 追踪 `search-box-dom-bindings.js` 引用链并列出替换点
2. 删除旧壳/改为纯复出口，并更新引用
3. 确保 cleanup 测试通过（必要时补“无引用”测试）
4. 提交 commit + 记录验收命令
