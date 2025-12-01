# Memory Bank - Context（精简版）

最后更新：2025-11-30

## 当前任务快照（2025-11-29）
- 任务1：🔍 分析 pdf-viewer 断点续读（resume）在高页码场景下的恢复页码偏差（例：关闭在 42 页，重开时在 39–40 跳动并最终停在 40 页）
- 任务2：📡 盘点 pdf-viewer 中 WS 消息重构的当前进度（仅做只读分析与阶段性结论）
- 任务3：🧩 梳理 pdf-viewer / pdf-home 在前端层面的「功能相同但各自实现」部分，并设计可抽象到 common 的组合式方案
- 任务4：🧱 盘点 pdf-viewer 内部 sidebar 系列（outline/anchor/annotation/card/translate/ai-assistant/backlink 等）的重复代码模式，输出只读分析报告，暂不落地重构
- 任务5：🧹 清理 `src/frontend/pdf-home` 与 `src/frontend/pdf-viewer` 目录下的所有 eslint 报错，为后续重构提供“lint 全绿”的基线（当前已完成一轮，两个目录在本次运行时 eslint 全绿）
- 任务6：⏱ 盘点“带 gate 条件的 WS 消息类型”当前实现情况（主要聚焦 pdf-viewer，兼顾 pdf-home 规范）
- 前序任务：压缩 context.md；多轮修复 PDF 页码跳转偏差 Bug + pdf-resume 模块化重构；WS 收发器与条件 gate 协议设计与 pdf-home 侧落地（详见归档与 AItemp 日志）

### 任务4：pdf-viewer 内部 sidebar 重复代码盘点与首轮组合式抽象（2025-11-29～30）

> 范围说明：仅关注 `src/frontend/pdf-viewer` 模块内部，与 sidebar 相关的 Feature/UI/infra 代码（包括 infra-sidebar、outline/anchor/annotation/card/translator/ai-assistant/backlink 等），不涉及与 pdf-home 的跨模块对比。2025-11-29 先完成只读分析，2025-11-30 在确保 lint 通过与行为等价的前提下，进行了小步的组合式抽象重构。

- 相关文件概览（结构保持不变，部分实现已开始组合化重构）
  - infra 层：`src/frontend/pdf-viewer/features/infra-sidebar/*`  
    - `real-sidebars.js`：注册 anchor/outline/annotation/card/translate/ai-assistant/backlink 等真实侧边栏，以及 `createRealSidebarButtons` 创建切换按钮。  
    - `sidebar-config.js`：集中管理 sidebar 配置基础结构（id/title/contentRenderer/宽度/是否可拉伸等）。  
    - `styles/sidebar-layout.css`：侧边栏布局与样式。  
  - 业务侧栏 UI：  
    - 锚点：`features/pdf-anchor/components/anchor-sidebar-ui.js`  
    - 标注：`features/pdf-annotation/components/annotation-sidebar-ui.js`  
    - 卡片：`features/pdf-card/components/card-sidebar-ui.js`  
    - 翻译：`features/pdf-translator/components/TranslatorSidebarUI.js`  
    - AI 助手：`features/ai-assistant/components/ai-assistant-sidebar-ui.js`  
    - 大纲（新）：`features/pdf-outline/components/outline-sidebar-ui.js`  
    - 大纲（经典）：`ui/outline-sidebar-ui.js`（OutlineSidebarUIClassic）

