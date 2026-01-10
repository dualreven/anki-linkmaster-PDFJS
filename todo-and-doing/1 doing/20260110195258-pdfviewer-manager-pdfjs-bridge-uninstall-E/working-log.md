# 20260110195258-pdfviewer-manager-pdfjs-bridge-uninstall-E 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 19:52:58
### 工作内容:
- 任务下发：让 PDFViewerManager 的 PDF.js EventBus bridge 可卸载，防监听泄漏/重复触发。
### 下一步计划:
1. 确认 pdfjsEventBus 的 off/unsub 机制（on 是否返回 off）
2. 实现可卸载桥接（收集 unsubs 或 off handler）
3. 补回归测试：install/uninstall/install 不重复桥接
4. 提交 commit + 记录验收命令
