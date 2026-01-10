# 20260110220446-pdfviewer-assets-global-error-toast-uninstall-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 22:04:46
### 工作内容:
- 任务下发：GlobalErrorToast 改为可卸载，消灭残留全局监听器。
### 下一步计划:
1. 读 `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 梳理 `global-error-toast.js` 当前绑定点与依赖
3. 先写回归测试（至少 2 条）再改实现
4. 提交 commit，记录验收命令与结果