- 发现的主要重复模式与首轮组合式抽象落地情况
  1. **侧边栏容器骨架样式高度重复 → 抽出 pdf-viewer 级 sidebar-shell 纯函数**  
     - 多个 SidebarUI 类在 `initialize()` / `#createContent()` 中手动创建根容器 `div`，并重复设置类似的内联样式：  
       - `"height:100%;display:flex;flex-direction:column;box-sizing:border-box;"`（AnchorSidebarUI / CardSidebarUI / OutlineSidebarUIClassic 等）；  
       - 或 `"display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;background:#fff"`（AnnotationSidebarUI 等）。  
     - 这些类的职责本质上都是“提供一个顶部工具栏 + 下方滚动区域”的侧栏内容骨架，只是各自 copy 了一套 flex 布局与样式串。  
     - 2025-11-30 进展：在 `src/frontend/pdf-viewer/shared/sidebar-shell.js` 中新增纯函数 `createSidebarRoot({ className, extraStyle })`，统一“100% 高度 + flex column + box-sizing:border-box”的壳子样式；  
       - `features/pdf-anchor/components/anchor-sidebar-ui.js` 与 `features/pdf-card/components/card-sidebar-ui.js` 已改为通过 `createSidebarRoot()` 创建根容器，其余 DOM 结构保持不变；  
       - 抽象范围仅限 pdf-viewer 内部，后续如模式稳定可考虑上升到 common/ui。

  2. **事件订阅/解除订阅模式重复 → 接入 subscription-bag 组合管理**  
     - 原状：AnchorSidebarUI / AnnotationSidebarUI / TranslatorSidebarUI / OutlineSidebarUI / OutlineSidebarUIClassic 等，都维护类似的 `#unsubs = []` 数组：  
       - 通过 `this.#unsubs.push(this.#eventBus.on(...))` / `onGlobal(...)` 收集订阅；  
       - 在 `destroy()` 中遍历调用 `unsub()` 或 `u()`，再清空数组。  
     - 这一模式与前面为 WebSocketAdapter 抽象的 `createSubscriptionBag` 十分接近。  
     - 2025-11-30 进展：在不改变对外行为的前提下，已将以下类改为使用 `createSubscriptionBag` 组合管理订阅：  
       - `features/pdf-anchor/components/anchor-sidebar-ui.js`（AnchorSidebarUI）  
       - `features/pdf-annotation/components/annotation-sidebar-ui.js`（AnnotationSidebarUI）  
       - `features/pdf-card/components/card-sidebar-ui.js`（CardSidebarUI）  
       这些类内部不再显式维护 `#unsubs = []` 数组，统一通过 `subscriptions.add(fn)` / `subscriptions.clear()` 管理订阅生命周期，减少重复 try/catch 代码。其余 Sidebar/Feature 后续可视情况逐步迁移。  
     - 补充：在非 sidebar 的 `PDFTranslatorFeature` 中，也将事件订阅收敛到 `createSubscriptionBag`，并新增专门的订阅释放单元测试（`pdf-translator-feature.subscriptions.test.js`），用于验证 install/uninstall 会触发所有 unsubscribe。  

  3. **Outline 侧边栏存在“新旧双实现”并行的功能重复**  
     - 新版：`features/pdf-outline/components/outline-sidebar-ui.js`（类 `OutlineSidebarUI`），使用 `OutlineToolbar` + jsTree + 全局事件；  
     - 旧版：`ui/outline-sidebar-ui.js`（类 `OutlineSidebarUIClassic`），同样使用 `OutlineToolbar` + jsTree + OUTLINE.LOAD/SELECT/REORDER 事件；  
     - 注册逻辑：`features/infra-sidebar/real-sidebars.js` 中优先从容器获取 `outlineSidebarUI`，缺失时退回 `new OutlineSidebarUIClassic(eventBus)`。  
     - 两者在职责上都是“展示 PDF 大纲树 + 处理选择/拖拽/复制 ID 等交互”，只是实现细节和日志/事件使用上有所差异。当前处于“兼容期的双轨实现”，属于明确的功能级重复。后续若确认新实现稳定，可在 infra 层统一为单实现，并将旧实现降级为示例/文档代码。

  4. **real-sidebars 中各业务侧栏注册逻辑模板化重复**  
     - `real-sidebars.js` 为 anchor/annotation/card/translate/ai-assistant/backlink 等侧栏创建配置时，大致遵循同一模式：  
       - 在外层定义 `let XxxUIInstance = null;`；  
       - 在 `contentRenderer` 内部首次访问时从容器 `container.get("xxxSidebarUI")` 获取并缓存；  
       - 若未成功获取，则渲染占位 DOM（多处使用 `"padding: 20px; color: #999; text-align: center;"` 或相似样式）；  
       - 最后传入 `createSidebarConfig`，并设置 `defaultWidth/minWidth/maxWidth/resizable`。  
     - 按钮创建部分 `createRealSidebarButtons(eventBus)` 也采用统一模板：定义 `buttons` 数组（id/label/title），再为每个按钮拼接相似的 inline 样式和点击事件逻辑。  
     - 这一块可以被视为“注册/按钮工厂”已经自带的模板，后续若要减少重复，可以考虑：  
       - 抽象出 `createLazySidebarConfig({ id, title, tokenName, placeholder })`；  
       - 抽象出 `createSidebarToggleButtons({ eventBus, containerId, buttons })`。当前仅记录为潜在重构方向。

  5. **占位 UI 与“开发中”文案重复**  
     - CardSidebarUI / real-sidebars 中的 backlink 占位 / 部分未启用 sidebar（如 translation 在容器缺失时）都渲染了类似的“功能开发中/未启用”提示：  
       - 使用中心对齐的图标 + 标题 + 功能列表说明；  
       - 文案风格与样式（padding/颜色/字号）高度一致。  
     - 目前这些占位 UI 分散在多个文件中维护，如果将来要统一视觉或批量修改文案，需要逐个文件调整。后续可以考虑增加一个通用的 `createFeaturePlaceholder({ icon, title, lines })` helper 或 CSS 组件，减少重复。

