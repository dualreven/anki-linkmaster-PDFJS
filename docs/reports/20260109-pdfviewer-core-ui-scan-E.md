# PDFViewer 面条化扫描报告 (E - core/ui)

**任务ID**: 20260109104700-pdfviewer-core-ui-spaghetti-scan-E  
**扫描时间**: 2026-01-09 11:20  
**扫描范围**: `src/frontend/pdf-viewer/core/**`, `src/frontend/pdf-viewer/ui/**`

## 1. 扫描执行清单
- `pnpm -s run lint`：待执行（此报告完成后立即触发）  
- 阅读现有报告：参考 `docs/reports/20260108-pdfviewer-scan-A.md` 确定模板结构。  
- 源码查看：`src/frontend/pdf-viewer/ui/{dom-element-manager.js,keyboard-handler.js,text-layer-manager.js}`、`src/frontend/pdf-viewer/core/{lifecycle-manager.js,state-manager.js,base-event-handler.js}`，以及 `docs/standards/text-layer-manager.md`。

## 2. 风险点列表 (P0/P1/P2)
| 级别 | 文件:行号 | 风险类型 | 描述 | 建议修复方向 |
| --- | --- | --- | --- | --- |
| **P1** | `src/frontend/pdf-viewer/ui/keyboard-handler.js:60-99` | 全局键盘监听泄漏 | `setupEventListener()` 在未提供 `DomEventHub` 的情况下直接对 `document` 调用 `addEventListener("keydown", …)`，但没有记录或拒绝重复注册；如果 PDFViewer 多次初始化或快速切换，旧的监听器会继续存在并与新实例共存，导致一次按键触发多次 `eventBus.emit`、导航/缩放命令叠加且事件总线变得难以追踪。 | 为 document 监听加上 “已注册” flag，或在每次 `setup` 前自动调用 `removeEventListener`/`#keydownUnsubscribe`；同时在 `destroy()` 中确保 `document` 监听总是移除。 |
| **P1** | `src/frontend/pdf-viewer/ui/text-layer-manager.js:60-120` | DOM 事件/容器耦合膨胀 | 构造器在 `document` 上安装 `selectionchange` 监听并通过 `#textLayerContainer` 派发自定义 `selectionchanged` 事件，但这个容器会被 `loadTextLayer`/`setContainer` 动态替换；如果管理器继续复用、而调用方换成新的容器，事件仍然发给旧的 DOM 节点，选区信息会“跑到”销毁的节点上（见触发、`getSelectedTextRect()` 与 `#dispatchSelectionEvent`）。这条单一的监听还让整个模块在多个容器间共享状态，导致内存/事件泄漏和 UI 反应不一致。 | 将选区监听解耦：1) 每次切换容器时重新绑定目标元素并清理旧事件；2) 或将事件转发给 `eventBus`/`CustomEvent`，避免依赖单个 DOM 节点；3) 明确文档中列出的职责（`docs/standards/text-layer-manager.md`）应只暴露接口，事件由上层统一调度。 |
| **P2** | `src/frontend/pdf-viewer/core/state-manager.js:70-210` | 事件总线熔断 / 粒度过粗 | `setCurrentPage`/`setTotalPages`/`setZoomLevel` 等方法在每次调用时都会 `#emitStateChange`，向 `PDF_VIEWER_EVENTS.STATE.CHANGED` 发出整个 `getState()` 快照；`reset()` 甚至先发 `PDF_VIEWER_EVENTS.STATE.RESET`，再逐字段触发额外事件。UI 层在监听 `STATE.CHANGED` 时必须对照每个字段才能决定如何更新，且一次页面切换会一路“灌”多个事件，造成订阅者重复计算与可观测管线的耦合。 | 控制 `state` 更新的事件粒度：比如新增 `PDF_VIEWER_EVENTS.STATE.FIELD_CHANGED` 结构、批量更新时只发一次事件、为 `reset()` 提供 `silent` 版，或让订阅者订阅字段级别的事件而不是总线级的 snapshot。 |
| **P2** | `src/frontend/pdf-viewer/core/lifecycle-manager.js:60-85` | 全局错误监听耦合 | `setupGlobalErrorHandling()` 直接在 `window` 上注册 `unhandledrejection` 与 `error` 事件，并在 `cleanup()` 前一直存在；虽然有 `#errorHandlersSetup` guard，但当 Viewer 不再需要时（如切换工作区）这些处理器仍然保持对 `#eventBus` 和 `#errorHandler` 的引用，跨模块复用时很容易导致错误流“交叉污染”。 | 让错误监听的注册/注销与生命周期管理器的钩子同步（例如将 `setupGlobalErrorHandling` 和 `cleanup` 绑定到 Viewer 初始化/销毁流程），或将 `window` 监听抽象为可替换的 “ErrorScope”，降低全局状态泄露。 |

