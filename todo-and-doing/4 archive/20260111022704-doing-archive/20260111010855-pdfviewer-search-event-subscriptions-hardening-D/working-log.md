# 20260111010855-pdfviewer-search-event-subscriptions-hardening-D 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-11 01:08（本地）
### 工作内容:
- 强化 pdf-search 订阅/DOM manager 边界与 cleanup 契约，补回归测试。
### 工作步骤:
1. 阅读 `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 先写测试（≥2条）：cleanup 对称 + cleanup 后不再触发
3. 进行最小拆分/重构（仅限 pdf-search scope）
4. 跑：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
5. 提交 git，记录 commit hash
### 工作结果:
- ✅ 已完成订阅层 Fail-Fast 与 cleanup 契约加固，并补齐回归测试（≥2）。
- 变更点（严格在 `src/frontend/pdf-viewer/features/pdf-search/**`）：
  - `components/search-box-event-subscriptions.js`：
    - `subscribeSearchBoxEvents(params)` **立即校验**：`params` 必须 plain object；`eventBus.on` 必须函数；`subscriberId` 必须非空字符串；`onOpen/onClose/onToggle` 必须函数；`onResult` 若提供必须函数。
    - **订阅建立失败时先清理已建立订阅再抛错**（避免部分订阅残留）。
    - 强制 `eventBus.on(...)` 返回 unsubscribe 函数，否则抛错。
    - cleanup 保持 **对称/幂等**：重复调用不抛错；cleanup 后不再触发 UI 回调。
  - 新增测试：
    - `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-event-subscriptions.cleanup.regression.test.js`
    - `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-event-subscriptions.failfast.test.js`
    - `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-event-subscriptions.no-dom-usage.test.js`

### 验证命令（定向）
- `pnpm exec jest --runTestsByPath "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-event-subscriptions.cleanup.regression.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-event-subscriptions.failfast.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-event-subscriptions.no-dom-usage.test.js" -i`
- `pnpm -s run lint`

### 提交
- `74a097c7` `refactor(pdf-search): harden search box event subscriptions`
### 存在问题:
- 无
### 下一步计划:
- 等待规划者合并/验收（重点点检：SearchBox destroy 后是否仍可能触发 UI 回调）。

## 工作记录2（按新增 gate 返工）
**时间**: 2026-01-11 12:57（本地）
### 变更动机（新增 gate 要求）
- `components/**` 不允许出现 `eventBus.on(...)`；订阅需要上移到 feature 装配层（或允许的非 components 层）。
- 同时需要满足 `feature-internal-eventbus-gates` 与 `frontend-line-limit` 门禁。

### 工作内容
- 移除 `components/search-box-event-subscriptions.js`（组件层不再存在 EventBus 订阅）。
- Feature 层改为订阅 `PDF_VIEWER_EVENTS.SEARCH.UI.OPEN`（来自 `KeyboardHandler` / 全局快捷键），并仅通过 `SearchManager` 驱动 UI。
- `SearchEngine` 增加 `onMatchesCount` 回调，把匹配计数直接写入 `SearchManager`，避免 Feature 内部闭环依赖 EventBus 的 `SEARCH.RESULT.UPDATED` 订阅。
- 替换回归测试：新增 Feature 级 cleanup 测试，删除已失效的 subscriptions helper 测试。

### 新增/更新测试
- `src/frontend/pdf-viewer/features/pdf-search/__tests__/search-feature.ui-open.cleanup.test.js`

### 验证命令（定向）
- `pnpm exec jest --runTestsByPath "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-bindings.shell-removed.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box-dom-manager.bindings.cleanup.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box.behavior.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-box.debounce.cancel.regression.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search-feature.ui-open.cleanup.test.js" "src/frontend/pdf-viewer/features/pdf-search/__tests__/search.alias-and-name.test.js" -i`
- `pnpm -s run lint`

### 提交
- `642b7b44` `refactor(pdf-search): move event subscriptions out of components`