- 说明
  - 本轮只读分析未改动任何 sidebar 相关业务代码，因此不会主动修复 lint 中已有的错误（例如 `outline-sidebar-ui.js` 中的缩进问题、部分工具文件中的 `no-empty`/`custom/no-silent-catch` 报错）；  
  - 运行 `pnpm exec eslint src/frontend/pdf-viewer --ext .js,.cjs,.mjs` 当前会报出若干历史问题，已在本次 AItemp 日志中记录为现状说明，而非本轮任务的一部分。  
  - 若后续决定对上述重复模式做抽象或重构，需要：  
    1) 在 `todo-and-doing/2 todo/` 新建对应需求目录与规范；  
    2) 为抽象出的 helper/组件补齐单元测试与契约测试；  
    3) 在 `architecture.md` / `tech.md` 中补充 sidebar 统一骨架/订阅模式的设计记录。


### 本次分析结论（pdf-resume 恢复页码 42→40 问题）
- 现象复述：用户在第 42 页关闭 pdf-viewer 后重新打开，同一文档会在 39–40 页之间短暂跳变，最终稳定停在第 40 页，而不是预期的 42 页。
- 关键链路：
  - 保存阶段：`PDFResumeFeature` 通过两条路径更新 resume：  
    1) `PAGE.CHANGING` 事件（由 `PDFViewerManager` 桥接 PDF.js 的 `pagechanging`），直接调用 `ResumeUpdater.setPage(pageNumber) + flush()`；  
    2) `PositionTracker` 基于 `viewerContainer` 视口中心，使用 `getCurrentPageAndPosition()`（内部调用 `detectCenterPageNumber` + `measureYPercent`）做滚动采样，同样调用 `setPage(pageAt) + flush()`。
  - 恢复阶段：`PDFResumeFeature.#applyLoadedResume()` 在收到后端的 `json_data.resume` 后，先恢复视图状态（缩放/布局/旋转），再通过 `NavigationService.navigateTo({ pageAt: resume.page, position: resume.y_percent })` 触发两步导航（`NAVIGATION.GOTO`→PDF.js 内部跳转 + `scrollToPosition` 二次平滑滚动）。
- 主要成因拆解：
  1. **保存阶段“当前页”定义不一致**  
     - PDF.js 的 `currentPageNumber` 与我们在 `pdf-page-detection-utils.detectCenterPageNumber()` 中使用的“视口中心页”不完全等价，尤其是在接近文档底部时：  
       - 用户通过页码输入或快捷跳转到第 42 页后，PDF.js 往往将第 42 页顶部对齐到视口上缘；  
       - 此时 `viewerContainer` 的**中心点**可能仍落在第 40～41 页区域（因为视口高度有限，底部无法完全再向下滚动）；  
       - 结果：`PAGE.CHANGING` 曾经发出过 `pageNumber = 42`，但用户继续微调滚动后，最后一个触发 resume 的事件往往来自 `PositionTracker`，其基于“中心页”检测出的 `pageAt` 可能是 40 或 41，而不是 42。  
     - `ResumeUpdater.flush()` 采用“最后一次 setPage 为准”的策略：如果最近一次调用来自 PositionTracker（`pageAt = 40`），则最终写入的 resume.page 就是 40，即使 PDF.js 内部的 `currentPageNumber` 仍为 42。
  2. **两步导航 + 位置测量的边界效应**  
     - 恢复时，`NavigationService.navigateTo()` 会：  
       1) 通过 `NAVIGATION.GOTO` 事件驱动 PDF.js 跳转到 `pageAt` 页面（内部有自己的滚动动画）；  
       2) 等待 `#waitForPageReady(pageAt)` + 额外 100ms，随后在我们的 DOM 层执行 `scrollToPosition(position, pageAt)`：  
          - 该方法尝试把“目标页中 y_percent 对应的点”放到视口中心；  
          - 但若目标页接近文档底部，理论上的中心位置会超出文档最大 `scrollTop`，代码里会被 `maxScrollTop` 截断；  
          - 被截断后，实际视口中心会偏上（落在上一两页的中部），这进一步放大了“保存阶段用中心页”的偏差。  
     - 从用户感知来看，这种“PDF.js 自己滚一段 + 我们再滚一段 + 边界截断”组合，很容易表现为：打开时先看到 39 页附近一闪，再滑到 40 页附近稳定下来，看不到 42 页，给人的直观印象就是“在 39–40 之间抖动，最后停在 40 页”。
  3. **中间状态写回的问题在上一轮已通过冻结机制缓解，但仍会放大上述偏差**  
     - 之前的 bug：在恢复导航过程中，PDF.js 的 `pagechanging` 会依次发出如 39→40→41→42 的中间页码；旧版本的 `PDFResumeFeature` 会立刻把这些中间页码写入 resume，导致“刚跳到 42，立刻又把 40 写回数据库”。  
     - 当前代码中已在 `PDFResumeFeature.#applyLoadedResume()` 中对 `PositionTracker` 调用 `freezeFor(3000)`，并在 `PAGE.CHANGING`/`ZOOM.CHANGING` 处理器里检查 `isFrozen`，避免恢复期间的中间状态被回写，这一块已经基本锁死。  
     - 但这只解决了“恢复期间写错”的问题，并**没有改变**“平时阅读时最后一次滚动由中心页检测驱动”的策略，因此在高页码 + 底部边界场景下，**保存下来的 resume 本身就有页码偏差（42 → 40）**，恢复逻辑只是在忠实执行这个“错误的真相”。  

