# PDFViewer 面条代码整治：P0/P1 汇总与并行拆分计划（2026-01-09）

## 输入材料（已收敛到 main）
- 基线：`docs/reports/20260108-pdfviewer-scan-baseline.md`
- 扫描报告：
  - A：`docs/reports/20260108-pdfviewer-scan-A.md`（adapters）
  - B：`docs/reports/20260108-pdfviewer-scan-B.md`（infra-ui/infra-sidebar）
  - C：`docs/reports/20260108-pdfviewer-scan-C.md`（pdf-annotation）
  - D：`docs/reports/20260108-pdfviewer-scan-D.md`（outline/search/bootstrap）

## P0（必须先止血）

### P0-1：Bootstrap 全局监听器缺少卸载
- **位置**：`src/frontend/pdf-viewer/bootstrap/app-bootstrap-feature.js:189`（wheel），`:190`（keydown）
- **复核结果**：确认存在 `window.addEventListener("wheel"...)` / `window.addEventListener("keydown"...)`，仅写入 `window.__PDFVIEWER_DISABLE_PAGE_ZOOM_GUARD__`，未发现对应 remove。
- **风险**：调用 `window.pdfViewerApp.destroy()`（内部 `registry.uninstallAll()`）后，仍残留全局监听器 → 内存泄漏/全局行为污染。
- **改造方向**：
  1) 在 `window.pdfViewerApp.destroy()` 路径中增加明确清理；
  2) 或把 zoom-guard 封装为可安装/可卸载的 Feature（更一致）。
- **必须补测试**：验证 destroy 后 wheel/keydown 监听器被移除（可通过 spy `window.removeEventListener` 或检查全局标记被清空）。

## P1（并行拆分主战场）

### P1-A（adapters）：入站分发收敛 + URL 依赖去耦
- **范围**：`src/frontend/pdf-viewer/adapters/**`
- **问题要点**：
  - 入站 routing 逻辑碎片化（类内 + bridge 并存）。
  - 出站 handler 依赖 `getCurrentPdfIdFromWindow()`（隐式依赖 URL/浏览器环境）。
  - subscription bag 手工维护，易漏清理。
- **目标形态**：
  - “入站处理器”以插件化 handler 列表收敛（单入口）。
  - `pdfId` 来源通过注入/接口提供，适配器不直接碰 `window.location`。
  - handler 统一返回 cleanup（数组/函数），由装配层集中处理。
- **回归测试**：
  - destroy 后 adapter 的 eventBus 订阅被清理（Leak test）。
  - gate 等待期间 destroy 不抛未捕获错误（Race test）。

### P1-B（infra-ui）：拆掉“巨型事件中心”的耦合点
- **范围**：`src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-*.js`
- **问题要点**：
  - `ui-manager-core-ui-controls.js` / `ui-manager-core-event-listeners.js` 订阅大量无关领域事件，成为“上帝对象”。
  - 组件既订阅 EventBus 又做 DOM/状态更新，数据流难追踪。
- **目标形态**：
  - UI 子模块变为“哑组件/服务”（只暴露方法），EventBus 订阅上移到 feature 装配层。
  - 每个子模块只负责一个域（缩放/导航/标题/状态提示等）。
- **回归测试**：
  - 至少 1 个针对拆分后装配层的测试：模拟关键事件，断言对应子模块方法被调用（不再要求子模块自身订阅 EventBus）。

### P1-C（pdf-annotation）：Tools 从“事件驱动渲染”改为“store-reactive”
- **范围**：`src/frontend/pdf-viewer/features/pdf-annotation/**`
- **问题要点**：
  - `ScreenshotTool` / `TextHighlightTool` 等依赖 CRUD 事件来增删 marker，存在“状态变化不经事件”的不同步风险。
  - `AnnotationSidebarUI` 已 store 驱动，但 `subscriptions.js` 残留 Zombie Code，误导维护者。
  - 多处 `setTimeout` 作为竞态缓解手段，生命周期不清晰。
- **目标形态**：
  - 工具层订阅 `AnnotationManager.store`（annotations diff），marker 渲染完全由 state 推导。
  - 抽出共享的 “Marker Layer/Adapter” 统一处理 PDF.js 的 page-render/scale 事件。
  - 清理 `subscriptions.js` 的无效回调接口，避免双驱动。
- **回归测试**：
  - 更新 store 后 sidebar 自动刷新（不依赖 CREATED/DELETED 事件）。
  - 载入数据后 marker 恢复（不依赖 `ANNOTATION.DATA.LOADED` 事件，或将其降级为非必需信号）。

### P1-D（search/outline）：DOM bindings 解耦 + UI 不直连 WS
- **范围**：
  - `src/frontend/pdf-viewer/features/pdf-search/**`
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
- **问题要点**：
  - search：DOM 绑定与业务逻辑混杂，`SearchManager` 职责过载。
  - outline：UI 组件直接订阅 `WEBSOCKET_EVENTS`，跨层耦合。
- **目标形态**：
  - search：拆出 `SearchBoxDOMManager`（只管 DOM），业务逻辑保留在 manager/service。
  - outline：WS 消息只进 `OutlineManager`（或 adapter），UI 只订阅领域事件/store。
- **回归测试**：
  - DOM manager 的 init/cleanup 能正确绑定/解绑事件（JSDOM）。
  - outline UI 不再直接订阅 WS 事件（以更高层事件/状态驱动）。

## 复核：B 报告的 P0 已在 main 修复（无需再做）
- `src/frontend/pdf-viewer/features/infra-sidebar/index.js`：
  - `setTimeout` 已记录到 `#timeouts` 并在 `uninstall()` 里 `clearTimeout`；
  - `document mousemove/mouseup` 监听器在 `uninstall()` 里兜底移除并重置 UI 状态。

## 并行拆分建议（对应 A/B/C/D worktree）
- A：P1-A adapters
- B：P1-B infra-ui（ui-manager-core 拆分）
- C：P1-C pdf-annotation tools store-reactive
- D：P0-1 bootstrap 清理 + P1-D search/outline 解耦

## 合入策略（减少“串行确认”成本）
- 每个 worktree：只改自己范围 + 自带回归测试（Fail-Fast，不做兜底）。
- main 侧：使用 `pnpm -s run merge:sweep` 批量集成（一次跑 lint + 指定 Jest）。

