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

## 工作记录2
**时间**: 2026-01-10 20:26
### 工作内容:
- 为 `PDFViewerManager` 增加可卸载的 PDF.js EventBus bridge：保存 handler 引用并在 `destroy()` 时使用 `pdfjsEventBus.off` 对称解绑。
- Fail-Fast：若 `pdfjsEventBus.off` 不存在，桥接直接抛错（禁止无法卸载也继续跑）。
- 新增回归测试：`initialize → destroy → initialize` 后，同一 pdfjs 事件只桥接一次（不重复 emit）。

### 改动范围:
- `src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js`
- `src/frontend/pdf-viewer/features/infra-ui/components/__tests__/pdf-viewer-manager.event-bridge.uninstall.test.js`

### 自验:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-ui/components/__tests__/pdf-viewer-manager.event-bridge.uninstall.test.js -i` ✅

### 工作结果:
- 已完成：`8ce558414c23dce2bcbc1c162caed9f0aca3677a`