- 结论：  
  - 当前 42→40 问题不是单一函数的 off-by-one，而是 **“中心页检测 + 两步导航 + 底部滚动边界 + 以最后一次 PositionTracker 写入为准”** 叠加造成的系统性偏差：  
    - 在文档中部时，中心页 ≈ 当前页，行为正常；  
    - 在接近末尾时，中心页倾向于落在倒数第二、第三页，导致 resume.page 往前飘；  
    - 再加上恢复时的两步滚动动画，用户会明显看到“先在 39–40 抖一阵，最后停在 40”，而从未真正停在 42。  
  - 之前增加冻结（freeze）的修复主要阻止了“恢复过程把中间页码写回 resume”的回归风险；本次分析进一步确认了**保存策略本身在高页码场景下对“当前页”的定义存在误差**，这是用户现在仍然能复现 42→40 现象的根本原因。

### 追加思路记录：事件状态字典 + once/on 条件触发（2025-11-28）
- 背景：用户希望在 MsgCenter 仅做“干净转发”的前提下，为 pdf-viewer 端的 WS 消息增加“带条件执行”的能力，例如：  
  - 在 pdf-viewer 打开并完成初始渲染（RENDER.READY）之后，再执行 outline 跳转或其它导航。  
- 约束：  
  - MsgCenter 只做转发，不理解 UI 事件；  
  - 条件判断逻辑应放在 pdf-viewer 这一端的 WebSocket 客户端上（ws-client / WebSocketAdapter），由前端自行决定“何时执行真正导航”。  
- 提议的机制：**事件状态字典 + waitForEventOnce / waitForNextEvent helper**  
  1. 由 pdf-viewer 维护一个统一的事件状态表，例如：  
     - `window.pdf_viewer_status.events[eventName] = { fired: boolean, count: number, lastPayload, lastAt }`；  
     - 每次通过 EventBus 观察到某个事件（如 `pdf-viewer:render:ready`）时，调用一个集中封装的 `markEventFired(name, payload)` 去更新字典：  
       - `fired = true`、`count += 1`、`lastPayload = payload`、`lastAt = Date.now()`。  
  2. 在 pdf-viewer WebSocket 客户端侧，扩展 WS 消息协议：  
     - 例如增加一个可选字段 `gate`：  
       - `gate: { once: "pdf-viewer:render:ready" }` 表示：若 READY 已经发生过则立即执行，否则等待**首次** READY 再执行一次；  
       - `gate: { on: "pdf-viewer:render:ready" }` 表示：无论之前 READY 是否发生过，都等待**下一次** READY 事件后执行。  
  3. 为避免“先读状态再订阅”带来的竞态，所有“等待某事件后执行”的逻辑必须集中封装，例如：  
     ```js
     function waitForEventOnce(eventName) {
       return new Promise((resolve) => {
         const off = eventBus.on(eventName, (payload) => {
           off();
           resolve(payload);
         });
         const status = window.pdf_viewer_status?.events?.[eventName];
         if (status?.fired) {
           off();
           resolve(status.lastPayload);
         }
       });
     }
     ```  
     - 先订阅，再检查 `status.fired`，可以保证：  
       - 如果事件在 helper 调用之前就已经发出，状态字典会显示 `fired=true`，helper 会同步 resolve；  
       - 如果事件在 helper 调用之后发出，则 listener 会捕获，不会“错过” READY。  
     - `waitForNextEvent(eventName)` 则只订阅，不看状态，用于语义上的 `on`。  
  4. 一次性/状态型事件的重置：  
     - 对 `RENDER.READY` 一类事件，每次新 PDF 加载（`FILE.LOAD.REQUESTED` 或 `FILE.LOAD.SUCCESS` 前）应重置对应的状态：  
       - `window.pdf_viewer_status.events[PDF_VIEWER_EVENTS.RENDER.READY] = { fired: false, count: 0, lastPayload: null, lastAt: null }`；  
     - 对生命周期长的状态（例如 client 注册成功）可在整个 viewer 生命周期内保持为 true。  
