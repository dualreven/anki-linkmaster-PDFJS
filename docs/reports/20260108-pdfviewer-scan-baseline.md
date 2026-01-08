# PDFViewer 扫描基线（main）

生成时间：2026-01-08 14:30（本报告用于“整治面条代码”的并行扫描统一口径）

## 扫描范围
- `src/frontend/pdf-viewer/**`

## 规模概览
- 文件数（全部）：`389`
- 文件数（常见代码/配置/文档扩展名）：`366`

## 热点文件（按行数 Top 25）
```
   776  src/frontend/pdf-viewer/docs/FEATURE-DEVELOPMENT-GUIDE.md
   614  src/frontend/pdf-viewer/assets/style.css
   449  src/frontend/pdf-viewer/features/pdf-outline/index.js
   449  src/frontend/pdf-viewer/features/infra-ui/components/ui-layout-controls.js
   440  src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core.js
   439  src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js
   437  src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-ui.js
   428  src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui.js
   427  src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/index.js
   426  src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/index.js
   423  src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.test.js
   419  src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/highlight-renderer.js
   418  src/frontend/pdf-viewer/features/infra-sidebar/index.js
   418  src/frontend/pdf-viewer/docs/ARCHITECTURE.md
   413  src/frontend/pdf-viewer/ui/text-layer-manager.js
   409  src/frontend/pdf-viewer/features/pdf-search/services/search-engine.js
   408  src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/color-picker-dialog.js
   394  src/frontend/pdf-viewer/docs/SPEC/PDF-VIEWER-LOGGING-IMPLEMENTATION-001.md
   388  src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/index.js
   388  src/frontend/pdf-viewer/features/pdf-url-loader/index.js
   385  src/frontend/pdf-viewer/adapters/websocket-adapter.js
   382  src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js
   380  src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/comment-dialog.js
   373  src/frontend/pdf-viewer/features/pdf-annotation/index.js
   373  src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js
```

## 关键“面条化风险信号”计数（命中行数）
- `eventBus.on/onGlobal/once`：`203`
- `addEventListener/removeEventListener`：`283`
- `setTimeout/setInterval`：`109`

## EventBus 订阅最密集文件（count-matches Top 10）
```
src/frontend/pdf-viewer/features/pdf-anchor/anchor-event-listeners.js:14
src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.test.js:14
src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-ui-controls.js:10
src/frontend/pdf-viewer/core/__tests__/state-manager.test.js:9
src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/subscriptions.js:8
src/frontend/pdf-viewer/features/pdf-annotation/index.js:8
src/frontend/pdf-viewer/adapters/websocket-adapter-outgoing-handlers.js:8
src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/event-subscriptions.js:7
src/frontend/pdf-viewer/features/pdf-search/index.js:7
src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-event-listeners.js:7
```

## DOM 监听最密集文件（addEventListener count-matches Top 10）
```
src/frontend/pdf-viewer/features/infra-ui/components/ui-layout-controls.js:14
src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/annotation-card.js:14
src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/color-picker-dialog.js:13
src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/highlight-action-menu.js:10
src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-toolbar.js:10
src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/card-renderer.js:9
src/frontend/pdf-viewer/features/pdf-search/components/search-box-dom-bindings.js:8
src/frontend/pdf-viewer/features/infra-ui/components/ui-zoom-controls.js:7
src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/floating-color-toolbar.js:7
src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/marker-renderer.js:7
```

## Timer 最密集文件（setTimeout/setInterval count-matches Top 10）
```
src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-crud.ws-requests.test.js:6
src/frontend/pdf-viewer/core/__tests__/lifecycle-manager.test.js:6
src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-sync-with-ws.test.js:5
src/frontend/pdf-viewer/features/pdf-outline/__tests__/outline-init-no-premature-render.test.js:5
src/frontend/pdf-viewer/features/pdf-annotation/__tests__/annotation-autoload-on-file-load.test.js:5
src/frontend/pdf-viewer/features/infra-nav-core/services/navigation-service.js:4
src/frontend/pdf-viewer/features/pdf-annotation/components/__tests__/annotation-sidebar-ui.test.js:4
src/frontend/pdf-viewer/features/infra-ui/components/ui-zoom-controls.js:2
src/frontend/pdf-viewer/features/pdf-resume/index.js:2
src/frontend/pdf-viewer/features/infra-sidebar/index.js:2
```

## 下一步（并行扫描要回答的问题）
- 哪些文件存在“订阅/监听/计时器”未在 `uninstall/destroy` 清理的风险？
- 哪些装配层文件同时做了：WS 消费 + 状态管理 + UI DOM + 事件桥接（需要拆分）？
- 哪些 Manager 仍在直接订阅 EventBus（违反“Manager 不订阅”约束）？
- 哪些地方存在跨 feature 的直接 import（独立性被破坏）？