## 3. “面条化结构”描述
- **DOM 衔接靠一个中心点**：`DOMElementManager` 在 `ui/dom-element-manager.js` 中收集了 15+ 个 ID，为 `loading`、`zoom`、`控制按钮`、`提示区域` 等提供唯一入口，但也将所有结构变化绑定在一个点上；任何前端模板调整都必须修改该管理器，风险集中。  
- **事件总线 + DOM 串联**：`KeyboardHandler` 既接管全局 `keydown`，又主动 `emit` 了导航/缩放/打印等多个事件（`PDF_VIEWER_EVENTS.NAVIGATION.*`, `ZOOM.*`, `SEARCH.UI.OPEN`, `PRINT.REQUEST`），它本身就成为了 UI 与内核之间 “唯一的转接站”，如果按键监听重复，那么事件总线就会收到多份重复 payload。  
- **选择/文本层篇章卡在 DOM**：`TextLayerManager` 既负责调用 PDF.js 渲染，又控制 `selectionchange` 事件、动态创建 `.text-highlight` 元素；它需要与容器、renderTextLayer、选区、highlight 等多个子系统交织，导致单元测试难写，容器交换时事件可能发给“陈旧”节点，符合面条结构“职责过载 + 订阅泄漏”的典型特征。  
- **核心状态由事件总线强耦合**：`StateManager` 的 `#emitStateChange` 把所有字段打包到 `STATE.CHANGED`，让 `core` 层不能本地处理状态变化，也难以做增量更新；这个包裹了多次 `set*` 的 `reset()` 进一步把多个状态事件一锅端出，放大了跨层依赖和调试成本（每个订阅者都要自行 diff）。

## 4. 拆分与改进建议
1. **封装 keyboard 事件生命周期**：为 `KeyboardHandler` 增加 `#documentListenerAdded` flag 和 `#removeDocumentListener()`，让 `setupEventListener()` 只在第一次注册；在每次 `destroy()`/`removeEventListener()` 前强制清理，避免 Viewer 重建时多次注册。  
2. **重构 TextLayerManager 事件路径**：将 `selectionchange` 事件推到 `eventBus` 或 `CustomEvent` 之外的通道，确保每次 `setContainer` 调用后都重绑；如果需要多个容器，只保留 `TextLayerManager` 的渲染逻辑，事件由上层 `UIManager` 自行转发。  
3. **引入状态更新管道**：用 `StateManager` 提供 `batchUpdate(updates)`/`dispatchField(field, value)` 接口，避免 `STATE.CHANGED` 在一口气执行 `setCurrentPage`、`setTotalPages` 时发出 N 次快照，粒度细化有助于订阅者只处理真正变动的字段。  
4. **明确 error lifecycle**：让 `LifecycleManager` 只在 UI 启动流程中注册 global handlers，销毁时必须卸载；或将 `window` 错误转成 `ErrorScope` 以便其他模块按需复用，避免跨模块“全局 handler”意外挂载多次。

## 5. 回归测试建议
1. **KeyboardHandler 注册次数测试**：在 `src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.test.js` 中模拟连续调用 `setupEventListener()`（第一次使用 `document`，第二次模拟 `DomEventHub`），断言 `document.addEventListener` 只被调用 1 次，避免重复提交。  
2. **TextLayerManager 容器切换测试**：设置伪 DOM 容器 A/B，先 `loadTextLayer` 到 A，再切换 `setContainer(B)`，验证 `selectionchange` 事件依然只派发给当前容器、旧容器没有 residual event，防止 leak。  
3. **StateManager 批处理行为测试**：在 `src/frontend/pdf-viewer/core/__tests__/state-manager.test.js` 中模拟一系列 `set*` 调用，确认 `STATE.CHANGED` 事件只在最终状态变化时发出一次快照，或新增 `batchUpdate` 触发只一次事件。