- 使用上的建议：  
  - “事件状态字典”可以对所有事件记录 fired/count/lastPayload，以便调试和统计；  
  - 但 `once` 的实际业务语义主要针对“状态型事件”（ready / registered / loaded），对高频动作型事件（例如 PAGE.CHANGING）通常只需要 `on`；  
  - 所有依赖 READY 才执行的逻辑（例如基于 WS 的 outline 跳转）应统一经由 helper，而不是到处手写 `if (status) { ... } else { on(...) }`。

---

### 本次分析结论（2025-11-29：pdf-viewer / pdf-home 重复功能与抽象方向）

> 目标：识别前端 pdf-viewer 与 pdf-home 中「功能相同但各自实现」的部分，以便后续抽象到 `src/frontend/common/**`，优先采用“组合优于继承”的模式。

1. 应用容器与 WSClient 生命周期管理：模式相同，具体实现各写一套  
   - pdf-viewer：`src/frontend/pdf-viewer/container/app-container.js`  
     - 提供 `createPDFViewerContainer({ wsUrl, enableValidation, logger })`，内部负责：  
       - 基于 `event-bus` 单例和 `WSClient` 创建基础设施；  
       - 管理 `connect/disconnect/reloadData/dispose/updateWebSocketUrl` 等生命周期；  
       - 通过 `setGlobalWebSocketClient` 暴露 WSClient；  
       - 内建与 ConsoleWebSocketBridge 的禁用逻辑，避免日志循环。  
   - pdf-home：`src/frontend/pdf-home/container/app-container.js`  
     - 提供 `createPDFHomeContainer({ root, wsUrl, logger, enableValidation })`，内部负责：  
       - 基于 `DependencyContainer` 注册 `logger/eventBus/wsClient` 等核心服务；  
       - 暴露 `connect/disconnect/reloadData/dispose/getDependencies/initialize/isInitialized`；  
       - 通过 `ensureUI/ensureEventBridges` 挂载 UI 管理器与业务事件桥接；  
       - 同样使用 `buildWsUrlFromQuery` 和共享的 `eventBusSingleton/WSClient`。  
   - 结论：两边在“容器 + WSClient 生命周期 + getDependencies/initialize”层面高度相似，只是：  
     - pdf-viewer 手写对象 + ConsoleBridge 管理；  
     - pdf-home 走通用 `DependencyContainer` 路线。  
   - 抽象方向（建议）：在 `src/frontend/common/containers/` 下强化 `app-container-base.js`：  
     - 提取“事件总线 + WSClient + initialize/connect/disconnect/updateWebSocketUrl”的公共骨架；  
     - 通过「选项 + 钩子」的组合方式让子模块注入：  
       - `resolveWsUrl()`（例如从 URL 参数解析 `msgCenter` 端口）；  
       - `registerGlobalServices(container)`（pdf-home 用 DI，pdf-viewer 用 setGlobalWebSocketClient）；  
       - `onConnected/afterConnected`（用于触发首轮 list 请求或其他初始化操作）。  
     - pdf-viewer / pdf-home 的具体容器只保留最小差异和 UI 相关逻辑。  

2. 基础设施 Feature：infra-app 模式在两个模块中重复实现  
   - pdf-viewer：`src/frontend/pdf-viewer/features/infra-app/index.js`（AppCoreFeature）  
     - 职责：  
       - 创建并初始化 `createPDFViewerContainer`；  
       - 通过 `setupWsInfra` 安装 `WebSocketAdapter` + `WebSocketAdapterViewer`；  
       - 将 `wsClient` 注册到根容器供其他 Feature 使用；  
       - 安装 `WebSocketErrorHandler` 做统一错误 toast。  
   - pdf-home：`src/frontend/pdf-home/features/infra-app/index.js`（PDFHomeInfraAppFeature）  
     - 职责：  
       - 通过 `setupWsInfra` 安装 `WebSocketAdapterHome`；  
       - 负责适配器的生命周期（install/uninstall 调用 WsInfra.dispose）。  
   - 结论：两边都实现了“基础设施 Feature（infra-app）+ WsInfra 安装适配器 + 统一错误处理”的模式，只是：  
     - pdf-viewer infra-app 额外负责创建容器和注册 wsClient；  
     - pdf-home infra-app 更轻，只管适配器安装。  
   - 抽象方向（建议）：在 `common/features/ws-infra/` 下增加一个“Feature 模板”工厂，例如 `createInfraAppFeature({ name, resolveContainer, adapterFactories, withErrorHandler })`：  
     - 内部统一处理 install/uninstall、WsInfra 安装/销毁、WebSocketErrorHandler 注册；  
     - 调用方只负责提供 `adapterFactories` 和容器获取方式；  
     - pdf-viewer / pdf-home 分别通过该工厂创建自己的 infra-app，实现“同一模式、不同组合配置”。  

