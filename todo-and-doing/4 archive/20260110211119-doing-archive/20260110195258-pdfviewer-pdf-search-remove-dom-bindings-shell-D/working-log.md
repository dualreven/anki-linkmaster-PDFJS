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

## 工作记录2
**时间**: 2026-01-10 20:31
### 工作内容:
- 删除 `search-box-dom-bindings.js` 薄壳，避免后续维护者继续在壳里增加 DOM 绑定逻辑。
- 在 `SearchBox` 装配层直接 new `SearchBoxDOMManager` 并 push cleanup（DOM 绑定仍只发生在 DOMManager 内）。
- 新增“无引用回归测试”：确保 `pdf-search` 源码不再引用 `search-box-dom-bindings`。

### 变更点
- 删除：`src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-bindings.js`
- 修改：`src/frontend/pdf-viewer/features/pdf-search/components/search-box.js`
- 新增：`src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-bindings.shell-removed.test.js`

### 验收
- `pnpm exec jest --runTestsByPath "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-bindings.shell-removed.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box.behavior.test.js" -i` ✅
- `pnpm -s run lint` ✅

### 交付信息
- commit: `bb8bdce8682dfaa5263215edf9d246e62231117a`