3. 模块专属 WebSocketAdapter：注册身份逻辑已统一到基类，但业务处理仍分散  
   - pdf-viewer：`WebSocketAdapterViewer`（`src/frontend/pdf-viewer/adapters/websocket-adapter-viewer.js`）  
     - 继承 `WebSocketAdapterBase`，主要负责：  
       - 从 URL 解析 `pdf-id`；  
       - 生成 `client_id = pdf-viewer-{pdf-id or viewerInstanceId}`；  
       - 填充 `client_type` / `capabilities` / `metadata`（包含迁移标记与调试字段）。  
   - pdf-home：`WebSocketAdapterHome`（`src/frontend/pdf-home/adapters/websocket-adapter-home.js`）  
     - 同样继承基类，负责：  
       - 固定 `client_id = pdf-home`；  
       - `client_type = [\"window:pdf-home\",\"singleton\"]`；  
       - 填充 library-management/search/file-operations 能力与 window_type 元数据。  
   - 结论：  
     - “模块专属适配器 + 继承 WebSocketAdapterBase + 提供 _getRegistrationConfig” 已经是共享模式；  
     - 当前无需再抽象，只需要在新增模块时继续沿用这一模式（组合点已经落在 WsInfra Feature 上）。  
   - 抽象方向（偏规范）：在 tech/SPEC 中明确：  
     - 所有前端窗口（pdf-home/pdf-viewer/将来新模块）都应通过“专属 Adapter + WebSocketAdapterBase + WsInfra”组合实现注册，不再直接在容器或业务代码中手写 `client_id`/`client_type`。  

4. WS 消息 → 领域事件映射：pdf-home 已集中到 common，pdf-viewer 仍在模块内适配器  
   - pdf-home：  
     - `src/frontend/common/pdf/websocket-handler.js` 提供统一的 WS → 领域事件桥接（例：record-update:completed/failed → `PDF_MANAGEMENT_EVENTS.EDIT.*`）；  
     - pdf-home Feature（如 `features/pdf-edit/index.js`）只关心 `PDF_MANAGEMENT_EVENTS.EDIT.COMPLETED/FAILED`，不再直接处理裸 WS 消息。  
   - pdf-viewer：  
     - `src/frontend/pdf-viewer/adapters/websocket-adapter.js`：  
       - 在同一个类中处理 outline/anchor/navigation/resume 等多个域；  
       - 直接订阅 `WEBSOCKET_EVENTS.MESSAGE.RECEIVED`，根据 `WEBSOCKET_MESSAGE_TYPES.*` 发射 `PDF_VIEWER_EVENTS.*`；  
       - 在适配器层承担了较多业务路由和诊断日志职责。  
   - 结论：职责相同（协议→领域事件），落点不同（pdf-home 已抽象在 common，pdf-viewer 仍在模块内），这属于“可以进一步抽象”的重复模式。  
   - 抽象方向（建议）：  
     - 在 `src/frontend/common/pdf/` 下进一步引入“viewer 侧 WS handler 模板”，例如：  
       - `viewer-websocket-outline-handler.js`、`viewer-websocket-anchor-handler.js`，内部只关心：  
         - 各自域的 WEBSOCKET_MESSAGE_TYPES 与 PDF_VIEWER_EVENTS 映射；  
         - 与 gate-runner（`common/ws/ws-gate-runner.js`）和 ws-gate-utils 的协同；  
       - WebSocketAdapter 只负责：  
         - 订阅 WS 消息并按“域”分发给这些 handler；  
         - 做少量跨域调度与队列管理。  
     - 这样 pdf-viewer 也能与 pdf-home 一样，通过 common handler 复用样板逻辑，降低适配器文件体积与重复代码。  

5. Feature Registry + 事件驱动架构：两侧已经共享相同基础设施  
   - pdf-home：`core/pdf-home-app-v2.js` 使用 `createAppContainer` + `createFeatureRegistry` + `StateManager` + `FeatureFlagManager` 组合，注册 `PDFHomeInfraAppFeature`、搜索/筛选/侧边栏/编辑等多个 Feature。  
   - pdf-viewer：`bootstrap/app-bootstrap-feature.js` + `features/README.md` 同样通过 `createAppContainer` + `createFeatureRegistry` 组织 Feature，注册 `AppCoreFeature`、PDFManagerFeature、Outline/Annotation/Resume/WindowControls 等。  
   - 结论：在架构模式层面已统一到 common micro-service 体系，此处不需要再做抽象。  

6. 抽象策略小结：组合优于继承  
   - 优先级高的抽象点：  
     1) 容器层骨架：在 `common/containers` 强化基类/工厂，通过 options + hook 组合出 pdf-viewer/pdf-home 的差异；  
     2) infra-app Feature 工厂：在 `common/features/ws-infra` 提供创建 infra-app Feature 的工厂方法，子模块只提供 adapterFactories / 容器 getter；  
     3) WS→领域事件 handler 拆分到 common：把 pdf-viewer 适配器里按业务域拆开的映射逻辑迁移到 `common/pdf/**` 的独立 handler 中。  
   - 继承仅保留在：  
     - WebSocketAdapterBase → WebSocketAdapterHome / WebSocketAdapterViewer 这一层，用来实现“模块身份”的自定义注册。  
   - 这样可以在不打破现有 Feature 架构与测试的前提下，逐步减少 pdf-viewer / pdf-home 内部“看起来相似、实则各写一份”的基础设施代码。  

### 2025-11-30 WS 条件消息（gate）类型与实现现状盘点

> 目标：整理当前“带 gate 条件的 WS 消息类型”在前端代码中的实际使用情况，明确哪些消息已经接入 gate.once/on/timeout_ms 语义，哪些仍停留在规范文档层面，方便后续扩大 gate 应用范围时参考。

- 公共工具层（common/ws）
  - `src/frontend/common/ws/ws-gate-utils.js`：提供 `validateGateConfig(rawGate)`，统一校验与规范化 WS 消息上的 `gate` 字段，支持：
    - `gate.once: string`：等待某“状态型事件”已发生或下一次发生（常用于 pdf-viewer:render:ready 这类 READY 事件）；
    - `gate.on: string`：等待某动作型事件的下一次发生（不关心历史）；
    - `gate.timeout_ms?: number`：可选超时（毫秒，正整数）；非法配置一律抛错（Fail-Fast），禁止兜底。
  - `src/frontend/common/ws/ws-gate-runner.js`：基于 EventBus 与内存状态字典实现 gate 执行逻辑：
    - `createEventStatusStore()`：创建 `{ events: { [eventName]: { fired,count,lastPayload,lastAt } } }` 结构，用于记录 READY 类事件的触发历史；
    - `markEventFired(store, eventName, payload)`：在状态型事件发生时更新 store；
    - `runWithGate({ eventBus, store, rawGate, run })`：统一解释 `gate.once/gate.on/timeout_ms`，在条件满足后执行 `run(payload)`，未配置 gate 时直接执行 run。
  - 对 gate 工具有独立单元测试：`src/frontend/common/ws/__tests__/ws-gate-utils.test.js` 验证各种合法/非法 gate 结构；ws-gate-runner 的行为在 pdf-viewer 端测试中覆盖（见下文）。

- pdf-viewer 端：当前唯一实际应用 gate 的消息类型
  - 适配器：`src/frontend/pdf-viewer/adapters/websocket-adapter.js`
    - 在处理 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED` 时，使用 `runWithGate` 包裹导航逻辑：
      - 入口：`case WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED: { ... runWithGate({ eventBus, store: this.#eventStatusStore, rawGate: message?.gate, run: async () => this.#handleViewerNavigate(message, correlationId) }) ... }`；
      - 若 gate 执行抛错（包括 timeout）则发送 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED`，错误码为 `"GATE_FAILED"`，并记录日志 `"[Navigate] gate execution failed"`。
    - 为 gate 提供状态事件观测入口：`#setupGateStatusObservers()` 中订阅 `PDF_VIEWER_EVENTS.RENDER.READY`：
      - 每次 READY 触发时调用 `markEventFired(this.#eventStatusStore, PDF_VIEWER_EVENTS.RENDER.READY, payload)`，这样 `gate.once: PDF_VIEWER_EVENTS.RENDER.READY` 能够利用历史事件立即执行或等待下一次 READY。
  - 单元测试：
    - `src/frontend/pdf-viewer/adapters/__tests__/event-gate-runner.test.js`：直接针对 runWithGate 语义做测试（once 有历史 & 无历史、on 仅下一次触发、timeout 超时抛错等），验证公共 gate-runner 行为；
    - `src/frontend/pdf-viewer/adapters/__tests__/websocket-adapter.navigate-gate.test.js`：从适配器层验证 `VIEWER_NAVIGATE_REQUESTED` 携带/不携带 gate 时的行为：
      - 无 gate：立即执行导航，不等待 READY；
      - `gate.once: PDF_VIEWER_EVENTS.RENDER.READY`：在 READY 之前发来的请求会挂起，直到 READY 事件触发后才执行导航；
      - 携带超时时间且迟迟未 READY：触发 `VIEWER_NAVIGATE_FAILED`，error.code 为 `"GATE_FAILED"`。
  - 规范文档：
    - `src/frontend/pdf-viewer/docs/SPEC/PDF-VIEWER-WEBSOCKET-CONTRACT-001.md` 中已经将 `gate` 字段作为 pdf-viewer WS 消息的通用条件执行约定，并给出示例：
      - 例如 `{"type":"pdf-viewer:navigate:requested", "data":{...}, "gate":{"once":"pdf-viewer:render:ready","timeout_ms":2500}}`。
    - 文档建议所有需要“等待渲染完成再执行”的 WS 请求统一使用该格式。

- pdf-home 端：目前仅在规范层面定义 gate，尚未有实际代码接入
  - 文档：`src/frontend/pdf-home/docs/SPEC/PDFHOME-WEBSOCKET-INTEGRATION-001.md` 复用了与 pdf-viewer 相同的 gate 约定：
    - 同样说明 `gate.once/on/timeout_ms`，并给出发向 pdf-viewer 的导航请求示例；
    - 要求 pdf-home 在发起“受前端状态约束”的 WS 请求（例如需要确认目标 viewer 已 render:ready）时使用统一 gate 格式。
  - 代码现状：截至本次扫描，pdf-home 的前端实现中尚未发现对 `gate` 字段或 `runWithGate` 的实际调用，说明：
    - pdf-home 目前仍将 gate 视为“对 pdf-viewer 的调用契约”，自身并未发出带 gate 的条件 WS 请求；
    - 一旦后续需要由 pdf-home 主动发起需要等待 viewer READY 的请求，可以直接复用 common/ws 层的 gate 工具。

- 其他模块与消息类型
  - 除 `WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED` 外，当前前端代码中没有其他 WS 消息类型实际携带 `gate` 字段参与条件执行；
  - Anchor/Outline/Resume 等业务场景虽然在规范和测试中与导航行为相关，但并未单独定义新的“条件消息类型”，而是依附于导航请求本身：
    - 例如 Outline 导航最终也通过 viewer 端 `VIEWER_NAVIGATE_REQUESTED` 消息触发实际页面跳转，因此其条件执行能力由导航消息的 gate 实现承担；
    - Resume 写入/应用目前仍走各自既有链路，未启用 gate。

- 总结（当前阶段性结论）
  - 公共 gate 工具（validateGateConfig + runWithGate + 事件状态存储）已经抽象到 `common/ws`，并通过单元测试验证；
  - **实际落地的“带 gate 条件的 WS 消息类型”目前只有一个：`WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED`**，由 pdf-viewer WebSocketAdapter 在 inbound 处理时应用 gate：
    - 支持 once/on/timeout_ms；
    - READY 事件通过 `PDF_VIEWER_EVENTS.RENDER.READY` 统一观测；
    - 失败场景统一回 `VIEWER_NAVIGATE_FAILED`，error.code = "GATE_FAILED"。
  - pdf-home 端目前仅在规范中声明 gate 协议，尚未在具体代码中发出带 gate 的 WS 请求；未来如需要，可以直接依赖 `common/ws/ws-gate-utils.js` 与 `ws-gate-runner.js`，避免重复造轮子。

## 2025-12-01：前端结构图分析任务记录

- 已基于 src/frontend 目录结构与 ARCHITECTURE-EXPLAINED.md 生成《前端结构图与架构说明》（AItemp/reports/frontend-architecture-20251201120842.md），总结 common/pdf-home/pdf-viewer 的分层与模块关系，供后续重构和答复用户使用。

## 2025-12-01：后端架构 Mermaid 图记录

- 已在 AItemp/reports/backend-architecture-20251201131315.md 中补充后端整体结构 Mermaid 图（launcher/launcher_core/msgCenter_server/pdfFile_server/api/database/pdf_manager/logging/linters 关系），可与前端结构图报告配套使用。

## 2025-12-01：维护清理指南文档

- 已新增 docs/MAINTENANCE-CLEANUP-GUIDE.md，用于规范“过时代码清理”和“过时文档清理”的流程（识别依据、小步清理步骤、归档与 Memory Bank 记录方式、自检清单），后续涉及重构/归档时应优先参考该文档。

## 2025-12-01：清理过时文档目录 docs/TODO

- 初步检查 docs 下文档后，确认 docs/TODO 目录为空且在仓库中无任何引用，同时实际任务管理流程已统一使用根目录 todo-and-doing/，故将 docs/TODO 视为过时目录并直接删除；后续如需查看任务规划，请以 todo-and-doing 为准。

## 2025-12-01：文档与代码实现对齐（首轮）

- 使用 AItemp/attempts/doc_scan_paths.py 扫描 docs/**.md 中的 src/tests 路径，对比当前代码，标记出若干仅存在于旧版 pdf-home v1 或早期集成方案中的路径；对相关索引与规范文档（如 docs/index/frontend/modules/*、WEBSOCKET-INTEGRATION、部分 SPEC/TESTING 文档）增加“历史/规划性说明”，以免读者误以为这些路径仍然存在或已经落地实现。
